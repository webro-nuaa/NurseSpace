from flask import Blueprint, request, jsonify
import json
from flask_login import current_user
from flask_jwt_extended import jwt_required, get_jwt_identity
from utils.auth import login_or_jwt_required
from utils.decorators import nurse_required
from models import User, Case, CaseCategory, Station, StandardAnswer, LearningRecord, WrongQuestion, ExamRecord, PointRecord, ExtendedKnowledge, WeaknessAnalysis, db
from utils.ai_evaluator import AIEvaluator
from sqlalchemy import desc, func
from datetime import datetime

nurse_bp = Blueprint('nurse', __name__)
ai_evaluator = AIEvaluator()


def _build_my_record(record):
    """从学习记录构建详细信息字典"""
    if not record:
        return {
            'user_answer': '',
            'score': None,
            'ai_feedback': '',
            'reason': '',
            'completed_at': None
        }

    feedback_text = record.ai_feedback or ''
    parsed = {}
    if feedback_text and feedback_text.strip().startswith('{'):
        try:
            parsed = json.loads(feedback_text)
        except (json.JSONDecodeError, TypeError):
            pass

    return {
        'user_answer': record.user_answer or '',
        'score': float(record.score) if record.score is not None else None,
        'ai_feedback': (parsed.get('feedback') if isinstance(parsed, dict) else feedback_text) or '',
        'reason': (parsed.get('reason') if isinstance(parsed, dict) else ''),
        'completed_at': record.completed_at.isoformat() if record.completed_at else None
    }


@nurse_bp.route('/dashboard')
@login_or_jwt_required
@nurse_required
def dashboard():
    user = current_user

    total_cases = Case.query.count()
    completed_stations = LearningRecord.query.filter_by(user_id=current_user.id).count()
    wrong_questions_count = WrongQuestion.query.filter_by(user_id=current_user.id).count()
    exam_count = ExamRecord.query.filter_by(user_id=current_user.id).count()

    recent_records = db.session.query(LearningRecord, Station, Case)\
        .join(Station, LearningRecord.station_id == Station.id)\
        .join(Case, Station.case_id == Case.id)\
        .filter(LearningRecord.user_id == current_user.id)\
        .order_by(desc(LearningRecord.completed_at))\
        .limit(5).all()

    recent_activities = []
    for record, station, case in recent_records:
        recent_activities.append({
            'id': record.id,
            'case_title': case.title,
            'station_name': station.name,
            'score': float(record.score) if record.score else 0,
            'completed_at': record.completed_at.isoformat()
        })

    category_progress = db.session.query(
        CaseCategory.name,
        func.count(Station.id).label('total_stations'),
        func.count(LearningRecord.id).label('completed_stations')
    ).join(Case, CaseCategory.id == Case.category_id)\
     .join(Station, Case.id == Station.case_id)\
     .outerjoin(LearningRecord,
                (Station.id == LearningRecord.station_id) &
                (LearningRecord.user_id == current_user.id))\
     .group_by(CaseCategory.id, CaseCategory.name).all()

    progress_data = []
    for category_name, total, completed in category_progress:
        progress_data.append({
            'category': category_name,
            'total': total,
            'completed': completed or 0,
            'progress': round((completed or 0) / total * 100, 1) if total > 0 else 0
        })

    return jsonify({
        'success': True,
        'data': {
            'user_info': {
                'real_name': user.real_name,
                'department': user.department,
                'points': user.points
            },
            'statistics': {
                'total_cases': total_cases,
                'completed_stations': completed_stations,
                'wrong_questions_count': wrong_questions_count,
                'exam_count': exam_count
            },
            'recent_activities': recent_activities,
            'progress_data': progress_data
        }
    })


