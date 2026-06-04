from routes.nurse import nurse_bp
import json
from datetime import datetime, timezone

from flask import jsonify, request, current_app
from flask_login import current_user
from utils.auth import login_or_jwt_required
from utils.decorators import nurse_required
from models import User, Case, CaseCategory, Station, StandardAnswer, LearningRecord, WrongQuestion, PointRecord, WeaknessAnalysis, db
from services.evaluation import EvaluationService, build_my_record
from sqlalchemy import desc, func


def _get_eval_service():
    return EvaluationService(current_app.extensions.get('ai_evaluator'))


@nurse_bp.route('/wrong-questions')
@login_or_jwt_required
@nurse_required
def get_wrong_questions():
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 10, type=int)

    query = db.session.query(WrongQuestion, Station, Case, CaseCategory)\
        .join(Station, WrongQuestion.station_id == Station.id)\
        .join(Case, Station.case_id == Case.id)\
        .join(CaseCategory, Case.category_id == CaseCategory.id)\
        .filter(WrongQuestion.user_id == current_user.id)

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
    page_items = station_items[start:start + per_page]

    wrong_questions_data = []
    for item in page_items:
        wrong_questions_data.append({
            'id': item['id'],
            'type': item['type'],
            'station_id': item['ref_id'],
            'station_name': item['ref_name'] or '扩展知识',
            'question': item['question'],
            'case_title': item['case_title'],
            'category_name': item['category_name'],
            'score': item['score'],
            'created_at': item['created_at'].isoformat()
        })

    return jsonify({
        'success': True,
        'data': {
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
    })


@nurse_bp.route('/wrong-questions/<int:station_id>')
@login_or_jwt_required
@nurse_required
def get_wrong_question_detail(station_id: int):
    station = Station.query.get_or_404(station_id)

    record = LearningRecord.query\
        .filter_by(user_id=current_user.id, station_id=station_id)\
        .order_by(desc(LearningRecord.completed_at))\
        .first()

    answers = StandardAnswer.query\
        .filter_by(station_id=station_id)\
        .order_by(StandardAnswer.order_index).all()

    return jsonify({
        'success': True,
        'data': {
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
            'my_record': build_my_record(record)
        }
    })


@nurse_bp.route('/weakness-analysis')
@login_or_jwt_required
@nurse_required
def get_weakness_analysis():
    saved = WeaknessAnalysis.query.filter_by(user_id=current_user.id).first()
    if saved:
        try:
            content = json.loads(saved.content)
        except Exception:
            content = {}
        return jsonify({
            'success': True,
            'data': {
                'analysis': content or {
                    'weak_categories': [],
                    'main_issues': [],
                    'improvement_suggestions': [],
                    'study_plan': '',
                    'priority_areas': []
                },
                'wrong_questions_count': 0,
                'category_distribution': {},
                'generated_at': saved.generated_at.isoformat() if saved.generated_at else None
            }
        })

    return jsonify({
        'success': True,
        'data': {
            'analysis': {
                'weak_categories': [],
                'main_issues': [],
                'improvement_suggestions': [],
                'study_plan': '',
                'priority_areas': []
            },
            'wrong_questions_count': 0,
            'category_distribution': {},
            'generated_at': None
        }
    })


@nurse_bp.route('/weakness-analysis/run', methods=['POST'])
@login_or_jwt_required
@nurse_required
def run_weakness_analysis():
    wrong_questions = db.session.query(WrongQuestion, Station, Case, CaseCategory)\
        .join(Station, WrongQuestion.station_id == Station.id)\
        .join(Case, Station.case_id == Case.id)\
        .join(CaseCategory, Case.category_id == CaseCategory.id)\
        .filter(WrongQuestion.user_id == current_user.id).all()

    def _parse_ai_feedback(record):
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

    wrong_data = []
    for wrong_q, station, case, category in wrong_questions:
        record = db.session.query(LearningRecord)\
            .filter_by(user_id=current_user.id, station_id=station.id)\
            .order_by(desc(LearningRecord.completed_at))\
            .first()
        ai_feedback_text, ai_reason_text = _parse_ai_feedback(record)
        answers = db.session.query(StandardAnswer)\
            .filter_by(station_id=station.id)\
            .order_by(StandardAnswer.order_index).all()
        standard_answer_items = [a.answer_item for a in answers]

        wrong_data.append({
            'category': category.name,
            'case_title': case.title,
            'station_name': station.name,
            'question': station.question,
            'user_answer': (record.user_answer if record else '') or '',
            'standard_answers': standard_answer_items,
            'score': float(wrong_q.score) if wrong_q.score else 0,
            'ai_feedback': ai_feedback_text,
            'ai_reason': ai_reason_text,
            'completed_at': record.completed_at.isoformat() if record and record.completed_at else None
        })

    svc = _get_eval_service()
    analysis = svc.analyze_weakness(current_user.id, wrong_data) or {}

    def _ensure_list(value):
        if isinstance(value, list):
            return value
        if value is None:
            return []
        return [value]

    def _normalize_improvements(items):
        arr = _ensure_list(items)
        normalized = []
        for it in arr:
            if isinstance(it, dict):
                normalized.append({
                    'category': it.get('category') or '综合',
                    'suggestion': it.get('suggestion') or (it.get('advice') or '')
                })
            else:
                normalized.append({'category': '综合', 'suggestion': str(it)})
        return normalized

    analysis = {
        'weak_categories': _ensure_list(analysis.get('weak_categories')),
        'main_issues': _ensure_list(analysis.get('main_issues')),
        'improvement_suggestions': _normalize_improvements(analysis.get('improvement_suggestions')),
        'study_plan': analysis.get('study_plan') or '',
        'priority_areas': _ensure_list(analysis.get('priority_areas'))
    }

    payload = json.dumps(analysis, ensure_ascii=False)
    saved = WeaknessAnalysis.query.filter_by(user_id=current_user.id).first()
    if saved:
        saved.content = payload
        saved.generated_at = datetime.now(timezone.utc)
    else:
        saved = WeaknessAnalysis(user_id=current_user.id, content=payload)
        db.session.add(saved)
    db.session.commit()

    return jsonify({
        'success': True,
        'data': {
            'analysis': analysis,
            'generated_at': saved.generated_at.isoformat() if saved.generated_at else None
        }
    })


@nurse_bp.route('/point-records')
@login_or_jwt_required
@nurse_required
def get_point_records():
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 20, type=int)

    pagination = PointRecord.query.filter_by(user_id=current_user.id)\
        .order_by(desc(PointRecord.created_at))\
        .paginate(page=page, per_page=per_page, error_out=False)

    records_data = []
    for record in pagination.items:
        records_data.append({
            'id': record.id,
            'points': record.points,
            'reason': record.reason,
            'related_type': record.related_type,
            'created_at': record.created_at.isoformat()
        })

    return jsonify({
        'success': True,
        'data': {
            'records': records_data,
            'current_points': current_user.points,
            'pagination': {
                'page': page,
                'per_page': per_page,
                'total': pagination.total,
                'pages': pagination.pages,
                'has_prev': pagination.has_prev,
                'has_next': pagination.has_next
            }
        }
    })
