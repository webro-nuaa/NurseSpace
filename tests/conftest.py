"""pytest fixtures for NurseSpace test suite.

集成测试策略：唯一测试后端是 MySQL（与生产一致），每个用例拥有独立空库
`nurse_training_test`（DROP/CREATE DATABASE 重建，开销极小），完整覆盖
外键 RESTRICT/CASCADE、ENUM 严格性、utf8mb4 字符集等 SQLite 无法验证的行为。

必须通过容器运行（测试进程需访问 db 服务上的 MySQL）：
    bash scripts/run_integration_tests.sh
"""
import os
import sys
import pytest

# Ensure project root is on path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Set test environment variables before any imports
os.environ.setdefault('SECRET_KEY', 'test-secret-key-for-testing-only')
os.environ.setdefault('JWT_SECRET_KEY', 'test-jwt-secret-for-testing-only-32-bytes-min')
os.environ.setdefault('ENCRYPTION_KEY', 'd0EMMLL-wOGkN5Az6IQvXd16BSbE6Fx8EDZT4xcifg4=')
os.environ.setdefault('MYSQL_PASSWORD', 'test')
os.environ.setdefault('MYSQL_HOST', 'db')
os.environ.setdefault('REDIS_ENABLED', '0')
os.environ.setdefault('RATELIMIT_ENABLED', '0')
os.environ.setdefault('CORS_ORIGINS', '*')

TEST_MYSQL_DB = os.environ.get('TEST_MYSQL_DB', 'nurse_training_test')


def _mysql_uri():
    """测试专用 MySQL 连接串（nursespace_app 已被授予测试库的 ALL 权限）。"""
    user = os.environ.get('TEST_MYSQL_USER', 'nursespace_app')
    password = os.environ.get('TEST_MYSQL_PASSWORD',
                              os.environ.get('MYSQL_PASSWORD', 'test'))
    host = os.environ.get('TEST_MYSQL_HOST', 'db')
    return (f"mysql+pymysql://{user}:{password}@{host}/{TEST_MYSQL_DB}"
            f"?charset=utf8mb4")


def _recreate_mysql_db():
    """删除并重建测试数据库，保证每个用例拿到干净的空库。

    lock_wait_timeout=10：若残留连接持有元数据锁，快速失败而非无限挂起。
    """
    from sqlalchemy import create_engine, text
    uri = _mysql_uri()
    server_uri = uri.rsplit('/', 1)[0] + '/'
    admin_engine = create_engine(server_uri, pool_pre_ping=True)
    with admin_engine.connect() as conn:
        conn.execute(text("SET SESSION lock_wait_timeout = 10"))
        conn.execute(text(f"DROP DATABASE IF EXISTS {TEST_MYSQL_DB}"))
        conn.execute(text(
            f"CREATE DATABASE {TEST_MYSQL_DB} CHARACTER SET utf8mb4 "
            f"COLLATE utf8mb4_unicode_ci"))
    admin_engine.dispose()
    return uri


# 安全关键：必须在 import app 之前把连接串指向测试库。
# Flask-SQLAlchemy 在 create_app 时就绑定引擎，事后改 config 无效——
# 否则所有测试（包括 drop_all）都会打到生产库。
_recreate_mysql_db()
os.environ['SQLALCHEMY_DATABASE_URI'] = _mysql_uri()

from app import create_app


