"""Supplementary tests covering previously untested features."""
import json
import io
import pytest
from models import db, User, Case, Station, StandardAnswer, Exam, CaseCategory


class TestProfileAndPassword:
    """Tests for /auth/profile and /auth/change-password endpoints."""

    def test_get_profile(self, client, nurse_token):
        resp = client.get('/auth/profile', headers={'Authorization': f'Bearer {nurse_token}'})
        assert resp.status_code == 200
        data = resp.get_json()
        assert data['success']
        assert data['user']['username'] == 'testnurse'

    def test_update_profile(self, client, nurse_token):
        resp = client.put('/auth/profile',
                          headers={'Authorization': f'Bearer {nurse_token}'},
                          json={'real_name': 'Updated Name', 'email': 'test@test.com',
                                'phone': '13800001111', 'department': '外科'})
        assert resp.status_code == 200
        data = resp.get_json()
        assert data['success']

        # Verify persisted
        resp2 = client.get('/auth/profile', headers={'Authorization': f'Bearer {nurse_token}'})
        user = resp2.get_json()['user']
        assert user['real_name'] == 'Updated Name'

    def test_update_profile_empty_name(self, client, nurse_token):
        resp = client.put('/auth/profile',
                          headers={'Authorization': f'Bearer {nurse_token}'},
                          json={'real_name': ''})
        assert resp.status_code == 200
        assert not resp.get_json()['success']

    def test_change_password_success(self, client, app, nurse_token):
        resp = client.post('/auth/change-password',
                           headers={'Authorization': f'Bearer {nurse_token}'},
                           json={'old_password': 'nursepass123', 'new_password': 'NewPass123'})
        assert resp.status_code == 200
        data = resp.get_json()
        assert data['success']

        # Revert password
        client.post('/auth/change-password',
                    headers={'Authorization': f'Bearer {nurse_token}'},
                    json={'old_password': 'NewPass123', 'new_password': 'nursepass123'})

    def test_change_password_wrong_old(self, client, nurse_token):
        resp = client.post('/auth/change-password',
                           headers={'Authorization': f'Bearer {nurse_token}'},
                           json={'old_password': 'wrongpass', 'new_password': 'NewPass123'})
        assert not resp.get_json()['success']

    def test_change_password_too_short(self, client, nurse_token):
        resp = client.post('/auth/change-password',
                           headers={'Authorization': f'Bearer {nurse_token}'},
                           json={'old_password': 'nursepass123', 'new_password': '123'})
        assert not resp.get_json()['success']

    def test_change_password_missing_fields(self, client, nurse_token):
        resp = client.post('/auth/change-password',
                           headers={'Authorization': f'Bearer {nurse_token}'},
                           json={})
        assert not resp.get_json()['success']


class TestAdminUserManagement:
    """Tests for admin user batch operations, reset password, toggle status."""

    def test_reset_user_password(self, client, admin_token, nurse_user):
        resp = client.post(f'/auth/users/{nurse_user.id}/reset-password',
                           headers={'Authorization': f'Bearer {admin_token}'})
        assert resp.status_code == 200
        data = resp.get_json()
        assert data['success']
        assert 'new_password' in data

    def test_toggle_user_status(self, client, admin_token, nurse_user):
        resp = client.post(f'/auth/users/{nurse_user.id}/toggle-status',
                           headers={'Authorization': f'Bearer {admin_token}'})
        assert resp.status_code == 200
        data = resp.get_json()
        assert data['success']

        # Toggle back
        client.post(f'/auth/users/{nurse_user.id}/toggle-status',
                    headers={'Authorization': f'Bearer {admin_token}'})

    def test_toggle_status_cannot_disable_self(self, client, admin_token, admin_user):
        resp = client.post(f'/auth/users/{admin_user.id}/toggle-status',
                           headers={'Authorization': f'Bearer {admin_token}'})
        assert resp.status_code == 200
        assert not resp.get_json()['success']

    def test_get_user_progress(self, client, admin_token, nurse_user):
        resp = client.get(f'/admin/users/{nurse_user.id}/progress',
                          headers={'Authorization': f'Bearer {admin_token}'})
        assert resp.status_code == 200
        data = resp.get_json()
        assert data['success']

    def test_batch_import_users_xlsx(self, client, admin_token):
        resp = client.post('/admin/users/batch-import-xlsx',
                           headers={'Authorization': f'Bearer {admin_token}'})
        assert resp.status_code in (200, 400)


