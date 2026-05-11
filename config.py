import os
from dotenv import load_dotenv

load_dotenv()


def _require_env(key):
    value = os.environ.get(key)
    if not value:
        raise RuntimeError(f"环境变量 {key} 未设置，生产环境必须配置")
    return value


class Config:
    VERSION = '3.0.0'

    SECRET_KEY = _require_env('SECRET_KEY')

    # MySQL
    MYSQL_USER = os.environ.get('MYSQL_USER', 'root')
    MYSQL_PASSWORD = _require_env('MYSQL_PASSWORD')
    MYSQL_HOST = os.environ.get('MYSQL_HOST', 'localhost')
    MYSQL_PORT = int(os.environ.get('MYSQL_PORT', 3306))
    MYSQL_DATABASE = os.environ.get('MYSQL_DATABASE', 'nurse_training_system')

    SQLALCHEMY_DATABASE_URI = os.environ.get(
        'SQLALCHEMY_DATABASE_URI',
        f'mysql+pymysql://{MYSQL_USER}:{MYSQL_PASSWORD}'
        f'@{MYSQL_HOST}:{MYSQL_PORT}/{MYSQL_DATABASE}?charset=utf8mb4'
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_POOL_SIZE = int(os.environ.get('DB_POOL_SIZE', 20))
    SQLALCHEMY_POOL_RECYCLE = int(os.environ.get('DB_POOL_RECYCLE', 1800))
    SQLALCHEMY_POOL_PRE_PING = True
    SQLALCHEMY_MAX_OVERFLOW = int(os.environ.get('DB_MAX_OVERFLOW', 10))

    # JWT
    JWT_SECRET_KEY = _require_env('JWT_SECRET_KEY')
    JWT_ACCESS_TOKEN_EXPIRES = int(os.environ.get('JWT_ACCESS_TOKEN_EXPIRES', 3600))

    # AI
    OPENAI_API_KEY = os.environ.get('OPENAI_API_KEY')
    OPENAI_MODEL = os.environ.get('OPENAI_MODEL', 'gpt-4o-mini')

    ZHIPU_API_KEY = os.environ.get('ZHIPU_API_KEY')
    ZHIPU_MODEL = os.environ.get('ZHIPU_MODEL', 'glm-4-air')

    # Baidu ASR (语音识别，国内免费额度 5万次/天)
    BAIDU_ASR_APP_ID = os.environ.get('BAIDU_ASR_APP_ID')
    BAIDU_ASR_API_KEY = os.environ.get('BAIDU_ASR_API_KEY')
    BAIDU_ASR_SECRET_KEY = os.environ.get('BAIDU_ASR_SECRET_KEY')

    # Redis
    _redis_password = os.environ.get('REDIS_PASSWORD', '')
    _redis_auth = f":{_redis_password}@" if _redis_password else ""
    _redis_base = f"redis://{_redis_auth}redis:6379"
    REDIS_URL = os.environ.get('REDIS_URL', f'{_redis_base}/0')
    REDIS_ENABLED = os.environ.get('REDIS_ENABLED', '1') == '1'

    # Rate limit
    RATELIMIT_ENABLED = os.environ.get('RATELIMIT_ENABLED', '1') == '1'
    RATELIMIT_STORAGE_URL = os.environ.get('RATELIMIT_STORAGE_URL', f'{_redis_base}/1')

    # File upload
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))
    UPLOAD_DIR = os.environ.get('UPLOAD_DIR', os.path.join(BASE_DIR, 'uploads'))
    MAX_CONTENT_LENGTH = 128 * 1024 * 1024
    CASES_DIR = os.environ.get('CASES_DIR', os.path.join(BASE_DIR, '案例'))

    # Encryption (用于加密 DB 中存储的 API Key)
    ENCRYPTION_KEY = _require_env('ENCRYPTION_KEY')

    # 站点外部 URL（用于生成二维码等外部链接，不配置则自动探测）
    SITE_URL = os.environ.get('SITE_URL', '').rstrip('/')

    # CORS
    CORS_ORIGINS = os.environ.get('CORS_ORIGINS', '*')

    # Session security
    SESSION_COOKIE_SECURE = os.environ.get('SESSION_COOKIE_SECURE', '1') == '1'
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = 'Lax'

    # Redis password (if set)
    REDIS_PASSWORD = os.environ.get('REDIS_PASSWORD', '')

    @staticmethod
    def ensure_directories():
        """确保必要的目录存在，在 app 初始化后调用"""
        os.makedirs(Config.UPLOAD_DIR, exist_ok=True)
        os.makedirs(os.path.join(Config.BASE_DIR, 'logs'), exist_ok=True)
        os.makedirs(Config.CASES_DIR, exist_ok=True)
