"""学习域服务 — 错题本、薄弱点诊断与积分流水（护士端）。

评分与提交流程见 evaluation_service（EvaluationService）；本模块只做
学习数据的查询、组装与薄弱点分析的持久化。
"""
import json
import logging
from datetime import datetime, timezone

from models import (
    db, Case, CaseCategory, Station, StandardAnswer, LearningRecord,
    WrongQuestion, PointRecord, WeaknessAnalysis,
)
from sqlalchemy import desc

logger = logging.getLogger(__name__)

# 薄弱点分析的空结构（无数据/解析失败时的统一返回形态）
_EMPTY_ANALYSIS = {
    'weak_categories': [],
    'main_issues': [],
    'improvement_suggestions': [],
    'study_plan': '',
    'priority_areas': []
}


def list_wrong_questions(user_id, page, per_page):
    """列出用户错题（按时间倒序，内存分页），返回 dict。"""
    query = db.session.query(WrongQuestion, Station, Case, CaseCategory)\
        .join(Station, WrongQuestion.station_id == Station.id)\
        .join(Case, Station.case_id == Case.id)\
        .join(CaseCategory, Case.category_id == CaseCategory.id)\
        .filter(WrongQuestion.user_id == user_id)

    station_items = []
    for wrong_q, station, case, category in query.all():
        station_items.append({
            'id': wrong_q.id,
            'type': station.station_type,
            'ref_id': station.id,
            'ref_name': station.name or '',
            'question': station.question,
            'case_title': case.title,
            'category_name': category.name,
            'score': float(wrong_q.score) if wrong_q.score else 0,
            'created_at': wrong_q.created_at
        })

    station_items.sort(key=lambda x: x['created_at'], reverse=True)
    total = len(station_items)
    total_pages = max(1, (total + per_page - 1) // per_page)
    start = (page - 1) * per_page

    wrong_questions_data = [
        {
            'id': item['id'],
            'type': item['type'],
            'station_id': item['ref_id'],
            'station_name': item['ref_name'] or '扩展知识',
            'question': item['question'],
            'case_title': item['case_title'],
            'category_name': item['category_name'],
            'score': item['score'],
            'created_at': item['created_at'].isoformat()
        }
        for item in station_items[start:start + per_page]
    ]

    return {
        'wrong_questions': wrong_questions_data,
        'pagination': {
            'page': page,
            'per_page': per_page,
            'total': total,
            'pages': total_pages,
            'has_prev': page > 1,
            'has_next': page < total_pages
        }
    }


def get_wrong_question_detail(user_id, station):
    """构建错题详情（最近一次学习记录 + 站点标准答案），返回 dict。"""
    record = LearningRecord.query\
        .filter_by(user_id=user_id, station_id=station.id)\
        .order_by(desc(LearningRecord.completed_at))\
        .first()

    answers = StandardAnswer.query\
        .filter_by(station_id=station.id)\
        .order_by(StandardAnswer.order_index).all()

    return {
        'station': {
            'id': station.id,
            'name': station.name,
            'assessment_task': station.assessment_task,
            'question': station.question
        },
        'standard_answers': [
            {'answer_item': a.answer_item, 'order_index': a.order_index}
            for a in answers
        ],
        'my_record': _build_my_record_brief(record)
    }


def _build_my_record_brief(record):
    """学习记录的简要形态（错题详情页使用）。"""
    if not record:
        return {'user_answer': '', 'score': None, 'completed_at': None}
    return {
        'user_answer': record.user_answer or '',
        'score': float(record.score) if record.score is not None else None,
        'completed_at': record.completed_at.isoformat() if record.completed_at else None
    }


def get_weakness_analysis(user_id):
    """读取已保存的薄弱点诊断；无记录时返回空结构。返回 dict。"""
    saved = WeaknessAnalysis.query.filter_by(user_id=user_id).first()
    generated_at = None
    analysis = dict(_EMPTY_ANALYSIS)

    if saved:
        try:
            content = json.loads(saved.content)
            if isinstance(content, dict):
                analysis = content
        except Exception:
            analysis = dict(_EMPTY_ANALYSIS)
        generated_at = saved.generated_at.isoformat() if saved.generated_at else None

    return {
        'analysis': analysis or dict(_EMPTY_ANALYSIS),
        'wrong_questions_count': 0,
        'category_distribution': {},
        'generated_at': generated_at
    }


def run_weakness_analysis(user_id, evaluation_service):
    """执行薄弱点诊断：汇集错题数据 → AI 分析 → 归一化 → 持久化。

    返回 ({'analysis': ..., 'generated_at': ...}, error_message)。
    """
    wrong_data = _collect_wrong_data(user_id)
    raw = evaluation_service.analyze_weakness(user_id, wrong_data) or {}
    analysis = _normalize_analysis(raw)

    try:
        payload = json.dumps(analysis, ensure_ascii=False)
        saved = WeaknessAnalysis.query.filter_by(user_id=user_id).first()
        if saved:
            saved.content = payload
            saved.generated_at = datetime.now(timezone.utc)
        else:
            saved = WeaknessAnalysis(user_id=user_id, content=payload)
            db.session.add(saved)
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        logger.error("薄弱点分析保存失败: %s", e, exc_info=True)
        return None, '分析保存失败，请稍后重试'

    return {
        'analysis': analysis,
        'generated_at': saved.generated_at.isoformat() if saved.generated_at else None
    }, None


def _collect_wrong_data(user_id):
    """汇集诊断输入：每条错题的答题内容、标准答案与 AI 反馈。"""
    wrong_questions = db.session.query(WrongQuestion, Station, Case, CaseCategory)\
        .join(Station, WrongQuestion.station_id == Station.id)\
        .join(Case, Station.case_id == Case.id)\
        .join(CaseCategory, Case.category_id == CaseCategory.id)\
        .filter(WrongQuestion.user_id == user_id).all()

    wrong_data = []
    for wrong_q, station, case, category in wrong_questions:
        record = db.session.query(LearningRecord)\
            .filter_by(user_id=user_id, station_id=station.id)\
            .order_by(desc(LearningRecord.completed_at))\
            .first()
        ai_feedback_text, ai_reason_text = parse_ai_feedback(record)
        answers = db.session.query(StandardAnswer)\
            .filter_by(station_id=station.id)\
            .order_by(StandardAnswer.order_index).all()

        wrong_data.append({
            'category': category.name,
            'case_title': case.title,
            'station_name': station.name,
            'question': station.question,
            'user_answer': (record.user_answer if record else '') or '',
            'standard_answers': [a.answer_item for a in answers],
            'score': float(wrong_q.score) if wrong_q.score else 0,
            'ai_feedback': ai_feedback_text,
            'ai_reason': ai_reason_text,
            'completed_at': record.completed_at.isoformat() if record and record.completed_at else None
        })
    return wrong_data


def parse_ai_feedback(record):
    """解析学习记录的 AI 反馈 JSON，返回 (feedback_text, reason_text)。"""
    ai_feedback_text = ''
    ai_reason_text = ''
    if record and record.ai_feedback:
        try:
            feedback_raw = record.ai_feedback or ''
            if isinstance(feedback_raw, str) and feedback_raw.strip().startswith('{'):
                parsed = json.loads(feedback_raw)
                ai_feedback_text = parsed.get('feedback', '') or ''
                ai_reason_text = parsed.get('reason', '') or ''
            else:
                ai_feedback_text = feedback_raw
        except Exception:
            ai_feedback_text = record.ai_feedback or ''
    return ai_feedback_text, ai_reason_text


def _normalize_analysis(raw):
    """把 AI 返回的分析结果归一化为统一结构（容错非 list 值）。"""
    return {
        'weak_categories': _ensure_list(raw.get('weak_categories')),
        'main_issues': _ensure_list(raw.get('main_issues')),
        'improvement_suggestions': _normalize_improvements(raw.get('improvement_suggestions')),
        'study_plan': raw.get('study_plan') or '',
        'priority_areas': _ensure_list(raw.get('priority_areas'))
    }


def _ensure_list(value):
    """把任意值归一化为 list。"""
    if isinstance(value, list):
        return value
    if value is None:
        return []
    return [value]


def _normalize_improvements(items):
    """把改进建议归一化为 [{category, suggestion}] 结构。"""
    normalized = []
    for it in _ensure_list(items):
        if isinstance(it, dict):
            normalized.append({
                'category': it.get('category') or '综合',
                'suggestion': it.get('suggestion') or (it.get('advice') or '')
            })
        else:
            normalized.append({'category': '综合', 'suggestion': str(it)})
    return normalized


def list_point_records(user_id, current_points, page, per_page):
    """分页列出积分流水，返回 dict。current_points 由调用方传入（避免服务层依赖请求上下文）。"""
    pagination = PointRecord.query.filter_by(user_id=user_id)\
        .order_by(desc(PointRecord.created_at))\
        .paginate(page=page, per_page=per_page, error_out=False)

    records_data = [
        {
            'id': record.id,
            'points': record.points,
            'reason': record.reason,
            'related_type': record.related_type,
            'created_at': record.created_at.isoformat()
        }
        for record in pagination.items
    ]

    return {
        'records': records_data,
        'current_points': current_points,
        'pagination': {
            'page': page,
            'per_page': per_page,
            'total': pagination.total,
            'pages': pagination.pages,
            'has_prev': pagination.has_prev,
            'has_next': pagination.has_next
        }
    }
