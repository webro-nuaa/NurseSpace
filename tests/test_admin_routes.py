"""Tests for admin management routes (CRUD operations, AI settings, exams)."""
import json
import io
import pytest


class TestDashboard:
    def test_dashboard_requires_admin(self, client, admin_token):
        resp = client.get('/admin/dashboard',
                          headers={'Authorization': f'Bearer {admin_token}'})
        data = resp.get_json()
        assert data['success']
        assert 'statistics' in data['data']

    def test_dashboard_rejects_nurse(self, client, nurse_token):
        resp = client.get('/admin/dashboard',
                          headers={'Authorization': f'Bearer {nurse_token}'})
        assert resp.status_code == 403 or not resp.get_json()['success']


class TestUserManagement:
    def test_list_users(self, client, admin_token):
        resp = client.get('/admin/users',
                          headers={'Authorization': f'Bearer {admin_token}'})
        data = resp.get_json()
        assert data['success']
        assert 'users' in data['data']

    def test_get_user_detail(self, client, admin_token, nurse_user):
        resp = client.get(f'/admin/users/{nurse_user.id}',
                          headers={'Authorization': f'Bearer {admin_token}'})
        data = resp.get_json()
        assert data['success']
        assert data['data']['username'] == 'testnurse'

    def test_update_user(self, client, admin_token, nurse_user):
        resp = client.put(f'/admin/users/{nurse_user.id}', json={
            'real_name': 'Updated', 'department': '外科',
            'email': 'updated@test.com'
        }, headers={'Authorization': f'Bearer {admin_token}'})
        assert resp.get_json()['success']

    def test_get_user_progress(self, client, admin_token, nurse_user):
        resp = client.get(f'/admin/users/{nurse_user.id}/progress',
                          headers={'Authorization': f'Bearer {admin_token}'})
        data = resp.get_json()
        assert data['success']
        assert 'category_progress' in data['data']
        assert 'recent_records' in data['data']
        assert 'point_records' in data['data']

    def test_xlsx_template_download(self, client, admin_token):
        resp = client.get('/admin/users/xlsx-template',
                          headers={'Authorization': f'Bearer {admin_token}'})
        assert resp.status_code == 200


class TestCaseManagement:
    def test_list_cases(self, client, admin_token):
        resp = client.get('/admin/cases',
                          headers={'Authorization': f'Bearer {admin_token}'})
        data = resp.get_json()
        assert data['success']
        assert 'cases' in data['data']

    def test_filter_by_case_type(self, client, admin_token, sample_case):
        resp = client.get('/admin/cases?case_type=learning',
                          headers={'Authorization': f'Bearer {admin_token}'})
        data = resp.get_json()
        assert data['success']

    def test_filter_by_case_type_exam(self, client, admin_token):
        resp = client.get('/admin/cases?case_type=exam',
                          headers={'Authorization': f'Bearer {admin_token}'})
        data = resp.get_json()
        assert data['success']

    def test_create_case_json(self, client, admin_token, category):
        resp = client.post('/admin/cases', json={
            'title': '手动创建案例', 'category_id': category.id,
            'difficulty': 'advanced', 'case_type': 'exam',
            'case_guide': '测试指引'
        }, headers={'Authorization': f'Bearer {admin_token}'})
        data = resp.get_json()
        assert data['success']
        assert data['case']['title'] == '手动创建案例'

    def test_create_case_missing_title(self, client, admin_token):
        resp = client.post('/admin/cases', json={
            'title': '', 'category_id': 1
        }, headers={'Authorization': f'Bearer {admin_token}'})
        assert not resp.get_json()['success']

    def test_get_case_detail(self, client, admin_token, sample_case):
        resp = client.get(f'/admin/cases/{sample_case.id}',
                          headers={'Authorization': f'Bearer {admin_token}'})
        data = resp.get_json()
        assert data['success']
        assert data['data']['case']['difficulty'] == 'intermediate'
        assert 'videos' in data['data']
        assert 'links' in data['data']

    def test_update_case(self, client, admin_token, sample_case):
        resp = client.put(f'/admin/cases/{sample_case.id}', json={
            'title': 'Updated Case', 'difficulty': 'advanced',
            'case_type': 'exam', 'case_guide': 'New guide'
        }, headers={'Authorization': f'Bearer {admin_token}'})
        assert resp.get_json()['success']

    def test_delete_case(self, client, admin_token, category):
        # Create a fresh case for deletion to avoid affecting shared fixture
        from models import Case, db
        with client.application.app_context():
            c = db.session.merge(category)
            case = Case(category_id=c.id, title='待删除案例', case_type='learning')
            db.session.add(case)
            db.session.commit()
            case_id = case.id
        resp = client.delete(f'/admin/cases/{case_id}',
                             headers={'Authorization': f'Bearer {admin_token}'})
        assert resp.get_json()['success']

    def test_batch_delete(self, client, admin_token, category):
        from models import Case, db
        with client.application.app_context():
            c = db.session.merge(category)
            case = Case(category_id=c.id, title='待批量删除案例', case_type='learning')
            db.session.add(case)
            db.session.commit()
            case_id = case.id
        resp = client.post('/admin/cases/batch-delete', json={
            'ids': [case_id]
        }, headers={'Authorization': f'Bearer {admin_token}'})
        assert resp.get_json()['success']

    def test_xlsx_template(self, client, admin_token):
        resp = client.get('/admin/cases/xlsx-template',
                          headers={'Authorization': f'Bearer {admin_token}'})
        assert resp.status_code == 200


