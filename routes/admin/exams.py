from routes.admin import admin_bp
import csv
from datetime import datetime, timezone, timedelta
from io import StringIO, BytesIO

from flask import jsonify, request, send_file, current_app
from flask_login import current_user
from utils.auth import login_or_jwt_required
from utils.decorators import admin_required
from utils.ai_evaluator import AIEvaluator
from models import User, Case, Station, StandardAnswer, Exam, ExamQuestion, ExamRecord, ExamAnswer, db
from sqlalchemy import desc, func


@admin_bp.route('/exams', methods=['GET', 'POST'])
@login_or_jwt_required
@admin_required
def manage_exams():
    if request.method == 'GET':
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 20, type=int)

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

        return jsonify({
            'success': True,
            'data': {
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
        })

    # POST: 创建考试
    data = request.get_json()

    title = data.get('title', '').strip()
    description = data.get('description', '').strip()
    duration = data.get('duration', 60)
    start_time = data.get('start_time')

    if not title:
        return jsonify({'success': False, 'message': '考试标题不能为空'})

    try:
        start_dt = datetime.fromisoformat(start_time) if start_time else None
        end_dt = start_dt + timedelta(minutes=duration) if start_dt else None

        exam = Exam(
            title=title,
            description=description,
            creator_id=current_user.id,
            duration=duration,
            start_time=start_dt,
            end_time=end_dt
        )

        db.session.add(exam)
        db.session.commit()

        return jsonify({
            'success': True,
            'message': '考试创建成功',
            'exam': {'id': exam.id, 'title': exam.title}
        })

    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"考试创建失败: {e}", exc_info=True)
        return jsonify({'success': False, 'message': '创建失败，请稍后重试'})


@admin_bp.route('/exams/<int:exam_id>', methods=['PUT'])
@login_or_jwt_required
@admin_required
def update_exam(exam_id):
    exam = Exam.query.get_or_404(exam_id)
    data = request.get_json() or {}
    for field in ['title', 'description']:
        if field in data:
            setattr(exam, field, (data.get(field) or '').strip())
    for field in ['duration']:
        if field in data:
            setattr(exam, field, int(data[field]))
    for field in ['start_time']:
        if field in data and data[field]:
            setattr(exam, field, datetime.fromisoformat(data[field]))
    if exam.start_time:
        exam.end_time = exam.start_time + timedelta(minutes=exam.duration)
    db.session.commit()
    return jsonify({'success': True, 'message': '考试已更新'})


@admin_bp.route('/exams/<int:exam_id>/publish', methods=['POST'])
@login_or_jwt_required
@admin_required
def publish_exam(exam_id):
    exam = Exam.query.get_or_404(exam_id)
    exam.status = 'published'
    db.session.commit()
    return jsonify({'success': True, 'message': '考试已发布'})


@admin_bp.route('/exams/<int:exam_id>/questions', methods=['GET', 'POST', 'DELETE'])
@login_or_jwt_required
@admin_required
def manage_exam_questions(exam_id):
    exam = Exam.query.get_or_404(exam_id)

    if request.method == 'DELETE':
        data = request.get_json()
        case_ids = data.get('case_ids', [])
        if not case_ids:
            return jsonify({'success': False, 'message': '请指定要移除的题目'})
        try:
            ExamQuestion.query.filter(
                ExamQuestion.exam_id == exam_id,
                ExamQuestion.case_id.in_(case_ids)
            ).delete(synchronize_session='fetch')
            db.session.commit()
            return jsonify({'success': True, 'message': '已移除'})
        except Exception as e:
            db.session.rollback()
            current_app.logger.error(f"从考试移除案例失败: {e}", exc_info=True)
            return jsonify({'success': False, 'message': '移除失败，请稍后重试'})

    if request.method == 'GET':
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

        return jsonify({
            'success': True,
            'data': {
                'exam': {'id': exam.id, 'title': exam.title, 'status': exam.status},
                'questions': questions_data
            }
        })

    # POST: 添加题目
    data = request.get_json()
    case_ids = data.get('case_ids', [])

    if not case_ids:
        return jsonify({'success': False, 'message': '请选择至少一个案例'})

    try:
        max_order = db.session.query(func.max(ExamQuestion.order_index))\
            .filter_by(exam_id=exam_id).scalar() or 0

        for i, case_id in enumerate(case_ids):
            existing = ExamQuestion.query.filter_by(
                exam_id=exam_id,
                case_id=case_id
            ).first()

            if not existing:
                exam_question = ExamQuestion(
                    exam_id=exam_id,
                    case_id=case_id,
                    score=100.0,
                    order_index=max_order + i + 1
                )
                db.session.add(exam_question)

        db.session.commit()

        return jsonify({'success': True, 'message': '案例添加成功'})

    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"考试添加案例失败: {e}", exc_info=True)
        return jsonify({'success': False, 'message': '添加失败，请稍后重试'})


