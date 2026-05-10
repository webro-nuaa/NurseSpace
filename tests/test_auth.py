"""Tests for authentication routes: login, register, JWT, password change, admin reset."""
import json
import pytest


class TestLogin:
    def test_login_page(self, client):
        resp = client.get('/auth/login')
        assert resp.status_code == 200

    def test_login_json_success(self, client, nurse_user):
        resp = client.post('/auth/login', json={
            'username': 'testnurse', 'password': 'nursepass123'
        })
        data = resp.get_json()
        assert data['success']
        assert 'access_token' in data
        assert data['user']['role'] == 'nurse'

    def test_login_wrong_password(self, client, nurse_user):
        resp = client.post('/auth/login', json={
            'username': 'testnurse', 'password': 'wrong'
        })
        assert not resp.get_json()['success']

    def test_login_disabled_user(self, client, app):
        from models import User, db
        with app.app_context():
            u = User(username='disabled', real_name='D', role='nurse', status='disabled')
            u.set_password('pass123456')
            db.session.add(u)
            db.session.commit()
        resp = client.post('/auth/login', json={
            'username': 'disabled', 'password': 'pass123456'
        })
        assert not resp.get_json()['success']

    def test_admin_login_redirects(self, client, admin_user):
        resp = client.post('/auth/login', data={
            'username': 'testadmin', 'password': 'adminpass123'
        }, follow_redirects=False)
        assert resp.status_code in (302, 200)


class TestRegister:
    def test_register_as_admin(self, client, admin_token):
        resp = client.post('/auth/register', json={
            'username': 'newuser', 'password': 'newpass123',
            'real_name': 'New', 'role': 'nurse'
        }, headers={'Authorization': f'Bearer {admin_token}'})
        data = resp.get_json()
        assert data['success']
        assert data['user']['username'] == 'newuser'

    def test_register_weak_password(self, client, admin_token):
        resp = client.post('/auth/register', json={
            'username': 'newuser2', 'password': '123',
            'real_name': 'New'
        }, headers={'Authorization': f'Bearer {admin_token}'})
        assert not resp.get_json()['success']

    def test_register_duplicate_username(self, client, admin_token, nurse_user):
        resp = client.post('/auth/register', json={
            'username': 'testnurse', 'password': 'newpass123',
            'real_name': 'Dup'
        }, headers={'Authorization': f'Bearer {admin_token}'})
        assert not resp.get_json()['success']

    def test_register_requires_admin(self, client, nurse_token):
        resp = client.post('/auth/register', json={
            'username': 'newuser3', 'password': 'newpass123',
            'real_name': 'N'
        }, headers={'Authorization': f'Bearer {nurse_token}'})
        assert resp.status_code == 403 or not resp.get_json()['success']


class TestProfile:
    def test_get_profile(self, client, nurse_token):
        resp = client.get('/auth/profile',
                          headers={'Authorization': f'Bearer {nurse_token}'})
        data = resp.get_json()
        assert data['success']
        assert data['user']['username'] == 'testnurse'

    def test_update_profile(self, client, nurse_token):
        resp = client.put('/auth/profile', json={
            'real_name': 'Updated Name', 'email': 'test@test.com',
            'phone': '13800001111'
        }, headers={'Authorization': f'Bearer {nurse_token}'})
        assert resp.get_json()['success']


class TestChangePassword:
    def test_change_password(self, client, nurse_token):
        resp = client.post('/auth/change-password', json={
            'old_password': 'nursepass123',
            'new_password': 'newpass456'
        }, headers={'Authorization': f'Bearer {nurse_token}'})
        assert resp.get_json()['success']

    def test_change_wrong_old_password(self, client, nurse_token):
        resp = client.post('/auth/change-password', json={
            'old_password': 'wrongpass',
            'new_password': 'newpass456'
        }, headers={'Authorization': f'Bearer {nurse_token}'})
        assert not resp.get_json()['success']


class TestAdminResetPassword:
    def test_reset_user_password(self, client, admin_token, nurse_user):
        resp = client.post(f'/auth/users/{nurse_user.id}/reset-password',
                           headers={'Authorization': f'Bearer {admin_token}'})
        data = resp.get_json()
        assert data['success']
        assert 'new_password' in data

    def test_reset_password_requires_admin(self, client, nurse_token, nurse_user):
        resp = client.post(f'/auth/users/{nurse_user.id}/reset-password',
                           headers={'Authorization': f'Bearer {nurse_token}'})
        assert resp.status_code == 403 or not resp.get_json()['success']

    def test_reset_nonexistent_user(self, client, admin_token):
        resp = client.post('/auth/users/99999/reset-password',
                           headers={'Authorization': f'Bearer {admin_token}'})
        assert not resp.get_json()['success']


class TestToggleStatus:
    def test_toggle_user_status(self, client, admin_token, app):
        # Create a fresh user to toggle so shared fixtures aren't affected
        from models import User, db
        with app.app_context():
            u = User(username='toggletest', real_name='Toggle', role='nurse', status='active')
            u.set_password('pass123')
            db.session.add(u)
            db.session.commit()
            uid = u.id
        resp = client.post(f'/auth/users/{uid}/toggle-status',
                           headers={'Authorization': f'Bearer {admin_token}'})
        data = resp.get_json()
        assert data['success']
        assert data['status'] == 'disabled'

    def test_cannot_disable_self(self, client, admin_token, admin_user):
        resp = client.post(f'/auth/users/{admin_user.id}/toggle-status',
                           headers={'Authorization': f'Bearer {admin_token}'})
        assert not resp.get_json()['success']
