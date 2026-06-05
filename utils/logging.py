"""
可观测性工具 — 请求追踪 ID + JSON 结构化日志

用法（app.py 中）:
    from utils.logging import init_request_id, JsonFormatter
    init_request_id(app)
"""

import uuid
import logging
import json
from datetime import datetime, timezone
from flask import request, g, has_request_context


# ---- 请求 ID ----

_REQUEST_ID_HEADER = 'X-Request-Id'


def init_request_id(app):
    """注册 before_request / after_request 钩子，注入请求追踪 ID。

    优先级：
    1. 客户端传入的 X-Request-Id 头（便于跨服务追踪）
    2. 自动生成 16 字符 UUID 短码
    """

    @app.before_request
    def _assign_request_id():
        req_id = request.headers.get(_REQUEST_ID_HEADER)
        if not req_id:
            req_id = uuid.uuid4().hex[:16]
        g.request_id = req_id

    @app.after_request
    def _set_request_id_header(response):
        req_id = g.get('request_id')
        if req_id:
            response.headers[_REQUEST_ID_HEADER] = req_id
        return response


def get_request_id() -> str:
    """获取当前请求的追踪 ID（可在任意视图/服务中调用）"""
    if has_request_context():
        return g.get('request_id', '-')
    return '-'


# ---- JSON 结构化日志 ----

class JsonFormatter(logging.Formatter):
    """将日志格式化为一行 JSON，便于 ELK / Loki / Cloud Logging 采集。

    在 gunicorn.conf.py 中配置：
        logconfig_dict = {
            'formatters': {'json': {'()': 'utils.logging.JsonFormatter'}},
            'handlers': {'console': {'class': 'logging.StreamHandler', 'formatter': 'json'}},
            'root': {'handlers': ['console'], 'level': 'INFO'},
        }
    """

    def format(self, record: logging.LogRecord) -> str:
        log_entry = {
            'timestamp': datetime.now(timezone.utc).isoformat(),
            'level': record.levelname,
            'logger': record.name,
            'message': record.getMessage(),
            'request_id': get_request_id(),
        }
        if record.exc_info and record.exc_info[1]:
            log_entry['exception'] = self.formatException(record.exc_info)
        return json.dumps(log_entry, ensure_ascii=False, default=str)
