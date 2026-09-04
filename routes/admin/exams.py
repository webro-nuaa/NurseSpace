"""管理员端考试管理路由 — 请求解析与响应组装，业务逻辑在 services.exam_service。"""
from routes.admin import admin_bp
from datetime import datetime, timedelta
from io import BytesIO

from flask import jsonify, request, send_file, current_app
from utils.auth import login_or_jwt_required
from utils.decorators import admin_required
from utils.ai_evaluator import AIEvaluator
from models import db, Exam, ExamAnswer
from services import exam_service
from utils.time_utils import parse_local_to_utc


@admin_bp.route('/exams', methods=['GET', 'POST'])
@login_or_jwt_required
@admin_required
def manage_exams():
    if request.method == 'GET':
        data = exam_service.list_exams(
            page=request.args.get('page', 1, type=int),
            per_page=request.args.get('per_page', 20, type=int),
        )
        return jsonify({'success': True, 'data': data})

    # POST: 创建考试
    from flask_login import current_user
    data = request.get_json()
    exam, error = exam_service.create_exam(data or {}, current_user.id)
    if error:
        return jsonify({'success': False, 'message': error})
    return jsonify({
        'success': True,
        'message': '考试创建成功',
        'exam': {'id': exam.id, 'title': exam.title}
    })


@admin_bp.route('/exams/<int:exam_id>', methods=['PUT'])
@login_or_jwt_required
@admin_required
def update_exam(exam_id):
    exam = Exam.query.get_or_404(exam_id)
    data = request.get_json() or {}
    for field in ['title', 'description']:
        if field in data:
            setattr(exam, field, (data.get(field) or '').strip())
    if 'duration' in data:
        try:
            exam.duration = int(data['duration'])
        except (TypeError, ValueError):
            return jsonify({'success': False, 'message': '考试时长必须为整数（分钟）'})
    if 'start_time' in data and data['start_time']:
        try:
            exam.start_time = parse_local_to_utc(data['start_time'])
        except ValueError:
            return jsonify({'success': False, 'message': '开始时间格式无效'})
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
        case_ids = (request.get_json() or {}).get('case_ids', [])
        if not case_ids:
            return jsonify({'success': False, 'message': '请指定要移除的题目'})
        error = exam_service.remove_questions(exam_id, case_ids)
        if error:
            return jsonify({'success': False, 'message': error})
        return jsonify({'success': True, 'message': '已移除'})

    if request.method == 'GET':
        return jsonify({
            'success': True,
            'data': {
                'exam': {'id': exam.id, 'title': exam.title, 'status': exam.status},
                **exam_service.list_questions(exam_id)
            }
        })

    # POST: 添加题目
    case_ids = (request.get_json() or {}).get('case_ids', [])
    if not case_ids:
        return jsonify({'success': False, 'message': '请选择至少一个案例'})
    error = exam_service.add_questions(exam_id, case_ids)
    if error:
        return jsonify({'success': False, 'message': error})
    return jsonify({'success': True, 'message': '案例添加成功'})


@admin_bp.route('/exams/<int:exam_id>/questions/clear', methods=['POST'])
@login_or_jwt_required
@admin_required
def clear_exam_questions(exam_id):
    Exam.query.get_or_404(exam_id)
    error = exam_service.clear_questions(exam_id)
    if error:
        return jsonify({'success': False, 'message': error})
    return jsonify({'success': True, 'message': '已清空所有题目'})


@admin_bp.route('/exams/<int:exam_id>/review', methods=['GET'])
@login_or_jwt_required
@admin_required
def get_exam_review(exam_id):
    exam = Exam.query.get_or_404(exam_id)
    return jsonify({'success': True, 'data': exam_service.build_review(exam)})


@admin_bp.route('/exams/<int:exam_id>/review/<int:record_id>', methods=['GET'])
@login_or_jwt_required
@admin_required
def get_participant_detail(exam_id, record_id):
    Exam.query.get_or_404(exam_id)
    payload = exam_service.build_participant_detail(exam_id, record_id)
    if not payload:
        from flask import abort
        abort(404)
    return jsonify({'success': True, 'data': payload})


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
    result = exam_service.update_answer_score(answer, new_score)

    return jsonify({
        'success': True,
        'message': '分数已更新',
        'data': result
    })


@admin_bp.route('/exams/<int:exam_id>/review/<int:answer_id>/re-score', methods=['POST'])
@login_or_jwt_required
@admin_required
def re_score_exam_answer(exam_id, answer_id):
    answer = ExamAnswer.query.get_or_404(answer_id)
    evaluator = current_app.extensions.get('ai_evaluator', AIEvaluator())

    data, error, status = exam_service.re_score_answer(answer, evaluator)
    if error:
        return jsonify({'success': False, 'message': error}), status

    return jsonify({
        'success': True,
        'message': 'AI 重新评分完成',
        'data': data
    })


@admin_bp.route('/exams/<int:exam_id>/export')
@login_or_jwt_required
@admin_required
def export_exam_results(exam_id):
    exam = Exam.query.get_or_404(exam_id)
    content, filename = exam_service.export_results_csv(exam)
    return send_file(
        BytesIO(content), mimetype='text/csv; charset=utf-8', as_attachment=True,
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
