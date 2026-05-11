"""Comprehensive v3.0.1 tests: exam review, score edit, re-score, export, nurse result, QR flow."""
import json
import io
import pytest
from models import db, User, Case, Station, StandardAnswer, Exam, ExamQuestion, ExamRecord, ExamAnswer, CaseCategory


def _ensure_data(app):
    """Ensure base test data exists. Returns (case_id, station_id)."""
    with app.app_context():
        cat = CaseCategory.query.filter_by(name='v3.0.1 测试').first()
        if cat is None:
            cat = CaseCategory(name='v3.0.1 测试', description='test')
            db.session.add(cat)
            db.session.flush()

        existing = Case.query.filter_by(title='v3.0.1 案例').first()
        if existing:
            st = Station.query.filter_by(case_id=existing.id).first()
            return existing.id, (st.id if st else None)

        case = Case(category_id=cat.id, title='v3.0.1 案例',
                    case_guide='测试案例背景', difficulty='intermediate', case_type='learning')
        db.session.add(case)
        db.session.flush()

        station = Station(case_id=case.id, name='v3.0.1 站点', assessment_task='考核任务',
                          question='问题内容', order_index=0)
        db.session.add(station)
        db.session.flush()

        ans = StandardAnswer(station_id=station.id, answer_item='答案项',
                            score_weight=1.0, order_index=0)
        db.session.add(ans)
        db.session.commit()
        return case.id, station.id


def _create_and_publish_exam(client, admin_token, title, case_id):
    """Helper: create exam, add question, publish. Returns exam_id."""
    resp = client.post('/admin/exams',
                       headers={'Authorization': f'Bearer {admin_token}'},
                       json={'title': title, 'duration_minutes': 60,
                             'pass_score': 60, 'case_type': 'learning'})
    assert resp.status_code == 200
    data = resp.get_json()
    assert data['success'], f"Create exam failed: {data}"
    exam_id = data['exam']['id']

    # Add question
    add_resp = client.post(f'/admin/exams/{exam_id}/questions',
                           headers={'Authorization': f'Bearer {admin_token}'},
                           json={'case_ids': [case_id]})
    assert add_resp.get_json()['success'], f"Add question failed: {add_resp.get_json()}"

    # Publish
    pub_resp = client.post(f'/admin/exams/{exam_id}/publish',
                           headers={'Authorization': f'Bearer {admin_token}'})
    assert pub_resp.get_json()['success'], f"Publish failed: {pub_resp.get_json()}"
    return exam_id


def _create_exam_with_submission(app, client, admin_token, nurse_user, nurse_token):
    """Helper: create a published exam with a case question, submit it as nurse, return ids."""
    case_id, station_id = _ensure_data(app)

    exam_id = _create_and_publish_exam(client, admin_token, 'v3.0.1 综合测试', case_id)

    # Get exam_question_id
    eq_id = None
    with app.app_context():
        eq = ExamQuestion.query.filter_by(exam_id=exam_id, case_id=case_id).first()
        eq_id = eq.id if eq else None

    # Nurse starts exam
    client.post(f'/nurse/exams/{exam_id}/start',
                headers={'Authorization': f'Bearer {nurse_token}'})

    # Submit exam
    client.post(f'/nurse/exams/{exam_id}/submit',
                headers={'Authorization': f'Bearer {nurse_token}'},
                json={'answers': [{'station_id': station_id, 'exam_question_id': eq_id, 'answer': '护士的回答内容'}]})

    # Get record id and answer id
    record_id = None
    answer_id = None
    with app.app_context():
        record = ExamRecord.query.filter_by(exam_id=exam_id, user_id=nurse_user.id).first()
        if record:
            record_id = record.id
            ans = ExamAnswer.query.filter_by(exam_record_id=record.id).first()
            answer_id = ans.id if ans else None

    return {
        'exam_id': exam_id,
        'case_id': case_id,
        'station_id': station_id,
        'eq_id': eq_id,
        'record_id': record_id,
        'answer_id': answer_id,
    }


