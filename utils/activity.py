"""用户活跃度追踪。

业界标准做法（对齐 django-last-seen / Moodle Last access）：
- before_request 钩子对已认证用户节流更新 last_seen_at（默认 5 分钟内跳过）
- "在线"为派生状态：last_seen_at 在窗口内（查询侧判定，见 /admin/statistics/activity）
- 任何异常静默吞掉：统计功能绝不能影响业务请求
- 节流状态存各 worker 进程内存（数百用户规模下 4 worker 最多 4 倍写入，可忽略），
  不依赖 Redis，避免缓存故障放大数据库写压力
"""
import logging
import time

from flask import current_app

logger = logging.getLogger(__name__)

SEEN_THROTTLE_SECONDS = 300

# {user_id: monotonic 时间戳}，进程内节流表；仅活跃用户持有条目，量级很小
_last_write: dict = {}


def _resolve_user_id():
    """混合认证下解析当前用户 id：Session（Flask-Login）优先，其次 JWT。"""
    from flask_login import current_user
    if current_user.is_authenticated:
        return current_user.id
    try:
        from flask_jwt_extended import get_jwt_identity
        identity = get_jwt_identity()
        return int(identity) if identity else None
    except Exception:
        return None


def _throttled(user_id) -> bool:
    now = time.monotonic()
    last = _last_write.get(user_id)
    if last is not None and now - last < SEEN_THROTTLE_SECONDS:
        return True
    _last_write[user_id] = now
    return False


def _touch_last_seen(user_id) -> None:
    from models import db, _utcnow
    from sqlalchemy import text
    db.session.execute(
        text("UPDATE users SET last_seen_at = :ts WHERE id = :uid"),
        {"ts": _utcnow(), "uid": user_id},
    )
    db.session.commit()


def init_activity_tracking(app) -> None:
    @app.before_request
    def _track_last_seen():
        try:
            user_id = _resolve_user_id()
            if not user_id or _throttled(user_id):
                return
            _touch_last_seen(user_id)
        except Exception:
            logger.debug("last_seen 更新失败（已忽略）", exc_info=True)
            try:
                from models import db
                db.session.rollback()
            except Exception:
                pass
