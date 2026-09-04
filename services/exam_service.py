"""考试域服务 — 考试管理与阅卷（管理员端）。

考试作答（护士端）的生命周期见 exam_taking_service。
"""
import csv
import logging
from datetime import datetime, timedelta, timezone
from io import StringIO

from models import (
    db, User, Case, Station, Exam, ExamQuestion, ExamRecord, ExamAnswer,
)
from sqlalchemy import desc, func
from utils.time_utils import parse_local_to_utc

logger = logging.getLogger(__name__)


def list_exams(page, per_page):
    """分页列出考试（含题目数与参与人数），返回可直接序列化的 dict。"""
    pagination = Exam.query.order_by(desc(Exam.created_at))\
        .paginate(page=page, per_page=per_page, error_out=False)

    exams_data = []
    for exam in pagination.items:
        question_count = ExamQuestion.query.filter_by(exam_id=exam.id).count()
        participant_count = ExamRecord.query.filter_by(exam_id=exam.id).count()
        exams_data.append({
            'id': exam.id,
            'title': exam.title,
            'description': exam.description,
            'duration': exam.duration,
            'status': exam.status,
            'question_count': question_count,
            'participant_count': participant_count,
            'start_time': exam.start_time.isoformat() if exam.start_time else None,
            'end_time': exam.end_time.isoformat() if exam.end_time else None,
            'created_at': exam.created_at.isoformat()
        })

    return {
        'exams': exams_data,
        'pagination': {
            'page': page,
            'per_page': per_page,
            'total': pagination.total,
            'pages': pagination.pages,
            'has_prev': pagination.has_prev,
            'has_next': pagination.has_next
        }
    }


def create_exam(data, creator_id):
    """创建考试。返回 (exam, error_message)；错误时已回滚。"""
    title = (data.get('title') or '').strip()
    if not title:
        return None, '考试标题不能为空'

    try:
        start_time = data.get('start_time')
        duration = data.get('duration', 60)
        start_dt = parse_local_to_utc(start_time) if start_time else None
        end_dt = start_dt + timedelta(minutes=duration) if start_dt else None

        exam = Exam(
            title=title,
            description=(data.get('description') or '').strip(),
            creator_id=creator_id,
            duration=duration,
            start_time=start_dt,
            end_time=end_dt
        )
        db.session.add(exam)
        db.session.commit()
        return exam, None
    except Exception as e:
        db.session.rollback()
        logger.error("考试创建失败: %s", e, exc_info=True)
        return None, '创建失败，请稍后重试'


def list_questions(exam_id):
    """列出考试题目（关联案例与站点数），返回 dict。"""
    questions = db.session.query(ExamQuestion, Case)\
        .join(Case, ExamQuestion.case_id == Case.id)\
        .filter(ExamQuestion.exam_id == exam_id)\
        .order_by(ExamQuestion.order_index).all()

    questions_data = []
    for eq, case in questions:
        station_count = Station.query.filter_by(case_id=case.id).count()
        questions_data.append({
            'id': eq.id,
            'case_id': case.id,
            'case_title': case.title,
            'difficulty': case.difficulty,
            'score': float(eq.score),
            'order_index': eq.order_index,
            'station_count': station_count
        })
    return {'questions': questions_data}


def add_questions(exam_id, case_ids):
    """把案例追加为考试题目（已存在的自动跳过）。返回 error_message 或 None。"""
    try:
        max_order = db.session.query(func.max(ExamQuestion.order_index))\
            .filter_by(exam_id=exam_id).scalar() or 0

        for i, case_id in enumerate(case_ids):
            existing = ExamQuestion.query.filter_by(
                exam_id=exam_id,
                case_id=case_id
            ).first()
            if not existing:
                db.session.add(ExamQuestion(
                    exam_id=exam_id,
                    case_id=case_id,
                    score=100.0,
                    order_index=max_order + i + 1
                ))

        db.session.commit()
        return None
    except Exception as e:
        db.session.rollback()
        logger.error("考试添加案例失败: %s", e, exc_info=True)
        return '添加失败，请稍后重试'


def remove_questions(exam_id, case_ids):
    """从考试移除指定案例的题目，并清理这些题目的学生答卷，避免外键冲突。

    返回 error_message 或 None。
    """
    try:
        question_ids = [
            q.id for q in ExamQuestion.query.filter(
                ExamQuestion.exam_id == exam_id,
                ExamQuestion.case_id.in_(case_ids)
            ).all()
        ]
        if question_ids:
            ExamAnswer.query.filter(ExamAnswer.exam_question_id.in_(question_ids))\
                .delete(synchronize_session='fetch')
            ExamQuestion.query.filter(ExamQuestion.id.in_(question_ids))\
                .delete(synchronize_session='fetch')
        db.session.commit()
        return None
    except Exception as e:
        db.session.rollback()
        logger.error("从考试移除案例失败: %s", e, exc_info=True)
        return '移除失败，请稍后重试'


def clear_questions(exam_id):
    """清空考试的全部题目，并清理学生答卷，避免外键冲突。

    返回 error_message 或 None。
    """
    try:
        question_ids = [
            q.id for q in ExamQuestion.query.filter_by(exam_id=exam_id).all()
        ]
        if question_ids:
            ExamAnswer.query.filter(ExamAnswer.exam_question_id.in_(question_ids))\
                .delete(synchronize_session='fetch')
        ExamQuestion.query.filter_by(exam_id=exam_id).delete()
        db.session.commit()
        return None
    except Exception as e:
        db.session.rollback()
        logger.error("清空考试题目失败: %s", e, exc_info=True)
        return '清空失败，请稍后重试'


