"""数据库设计加固的回归测试。

对应修复：
1. LearningRecord 唯一约束 UNIQUE(user_id, station_id)
2. ExamRecord 唯一约束 UNIQUE(exam_id, user_id)
3. 考试时间窗统一存 naive UTC（parse_local_to_utc）
4. 删除案例时清理站点评论及点赞/举报；被考试引用时给出明确错误
"""
from datetime import datetime

import pytest
from sqlalchemy.exc import IntegrityError

from models import (
    db, User, Case, Station, Exam, ExamQuestion, ExamRecord, ExamAnswer,
    LearningRecord, Comment, CommentLike,
)
from utils.time_utils import parse_local_to_utc


def _make_user(app, username='regu1'):
    with app.app_context():
        u = User(username=username, real_name='Reg User', role='nurse', status='active')
        u.set_password('regtest123')
        db.session.add(u)
        db.session.commit()
        return u.id


def _make_case_with_station(app, cat_id, title='约束测试案例'):
    """通过 ORM 创建案例+站点，返回 (case_id, station_id)。"""
    with app.app_context():
        case = Case(title=title, category_id=cat_id)
        db.session.add(case)
        db.session.flush()
        station = Station(case_id=case.id, name='评估站点', question='评估问题',
                          station_type='assessment')
        db.session.add(station)
        db.session.commit()
        return case.id, station.id


def test_learning_record_unique_user_station(app, db_session, category):
    """同一用户+站点不允许两条学习记录。"""
    uid = _make_user(app)
    _, sid = _make_case_with_station(app, category.id)
    with app.app_context():
        db.session.add(LearningRecord(user_id=uid, station_id=sid, score=80))
        db.session.commit()
        db.session.add(LearningRecord(user_id=uid, station_id=sid, score=90))
        with pytest.raises(IntegrityError):
            db.session.commit()
        db.session.rollback()


def test_exam_record_unique_exam_user(app, db_session, category):
    """同一用户+考试只允许一条考试记录（与 start_exam 业务守卫一致）。"""
    uid = _make_user(app, 'regu2')
    with app.app_context():
        exam = Exam(title='唯一约束考试', creator_id=1, duration=30)
        db.session.add(exam)
        db.session.flush()
        db.session.add(ExamRecord(exam_id=exam.id, user_id=uid, max_score=100))
        db.session.commit()
        db.session.add(ExamRecord(exam_id=exam.id, user_id=uid, max_score=100))
        with pytest.raises(IntegrityError):
            db.session.commit()
        db.session.rollback()


def test_parse_local_to_utc():
    """datetime-local（naive 本地时间）与带时区 ISO 字符串都转为 naive UTC。"""
    assert parse_local_to_utc('2026-09-03T20:00') == datetime(2026, 9, 3, 12, 0)
    assert parse_local_to_utc('2026-09-03T20:00+08:00') == datetime(2026, 9, 3, 12, 0)
    with pytest.raises(ValueError):
        parse_local_to_utc('not-a-date')


def test_create_exam_stores_utc(client, app, admin_token):
    """创建考试：本地 20:00（Asia/Shanghai）应存为 12:00 UTC。"""
    resp = client.post('/admin/exams', json={
        'title': 'UTC 转换考试', 'description': '', 'duration': 60,
        'start_time': '2026-09-03T20:00',
    }, headers={'Authorization': f'Bearer {admin_token}'})
    assert resp.get_json()['success']
    exam_id = resp.get_json()['exam']['id']
    with app.app_context():
        exam = db.session.get(Exam, exam_id)
        assert exam.start_time.strftime('%Y-%m-%d %H:%M') == '2026-09-03 12:00'


def test_delete_case_cleans_comments(app, db_session, category):
    """删除案例：站点评论、点赞一并清理，不留孤儿。"""
    uid = _make_user(app, 'regu3')
    case_id, sid = _make_case_with_station(app, category.id, '评论清理案例')
    with app.app_context():
        comment = Comment(
            user_id=uid, content_type='station_answer', content_id=sid,
            content='测试评论')
        db.session.add(comment)
        db.session.flush()
        comment_id = comment.id
        db.session.add(CommentLike(user_id=uid, comment_id=comment_id))
        db.session.commit()
        assert Comment.query.filter_by(content_id=sid).count() == 1

        case = db.session.get(Case, case_id)
        from services import case_service
        err = case_service.delete_case(case)
        assert err is None
        assert Comment.query.filter_by(content_id=sid).count() == 0
        assert CommentLike.query.filter_by(comment_id=comment_id).count() == 0


def test_delete_case_referenced_by_exam_rejected(app, db_session, category):
    """被考试答卷引用的案例不可删除，返回明确错误（依赖 DB FK RESTRICT）。"""
    uid = _make_user(app, 'regu4')
    case_id, sid = _make_case_with_station(app, category.id, '被考试引用案例')
    with app.app_context():
        exam = Exam(title='引用考试', creator_id=1, duration=30)
        db.session.add(exam)
        db.session.flush()
        # 答卷必须引用考试下的真实题目（exam_questions 有 FK），不能用占位 id
        question = ExamQuestion(exam_id=exam.id, case_id=case_id)
        db.session.add(question)
        db.session.flush()
        record = ExamRecord(exam_id=exam.id, user_id=uid, max_score=100)
        db.session.add(record)
        db.session.flush()
        db.session.add(ExamAnswer(
            exam_record_id=record.id, exam_question_id=question.id, station_id=sid))
        db.session.commit()

        case = db.session.get(Case, case_id)
        from services import case_service
        err = case_service.delete_case(case)
        assert err == '该案例已被考试引用，无法删除'
        assert db.session.get(Case, case_id) is not None
