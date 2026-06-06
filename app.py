import os
from flask import Flask, jsonify, request, redirect, url_for
from flask_login import LoginManager
from werkzeug.middleware.proxy_fix import ProxyFix

# PyJWT 2.8.x compatibility shim — zhipuai pins PyJWT<2.9 but flask-jwt-extended
# expects jwt.types.Options (added in PyJWT 2.10+).  Provide a stub.
import jwt.types as _jwt_types
if not hasattr(_jwt_types, 'Options'):
    from typing import TypedDict, Optional, List as _List
    class _Options(TypedDict, total=False):
        verify_signature: bool
        verify_exp: bool
        verify_iat: bool
        verify_aud: bool
        verify_iss: bool
        require: Optional[_List[str]]
    _jwt_types.Options = _Options

from flask_jwt_extended import JWTManager
from flask_cors import CORS
from flask_wtf.csrf import CSRFProtect
from flask_caching import Cache
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from flask_migrate import Migrate
from config import Config
import logging

login_manager = LoginManager()
jwt = JWTManager()
csrf = CSRFProtect()
cache = Cache()
limiter = Limiter(key_func=get_remote_address)
migrate = Migrate()


def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)

    # JSON 不应转义中文（提高可读性、减少带宽）
    app.json.ensure_ascii = False

    # 请求追踪 ID — 每个请求自动分配，响应头返回 X-Request-Id
    from utils.logging import init_request_id
    init_request_id(app)

    # 信任 Nginx 反向代理的 X-Forwarded-* 头（HTTPS 终止）
    app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1, x_host=1)

    # 确保必要目录存在
    Config.ensure_directories()

    from models import db, User
    db.init_app(app)
    migrate.init_app(app, db)

    # ---- 依赖注入：统一管理共享实例 ----
    from utils.ai_evaluator import AIEvaluator
    app.extensions['ai_evaluator'] = AIEvaluator()

    from services.knowledge import KnowledgeService
    app.extensions['knowledge_service'] = KnowledgeService()

    login_manager.init_app(app)
    jwt.init_app(app)
    csrf.init_app(app)
    cors_origins = Config.CORS_ORIGINS.split(',') if Config.CORS_ORIGINS else []
    if '*' in cors_origins and Config.CORS_SUPPORTS_CREDENTIALS:
        app.logger.warning("CORS_ORIGINS='*' cannot be used with credentialed requests; disabling CORS credentials")
        cors_supports_credentials = False
    else:
        cors_supports_credentials = Config.CORS_SUPPORTS_CREDENTIALS
    CORS(app, supports_credentials=cors_supports_credentials, origins=cors_origins or [])

    # Cache
    if Config.REDIS_ENABLED:
        app.config['CACHE_TYPE'] = 'RedisCache'
        app.config['CACHE_REDIS_URL'] = Config.REDIS_URL
        app.config['CACHE_DEFAULT_TIMEOUT'] = 300
    else:
        app.config['CACHE_TYPE'] = 'SimpleCache'
        app.config['CACHE_DEFAULT_TIMEOUT'] = 60
    cache.init_app(app)

    # Rate limiter
    if Config.RATELIMIT_ENABLED:
        app.config['RATELIMIT_STORAGE_URI'] = Config.RATELIMIT_STORAGE_URL
        app.config['RATELIMIT_STRATEGY'] = 'fixed-window'
    else:
        app.config['RATELIMIT_ENABLED'] = False
    limiter.init_app(app)

    login_manager.login_view = 'auth.login'
    login_manager.login_message = '请先登录系统'
    login_manager.login_message_category = 'info'

    @login_manager.user_loader
    def load_user(user_id):
        return db.session.get(User, int(user_id))

    @login_manager.unauthorized_handler
    def unauthorized():
        is_api = (
            request.headers.get('X-Requested-With') == 'XMLHttpRequest'
            or (request.accept_mimetypes.accept_json
                and not request.accept_mimetypes.accept_html)
        )
        if is_api:
            return jsonify({'success': False, 'message': '请先登录'}), 401
        return redirect(url_for('auth.login'))

    # ---- 全局错误处理 ----
    @app.errorhandler(400)
    def bad_request(e):
        return jsonify({'success': False, 'message': '请求参数有误'}), 400

    @app.errorhandler(404)
    def not_found(e):
        return jsonify({'success': False, 'message': '资源不存在'}), 404

    @app.errorhandler(405)
    def method_not_allowed(e):
        return jsonify({'success': False, 'message': '请求方法不允许'}), 405

    @app.errorhandler(500)
    def internal_error(e):
        try:
            db.session.rollback()
        except Exception:
            pass
        logging.getLogger(__name__).exception("Internal server error")
        return jsonify({'success': False, 'message': '服务器内部错误'}), 500

    @app.after_request
    def add_cache_headers(response):
        """HTML 页面添加 no-cache 头，防止浏览器缓存旧版页面导致加载旧 JS/CSS。
        JSON 接口不添加，让客户端自行控制缓存策略。"""
        if response.content_type and 'text/html' in response.content_type:
            response.headers['Cache-Control'] = 'no-cache, must-revalidate'
            response.headers['Pragma'] = 'no-cache'  # HTTP/1.0 兼容
        return response

    # 注册蓝图
    from routes.auth import auth_bp
    from routes.nurse import nurse_bp
    from routes.admin import admin_bp
    from routes.api import api_bp

    # api_bp: public/JWT API endpoints do not rely on the browser session cookie.
    # Browser-backed auth/admin/nurse routes keep CSRF protection enabled.
    csrf.exempt(api_bp)

    app.register_blueprint(auth_bp, url_prefix='/auth')
    app.register_blueprint(nurse_bp, url_prefix='/nurse')
    app.register_blueprint(admin_bp, url_prefix='/admin')
    app.register_blueprint(api_bp, url_prefix='/api')

    from routes.main import main_bp
    app.register_blueprint(main_bp)

    # 上传文件服务（视频等）
    from flask import send_from_directory
    @app.route('/uploads/<path:filename>')
    def serve_upload(filename):
        upload_dir = app.config.get('UPLOAD_DIR', os.path.join(app.root_path, 'uploads'))
        return send_from_directory(upload_dir, filename)

    return app


if __name__ == '__main__':
    app = create_app()
    with app.app_context():
        from models import db
        db.create_all()
    app.run(debug=os.environ.get('FLASK_DEBUG', '0') == '1', host='0.0.0.0', port=5000)