@nurse_bp.route('/cases')
@login_or_jwt_required
@nurse_required
def get_cases():
    category_id = request.args.get('category_id', type=int)
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 10, type=int)

    query = db.session.query(Case, CaseCategory)\
        .join(CaseCategory, Case.category_id == CaseCategory.id)

    if category_id:
        query = query.filter(Case.category_id == category_id)

    pagination = query.paginate(page=page, per_page=per_page, error_out=False)

    cases_data = []
    for case, category in pagination.items:
        total_stations = Station.query.filter_by(case_id=case.id).count()
        completed_stations = db.session.query(LearningRecord)\
            .join(Station, LearningRecord.station_id == Station.id)\
            .filter(Station.case_id == case.id, LearningRecord.user_id == current_user.id)\
            .count()

        cases_data.append({
            'id': case.id,
            'title': case.title,
            'category': category.name,
            'site_info': case.site_info,
            'total_stations': total_stations,
            'completed_stations': completed_stations,
            'progress': round(completed_stations / total_stations * 100, 1) if total_stations > 0 else 0,
            'created_at': case.created_at.isoformat()
        })

    categories = CaseCategory.query.all()
    categories_data = [
        {'id': cat.id, 'name': cat.name, 'description': cat.description}
        for cat in categories
    ]

    return jsonify({
        'success': True,
        'data': {
            'cases': cases_data,
            'categories': categories_data,
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


@nurse_bp.route('/cases/<int:case_id>')
@login_or_jwt_required
@nurse_required
def get_case_detail(case_id):
    case = db.session.get(Case, case_id)
    if not case:
        return jsonify({'success': False, 'message': '案例不存在'}), 404

    stations = Station.query.filter_by(case_id=case_id).all()
    stations_data = []

    for station in stations:
        learning_record = LearningRecord.query.filter_by(
            user_id=current_user.id,
            station_id=station.id
        ).first()

        stations_data.append({
            'id': station.id,
            'name': station.name,
            'assessment_task': station.assessment_task,
            'question': station.question,
            'completed': learning_record is not None,
            'score': float(learning_record.score) if (learning_record is not None and learning_record.score is not None) else (None if learning_record is None else 0.0),
            'completed_at': learning_record.completed_at.isoformat() if learning_record else None
        })

    extended_knowledge = ExtendedKnowledge.query.filter_by(case_id=case_id).all()
    knowledge_data = []
    for ek in extended_knowledge:
        raw = (ek.answer or '').strip()
        items = [s.strip() for s in raw.replace('\r', '').split('\n') if s.strip()]
        knowledge_data.append({
            'id': ek.id,
            'question': ek.question,
            'answers': items
        })

    return jsonify({
        'success': True,
        'data': {
            'case': {
                'id': case.id,
                'title': case.title,
                'case_guide': case.case_guide,
                'site_info': case.site_info,
                'category_name': case.category.name
            },
            'stations': stations_data,
            'extended_knowledge': knowledge_data
        }
    })


@nurse_bp.route('/knowledge/<int:knowledge_id>/submit', methods=['POST'])
@login_or_jwt_required
@nurse_required
def submit_knowledge_answer(knowledge_id):
    knowledge = ExtendedKnowledge.query.get_or_404(knowledge_id)
    data = request.get_json()
    user_answer = (data.get('answer') or '').strip()
    if not user_answer:
        return jsonify({'success': False, 'message': '答案不能为空'})

    raw = (knowledge.answer or '').strip()
    items = [s.strip() for s in raw.replace('\r', '').split('\n') if s.strip()]
    if not items:
        return jsonify({'success': False, 'message': '该题暂无标准答案'})

    standard_data = [{'answer_item': t, 'score_weight': 1.0} for t in items]

    evaluation = ai_evaluator.evaluate_answer(
        knowledge.question,
        user_answer,
        standard_data
    )

    return jsonify({
        'success': True,
        'evaluation': evaluation,
        'standard_answers': [{'answer_item': t, 'order_index': idx} for idx, t in enumerate(items)]
    })


@nurse_bp.route('/stations/<int:station_id>/submit', methods=['POST'])
@login_or_jwt_required
@nurse_required
def submit_answer(station_id):
    user = current_user

    station = Station.query.get_or_404(station_id)
    data = request.get_json()
    user_answer = data.get('answer', '').strip()

    if not user_answer:
        return jsonify({'success': False, 'message': '答案不能为空'})

    standard_answers = StandardAnswer.query.filter_by(station_id=station_id)\
        .order_by(StandardAnswer.order_index).all()

    if not standard_answers:
        return jsonify({'success': False, 'message': '该题目暂无标准答案'})

    standard_data = [
        {'answer_item': ans.answer_item, 'score_weight': float(ans.score_weight)}
        for ans in standard_answers
    ]

    evaluation = ai_evaluator.evaluate_answer(
        station.question,
        user_answer,
        standard_data
    )

    try:
        existing_record = LearningRecord.query.filter_by(
            user_id=current_user.id,
            station_id=station_id
        ).first()

        feedback_json = json.dumps({
            'feedback': evaluation.get('feedback', ''),
            'reason': evaluation.get('reason', '')
        }, ensure_ascii=False)

        if existing_record:
            existing_record.user_answer = user_answer
            existing_record.score = evaluation['score']
            existing_record.ai_feedback = feedback_json
            existing_record.completed_at = datetime.utcnow()
            learning_record = existing_record
        else:
            learning_record = LearningRecord(
                user_id=current_user.id,
                station_id=station_id,
                user_answer=user_answer,
                score=evaluation['score'],
                max_score=evaluation['max_score'],
                ai_feedback=feedback_json
            )
            db.session.add(learning_record)

        # 错题处理
        if evaluation['score'] < 60:
            existing_wrong = WrongQuestion.query.filter_by(
                user_id=current_user.id,
                station_id=station_id
            ).first()

            if existing_wrong:
                existing_wrong.score = evaluation['score']
            else:
                wrong_question = WrongQuestion(
                    user_id=current_user.id,
                    station_id=station_id,
                    score=evaluation['score']
                )
                db.session.add(wrong_question)
        else:
            WrongQuestion.query.filter_by(
                user_id=current_user.id,
                station_id=station_id
            ).delete()

        # 积分奖励
        if evaluation['score'] >= 80:
            points_to_add = 20 if evaluation['score'] >= 90 else 10

            user.points += points_to_add

            point_record = PointRecord(
                user_id=current_user.id,
                points=points_to_add,
                reason=f"案例学习高分奖励 (得分: {evaluation['score']})",
                related_id=learning_record.id,
                related_type='learning'
            )
            db.session.add(point_record)

        db.session.commit()

        return jsonify({
            'success': True,
            'message': '答案提交成功',
            'evaluation': {
                'score': evaluation['score'],
                'max_score': evaluation['max_score'],
                'feedback': evaluation['feedback'],
                'covered_points': evaluation.get('covered_points', []),
                'missed_points': evaluation.get('missed_points', []),
                'suggestions': evaluation.get('suggestions', ''),
                'reason': evaluation.get('reason', '')
            },
            'standard_answers': [
                {'answer_item': ans.answer_item, 'order_index': ans.order_index}
                for ans in standard_answers
            ]
        })

    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': f'提交失败：{str(e)}'})


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
        .filter(WrongQuestion.user_id == current_user.id)\
        .order_by(desc(WrongQuestion.created_at))

    pagination = query.paginate(page=page, per_page=per_page, error_out=False)

    wrong_questions_data = []
    for wrong_q, station, case, category in pagination.items:
        wrong_questions_data.append({
            'id': wrong_q.id,
            'station_id': station.id,
            'station_name': station.name,
            'question': station.question,
            'case_title': case.title,
            'category_name': category.name,
            'score': float(wrong_q.score) if wrong_q.score else 0,
            'created_at': wrong_q.created_at.isoformat()
        })

    return jsonify({
        'success': True,
        'data': {
            'wrong_questions': wrong_questions_data,
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

    wrong_data = []
    for wrong_q, station, case, category in wrong_questions:
        record = db.session.query(LearningRecord)\
            .filter_by(user_id=current_user.id, station_id=station.id)\
            .order_by(desc(LearningRecord.completed_at))\
            .first()
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

    analysis = ai_evaluator.analyze_weakness(current_user.id, wrong_data) or {}

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
        saved.generated_at = datetime.utcnow()
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


@nurse_bp.route('/exams')
@login_or_jwt_required
@nurse_required
def get_exams():
    from models import Exam

    exams = Exam.query.filter(
        Exam.status == 'published',
        Exam.end_time > datetime.utcnow()
    ).order_by(desc(Exam.created_at)).all()

    exams_data = []
    for exam in exams:
        exam_record = ExamRecord.query.filter_by(
            exam_id=exam.id,
            user_id=current_user.id
        ).first()

        exams_data.append({
            'id': exam.id,
            'title': exam.title,
            'description': exam.description,
            'duration': exam.duration,
            'start_time': exam.start_time.isoformat() if exam.start_time else None,
            'end_time': exam.end_time.isoformat() if exam.end_time else None,
            'participated': exam_record is not None,
            'score': float(exam_record.total_score) if exam_record and exam_record.total_score else None,
            'status': exam_record.status if exam_record else None
        })

    return jsonify({
        'success': True,
        'data': {'exams': exams_data}
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
            'my_record': _build_my_record(record)
        }
    })
