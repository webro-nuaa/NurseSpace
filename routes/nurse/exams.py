from routes.nurse import nurse_bp
from datetime import datetime, timezone

from flask import jsonify, request, current_app
from flask_login import current_user
from utils.auth import login_or_jwt_required
from utils.decorators import nurse_required
from models import User, Case, Station, StandardAnswer, Exam, ExamQuestion, ExamRecord, ExamAnswer, PointRecord, db
from services.evaluation import EvaluationService
from services.points import PointService
from sqlalchemy import desc


def _get_eval_service():
    return EvaluationService(current_app.extensions.get('ai_evaluator'))


@nurse_bp.route('/exams')
@login_or_jwt_required
@nurse_required
def get_exams():
    now = datetime.now(timezone.utc).replace(tzinfo=None)

    participated_ids = [
        r.exam_id for r in
        ExamRecord.query.filter_by(user_id=current_user.id).all()
    ]

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

    exam_questions = db.session.query(ExamQuestion, Case)\
        .join(Case, ExamQuestion.case_id == Case.id)\
        .filter(ExamQuestion.exam_id == exam_id)\
        .order_by(ExamQuestion.order_index).all()

    questions_data = []
    total_max = 0
    for eq, case in exam_questions:
        stations = Station.query.filter_by(case_id=case.id).order_by(Station.order_index).all()
        total_max += len(stations) * 100
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

    exam_questions = ExamQuestion.query.filter_by(exam_id=exam_id).all()
    valid_pairs = set()
    for eq in exam_questions:
        case_stations = Station.query.filter_by(case_id=eq.case_id).all()
        for s in case_stations:
            valid_pairs.add((eq.id, s.id))

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

    svc = _get_eval_service()
    total_earned = 0
    for a in answers:
        answer_text = (a.get('answer') or '').strip()
        station_id = a['station_id']
        exam_question_id = a.get('exam_question_id')

        station = db.session.get(Station, station_id)
        score, feedback = svc.evaluate_exam_answer(station, answer_text)
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

    PointService.award_exam_participation(db, current_user.id, record.exam.title, exam_id)

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
    record = ExamRecord.query.filter_by(
        exam_id=exam_id, user_id=current_user.id
    ).first()

    if not record:
        return jsonify({'success': False, 'message': '未找到考试记录'}), 404

    answers = ExamAnswer.query.filter_by(exam_record_id=record.id).order_by(ExamAnswer.id).all()

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