class TestStationCRUD:
    def test_create_station(self, client, admin_token, sample_case):
        resp = client.post(f'/admin/cases/{sample_case.id}/stations', json={
            'name': '新站点', 'question': '新问题？', 'assessment_task': '任务'
        }, headers={'Authorization': f'Bearer {admin_token}'})
        assert resp.get_json()['success']

    def test_update_station(self, client, admin_token, sample_case):
        from models import Station
        station = Station.query.first()
        if not station:
            pytest.skip('No station in fixture')
        resp = client.put(
            f'/admin/cases/{sample_case.id}/stations/{station.id}',
            json={'name': 'Updated Station', 'question': '新题目？'},
            headers={'Authorization': f'Bearer {admin_token}'})
        assert resp.get_json()['success']

    def test_update_station_answers(self, client, admin_token, sample_case):
        from models import Station
        station = Station.query.first()
        if not station:
            pytest.skip('No station in fixture')
        resp = client.put(
            f'/admin/cases/{sample_case.id}/stations/{station.id}/answers',
            json={'answers': [
                {'answer_item': '新答案1', 'score_weight': 1.0},
                {'answer_item': '新答案2', 'score_weight': 0.5}
            ]},
            headers={'Authorization': f'Bearer {admin_token}'})
        assert resp.get_json()['success']

    def test_delete_station(self, client, admin_token, sample_case):
        from models import Station, db, Case
        # Create a fresh station to delete
        with client.application.app_context():
            station = Station(case_id=sample_case.id, name='待删除站点',
                              question='待删除问题？', assessment_task='任务', order_index=99)
            db.session.add(station)
            db.session.commit()
            sid = station.id
        resp = client.delete(
            f'/admin/cases/{sample_case.id}/stations/{sid}',
            headers={'Authorization': f'Bearer {admin_token}'})
        assert resp.get_json()['success']


