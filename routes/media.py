"""媒体资源鉴权。

nginx 对 /uploads/ 静态资源启用 auth_request（见 nginx/nginx.conf.template），
每个资源请求前先向本蓝图发起子请求，按 auth_request 契约返回：

- 2xx  → 放行静态文件
- 401/403 → 拒绝（nginx 回传给客户端）
- 其他（如 302）→ nginx 视为配置错误返回 500

因此本端点采用与 login_or_jwt_required 相同的认证语义
（Session 回退 + JWT 优先 + token_version 校验），
但认证失败时显式返回 401，不走页面分支的 302。
"""
from flask import Blueprint, jsonify, request

media_bp = Blueprint('media', __name__)


@media_bp.route('/auth', methods=['GET'])
def auth_check():
    """nginx auth_request 鉴权子请求端点：已登录 200，未登录 401。"""
    # Session 通道（浏览器同源请求自动携带 Cookie）
    from flask_login import current_user
    if current_user.is_authenticated:
        return jsonify({'success': True})

    # JWT 通道（API 客户端带 Authorization: Bearer）
    from flask_jwt_extended import verify_jwt_in_request, get_jwt_identity, get_jwt
    from models import User, db
    try:
        verify_jwt_in_request(optional=True)
        user_id = get_jwt_identity()
        claims = get_jwt()
    except Exception:
        user_id, claims = None, {}

    user = None
    if user_id:
        try:
            uid = int(user_id)
        except (TypeError, ValueError):
            uid = None
        if uid:
            candidate = db.session.get(User, uid)
            # 账号启用 + token_version 一致（改密后旧 token 失效）才放行
            if (candidate and candidate.is_active()
                    and claims.get('v', 0) == (candidate.token_version or 0)):
                user = candidate

    if user:
        return jsonify({'success': True})
    return jsonify({'success': False, 'message': '请先登录'}), 401
