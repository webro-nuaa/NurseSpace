from flask_sqlalchemy import SQLAlchemy
from flask_login import UserMixin
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime

# 这里不直接导入db，而是在需要时从flask的current_app中获取
db = SQLAlchemy()

class User(UserMixin, db.Model):
    __tablename__ = 'users'
    
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(50), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    email = db.Column(db.String(100))
    phone = db.Column(db.String(20))
    real_name = db.Column(db.String(50), nullable=False)
    role = db.Column(db.Enum('nurse', 'admin'), nullable=False, default='nurse')
    department = db.Column(db.String(100))
    status = db.Column(db.Enum('active', 'disabled'), default='active')
    points = db.Column(db.Integer, default=0)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # 关系
    learning_records = db.relationship('LearningRecord', backref='user', lazy='dynamic')
    wrong_questions = db.relationship('WrongQuestion', backref='user', lazy='dynamic')
    exam_records = db.relationship('ExamRecord', backref='user', lazy='dynamic')
    point_records = db.relationship('PointRecord', backref='user', lazy='dynamic')
    
    def set_password(self, password):
        self.password_hash = generate_password_hash(password)
    
    def check_password(self, password):
        return check_password_hash(self.password_hash, password)
    
    def is_admin(self):
        return self.role == 'admin'
    
    def is_active(self):
        return self.status == 'active'

class CaseCategory(db.Model):
    __tablename__ = 'case_categories'
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(50), nullable=False)
    description = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # 关系
    cases = db.relationship('Case', backref='category', lazy='dynamic')

class Case(db.Model):
    __tablename__ = 'cases'
    
    id = db.Column(db.Integer, primary_key=True)
    category_id = db.Column(db.Integer, db.ForeignKey('case_categories.id'), nullable=False)
    title = db.Column(db.String(200), nullable=False)
    case_guide = db.Column(db.Text)
    site_info = db.Column(db.String(100))
    file_path = db.Column(db.String(500))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # 关系
    stations = db.relationship('Station', backref='case', lazy='dynamic', cascade='all, delete-orphan')
    extended_knowledge = db.relationship('ExtendedKnowledge', backref='case', lazy='dynamic', cascade='all, delete-orphan')

class Station(db.Model):
    __tablename__ = 'stations'
    
    id = db.Column(db.Integer, primary_key=True)
    case_id = db.Column(db.Integer, db.ForeignKey('cases.id'), nullable=False)
    name = db.Column(db.String(200), nullable=False)
    assessment_task = db.Column(db.Text)
    question = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # 关系
    standard_answers = db.relationship('StandardAnswer', backref='station', lazy='dynamic', cascade='all, delete-orphan')
    learning_records = db.relationship('LearningRecord', backref='station', lazy='dynamic')
    wrong_questions = db.relationship('WrongQuestion', backref='station', lazy='dynamic')
    exam_questions = db.relationship('ExamQuestion', backref='station', lazy='dynamic')
    exam_answers = db.relationship('ExamAnswer', backref='station', lazy='dynamic')

class StandardAnswer(db.Model):
    __tablename__ = 'standard_answers'
    
    id = db.Column(db.Integer, primary_key=True)
    station_id = db.Column(db.Integer, db.ForeignKey('stations.id'), nullable=False)
    answer_item = db.Column(db.Text, nullable=False)
    score_weight = db.Column(db.Numeric(5, 2), default=1.00)
    order_index = db.Column(db.Integer, default=0)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class ExtendedKnowledge(db.Model):
    __tablename__ = 'extended_knowledge'
    
    id = db.Column(db.Integer, primary_key=True)
    case_id = db.Column(db.Integer, db.ForeignKey('cases.id'), nullable=False)
    question = db.Column(db.Text, nullable=False)
    answer = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class LearningRecord(db.Model):
    __tablename__ = 'learning_records'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    station_id = db.Column(db.Integer, db.ForeignKey('stations.id'), nullable=False)
    user_answer = db.Column(db.Text)
    score = db.Column(db.Numeric(5, 2))
    max_score = db.Column(db.Numeric(5, 2), default=100.00)
    ai_feedback = db.Column(db.Text)
    completed_at = db.Column(db.DateTime, default=datetime.utcnow)

class WrongQuestion(db.Model):
    __tablename__ = 'wrong_questions'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    station_id = db.Column(db.Integer, db.ForeignKey('stations.id'), nullable=False)
    score = db.Column(db.Numeric(5, 2))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    __table_args__ = (db.UniqueConstraint('user_id', 'station_id', name='unique_user_station'),)

class Exam(db.Model):
    __tablename__ = 'exams'
    
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text)
    creator_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    start_time = db.Column(db.DateTime)
    end_time = db.Column(db.DateTime)
    duration = db.Column(db.Integer, default=60)  # 分钟
    status = db.Column(db.Enum('draft', 'published', 'ended'), default='draft')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # 关系
    creator = db.relationship('User', backref='created_exams')
    questions = db.relationship('ExamQuestion', backref='exam', lazy='dynamic', cascade='all, delete-orphan')
    records = db.relationship('ExamRecord', backref='exam', lazy='dynamic')

class ExamQuestion(db.Model):
    __tablename__ = 'exam_questions'
    
    id = db.Column(db.Integer, primary_key=True)
    exam_id = db.Column(db.Integer, db.ForeignKey('exams.id'), nullable=False)
    station_id = db.Column(db.Integer, db.ForeignKey('stations.id'), nullable=False)
    score = db.Column(db.Numeric(5, 2), default=10.00)
    order_index = db.Column(db.Integer, default=0)