class TestVideoLinkCRUD:
    def test_create_video(self, client, admin_token, sample_case):
        resp = client.post(f'/admin/cases/{sample_case.id}/videos', json={
            'title': 'Test Video', 'url': 'https://example.com/video',
            'description': 'A test video'
        }, headers={'Authorization': f'Bearer {admin_token}'})
        assert resp.get_json()['success']

    def test_delete_video(self, client, admin_token, sample_case):
        # Create first then delete
        create_resp = client.post(f'/admin/cases/{sample_case.id}/videos', json={
            'title': 'V', 'url': 'https://v.com'
        }, headers={'Authorization': f'Bearer {admin_token}'})
        vid = create_resp.get_json().get('video', {}).get('id')
        if not vid:
            pytest.skip('Video not created')
        resp = client.delete(f'/admin/cases/{sample_case.id}/videos/{vid}',
                             headers={'Authorization': f'Bearer {admin_token}'})
        assert resp.get_json()['success']

    def test_create_link(self, client, admin_token, sample_case):
        resp = client.post(f'/admin/cases/{sample_case.id}/links', json={
            'title': 'Test Link', 'url': 'https://example.com',
            'description': 'A test link'
        }, headers={'Authorization': f'Bearer {admin_token}'})
        assert resp.get_json()['success']

    def test_delete_link(self, client, admin_token, sample_case):
        create_resp = client.post(f'/admin/cases/{sample_case.id}/links', json={
            'title': 'L', 'url': 'https://l.com'
        }, headers={'Authorization': f'Bearer {admin_token}'})
        lid = create_resp.get_json().get('link', {}).get('id')
        if not lid:
            pytest.skip('Link not created')
        resp = client.delete(f'/admin/cases/{sample_case.id}/links/{lid}',
                             headers={'Authorization': f'Bearer {admin_token}'})
        assert resp.get_json()['success']


class TestAISettings:
    def test_get_ai_settings(self, client, admin_token):
        resp = client.get('/admin/ai-settings',
                          headers={'Authorization': f'Bearer {admin_token}'})
        data = resp.get_json()
        assert data['success']
        assert 'provider' in data['data']

    def test_update_ai_settings(self, client, admin_token):
        resp = client.put('/admin/ai-settings', json={
            'provider': 'local', 'openai_model': 'gpt-4o-mini'
        }, headers={'Authorization': f'Bearer {admin_token}'})
        assert resp.get_json()['success']

    def test_invalid_provider(self, client, admin_token):
        resp = client.put('/admin/ai-settings', json={
            'provider': 'invalid'
        }, headers={'Authorization': f'Bearer {admin_token}'})
        assert not resp.get_json()['success']


class TestExamManagement:
    def test_list_exams(self, client, admin_token):
        resp = client.get('/admin/exams',
                          headers={'Authorization': f'Bearer {admin_token}'})
        data = resp.get_json()
        assert data['success']

    def test_create_exam(self, client, admin_token):
        resp = client.post('/admin/exams', json={
            'title': '测试考试', 'description': '描述', 'duration': 60
        }, headers={'Authorization': f'Bearer {admin_token}'})
        data = resp.get_json()
        assert data['success']
        assert data['exam']['title'] == '测试考试'

    def test_update_exam(self, client, admin_token):
        # Create then update
        resp = client.post('/admin/exams', json={
            'title': '原考试', 'duration': 30
        }, headers={'Authorization': f'Bearer {admin_token}'})
        exam_id = resp.get_json()['exam']['id']
        resp = client.put(f'/admin/exams/{exam_id}', json={
            'title': '更新考试', 'duration': 45
        }, headers={'Authorization': f'Bearer {admin_token}'})
        assert resp.get_json()['success']

    def test_publish_exam(self, client, admin_token):
        resp = client.post('/admin/exams', json={
            'title': '待发布', 'duration': 60
        }, headers={'Authorization': f'Bearer {admin_token}'})
        exam_id = resp.get_json()['exam']['id']
        resp = client.post(f'/admin/exams/{exam_id}/publish',
                           headers={'Authorization': f'Bearer {admin_token}'})
        assert resp.get_json()['success']

    def test_qr_code(self, client, admin_token):
        resp = client.post('/admin/exams', json={
            'title': '二维码考试', 'duration': 60
        }, headers={'Authorization': f'Bearer {admin_token}'})
        exam_id = resp.get_json()['exam']['id']
        resp = client.get(f'/admin/exams/{exam_id}/qr-code',
                          headers={'Authorization': f'Bearer {admin_token}'})
        assert resp.status_code == 200
        assert resp.content_type == 'image/png'


class TestStatistics:
    def test_learning_data(self, client, admin_token):
        resp = client.get('/admin/statistics/learning-data',
                          headers={'Authorization': f'Bearer {admin_token}'})
        assert resp.get_json()['success']

    def test_group_weakness(self, client, admin_token):
        resp = client.get('/admin/statistics/group-weakness',
                          headers={'Authorization': f'Bearer {admin_token}'})
        assert resp.get_json()['success']
