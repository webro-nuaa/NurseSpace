"""护士端考试路由 — 请求解析与响应组装，业务逻辑在 services.exam_taking_service。"""
from routes.nurse import nurse_bp

from flask import jsonify, request, current_app
from flask_login import current_user
from utils.auth import login_or_jwt_required
from utils.decorators import nurse_required
from services.evaluation import EvaluationService
from services import exam_taking_service


def _get_eval_service():
    return EvaluationService(current_app.extensions.get('ai_evaluator'))


@nurse_bp.route('/exams')
@login_or_jwt_required
@nurse_required
def get_exams():
    data = exam_taking_service.list_available_exams(current_user.id)
    return jsonify({'success': True, 'data': data})


@nurse_bp.route('/exams/<int:exam_id>/start', methods=['POST'])
@login_or_jwt_required
@nurse_required
def start_exam(exam_id):
    data, error = exam_taking_service.start_exam(current_user.id, exam_id)
    if error:
        return jsonify({'success': False, 'message': error[0]}), error[1]
    return jsonify({'success': True, 'data': data})


@nurse_bp.route('/exams/<int:exam_id>/submit', methods=['POST'])
@login_or_jwt_required
@nurse_required
def submit_exam(exam_id):
    data = request.get_json() or {}
    result, error = exam_taking_service.submit_exam(
        user_id=current_user.id,
        exam_id=exam_id,
        answers=data.get('answers', []),
        evaluation_service=_get_eval_service(),
    )
    if error:
        return jsonify({'success': False, 'message': error[0]}), error[1]
    return jsonify({'success': True, 'message': '考试已提交', 'data': result})


@nurse_bp.route('/exams/<int:exam_id>/result')
@login_or_jwt_required
@nurse_required
def get_exam_result(exam_id):
    data = exam_taking_service.get_exam_result(current_user.id, exam_id)
    if not data:
        return jsonify({'success': False, 'message': '未找到考试记录'}), 404
    return jsonify({'success': True, 'data': data})