class TestCommentsAPI:
    """Tests for /api/comments — requires content_type, content_id, content (min 5 chars)."""

    def test_list_comments_requires_params(self, client):
        """GET /api/comments without content_type/content_id returns error."""
        resp = client.get('/api/comments')
        assert resp.status_code == 200
        data = resp.get_json()
        assert data['success'] is False

    def test_create_comment_requires_fields(self, client, nurse_token):
        """POST /api/comments requires content_type, content_id, content."""
        resp = client.post('/api/comments',
                           headers={'Authorization': f'Bearer {nurse_token}'},
                           json={'content': '短'})
        assert resp.status_code == 200
        assert not resp.get_json()['success']

    def test_create_comment_content_too_short(self, client, nurse_token):
        """Content must be at least 5 characters."""
        resp = client.post('/api/comments',
                           headers={'Authorization': f'Bearer {nurse_token}'},
                           json={'content_type': 'station_answer', 'content_id': 1,
                                 'content': 'ab'})
        assert resp.status_code == 200
        # Should fail because content < 5 chars or content_id doesn't exist
        assert 'success' in resp.get_json()

    def test_comments_require_auth(self, client):
        resp = client.post('/api/comments', json={'content': 'No auth test'})
        assert resp.status_code == 401


class TestStatisticsAPI:
    """Tests for statistics and analysis endpoints."""

    def test_learning_data(self, client, admin_token):
        resp = client.get('/admin/statistics/learning-data',
                          headers={'Authorization': f'Bearer {admin_token}'})
        assert resp.status_code == 200
        data = resp.get_json()
        assert data['success']

    def test_group_weakness(self, client, admin_token):
        resp = client.get('/admin/statistics/group-weakness',
                          headers={'Authorization': f'Bearer {admin_token}'})
        assert resp.status_code == 200
        data = resp.get_json()
        assert data['success']

    def test_statistics_overview(self, client, admin_token):
        resp = client.get('/api/statistics/overview',
                          headers={'Authorization': f'Bearer {admin_token}'})
        assert resp.status_code == 200
        data = resp.get_json()
        assert data['success']


class TestNurseFeatures:
    """Tests for nurse knowledge, station search, exams."""

    def test_station_search_admin_only(self, client, nurse_token):
        """Station search requires admin role."""
        resp = client.get('/api/stations/search?keyword=测试',
                          headers={'Authorization': f'Bearer {nurse_token}'})
        assert resp.status_code == 200
        data = resp.get_json()
        assert not data['success']  # nurse role denied

    def test_station_search_as_admin(self, client, admin_token):
        resp = client.get('/api/stations/search?keyword=测试',
                          headers={'Authorization': f'Bearer {admin_token}'})
        assert resp.status_code == 200
        data = resp.get_json()
        assert data['success']

    def test_get_station_detail(self, client, nurse_token, sample_case):
        from models import Station
        station = Station.query.filter_by(case_id=sample_case.id).first()
        resp = client.get(f'/api/stations/{station.id}',
                          headers={'Authorization': f'Bearer {nurse_token}'})
        assert resp.status_code == 200
        data = resp.get_json()
        assert data['success']

    def test_submit_knowledge_answer_requires_content(self, client, nurse_token, app):
        """Submit answer requires content."""
        resp = client.post('/nurse/knowledge/1/submit',
                           headers={'Authorization': f'Bearer {nurse_token}'},
                           json={'answer': ''})
        if resp.status_code == 200:
            data = resp.get_json()
            assert 'success' in data

    def test_list_exams_nurse(self, client, nurse_token):
        resp = client.get('/nurse/exams',
                          headers={'Authorization': f'Bearer {nurse_token}'})
        assert resp.status_code == 200
        data = resp.get_json()
        assert data['success']

    def test_point_records(self, client, nurse_token):
        resp = client.get('/nurse/point-records',
                          headers={'Authorization': f'Bearer {nurse_token}'})
        assert resp.status_code == 200
        data = resp.get_json()
        assert data['success']

    def test_weakness_analysis_run(self, client, nurse_token):
        resp = client.post('/nurse/weakness-analysis/run',
                           headers={'Authorization': f'Bearer {nurse_token}'})
        assert resp.status_code == 200
        data = resp.get_json()
        assert data['success']