class ExamRecord(db.Model):
    __tablename__ = 'exam_records'
    
    id = db.Column(db.Integer, primary_key=True)
    exam_id = db.Column(db.Integer, db.ForeignKey('exams.id'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    total_score = db.Column(db.Numeric(5, 2), default=0)
    max_score = db.Column(db.Numeric(5, 2), default=100)
    start_time = db.Column(db.DateTime, default=datetime.utcnow)
    submit_time = db.Column(db.DateTime)
    status = db.Column(db.Enum('in_progress', 'submitted'), default='in_progress')
    
    # 关系
    answers = db.relationship('ExamAnswer', backref='exam_record', lazy='dynamic', cascade='all, delete-orphan')

class ExamAnswer(db.Model):
    __tablename__ = 'exam_answers'
    
    id = db.Column(db.Integer, primary_key=True)
    exam_record_id = db.Column(db.Integer, db.ForeignKey('exam_records.id'), nullable=False)
    station_id = db.Column(db.Integer, db.ForeignKey('stations.id'), nullable=False)
    user_answer = db.Column(db.Text)
    score = db.Column(db.Numeric(5, 2), default=0)
    ai_feedback = db.Column(db.Text)

class PointRecord(db.Model):
    __tablename__ = 'point_records'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    points = db.Column(db.Integer, nullable=False)
    reason = db.Column(db.String(200))
    related_id = db.Column(db.Integer)
    related_type = db.Column(db.Enum('learning', 'exam'))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)


class AiSetting(db.Model):
    __tablename__ = 'ai_settings'

    id = db.Column(db.Integer, primary_key=True)
    # provider: glm | openai | local
    provider = db.Column(db.String(20), nullable=False, default='local')
    
    # OpenAI
    openai_key = db.Column(db.String(200))
    openai_model = db.Column(db.String(100))

    # Zhipu GLM
    zhipu_key = db.Column(db.String(200))
    zhipu_model = db.Column(db.String(100))

    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    @staticmethod
    def get_singleton() -> "AiSetting":
        setting = AiSetting.query.get(1)
        if not setting:
            setting = AiSetting(id=1, provider='local')
            db.session.add(setting)
            db.session.commit()
        return setting


class WeaknessAnalysis(db.Model):
    __tablename__ = 'weakness_analysis'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False, unique=True)
    content = db.Column(db.Text, nullable=False)  # 存储分析JSON文本
    generated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # 关系（可选）
    user = db.relationship('User', backref=db.backref('weakness_analysis', uselist=False))

class Comment(db.Model):
    """评论表 - 支持对答案的评论和讨论"""
    __tablename__ = 'comments'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    
    # 评论内容类型：station_answer(站点答案), knowledge_answer(扩展知识答案)
    content_type = db.Column(db.Enum('station_answer', 'knowledge_answer'), nullable=False)
    
    # 关联的答案ID（站点ID或扩展知识ID）
    content_id = db.Column(db.Integer, nullable=False)
    
    # 评论内容
    content = db.Column(db.Text, nullable=False)
    
    # 评论类型：comment(普通评论), question(问题), answer(回答), suggestion(建议)
    comment_type = db.Column(db.Enum('comment', 'question', 'answer', 'suggestion'), default='comment')
    
    # 父评论ID（用于回复功能）
    parent_id = db.Column(db.Integer, db.ForeignKey('comments.id'), nullable=True)
    
    # 点赞数
    likes_count = db.Column(db.Integer, default=0)
    
    # 状态：active(正常), hidden(隐藏), deleted(删除)
    status = db.Column(db.Enum('active', 'hidden', 'deleted'), default='active')
    
    # 时间戳
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # 关系
    user = db.relationship('User', backref=db.backref('comments', lazy='dynamic'))
    parent = db.relationship('Comment', remote_side=[id], backref=db.backref('replies', lazy='dynamic'))
    
    # 复合索引：用于快速查询特定内容的评论
    __table_args__ = (
        db.Index('idx_content_type_id', 'content_type', 'content_id'),
        db.Index('idx_user_status', 'user_id', 'status'),
        db.Index('idx_parent_status', 'parent_id', 'status'),
    )

class CommentLike(db.Model):
    """评论点赞表 - 记录用户对评论的点赞"""
    __tablename__ = 'comment_likes'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    comment_id = db.Column(db.Integer, db.ForeignKey('comments.id'), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # 关系
    user = db.relationship('User', backref=db.backref('comment_likes', lazy='dynamic'))
    comment = db.relationship('Comment', backref=db.backref('likes', lazy='dynamic'))
    
    # 唯一约束：一个用户只能对一个评论点赞一次
    __table_args__ = (
        db.UniqueConstraint('user_id', 'comment_id', name='unique_user_comment_like'),
    )

class CommentReport(db.Model):
    """评论举报表 - 记录对不当评论的举报"""
    __tablename__ = 'comment_reports'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    comment_id = db.Column(db.Integer, db.ForeignKey('comments.id'), nullable=False)
    
    # 举报原因
    reason = db.Column(db.Enum('spam', 'inappropriate', 'offensive', 'other'), nullable=False)
    
    # 举报详情
    description = db.Column(db.Text)
    
    # 处理状态：pending(待处理), reviewed(已审核), resolved(已处理)
    status = db.Column(db.Enum('pending', 'reviewed', 'resolved'), default='pending')
    
    # 管理员处理意见
    admin_note = db.Column(db.Text)
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # 关系
    user = db.relationship('User', backref=db.backref('comment_reports', lazy='dynamic'))
    comment = db.relationship('Comment', backref=db.backref('reports', lazy='dynamic'))
    
    # 唯一约束：一个用户只能举报一个评论一次
    __table_args__ = (
        db.UniqueConstraint('user_id', 'comment_id', name='unique_user_comment_report'),
    )