@admin_bp.route('/exams/<int:exam_id>/questions/clear', methods=['POST'])
@login_or_jwt_required
@admin_required
def clear_exam_questions(exam_id):
    Exam.query.get_or_404(exam_id)
    ExamQuestion.query.filter_by(exam_id=exam_id).delete()
    db.session.commit()
    return jsonify({'success': True, 'message': '已清空所有题目'})


@admin_bp.route('/exams/<int:exam_id>/review', methods=['GET'])
@login_or_jwt_required
@admin_required
def get_exam_review(exam_id):
    exam = Exam.query.get_or_404(exam_id)

    records = ExamRecord.query.filter_by(
        exam_id=exam_id, status='submitted'
    ).order_by(ExamRecord.submit_time.desc()).all()

    participants = []
    for record in records:
        user = db.session.get(User, record.user_id)
        answers = ExamAnswer.query.filter_by(
            exam_record_id=record.id
        ).order_by(ExamAnswer.id).all()

        answers_data = []
        for ans in answers:
            station = db.session.get(Station, ans.station_id) if ans.station_id else None
            exam_question = db.session.get(ExamQuestion, ans.exam_question_id) if ans.exam_question_id else None
            case = db.session.get(Case, exam_question.case_id) if exam_question else None

            standard_answers_data = []
            if station:
                standard_answers_data = [
                    {'answer_item': sa.answer_item, 'score_weight': float(sa.score_weight)}
                    for sa in station.standard_answers.all()
                ]

            answers_data.append({
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
            })

        participants.append({
            'record_id': record.id,
            'user_id': user.id if user else record.user_id,
            'real_name': user.real_name if user else '未知',
            'username': user.username if user else '',
            'department': user.department if user else '',
            'total_score': float(record.total_score) if record.total_score else 0,
            'max_score': float(record.max_score) if record.max_score else 0,
            'start_time': record.start_time.isoformat() if record.start_time else None,
            'submit_time': record.submit_time.isoformat() if record.submit_time else None,
            'answers': answers_data
        })

    return jsonify({
        'success': True,
        'data': {
            'exam': {'id': exam.id, 'title': exam.title, 'status': exam.status},
            'participants': participants
        }
    })


@admin_bp.route('/exams/<int:exam_id>/review/<int:record_id>', methods=['GET'])
@login_or_jwt_required
@admin_required
def get_participant_detail(exam_id, record_id):
    exam = Exam.query.get_or_404(exam_id)
    record = ExamRecord.query.filter_by(id=record_id, exam_id=exam_id).first_or_404()

    user = db.session.get(User, record.user_id)
    answers = ExamAnswer.query.filter_by(
        exam_record_id=record.id
    ).order_by(ExamAnswer.id).all()

    answers_data = []
    for ans in answers:
        station = db.session.get(Station, ans.station_id) if ans.station_id else None
        exam_question = db.session.get(ExamQuestion, ans.exam_question_id) if ans.exam_question_id else None
        case = db.session.get(Case, exam_question.case_id) if exam_question else None

        standard_answers_data = []
        if station:
            standard_answers_data = [
                {'answer_item': sa.answer_item, 'score_weight': float(sa.score_weight)}
                for sa in station.standard_answers.all()
            ]

        answers_data.append({
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
        })

    return jsonify({
        'success': True,
        'data': {
            'exam': {'id': exam.id, 'title': exam.title, 'status': exam.status},
            'participant': {
                'record_id': record.id,
                'user_id': user.id if user else record.user_id,
                'real_name': user.real_name if user else '未知',
                'username': user.username if user else '',
                'department': user.department if user else '',
                'total_score': float(record.total_score) if record.total_score else 0,
                'max_score': float(record.max_score) if record.max_score else 0,
                'start_time': record.start_time.isoformat() if record.start_time else None,
                'submit_time': record.submit_time.isoformat() if record.submit_time else None,
                'answers': answers_data
            }
        }
    })


