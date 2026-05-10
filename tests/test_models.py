"""Tests for all ORM models and their relationships."""
import pytest
from models import User, CaseCategory, Case, Station, StandardAnswer, ExtendedKnowledge
from models import ExtensionVideo, ExtensionLink, LearningRecord, WrongQuestion
from models import Exam, ExamQuestion, ExamRecord, ExamAnswer, PointRecord
from models import AiSetting, WeaknessAnalysis, Comment, CommentLike, CommentReport
from models import db


class TestUser:
    def test_create_user(self, app):
        with app.app_context():
            user = User(username='test', real_name='Test', role='nurse')
            user.set_password('password123')
            db.session.add(user)
            db.session.commit()
            assert user.id is not None
            assert user.check_password('password123')
            assert not user.check_password('wrongpass')
            assert user.is_active()
            assert not user.is_admin()
            assert user.points == 0

    def test_admin_role(self, app):
        with app.app_context():
            user = User(username='admin', real_name='Admin', role='admin')
            assert user.is_admin()

    def test_disabled_user(self, app):
        with app.app_context():
            user = User(username='disabled', real_name='Disabled',
                        role='nurse', status='disabled')
            assert not user.is_active()


class TestCaseCategory:
    def test_create(self, app):
        with app.app_context():
            cat = CaseCategory(name='测试类别', description='测试描述')
            db.session.add(cat)
            db.session.commit()
            assert cat.id is not None
            assert cat.name == '测试类别'


class TestCase:
    def test_create(self, app, category):
        with app.app_context():
            cat = db.session.merge(category)
            case = Case(category_id=cat.id, title='案例1',
                        difficulty='basic', case_type='learning',
                        case_guide='指引')
            db.session.add(case)
            db.session.commit()
            assert case.difficulty == 'basic'
            assert case.case_type == 'learning'
            assert case.category.name == '儿科模块'

    def test_default_values(self, app, category):
        with app.app_context():
            cat = db.session.merge(category)
            case = Case(category_id=cat.id, title='案例2')
            db.session.add(case)
            db.session.commit()
            assert case.difficulty == 'intermediate'
            assert case.case_type == 'learning'


class TestStation:
    def test_create_with_answers(self, app, sample_case):
        with app.app_context():
            c = db.session.merge(sample_case)
            station = Station(case_id=c.id, name='S1', question='Q?',
                              assessment_task='Task', order_index=0)
            db.session.add(station)
            db.session.flush()
            ans = StandardAnswer(station_id=station.id, answer_item='A1',
                                 score_weight=1.0, order_index=0)
            db.session.add(ans)
            db.session.commit()
            assert station.id is not None
            assert station.standard_answers.count() == 1

    def test_cascade_delete(self, app, category):
        with app.app_context():
            cat = db.session.merge(category)
            tmp = Case(category_id=cat.id, title='cascade-delete-test',
                       case_guide='test', case_type='learning')
            db.session.add(tmp)
            db.session.flush()
            station = Station(case_id=tmp.id, name='tmp-s', question='Q?',
                              assessment_task='Task', order_index=0)
            db.session.add(station)
            db.session.commit()
            sid = tmp.id
            # Deleting the case should cascade-delete its stations
            c = db.session.merge(tmp)
            db.session.delete(c)
            db.session.commit()
            assert Station.query.filter_by(case_id=sid).count() == 0


class TestExtensionVideoLink:
    def test_video_creation(self, app, sample_case, db_session):
        with app.app_context():
            c = db.session.merge(sample_case)
            v = ExtensionVideo(case_id=c.id, title='V1', url='https://v.com',
                               description='desc', order_index=0)
            db.session.add(v)
            db.session.commit()
            assert v.id is not None
            assert c.videos.count() >= 1

    def test_link_creation(self, app, sample_case):
        with app.app_context():
            c = db.session.merge(sample_case)
            l = ExtensionLink(case_id=c.id, title='L1', url='https://l.com',
                              description='desc', order_index=0)
            db.session.add(l)
            db.session.commit()
            assert l.id is not None
            assert c.links.count() >= 1