# ---- 阅卷（review） ----

def _serialize_review_answer(ans):
    """构建阅卷视角的单条答案明细（含站点、标准答案、所属案例）。"""
    station = db.session.get(Station, ans.station_id) if ans.station_id else None
    exam_question = db.session.get(ExamQuestion, ans.exam_question_id) if ans.exam_question_id else None
    case = db.session.get(Case, exam_question.case_id) if exam_question else None

    standard_answers_data = []
    if station:
        standard_answers_data = [
            {'answer_item': sa.answer_item, 'score_weight': float(sa.score_weight)}
            for sa in station.standard_answers.all()
        ]

    return {
        'id': ans.id,
        'exam_question_id': ans.exam_question_id,
        'station_id': ans.station_id,
        'station_name': station.name if station else '',
        'question': station.question if station else '',
        'user_answer': ans.user_answer,
        'score': float(ans.score) if ans.score else 0,
        'ai_feedback': ans.ai_feedback,
        'standard_answers': standard_answers_data,
        'case_title': case.title if case else '',
        'case_id': case.id if case else None
    }


def _serialize_review_record(record):
    """构建阅卷视角的单个考生记录（含全部答案明细）。"""
    user = db.session.get(User, record.user_id)
    answers = ExamAnswer.query.filter_by(
        exam_record_id=record.id
    ).order_by(ExamAnswer.id).all()

    return {
        'record_id': record.id,
        'user_id': user.id if user else record.user_id,
        'real_name': user.real_name if user else '未知',
        'username': user.username if user else '',
        'department': user.department if user else '',
        'total_score': float(record.total_score) if record.total_score else 0,
        'max_score': float(record.max_score) if record.max_score else 0,
        'start_time': record.start_time.isoformat() if record.start_time else None,
        'submit_time': record.submit_time.isoformat() if record.submit_time else None,
        'answers': [_serialize_review_answer(ans) for ans in answers]
    }


def _exam_payload(exam):
    """构建考试基本信息（用于响应组装）。"""
    return {'id': exam.id, 'title': exam.title, 'status': exam.status}


def build_review(exam):
    """构建整场考试的阅卷数据（全部已提交考生）。exam 由调用方保证存在。"""
    records = ExamRecord.query.filter_by(
        exam_id=exam.id, status='submitted'
    ).order_by(ExamRecord.submit_time.desc()).all()

    return {
        'exam': _exam_payload(exam),
        'participants': [_serialize_review_record(record) for record in records]
    }


def build_participant_detail(exam_id, record_id):
    """构建单个考生的阅卷明细。记录不存在时返回 None。"""
    record = ExamRecord.query.filter_by(id=record_id, exam_id=exam_id).first()
    if not record:
        return None
    return {'participant': _serialize_review_record(record)}


def recalculate_record_total(record_id):
    """重算考试记录的总分（所有答案得分之和）。返回 (record, total_score)。"""
    record = db.session.get(ExamRecord, record_id)
    if not record:
        return None, 0
    all_answers = ExamAnswer.query.filter_by(exam_record_id=record.id).all()
    total = sum(float(a.score or 0) for a in all_answers)
    record.total_score = total
    return record, total


def update_answer_score(answer, new_score):
    """人工修正单条答案得分并重算记录总分。返回可直接序列化的 dict。"""
    answer.score = new_score
    record, total = recalculate_record_total(answer.exam_record_id)
    db.session.commit()
    return {
        'answer_id': answer.id,
        'score': float(answer.score) if answer.score else 0,
        'record_total_score': float(total) if record and total else 0
    }


def re_score_answer(answer, evaluator):
    """AI 重新评分单条答案并重算记录总分。

    返回 (data, error_message, status_code)。
    """
    station = db.session.get(Station, answer.station_id)
    if not station:
        return None, '关联站点不存在', 404

    standard_answers = [
        {'answer_item': sa.answer_item, 'score_weight': float(sa.score_weight)}
        for sa in station.standard_answers.all()
    ]
    if not standard_answers:
        return None, '该站点无标准答案，无法 AI 评分', 400

    result = evaluator.evaluate_answer(
        question=station.question or '',
        user_answer=answer.user_answer or '',
        standard_answers=standard_answers
    )

    answer.score = result.get('score', 0)
    answer.ai_feedback = result.get('feedback', '')

    record, total = recalculate_record_total(answer.exam_record_id)
    db.session.commit()

    return {
        'answer_id': answer.id,
        'score': float(answer.score) if answer.score else 0,
        'ai_feedback': answer.ai_feedback,
        'record_total_score': float(total) if record and total else 0
    }, None, None


def export_results_csv(exam):
    """导出考试成绩 CSV（带 BOM，Excel 中文兼容）。返回 (bytes, filename)。"""
    records = ExamRecord.query.filter_by(
        exam_id=exam.id, status='submitted'
    ).order_by(ExamRecord.submit_time.desc()).all()

    si = StringIO()
    si.write('﻿')  # BOM for Excel Chinese support
    writer = csv.writer(si)
    writer.writerow(['考生姓名', '科室', '总分', '满分', '提交时间'])

    for r in records:
        user = db.session.get(User, r.user_id)
        writer.writerow([
            user.real_name if user else '未知',
            user.department if user else '',
            f"{float(r.total_score or 0):.0f}",
            f"{float(r.max_score or 0):.0f}",
            r.submit_time.strftime('%Y-%m-%d %H:%M') if r.submit_time else ''
        ])

    filename = f"{exam.title}_成绩_{datetime.now(timezone.utc).strftime('%Y%m%d')}.csv"
    return si.getvalue().encode('utf-8-sig'), filename