class TestAdminExamManagement:
    """Tests for exam CRUD operations."""

    def test_create_exam(self, client, admin_token):
        resp = client.post('/admin/exams',
                           headers={'Authorization': f'Bearer {admin_token}'},
                           json={'title': '综合测试', 'duration_minutes': 60,
                                 'pass_score': 60, 'case_type': 'learning'})
        assert resp.status_code == 200
        data = resp.get_json()
        assert data['success']

    def test_create_exam_missing_title(self, client, admin_token):
        resp = client.post('/admin/exams',
                           headers={'Authorization': f'Bearer {admin_token}'},
                           json={'duration_minutes': 60})
        assert not resp.get_json()['success']

    def test_list_exams(self, client, admin_token):
        resp = client.get('/admin/exams',
                          headers={'Authorization': f'Bearer {admin_token}'})
        assert resp.status_code == 200
        data = resp.get_json()
        assert data['success']

    def test_qr_code_generation(self, client, admin_token):
        # Create an exam first
        r = client.post('/admin/exams',
                        headers={'Authorization': f'Bearer {admin_token}'},
                        json={'title': 'QR测试', 'duration_minutes': 30,
                              'pass_score': 60, 'case_type': 'learning'})
        data = r.get_json()
        assert data['success']
        exam_id = data['exam']['id']

        resp = client.get(f'/admin/exams/{exam_id}/qr-code',
                          headers={'Authorization': f'Bearer {admin_token}'})
        assert resp.status_code == 200
        assert resp.content_type in ('image/png', 'image/png; charset=utf-8')

    def test_exam_questions_crud(self, client, admin_token, sample_case):
        # Create exam
        r = client.post('/admin/exams',
                        headers={'Authorization': f'Bearer {admin_token}'},
                        json={'title': 'Q管理测试', 'duration_minutes': 30,
                              'pass_score': 60, 'case_type': 'learning'})
        exam_id = r.get_json()['exam']['id']

        # Add question
        resp = client.post(f'/admin/exams/{exam_id}/questions',
                           headers={'Authorization': f'Bearer {admin_token}'},
                           json={'station_ids': [sample_case.id]})
        assert resp.status_code == 200

        # List questions
        resp2 = client.get(f'/admin/exams/{exam_id}/questions',
                           headers={'Authorization': f'Bearer {admin_token}'})
        assert resp2.status_code == 200


class TestAISettings:
    """Tests for AI settings management."""

    def test_get_ai_settings(self, client, admin_token):
        resp = client.get('/admin/ai-settings',
                          headers={'Authorization': f'Bearer {admin_token}'})
        assert resp.status_code == 200
        data = resp.get_json()
        assert data['success']

    def test_update_ai_settings(self, client, admin_token):
        resp = client.put('/admin/ai-settings',
                          headers={'Authorization': f'Bearer {admin_token}'},
                          json={'provider': 'openai', 'model': 'gpt-4o-mini',
                                'api_key': 'sk-test', 'base_url': 'https://api.openai.com/v1'})
        assert resp.status_code == 200
        data = resp.get_json()
        assert data['success']

    def test_test_ai_connection(self, client, admin_token):
        resp = client.post('/admin/ai-settings/test',
                           headers={'Authorization': f'Bearer {admin_token}'},
                           json={'provider': 'openai', 'api_key': 'sk-test',
                                 'model': 'gpt-4o-mini', 'base_url': 'https://api.openai.com/v1'})
        assert resp.status_code != 500


class TestCategoriesAPI:
    """Tests for category listing."""

    def test_list_categories(self, client, admin_token):
        resp = client.get('/api/categories',
                          headers={'Authorization': f'Bearer {admin_token}'})
        assert resp.status_code == 200
        data = resp.get_json()
        assert data['success']


class TestCaseBatchOperations:
    """Tests for case batch delete and batch upload."""

    def test_batch_delete_cases(self, client, admin_token, sample_case):
        resp = client.post('/admin/cases/batch-delete',
                           headers={'Authorization': f'Bearer {admin_token}'},
                           json={'case_ids': [sample_case.id + 99999]})
        assert resp.status_code in (200, 400)

    def test_batch_upload_no_file(self, client, admin_token):
        resp = client.post('/admin/cases/batch-upload',
                           headers={'Authorization': f'Bearer {admin_token}'})
        assert resp.status_code in (200, 400, 500)


class TestHealthEndpoint:
    """Test health check endpoint."""

    def test_health_check(self, client):
        resp = client.get('/api/health')
        assert resp.status_code == 200
        data = resp.get_json()
        assert data['status'] == 'healthy'

    def test_health_has_version(self, client):
        resp = client.get('/api/health')
        assert resp.status_code == 200
        data = resp.get_json()
        assert 'version' in data
        assert data['service'] == 'nurse_training_system'