@pytest.fixture(scope='function')
def app():
    """Per-test Flask app with a clean MySQL database (per-test isolation)."""
    _app = create_app()
    _app.config.update({
        'TESTING': True,
        'WTF_CSRF_ENABLED': False,
        'SECRET_KEY': 'test-secret',
        'JWT_SECRET_KEY': 'test-jwt-secret-for-testing-only-32-bytes-min',
    })
    _app.json.ensure_ascii = False

    ctx = _app.app_context()
    ctx.push()
    from models import db
    db.create_all()
    # 关键：外层 context 的 session 会与 test client 请求共享 —— Flask 的
    # RequestContext.push() 在栈顶已有同 app 的 context 时直接复用，请求内的
    # db.session 就是这里的 session。默认 expire_on_commit 会让 fixture commit
    # 之后的属性访问（如 sample_case.id）触发 refresh SELECT，留下一个
    # REPEATABLE-READ 悬挂快照事务，快照早于测试中新建的数据，请求便读不到。
    # 关闭后 fixture 链均以 commit 收尾、无悬挂事务，请求的 SELECT 拿到新快照。
    # 注意必须通过 db.session() 取 session 实例再赋值 —— scoped_session 没有
    # __setattr__ 代理，db.session.expire_on_commit = False 只会写到包装对象上。
    db.session().expire_on_commit = False
    yield _app
    # 必须先关闭全部池化连接：测试中打开的事务可能持有 MySQL 元数据锁，
    # 不释放会让 drop_all（另一条连接）永远等待
    db.session.rollback()
    db.engine.dispose()
    db.drop_all()
    ctx.pop()


@pytest.fixture()
def client(app):
    """Flask test client."""
    return app.test_client()


@pytest.fixture()
def db_session(app):
    """Reset session state before each test (handles prior test failures)."""
    from models import db as _db
    try:
        _db.session.rollback()
    except Exception:
        pass
    _db.session.expire_all()
    return _db.session


@pytest.fixture()
def admin_user(app):
    """Create and return an admin user (function scope to avoid test isolation issues)."""
    from models import User, db
    user = User.query.filter_by(username='testadmin').first()
    if not user:
        user = User(username='testadmin', real_name='Test Admin', role='admin', status='active')
        user.set_password('adminpass123')
        db.session.add(user)
        db.session.commit()
    return user


@pytest.fixture()
def nurse_user(app):
    """Create and return a nurse user (function scope to avoid test isolation issues)."""
    from models import User, db
    user = User.query.filter_by(username='testnurse').first()
    if not user:
        user = User(username='testnurse', real_name='Test Nurse',
                    role='nurse', status='active', department='内科')
        user.set_password('nursepass123')
        db.session.add(user)
        db.session.commit()
    return user


@pytest.fixture()
def admin_token(app, admin_user):
    """JWT access token for admin user (function scope to pick up token_version changes)."""
    from flask_jwt_extended import create_access_token
    return create_access_token(identity=str(admin_user.id), additional_claims={'v': admin_user.token_version or 0})


@pytest.fixture()
def nurse_token(app, nurse_user):
    """JWT access token for nurse user (function scope to pick up token_version changes)."""
    from flask_jwt_extended import create_access_token
    return create_access_token(identity=str(nurse_user.id), additional_claims={'v': nurse_user.token_version or 0})


@pytest.fixture(scope='function')
def category(app):
    """Create a test case category (per-test, clean isolation)."""
    from models import CaseCategory, db
    cat = CaseCategory.query.filter_by(name='儿科模块').first()
    if not cat:
        cat = CaseCategory(name='儿科模块', description='儿科相关医疗案例')
        db.session.add(cat)
        db.session.commit()
    return cat


@pytest.fixture(scope='function')
def sample_case(app, category):
    """Create a sample learning case with stations (per-test, clean isolation)."""
    from models import Case, Station, StandardAnswer, db
    case = Case.query.filter_by(title='测试案例').first()
    if not case:
        case = Case(category_id=category.id, title='测试案例',
                    case_guide='测试指引', difficulty='intermediate', case_type='learning')
        db.session.add(case)
        db.session.flush()

        station = Station(case_id=case.id, name='站点1',
                          assessment_task='考核任务1', question='问题1？', order_index=0)
        db.session.add(station)
        db.session.flush()

        ans = StandardAnswer(station_id=station.id, answer_item='答案1', score_weight=1.0, order_index=0)
        db.session.add(ans)
        db.session.commit()
    return case
