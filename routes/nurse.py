from flask import Blueprint, request, jsonify, current_app
import json
from flask_login import current_user
from flask_jwt_extended import jwt_required, get_jwt_identity
from utils.auth import login_or_jwt_required
from utils.decorators import nurse_required
from models import User, Case, CaseCategory, Station, StandardAnswer, LearningRecord, WrongQuestion, Exam, ExamQuestion, ExamRecord, ExamAnswer, PointRecord, ExtendedKnowledge, KnowledgeAnswer, WeaknessAnalysis, ExtensionVideo, ExtensionLink, db
from utils.ai_evaluator import AIEvaluator
from sqlalchemy import desc, func
from datetime import datetime, timezone

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
        .join(CaseCategory, Case.category_id == CaseCategory.id)\
        .filter(Case.case_type == 'learning')

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
            'total_stations': total_stations,
            'completed_stations': completed_stations,
            'progress': round(completed_stations / total_stations * 100, 1) if total_stations > 0 else 0,
            'created_at': case.created_at.isoformat()
        })

    categories = CaseCategory.query.all()
    case_counts = dict(
        db.session.query(Case.category_id, func.count(Case.id))
        .filter(Case.case_type == 'learning')
        .group_by(Case.category_id).all()
    )
    categories_data = [
        {
            'id': cat.id, 'name': cat.name, 'description': cat.description,
            'case_count': case_counts.get(cat.id, 0)
        }
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

    stations = Station.query.filter_by(case_id=case_id)\
        .order_by(Station.order_index).all()
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
        answers = KnowledgeAnswer.query.filter_by(knowledge_id=ek.id)\
            .order_by(KnowledgeAnswer.order_index).all()
        knowledge_data.append({
            'id': ek.id,
            'question': ek.question,
            'answers': [{'id': a.id, 'answer_item': a.answer_item,
                         'score_weight': float(a.score_weight)} for a in answers]
        })

    videos = ExtensionVideo.query.filter_by(case_id=case_id).order_by(ExtensionVideo.order_index).all()
    links = ExtensionLink.query.filter_by(case_id=case_id).order_by(ExtensionLink.order_index).all()

    return jsonify({
        'success': True,
        'data': {
            'case': {
                'id': case.id,
                'title': case.title,
                'case_guide': case.case_guide,
                'difficulty': case.difficulty or 'intermediate',
                'case_type': case.case_type or 'learning',
                'category_id': case.category_id,
                'category_name': case.category.name
            },
            'stations': stations_data,
            'extended_knowledge': knowledge_data,
            'videos': [{'id': v.id, 'title': v.title, 'url': v.url,
                        'description': v.description or '', 'order_index': v.order_index}
                       for v in videos],
            'links': [{'id': l.id, 'title': l.title, 'url': l.url,
                       'description': l.description or '', 'order_index': l.order_index}
                      for l in links]
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

    answers = KnowledgeAnswer.query.filter_by(knowledge_id=knowledge_id)\
        .order_by(KnowledgeAnswer.order_index).all()
    standard_data = [{'answer_item': a.answer_item, 'score_weight': float(a.score_weight)} for a in answers]

    if not standard_data:
        return jsonify({'success': False, 'message': '该题暂无标准答案'})

    evaluation = ai_evaluator.evaluate_answer(
        knowledge.question,
        user_answer,
        standard_data
    )

    return jsonify({
        'success': True,
        'evaluation': evaluation,
        'standard_answers': [{'answer_item': a.answer_item, 'order_index': a.order_index} for a in answers]
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
            existing_record.completed_at = datetime.now(timezone.utc)
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

        # 积分奖励（原子更新，避免竞态条件）
        if evaluation['score'] >= 80:
            points_to_add = 20 if evaluation['score'] >= 90 else 10

            User.query.filter_by(id=user.id).update(
                {'points': User.points + points_to_add},
                synchronize_session=False
            )

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
        current_app.logger.error(f"答案提交失败: {e}", exc_info=True)
        return jsonify({'success': False, 'message': '提交失败，请稍后重试'})


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


@nurse_bp.route('/exams')
@login_or_jwt_required
@nurse_required
def get_exams():
    now = datetime.now(timezone.utc).replace(tzinfo=None)

    # 获取当前用户参加过的考试 ID
    participated_ids = [
        r.exam_id for r in
        ExamRecord.query.filter_by(user_id=current_user.id).all()
    ]

    # 已发布的考试：用户参加过的（不受时间限制）+ 还在有效期内的
    exams = Exam.query.filter(
        Exam.status == 'published',
        db.or_(
            Exam.id.in_(participated_ids) if participated_ids else False,
            db.or_(Exam.end_time == None, Exam.end_time > now)
        )
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


@nurse_bp.route('/exams/<int:exam_id>/start', methods=['POST'])
@login_or_jwt_required
@nurse_required
def start_exam(exam_id):
    exam = Exam.query.get_or_404(exam_id)

    if exam.status != 'published':
        return jsonify({'success': False, 'message': '考试未发布'}), 400
    if exam.end_time and exam.end_time <= datetime.now(timezone.utc).replace(tzinfo=None):
        return jsonify({'success': False, 'message': '考试已结束'}), 400

    existing = ExamRecord.query.filter_by(
        exam_id=exam_id, user_id=current_user.id
    ).first()
    if existing:
        return jsonify({'success': False, 'message': '您已参加过该考试'}), 400

    record = ExamRecord(
        exam_id=exam_id,
        user_id=current_user.id,
        max_score=0,
        status='in_progress'
    )
    db.session.add(record)
    db.session.flush()

    # Load exam questions grouped by case
    exam_questions = db.session.query(ExamQuestion, Case)\
        .join(Case, ExamQuestion.case_id == Case.id)\
        .filter(ExamQuestion.exam_id == exam_id)\
        .order_by(ExamQuestion.order_index).all()

    questions_data = []
    total_max = 0
    for eq, case in exam_questions:
        total_max += float(eq.score)
        stations = Station.query.filter_by(case_id=case.id).order_by(Station.order_index).all()
        stations_data = []
        for station in stations:
            standard_answers = [
                {'answer_item': sa.answer_item, 'score_weight': float(sa.score_weight)}
                for sa in station.standard_answers.all()
            ]
            stations_data.append({
                'id': station.id,
                'name': station.name,
                'question': station.question,
                'assessment_task': station.assessment_task,
                'standard_answers': standard_answers
            })
        questions_data.append({
            'id': eq.id,
            'case_id': case.id,
            'case_title': case.title,
            'case_guide': case.case_guide,
            'difficulty': case.difficulty,
            'score': float(eq.score),
            'order_index': eq.order_index,
            'stations': stations_data
        })

    record.max_score = total_max
    db.session.commit()

    return jsonify({
        'success': True,
        'data': {
            'record_id': record.id,
            'exam': {
                'id': exam.id,
                'title': exam.title,
                'description': exam.description,
                'duration': exam.duration,
                'end_time': exam.end_time.isoformat() if exam.end_time else None
            },
            'questions': questions_data,
            'total_score': total_max
        }
    })


@nurse_bp.route('/exams/<int:exam_id>/submit', methods=['POST'])
@login_or_jwt_required
@nurse_required
def submit_exam(exam_id):
    record = ExamRecord.query.filter_by(
        exam_id=exam_id, user_id=current_user.id, status='in_progress'
    ).first()
    if not record:
        return jsonify({'success': False, 'message': '未找到进行中的考试记录'}), 404

    data = request.get_json() or {}
    answers = data.get('answers', [])

    if not answers:
        return jsonify({'success': False, 'message': '请至少作答一题'}), 400

    # Verify station-exam ownership: build a set of valid (exam_question_id, station_id) pairs
    exam_questions = ExamQuestion.query.filter_by(exam_id=exam_id).all()
    valid_pairs = set()
    for eq in exam_questions:
        case_stations = Station.query.filter_by(case_id=eq.case_id).all()
        for s in case_stations:
            valid_pairs.add((eq.id, s.id))

    # Validate no empty answers and no duplicate (exam_question_id, station_id) pairs
    empty_stations = []
    seen_pairs = set()
    for a in answers:
        answer_text = (a.get('answer') or '').strip()
        station_id = a.get('station_id')
        exam_question_id = a.get('exam_question_id')

        if (exam_question_id, station_id) not in valid_pairs:
            return jsonify({'success': False, 'message': '提交数据无效'}), 400

        pair = (exam_question_id, station_id)
        if pair in seen_pairs:
            return jsonify({'success': False, 'message': f'站点答案重复提交'}), 400
        seen_pairs.add(pair)

        if not answer_text:
            station = db.session.get(Station, station_id)
            empty_stations.append(station.name if station else f'站点#{station_id}')

    if empty_stations:
        return jsonify({
            'success': False,
            'message': f'请完成以下题目的作答：{", ".join(empty_stations)}'
        }), 400

    total_earned = 0
    for a in answers:
        answer_text = (a.get('answer') or '').strip()
        station_id = a['station_id']
        exam_question_id = a.get('exam_question_id')

        station = db.session.get(Station, station_id)
        standard_answers = [
            {'answer_item': sa.answer_item, 'score_weight': float(sa.score_weight)}
            for sa in (station.standard_answers.all() if station else [])
        ]

        if standard_answers and answer_text:
            result = ai_evaluator.evaluate_answer(
                question=station.question if station else '',
                user_answer=answer_text,
                standard_answers=standard_answers
            )
            score = result.get('score', 0)
            feedback = result.get('feedback', '')
        else:
            score = 0
            feedback = ''

        total_earned += score

        answer = ExamAnswer(
            exam_record_id=record.id,
            exam_question_id=exam_question_id,
            station_id=station_id,
            user_answer=answer_text,
            score=score,
            ai_feedback=feedback
        )
        db.session.add(answer)

    record.status = 'submitted'
    record.submit_time = datetime.now(timezone.utc)
    record.total_score = total_earned

    # Award participation points (atomic update to avoid race condition)
    point_record = PointRecord(
        user_id=current_user.id,
        points=5,
        reason=f'参加考试：{record.exam.title}',
        related_id=exam_id,
        related_type='exam'
    )
    db.session.add(point_record)
    User.query.filter_by(id=current_user.id).update(
        {'points': User.points + 5},
        synchronize_session=False
    )

    db.session.commit()

    return jsonify({
        'success': True,
        'message': '考试已提交',
        'data': {
            'total_score': float(total_earned),
            'max_score': float(record.max_score),
            'questions_answered': len(answers)
        }
    })


@nurse_bp.route('/exams/<int:exam_id>/result')
@login_or_jwt_required
@nurse_required
def get_exam_result(exam_id):
    """获取护士某次考试的详细结果（含每题得分和AI反馈）"""
    record = ExamRecord.query.filter_by(
        exam_id=exam_id, user_id=current_user.id
    ).first()

    if not record:
        return jsonify({'success': False, 'message': '未找到考试记录'}), 404

    answers = ExamAnswer.query.filter_by(exam_record_id=record.id).order_by(ExamAnswer.id).all()

    # Group answers by case (using dict to maintain insertion order, Python 3.7+)
    cases_dict = {}
    for ans in answers:
        station = db.session.get(Station, ans.station_id) if ans.station_id else None
        exam_question = db.session.get(ExamQuestion, ans.exam_question_id) if ans.exam_question_id else None
        case = db.session.get(Case, exam_question.case_id) if exam_question else None

        case_key = exam_question.case_id if exam_question else 0

        if case_key not in cases_dict:
            cases_dict[case_key] = {
                'case_id': case.id if case else None,
                'case_title': case.title if case else '未知案例',
                'stations': []
            }

        standard_answers_data = []
        if station:
            standard_answers_data = [
                {'answer_item': sa.answer_item, 'score_weight': float(sa.score_weight)}
                for sa in station.standard_answers.order_by(StandardAnswer.order_index).all()
            ]

        cases_dict[case_key]['stations'].append({
            'id': ans.id,
            'station_name': station.name if station else '',
            'question': station.question if station else '',
            'user_answer': ans.user_answer or '',
            'score': float(ans.score) if ans.score else 0,
            'ai_feedback': ans.ai_feedback or '',
            'standard_answers': standard_answers_data
        })

    cases_data = list(cases_dict.values())

    exam = db.session.get(Exam, exam_id)

    return jsonify({
        'success': True,
        'data': {
            'exam': {
                'id': exam.id,
                'title': exam.title,
                'description': exam.description,
                'duration': exam.duration
            } if exam else None,
            'total_score': float(record.total_score) if record.total_score else 0,
            'max_score': float(record.max_score) if record.max_score else 0,
            'status': record.status,
            'submit_time': record.submit_time.isoformat() if record.submit_time else None,
            'cases': cases_data
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
