"""pytest fixtures for NurseSpace test suite."""
import os
import sys
import pytest

# Ensure project root is on path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Set test environment variables before any imports
os.environ.setdefault('SECRET_KEY', 'test-secret-key-for-testing-only')
os.environ.setdefault('JWT_SECRET_KEY', 'test-jwt-secret-for-testing-only')
os.environ.setdefault('ENCRYPTION_KEY', 'd0EMMLL-wOGkN5Az6IQvXd16BSbE6Fx8EDZT4xcifg4=')
os.environ.setdefault('MYSQL_PASSWORD', 'test')
os.environ.setdefault('MYSQL_HOST', 'localhost')
os.environ.setdefault('REDIS_ENABLED', '0')
os.environ.setdefault('RATELIMIT_ENABLED', '0')
os.environ.setdefault('CORS_ORIGINS', '*')
os.environ['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///:memory:'

from app import create_app


@pytest.fixture(scope='function')
def app():
    """Per-test Flask app with SQLite in-memory database (clean isolation)."""
    _app = create_app()
    _app.config.update({
        'TESTING': True,
        'SQLALCHEMY_DATABASE_URI': 'sqlite:///:memory:',
        'WTF_CSRF_ENABLED': False,
        'SECRET_KEY': 'test-secret',
        'JWT_SECRET_KEY': 'test-jwt-secret',
    })
    _app.json.ensure_ascii = False

    ctx = _app.app_context()
    ctx.push()
    from models import db
    db.create_all()
    yield _app
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