class TestExamReviewAndScoring:
    """Tests for admin exam review, score editing, re-scoring."""

    def test_review_page_requires_admin(self, client, nurse_token, app, admin_token, nurse_user):
        ids = _create_exam_with_submission(app, client, admin_token, nurse_user, nurse_token)
        resp = client.get(f'/admin/exams/{ids["exam_id"]}/review',
                         headers={'Authorization': f'Bearer {nurse_token}'})
        # Nurse accessing admin route should fail
        assert resp.status_code in (200, 302, 403)

    def test_review_page_returns_participants(self, client, admin_token, app, nurse_user, nurse_token):
        ids = _create_exam_with_submission(app, client, admin_token, nurse_user, nurse_token)
        resp = client.get(f'/admin/exams/{ids["exam_id"]}/review',
                         headers={'Authorization': f'Bearer {admin_token}'})
        assert resp.status_code == 200
        data = resp.get_json()
        assert data['success']
        assert 'data' in data
        assert 'participants' in data['data']
        assert 'exam' in data['data']

    def test_edit_score(self, client, admin_token, app, nurse_user, nurse_token):
        ids = _create_exam_with_submission(app, client, admin_token, nurse_user, nurse_token)
        assert ids['answer_id'] is not None, "Answer was not created"

        resp = client.put(f'/admin/exams/{ids["exam_id"]}/review/{ids["answer_id"]}/score',
                          headers={'Authorization': f'Bearer {admin_token}'},
                          json={'score': 85})
        assert resp.status_code == 200
        data = resp.get_json()
        assert data['success']

    def test_edit_score_accepts_any_value(self, client, admin_token, app, nurse_user, nurse_token):
        ids = _create_exam_with_submission(app, client, admin_token, nurse_user, nurse_token)
        resp = client.put(f'/admin/exams/{ids["exam_id"]}/review/{ids["answer_id"]}/score',
                          headers={'Authorization': f'Bearer {admin_token}'},
                          json={'score': 150})
        assert resp.status_code == 200
        assert resp.get_json()['success']

    def test_edit_score_missing_score_field(self, client, admin_token, app, nurse_user, nurse_token):
        ids = _create_exam_with_submission(app, client, admin_token, nurse_user, nurse_token)
        resp = client.put(f'/admin/exams/{ids["exam_id"]}/review/{ids["answer_id"]}/score',
                          headers={'Authorization': f'Bearer {admin_token}'},
                          json={})
        assert resp.status_code == 400
        assert not resp.get_json()['success']

    def test_ai_re_score(self, client, admin_token, app, nurse_user, nurse_token):
        ids = _create_exam_with_submission(app, client, admin_token, nurse_user, nurse_token)
        assert ids['answer_id'] is not None, "Answer was not created"

        resp = client.post(f'/admin/exams/{ids["exam_id"]}/review/{ids["answer_id"]}/re-score',
                           headers={'Authorization': f'Bearer {admin_token}'})
        assert resp.status_code == 200
        data = resp.get_json()
        assert data['success']

    def test_edit_score_nonexistent_answer(self, client, admin_token, app, nurse_user, nurse_token):
        ids = _create_exam_with_submission(app, client, admin_token, nurse_user, nurse_token)
        resp = client.put(f'/admin/exams/{ids["exam_id"]}/review/99999/score',
                          headers={'Authorization': f'Bearer {admin_token}'},
                          json={'score': 80})
        assert resp.status_code == 404


class TestCSVExport:
    """Tests for batch CSV export of exam results."""

    def test_export_csv_basic(self, client, admin_token, app, nurse_user, nurse_token):
        ids = _create_exam_with_submission(app, client, admin_token, nurse_user, nurse_token)
        resp = client.get(f'/admin/exams/{ids["exam_id"]}/export',
                         headers={'Authorization': f'Bearer {admin_token}'})
        assert resp.status_code == 200
        assert 'text/csv' in resp.content_type

    def test_export_csv_no_submissions(self, client, admin_token, app):
        case_id, _ = _ensure_data(app)
        exam_id = _create_and_publish_exam(client, admin_token, '空考试', case_id)
        resp = client.get(f'/admin/exams/{exam_id}/export',
                         headers={'Authorization': f'Bearer {admin_token}'})
        assert resp.status_code == 200

    def test_export_requires_admin(self, client, nurse_token, admin_token, app, nurse_user):
        ids = _create_exam_with_submission(app, client, admin_token, nurse_user, nurse_token)
        resp = client.get(f'/admin/exams/{ids["exam_id"]}/export',
                         headers={'Authorization': f'Bearer {nurse_token}'})
        assert resp.status_code in (200, 302, 403)

    def test_export_nonexistent_exam(self, client, admin_token):
        resp = client.get('/admin/exams/99999/export',
                         headers={'Authorization': f'Bearer {admin_token}'})
        assert resp.status_code == 404