@admin_bp.route('/exams/<int:exam_id>/review/<int:answer_id>/score', methods=['PUT'])
@login_or_jwt_required
@admin_required
def update_exam_answer_score(exam_id, answer_id):
    data = request.get_json() or {}
    new_score = data.get('score')

    if new_score is None:
        return jsonify({'success': False, 'message': '请提供分数'}), 400

    try:
        new_score = float(new_score)
    except (ValueError, TypeError):
        return jsonify({'success': False, 'message': '分数格式无效'}), 400

    answer = ExamAnswer.query.get_or_404(answer_id)
    answer.score = new_score

    record = db.session.get(ExamRecord, answer.exam_record_id)
    if record:
        all_answers = ExamAnswer.query.filter_by(exam_record_id=record.id).all()
        record.total_score = sum(float(a.score or 0) for a in all_answers)

    db.session.commit()

    return jsonify({
        'success': True,
        'message': '分数已更新',
        'data': {
            'answer_id': answer.id,
            'score': float(answer.score) if answer.score else 0,
            'record_total_score': float(record.total_score) if record and record.total_score else 0
        }
    })


@admin_bp.route('/exams/<int:exam_id>/review/<int:answer_id>/re-score', methods=['POST'])
@login_or_jwt_required
@admin_required
def re_score_exam_answer(exam_id, answer_id):
    answer = ExamAnswer.query.get_or_404(answer_id)
    station = db.session.get(Station, answer.station_id)
    if not station:
        return jsonify({'success': False, 'message': '关联站点不存在'}), 404

    standard_answers = [
        {'answer_item': sa.answer_item, 'score_weight': float(sa.score_weight)}
        for sa in station.standard_answers.all()
    ]
    if not standard_answers:
        return jsonify({'success': False, 'message': '该站点无标准答案，无法 AI 评分'})

    evaluator = current_app.extensions.get('ai_evaluator', AIEvaluator())
    result = evaluator.evaluate_answer(
        question=station.question or '',
        user_answer=answer.user_answer or '',
        standard_answers=standard_answers
    )

    answer.score = result.get('score', 0)
    answer.ai_feedback = result.get('feedback', '')

    record = db.session.get(ExamRecord, answer.exam_record_id)
    if record:
        all_answers = ExamAnswer.query.filter_by(exam_record_id=record.id).all()
        record.total_score = sum(float(a.score or 0) for a in all_answers)

    db.session.commit()

    return jsonify({
        'success': True,
        'message': 'AI 重新评分完成',
        'data': {
            'answer_id': answer.id,
            'score': float(answer.score) if answer.score else 0,
            'ai_feedback': answer.ai_feedback,
            'record_total_score': float(record.total_score) if record and record.total_score else 0
        }
    })


@admin_bp.route('/exams/<int:exam_id>/export')
@login_or_jwt_required
@admin_required
def export_exam_results(exam_id):
    exam = Exam.query.get_or_404(exam_id)
    records = ExamRecord.query.filter_by(
        exam_id=exam_id, status='submitted'
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

    output = si.getvalue().encode('utf-8-sig')
    bio = BytesIO(output)
    filename = f"{exam.title}_成绩_{datetime.now(timezone.utc).strftime('%Y%m%d')}.csv"
    return send_file(
        bio, mimetype='text/csv; charset=utf-8', as_attachment=True,
        download_name=filename
    )


@admin_bp.route('/exams/<int:exam_id>/qr-code')
@login_or_jwt_required
@admin_required
def get_exam_qr_code(exam_id):
    import qrcode
    from flask_jwt_extended import create_access_token
    import logging as _logging

    exam = Exam.query.get_or_404(exam_id)
    token = create_access_token(identity=f'exam:{exam_id}')

    site_url = current_app.config.get('SITE_URL', '')
    if site_url:
        base = site_url
    else:
        base = request.host_url.rstrip('/')
        proto = request.headers.get('X-Forwarded-Proto', '')
        if proto == 'https':
            base = base.replace('http://', 'https://')

    exam_url = f"{base}/nurse/exam-access?token={token}&exam_id={exam_id}"

    try:
        img = qrcode.make(exam_url)
        buf = BytesIO()
        img.save(buf, format='PNG')
        buf.seek(0)
        resp = send_file(buf, mimetype='image/png')
        resp.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate'
        return resp
    except Exception as e:
        _logging.getLogger(__name__).error('QR 二维码生成失败：%s', e)
        return jsonify({'success': False, 'message': '二维码生成失败'}), 500
