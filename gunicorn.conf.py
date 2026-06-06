import os

bind = "0.0.0.0:8000"
workers = int(os.environ.get("GUNICORN_WORKERS", 4))
threads = int(os.environ.get("GUNICORN_THREADS", 10))
worker_class = "gthread"
worker_connections = 1000
timeout = int(os.environ.get("GUNICORN_TIMEOUT", 120))
keepalive = 5
graceful_timeout = 30
max_requests = 2000
max_requests_jitter = 100
preload_app = True

# 日志：accesslog 输出到 stdout 供 Docker 采集，errorlog 保留文件
# 生产环境可设 LOG_FORMAT=json 启用结构化日志
accesslog = "-"
errorlog = os.environ.get("GUNICORN_ERROR_LOG", "/app/logs/error.log")
loglevel = os.environ.get("LOG_LEVEL", "info")

_log_format = os.environ.get("LOG_FORMAT", "")
if _log_format == "json":
    access_log_format = '{"request_id":"%({x-request-id}i)s","remote_addr":"%(h)s","method":"%(m)s","path":"%(U)s","query":"%(q)s","status":"%(s)s","body_bytes":%(b)s,"user_agent":"%(a)s","referer":"%(f)s","duration_us":%(D)s}'
else:
    access_log_format = '%(h)s %(l)s %(u)s %(t)s "%(r)s" %(s)s %(b)s "%(f)s" "%(a)s" %(D)s'


def post_fork(server, worker):
    from app import create_app
    from models import db
    app = create_app()
    with app.app_context():
        db.engine.dispose()