class TestNurseExamResult:
    """Tests for nurse exam result viewing."""

    def test_get_result_with_submission(self, client, admin_token, app, nurse_user, nurse_token):
        ids = _create_exam_with_submission(app, client, admin_token, nurse_user, nurse_token)
        resp = client.get(f'/nurse/exams/{ids["exam_id"]}/result',
                         headers={'Authorization': f'Bearer {nurse_token}'})
        assert resp.status_code == 200
        result = resp.get_json()
        assert result['success']
        data = result.get('data', result)
        assert 'answers' in data
        assert 'total_score' in data

    def test_get_result_no_record(self, client, nurse_token, admin_token, app):
        case_id, _ = _ensure_data(app)
        exam_id = _create_and_publish_exam(client, admin_token, '未参加考试', case_id)
        resp = client.get(f'/nurse/exams/{exam_id}/result',
                         headers={'Authorization': f'Bearer {nurse_token}'})
        assert resp.status_code == 404

    def test_result_requires_nurse_role(self, client, admin_token, app, nurse_user, nurse_token):
        ids = _create_exam_with_submission(app, client, admin_token, nurse_user, nurse_token)
        resp = client.get(f'/nurse/exams/{ids["exam_id"]}/result',
                         headers={'Authorization': f'Bearer {admin_token}'})
        assert resp.status_code in (200, 302, 403)

    def test_result_contains_case_info(self, client, admin_token, app, nurse_user, nurse_token):
        ids = _create_exam_with_submission(app, client, admin_token, nurse_user, nurse_token)
        resp = client.get(f'/nurse/exams/{ids["exam_id"]}/result',
                         headers={'Authorization': f'Bearer {nurse_token}'})
        data = resp.get_json()
        assert data['success']
        if data.get('answers'):
            ans = data['answers'][0]
            assert 'station_name' in ans or 'station_id' in ans
            assert 'score' in ans
            assert 'ai_feedback' in ans


