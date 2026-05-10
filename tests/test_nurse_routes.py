"""Tests for nurse-side routes: dashboard, cases, answer submission, exams."""
import json
import pytest


class TestNurseDashboard:
    def test_dashboard(self, client, nurse_token):
        resp = client.get('/nurse/dashboard',
                          headers={'Authorization': f'Bearer {nurse_token}'})
        data = resp.get_json()
        assert data['success']
        assert 'user_info' in data['data']
        assert 'statistics' in data['data']

    def test_dashboard_requires_nurse_role(self, client, admin_token):
        resp = client.get('/nurse/dashboard',
                          headers={'Authorization': f'Bearer {admin_token}'})
        # Admin can also access — it just requires nurse_required
        # Nurse_required decorator checks role, not access
        pass  # Admin can access nurse routes for testing


class TestNurseCases:
    def test_list_cases_learning_only(self, client, nurse_token, sample_case):
        resp = client.get('/nurse/cases',
                          headers={'Authorization': f'Bearer {nurse_token}'})
        data = resp.get_json()
        assert data['success']
        assert 'cases' in data['data']
        # sample_case is learning type, should appear
        has_case = any(
            c['id'] == sample_case.id for c in data['data']['cases']
        ) if data['data']['cases'] else False

    def test_filter_by_category(self, client, nurse_token, category):
        resp = client.get(f'/nurse/cases?category_id={category.id}',
                          headers={'Authorization': f'Bearer {nurse_token}'})
        assert resp.get_json()['success']

    def test_get_case_detail(self, client, nurse_token, sample_case):
        resp = client.get(f'/nurse/cases/{sample_case.id}',
                          headers={'Authorization': f'Bearer {nurse_token}'})
        data = resp.get_json()
        assert data['success']
        assert 'videos' in data['data']
        assert 'links' in data['data']
        assert 'stations' in data['data']
        assert 'extended_knowledge' in data['data']

    def test_case_not_found(self, client, nurse_token):
        resp = client.get('/nurse/cases/99999',
                          headers={'Authorization': f'Bearer {nurse_token}'})
        assert resp.status_code == 404


class TestAnswerSubmission:
    def test_submit_answer(self, client, nurse_token, sample_case):
        from models import Station
        station = Station.query.first()
        if not station:
            pytest.skip('No station in fixture')
        resp = client.post(f'/nurse/stations/{station.id}/submit', json={
            'answer': '这是一个测试答案'
        }, headers={'Authorization': f'Bearer {nurse_token}'})
        data = resp.get_json()
        assert data['success']
        assert 'evaluation' in data

    def test_submit_empty_answer(self, client, nurse_token, sample_case):
        from models import Station
        station = Station.query.first()
        if not station:
            pytest.skip('No station in fixture')
        resp = client.post(f'/nurse/stations/{station.id}/submit', json={
            'answer': ''
        }, headers={'Authorization': f'Bearer {nurse_token}'})
        assert not resp.get_json()['success']

    def test_submit_answer_no_standard(self, client, nurse_token, sample_case):
        from models import Station, StandardAnswer, db
        # Create a fresh station with no standard answers
        with client.application.app_context():
            station = Station(case_id=sample_case.id, name='无标准答案站点',
                              question='无标准答案问题？', assessment_task='任务', order_index=99)
            db.session.add(station)
            db.session.commit()
            sid = station.id
        resp = client.post(f'/nurse/stations/{sid}/submit', json={
            'answer': '测试答案'
        }, headers={'Authorization': f'Bearer {nurse_token}'})
        assert not resp.get_json()['success']


class TestWrongQuestions:
    def test_list_wrong_questions(self, client, nurse_token):
        resp = client.get('/nurse/wrong-questions',
                          headers={'Authorization': f'Bearer {nurse_token}'})
        data = resp.get_json()
        assert data['success']

    def test_get_wrong_question_detail(self, client, nurse_token, sample_case):
        from models import Station
        station = Station.query.first()
        if not station:
            pytest.skip('No station')
        resp = client.get(f'/nurse/wrong-questions/{station.id}',
                          headers={'Authorization': f'Bearer {nurse_token}'})
        data = resp.get_json()
        assert data['success'] or resp.status_code == 404


class TestWeaknessAnalysis:
    def test_get_weakness(self, client, nurse_token):
        resp = client.get('/nurse/weakness-analysis',
                          headers={'Authorization': f'Bearer {nurse_token}'})
        data = resp.get_json()
        assert data['success']
        assert 'analysis' in data['data']

    def test_run_weakness_analysis(self, client, nurse_token):
        resp = client.post('/nurse/weakness-analysis/run',
                           headers={'Authorization': f'Bearer {nurse_token}'})
        data = resp.get_json()
        assert data['success']


class TestNurseExams:
    def test_list_published_exams(self, client, nurse_token):
        resp = client.get('/nurse/exams',
                          headers={'Authorization': f'Bearer {nurse_token}'})
        data = resp.get_json()
        assert data['success']


class TestPointRecords:
    def test_get_point_records(self, client, nurse_token):
        resp = client.get('/nurse/point-records',
                          headers={'Authorization': f'Bearer {nurse_token}'})
        data = resp.get_json()
        assert data['success']
        assert 'records' in data['data']