class TestLearningRecord:
    def test_create_record(self, app, nurse_user, sample_case):
        with app.app_context():
            u = db.session.merge(nurse_user)
            c = db.session.merge(sample_case)
            station = c.stations.first()
            record = LearningRecord(user_id=u.id, station_id=station.id,
                                    user_answer='回答', score=85.0)
            db.session.add(record)
            db.session.commit()
            assert record.id is not None
            assert float(record.score) == 85.0


class TestExamModels:
    def test_create_exam(self, app, admin_user):
        with app.app_context():
            u = db.session.merge(admin_user)
            exam = Exam(title='考试1', creator_id=u.id, duration=60, status='draft')
            db.session.add(exam)
            db.session.commit()
            assert exam.id is not None
            assert exam.status == 'draft'

    def test_exam_with_questions(self, app, admin_user, sample_case):
        with app.app_context():
            u = db.session.merge(admin_user)
            c = db.session.merge(sample_case)
            station = c.stations.first()
            exam = Exam(title='考试2', creator_id=u.id)
            db.session.add(exam)
            db.session.flush()
            eq = ExamQuestion(exam_id=exam.id, station_id=station.id, score=10.0)
            db.session.add(eq)
            db.session.commit()
            assert exam.questions.count() == 1


class TestAiSetting:
    def test_singleton(self, app):
        with app.app_context():
            s1 = AiSetting.get_singleton()
            s2 = AiSetting.get_singleton()
            assert s1.id == s2.id
            assert s1.provider == 'local'


class TestWeaknessAnalysis:
    def test_create(self, app, nurse_user):
        with app.app_context():
            u = db.session.merge(nurse_user)
            wa = WeaknessAnalysis(user_id=u.id, content='{"key":"val"}')
            db.session.add(wa)
            db.session.commit()
            assert wa.id is not None


class TestComment:
    def test_create_comment(self, app, nurse_user):
        with app.app_context():
            u = db.session.merge(nurse_user)
            c = Comment(user_id=u.id, content_type='station_answer',
                        content_id=1, content='好答案')
            db.session.add(c)
            db.session.commit()
            assert c.id is not None
            assert c.status == 'active'

    def test_comment_reply(self, app, nurse_user):
        with app.app_context():
            u = db.session.merge(nurse_user)
            parent = Comment(user_id=u.id, content_type='station_answer',
                             content_id=1, content='父评论')
            db.session.add(parent)
            db.session.flush()
            reply = Comment(user_id=u.id, content_type='station_answer',
                            content_id=1, content='回复', parent_id=parent.id)
            db.session.add(reply)
            db.session.commit()
            assert parent.replies.count() == 1

    def test_comment_like(self, app, nurse_user):
        with app.app_context():
            u = db.session.merge(nurse_user)
            c = Comment(user_id=u.id, content_type='station_answer',
                        content_id=1, content='评论')
            db.session.add(c)
            db.session.flush()
            like = CommentLike(user_id=u.id, comment_id=c.id)
            db.session.add(like)
            db.session.commit()
            assert CommentLike.query.count() == 1

    def test_unique_like(self, app, nurse_user):
        with app.app_context():
            u = db.session.merge(nurse_user)
            c = Comment(user_id=u.id, content_type='station_answer',
                        content_id=1, content='评论')
            db.session.add(c)
            db.session.flush()
            db.session.add(CommentLike(user_id=u.id, comment_id=c.id))
            db.session.commit()
            with pytest.raises(Exception):
                db.session.add(CommentLike(user_id=u.id, comment_id=c.id))
                db.session.commit()
            db.session.rollback()


class TestCommentReport:
    def test_create_report(self, app, nurse_user, admin_user):
        with app.app_context():
            u = db.session.merge(nurse_user)
            a = db.session.merge(admin_user)
            c = Comment(user_id=a.id, content_type='station_answer',
                        content_id=1, content='评论')
            db.session.add(c)
            db.session.flush()
            report = CommentReport(user_id=u.id, comment_id=c.id,
                                   reason='spam', description='垃圾')
            db.session.add(report)
            db.session.commit()
            assert report.status == 'pending'