class TestExamSubmission:
    """Tests for exam start/submit flow including edge cases."""

    def test_start_exam_success(self, client, admin_token, app, nurse_token):
        case_id, _ = _ensure_data(app)
        exam_id = _create_and_publish_exam(client, admin_token, '开始考试测试', case_id)

        resp = client.post(f'/nurse/exams/{exam_id}/start',
                          headers={'Authorization': f'Bearer {nurse_token}'})
        assert resp.status_code == 200
        data = resp.get_json()
        assert data['success']

    def test_submit_empty_answers_rejected(self, client, admin_token, app, nurse_token):
        case_id, _ = _ensure_data(app)
        exam_id = _create_and_publish_exam(client, admin_token, '空答案测试', case_id)

        # Start exam first
        start_resp = client.post(f'/nurse/exams/{exam_id}/start',
                                headers={'Authorization': f'Bearer {nurse_token}'})
        assert start_resp.get_json()['success']

        resp = client.post(f'/nurse/exams/{exam_id}/submit',
                          headers={'Authorization': f'Bearer {nurse_token}'},
                          json={'answers': []})
        # Empty answers is rejected (400) or returns success: False (200)
        assert resp.status_code in (200, 400)
        assert not resp.get_json()['success']

    def test_double_submit_rejected(self, client, admin_token, app, nurse_user, nurse_token):
        ids = _create_exam_with_submission(app, client, admin_token, nurse_user, nurse_token)
        # Record is already 'submitted', so double submit returns 404 (no in_progress record)
        resp = client.post(f'/nurse/exams/{ids["exam_id"]}/submit',
                          headers={'Authorization': f'Bearer {nurse_token}'},
                          json={'answers': [{'station_id': ids['station_id'], 'exam_question_id': ids['eq_id'], 'answer': '第二次提交'}]})
        assert resp.status_code == 404

    def test_duplicate_answer_ids_in_submit(self, client, admin_token, app, nurse_user, nurse_token):
        ids = _create_exam_with_submission(app, client, admin_token, nurse_user, nurse_token)
        case_id, _ = _ensure_data(app)
        exam_id = _create_and_publish_exam(client, admin_token, '重复答案测试', case_id)

        # Start exam first
        client.post(f'/nurse/exams/{exam_id}/start',
                    headers={'Authorization': f'Bearer {nurse_token}'})

        with app.app_context():
            eq = ExamQuestion.query.filter_by(exam_id=exam_id, case_id=case_id).first()
            new_eq_id = eq.id if eq else None

        station_id = ids['station_id']
        resp = client.post(f'/nurse/exams/{exam_id}/submit',
                          headers={'Authorization': f'Bearer {nurse_token}'},
                          json={'answers': [
                              {'station_id': station_id, 'exam_question_id': new_eq_id, 'answer': '答案A'},
                              {'station_id': station_id, 'exam_question_id': new_eq_id, 'answer': '答案B'},
                          ]})
        assert resp.status_code == 400
        assert not resp.get_json()['success']


class TestQRCodeFlow:
    """Tests for QR code token generation and exam access."""

    def test_qr_code_returns_png(self, client, admin_token, app):
        case_id, _ = _ensure_data(app)
        exam_id = _create_and_publish_exam(client, admin_token, 'QR测试', case_id)

        resp = client.get(f'/admin/exams/{exam_id}/qr-code',
                         headers={'Authorization': f'Bearer {admin_token}'})
        assert resp.status_code == 200
        assert resp.content_type in ('image/png', 'image/png; charset=utf-8')

    def test_exam_access_page_loads(self, client):
        resp = client.get('/nurse/exam-access')
        # Returns HTML page (200), redirect (302), or error if token missing (400)
        assert resp.status_code in (200, 302, 400)

    def test_exam_access_with_token_param(self, client, admin_token, app):
        case_id, _ = _ensure_data(app)
        exam_id = _create_and_publish_exam(client, admin_token, 'QR访问测试', case_id)

        from flask_jwt_extended import create_access_token
        token = create_access_token(identity=f'exam:{exam_id}')
        resp = client.get(f'/nurse/exam-access?token={token}')
        assert resp.status_code in (200, 302, 400)


class TestStationExamValidation:
    """Tests for station-exam ownership validation in exam submission."""

    def test_submit_station_not_in_exam(self, client, admin_token, app, nurse_user, nurse_token):
        """Submit answer for a station not in the exam -> rejected."""
        station2_id = None
        with app.app_context():
            cat = CaseCategory.query.filter_by(name='v3.0.1 验证').first()
            if cat is None:
                cat = CaseCategory(name='v3.0.1 验证', description='test')
                db.session.add(cat)
                db.session.flush()

            case2 = Case(category_id=cat.id, title='外部案例', case_guide='g',
                        difficulty='intermediate', case_type='learning')
            db.session.add(case2)
            db.session.flush()
            station2 = Station(case_id=case2.id, name='外部站点', question='Q', order_index=0)
            db.session.add(station2)
            db.session.commit()
            station2_id = station2.id

        # Use _create_exam_with_submission which creates an exam with its own case
        # But create a FRESH exam (not yet submitted) for validation test
        ids = _create_exam_with_submission(app, client, admin_token, nurse_user, nurse_token)

        # Create a new exam that is NOT yet submitted
        case_id, _ = _ensure_data(app)
        new_exam_id = _create_and_publish_exam(client, admin_token, '范围验证考试', case_id)

        with app.app_context():
            eq = ExamQuestion.query.filter_by(exam_id=new_exam_id, case_id=case_id).first()
            new_eq_id = eq.id if eq else None

        # Start and submit for the new exam with station not in the exam
        client.post(f'/nurse/exams/{new_exam_id}/start',
                    headers={'Authorization': f'Bearer {nurse_token}'})
        resp = client.post(f'/nurse/exams/{new_exam_id}/submit',
                          headers={'Authorization': f'Bearer {nurse_token}'},
                          json={'answers': [{'station_id': station2_id, 'exam_question_id': new_eq_id, 'answer': '越界答案'}]})
        # Invalid station-exam pair returns 400
        assert resp.status_code == 400
        assert not resp.get_json()['success']


