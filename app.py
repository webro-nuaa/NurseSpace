from flask import Flask, jsonify, request, redirect, url_for
from flask_login import LoginManager

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

    # 确保必要目录存在
    Config.ensure_directories()

    from models import db, User
    db.init_app(app)
    migrate.init_app(app, db)

    login_manager.init_app(app)
    jwt.init_app(app)
    csrf.init_app(app)
    CORS(app, supports_credentials=True, origins=Config.CORS_ORIGINS.split(',') if Config.CORS_ORIGINS != '*' else '*')

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
        app.config['RATELIMIT_STORAGE_URL'] = Config.RATELIMIT_STORAGE_URL
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
        if request.accept_mimetypes.accept_json and \
           not request.accept_mimetypes.accept_html:
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

    # 注册蓝图
    from routes.auth import auth_bp
    from routes.nurse import nurse_bp
    from routes.admin import admin_bp
    from routes.api import api_bp

    # 豁免 CSRF 的蓝图 — 全部使用 JWT Bearer 认证，天然免疫 CSRF
    csrf.exempt(auth_bp)
    csrf.exempt(nurse_bp)
    csrf.exempt(admin_bp)
    csrf.exempt(api_bp)

    app.register_blueprint(auth_bp, url_prefix='/auth')
    app.register_blueprint(nurse_bp, url_prefix='/nurse')
    app.register_blueprint(admin_bp, url_prefix='/admin')
    app.register_blueprint(api_bp, url_prefix='/api')

    from routes.main import main_bp
    app.register_blueprint(main_bp)

    # 上传文件服务（视频等）
    from flask import send_from_directory
    import os as _os
    @app.route('/uploads/<path:filename>')
    def serve_upload(filename):
        upload_dir = app.config.get('UPLOAD_DIR', _os.path.join(app.root_path, 'uploads'))
        return send_from_directory(upload_dir, filename)

    return app


if __name__ == '__main__':
    app = create_app()
    with app.app_context():
        from models import db
        db.create_all()
    app.run(debug=os.environ.get('FLASK_DEBUG', '0') == '1', host='0.0.0.0', port=5000)
