"""回归测试：API 测试发现的三个 bug 的修复验证。

1. 会话 Cookie 登录用户访问角色不匹配页面 → 403（修复前 get_jwt_identity()
   在无 JWT 上下文时抛 RuntimeError 导致 500）
2. PUT /admin/exams/<id> 非法 duration/start_time → 校验失败消息（修复前 500）
3. 登录限流触发 → 自定义 JSON + 429（修复前 on_breach 返回元组被忽略）
"""


def _create_admin_via_api(client, app, username):
    from models import User, db
    with app.app_context():
        u = User(username=username, real_name='Reg Admin', role='admin', status='active')
        u.set_password('regtest123')
        db.session.add(u)
        db.session.commit()
    resp = client.post('/auth/login', json={'username': username, 'password': 'regtest123'})
    assert resp.get_json()['success']


def test_session_admin_on_nurse_endpoint_gets_403(client, app):
    """会话登录的管理员访问护士端点 → 403，而非 500。"""
    _create_admin_via_api(client, app, 'sessadmin')
    # JSON 登录同时已建立 Session Cookie；不带 JWT 访问护士端点
    resp = client.get('/nurse/cases')
    assert resp.status_code == 403
    assert not resp.get_json()['success']


def test_update_exam_invalid_duration_and_start_time(client, app, admin_token):
    """非法 duration / start_time 返回校验失败，而非 500。"""
    headers = {'Authorization': f'Bearer {admin_token}'}
    resp = client.post('/admin/exams', json={
        'title': '参数校验考试', 'description': '', 'duration': 30
    }, headers=headers)
    exam_id = resp.get_json()['exam']['id']

    resp = client.put(f'/admin/exams/{exam_id}', json={'duration': 'abc'}, headers=headers)
    data = resp.get_json()
    assert resp.status_code == 200 and not data['success']

    resp = client.put(f'/admin/exams/{exam_id}', json={'start_time': 'not-a-date'}, headers=headers)
    data = resp.get_json()
    assert resp.status_code == 200 and not data['success']

    # 合法值仍可正常更新
    resp = client.put(f'/admin/exams/{exam_id}', json={
        'duration': 45, 'start_time': '2026-09-03T10:00:00'
    }, headers=headers)
    assert resp.get_json()['success']


def test_login_rate_limit_returns_custom_429_json(client, app):
    """登录限流触发时返回自定义 JSON 消息与 429 状态码。

    flask-limiter 的 init_app 在 enabled=False 时直接返回（不创建 storage），
    因此必须以 RATELIMIT_ENABLED=True 重建 app 实例来验证，结束后恢复配置。
    """
    from config import Config
    from app import create_app

    original = Config.RATELIMIT_ENABLED
    original_url = Config.RATELIMIT_STORAGE_URL
    Config.RATELIMIT_ENABLED = True
    Config.RATELIMIT_STORAGE_URL = 'memory://'
    try:
        test_app = create_app()
        test_app.config.update(TESTING=True, WTF_CSRF_ENABLED=False)
        from models import db
        with test_app.app_context():
            db.create_all()
        c = test_app.test_client()
        for _ in range(5):
            c.post('/auth/login', json={'username': 'nosuch', 'password': 'wrongpass1'})
        resp = c.post('/auth/login', json={'username': 'nosuch', 'password': 'wrongpass1'})
    finally:
        Config.RATELIMIT_ENABLED = original
        Config.RATELIMIT_STORAGE_URL = original_url
    assert resp.status_code == 429
    assert '过于频繁' in resp.get_json()['message']
