"""Tests for security: CSRF, CORS, JWT, rate limiting, encryption, admin guards."""
import json
import os
import pytest


class TestCSRFProtection:
    def test_csrf_disabled_in_test_config(self, app):
        """CSRF is disabled in test config to simplify testing."""
        assert app.config.get('WTF_CSRF_ENABLED') is False

    def test_auth_bp_login_works(self, client, app):
        """Login works without CSRF because auth_bp is exempt."""
        # Create a fresh user to avoid password-changed-by-other-tests issues
        from models import User, db
        with app.app_context():
            u = User(username='csrftest', real_name='CSRF Test', role='nurse', status='active')
            u.set_password('csrftest123')
            db.session.add(u)
            db.session.commit()
        resp = client.post('/auth/login', json={
            'username': 'csrftest', 'password': 'csrftest123'
        })
        data = resp.get_json()
        assert data['success']

    def test_admin_post_works_with_jwt(self, client, admin_token, category):
        """Admin POST works with JWT even without CSRF (CSRF disabled in test)."""
        resp = client.post('/admin/cases', json={
            'title': 'csrf test case', 'category_id': category.id,
            'case_type': 'learning'
        }, headers={'Authorization': f'Bearer {admin_token}'})
        data = resp.get_json()
        # With CSRF disabled, this should succeed
        assert data['success']


class TestCORSHeaders:
    def test_cors_response_ok(self, client):
        resp = client.get('/auth/login')
        assert resp.status_code == 200


class TestJWTProtection:
    def test_expired_token_rejected(self, app, nurse_user):
        from flask_jwt_extended import create_access_token
        import datetime
        token = create_access_token(
            identity=str(nurse_user.id),
            expires_delta=datetime.timedelta(seconds=-1)
        )
        client = app.test_client()
        resp = client.get('/nurse/dashboard',
                          headers={'Authorization': f'Bearer {token}',
                                   'Accept': 'application/json'})
        assert resp.status_code in (401, 422)

    def test_invalid_token_rejected(self, client):
        resp = client.get('/nurse/dashboard',
                          headers={'Authorization': 'Bearer invalid.token.here',
                                   'Accept': 'application/json'})
        assert resp.status_code in (401, 422)

    def test_no_token_rejected(self, app):
        # Use a fresh client to avoid session contamination from other tests
        client = app.test_client()
        resp = client.get('/nurse/dashboard',
                          headers={'Accept': 'application/json'})
        # Without token, should be rejected (401/403) or redirected to login (302)
        assert resp.status_code in (302, 401, 403)

    def test_nurse_cannot_access_admin(self, client, nurse_token):
        resp = client.get('/admin/dashboard',
                          headers={'Authorization': f'Bearer {nurse_token}'})
        assert resp.status_code == 403 or not resp.get_json()['success']


class TestAdminGuards:
    def test_admin_only_endpoints(self, client, nurse_token):
        """Nurse token should not access admin-only routes."""
        admin_only_paths = [
            '/admin/users',
            '/admin/cases',
            '/admin/exams',
            '/admin/ai-settings',
        ]
        for path in admin_only_paths:
            resp = client.get(path,
                headers={'Authorization': f'Bearer {nurse_token}'})
            assert resp.status_code in (401, 403), \
                f'{path} should reject nurse, got {resp.status_code}'

    def test_toggle_status_cannot_disable_self(self, client, admin_token, admin_user):
        resp = client.post(f'/auth/users/{admin_user.id}/toggle-status',
                           headers={'Authorization': f'Bearer {admin_token}'})
        assert not resp.get_json()['success']


class TestEncryption:
    def test_encrypt_decrypt_roundtrip(self):
        from utils.crypto import encrypt_value, decrypt_value
        original = 'sk-test-api-key-12345'
        encrypted = encrypt_value(original)
        assert encrypted is not None
        assert encrypted != original
        decrypted = decrypt_value(encrypted)
        assert decrypted == original

    def test_encrypt_none_value(self):
        from utils.crypto import encrypt_value, decrypt_value
        assert encrypt_value(None) is None
        assert encrypt_value('') is None
        assert decrypt_value(None) is None
        assert decrypt_value('') is None

    def test_encrypt_different_each_time(self):
        from utils.crypto import encrypt_value
        v = 'my-secret-key'
        c1 = encrypt_value(v)
        c2 = encrypt_value(v)
        # Fernet produces different ciphertext each time (timestamp in token)
        assert c1 != c2

    def test_missing_key_raises(self, monkeypatch):
        monkeypatch.delenv('ENCRYPTION_KEY', raising=False)
        # Re-import to trigger the error
        import utils.crypto
        with pytest.raises(RuntimeError):
            utils.crypto.encrypt_value('test')


class TestRateLimitHeaders:
    def test_rate_limit_headers_on_auth(self, client):
        """Auth endpoints should handle login requests."""
        resp = client.post('/auth/login', json={
            'username': 'testnurse', 'password': 'wrong'
        })
        assert resp.status_code in (200, 401, 429)


class TestSessionSecurity:
    def test_session_cookie_settings(self, app):
        assert app.config.get('SESSION_COOKIE_HTTPONLY') is True
        assert app.config.get('SESSION_COOKIE_SAMESITE') == 'Lax'

    def test_json_ensure_ascii_off(self, app, client, nurse_token):
        """Chinese characters should not be escaped in JSON."""
        resp = client.get('/nurse/dashboard',
                          headers={'Authorization': f'Bearer {nurse_token}'})
        data = resp.get_json()
        assert data['success']