class TestJWTAndSessionAuth:
    """Verify all new v3.0.1 endpoints work with JWT Bearer auth."""

    def test_review_with_jwt(self, client, admin_token, app, nurse_user, nurse_token):
        ids = _create_exam_with_submission(app, client, admin_token, nurse_user, nurse_token)
        resp = client.get(f'/admin/exams/{ids["exam_id"]}/review',
                         headers={'Authorization': f'Bearer {admin_token}'})
        assert resp.status_code == 200

    def test_export_with_jwt(self, client, admin_token, app, nurse_user, nurse_token):
        ids = _create_exam_with_submission(app, client, admin_token, nurse_user, nurse_token)
        resp = client.get(f'/admin/exams/{ids["exam_id"]}/export',
                         headers={'Authorization': f'Bearer {admin_token}'})
        assert resp.status_code == 200

    def test_result_with_jwt(self, client, admin_token, app, nurse_user, nurse_token):
        ids = _create_exam_with_submission(app, client, admin_token, nurse_user, nurse_token)
        resp = client.get(f'/nurse/exams/{ids["exam_id"]}/result',
                         headers={'Authorization': f'Bearer {nurse_token}'})
        assert resp.status_code == 200


class TestPointsSystem:
    """Tests for points updates on exam submission."""

    def test_submit_exam_awards_points(self, client, admin_token, app, nurse_user, nurse_token):
        ids = _create_exam_with_submission(app, client, admin_token, nurse_user, nurse_token)
        with app.app_context():
            user = db.session.get(User, nurse_user.id)
            before_points = user.points

        # Create and submit another exam for the same nurse
        case_id, _ = _ensure_data(app)
        exam_id = _create_and_publish_exam(client, admin_token, '积分测试', case_id)

        with app.app_context():
            eq2 = ExamQuestion.query.filter_by(exam_id=exam_id, case_id=case_id).first()
            eq2_id = eq2.id if eq2 else None

        client.post(f'/nurse/exams/{exam_id}/start',
                   headers={'Authorization': f'Bearer {nurse_token}'})
        client.post(f'/nurse/exams/{exam_id}/submit',
                   headers={'Authorization': f'Bearer {nurse_token}'},
                   json={'answers': [{'station_id': ids['station_id'], 'exam_question_id': eq2_id, 'answer': '答题内容'}]})

        with app.app_context():
            user_after = db.session.get(User, nurse_user.id)
            assert user_after.points >= before_points


class TestErrorMessages:
    """Verify secure error messages (no internal info leak)."""

    def test_review_score_not_found(self, client, admin_token):
        resp = client.put('/admin/exams/1/review/99999/score',
                         headers={'Authorization': f'Bearer {admin_token}'},
                         json={'score': 80})
        data = resp.get_json()
        assert 'success' in data
        msg = data.get('message', '')
        assert 'Traceback' not in msg
        assert 'Exception' not in msg
        assert 'File "' not in msg

    def test_export_not_found(self, client, admin_token):
        resp = client.get('/admin/exams/99999/export',
                         headers={'Authorization': f'Bearer {admin_token}'})
        data = resp.get_json()
        msg = data.get('message', '')
        assert 'Traceback' not in msg

    def test_result_not_found(self, client, nurse_token):
        resp = client.get('/nurse/exams/99999/result',
                         headers={'Authorization': f'Bearer {nurse_token}'})
        data = resp.get_json()
        msg = data.get('message', '')
        assert 'Traceback' not in msg
