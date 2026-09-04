"""护士端案例路由 — 请求解析与响应组装，业务逻辑在 services.case_learning_service。"""
from routes.nurse import nurse_bp
from flask import jsonify, request, current_app
from flask_login import current_user
from utils.auth import login_or_jwt_required
from utils.decorators import nurse_required
from models import Station, StandardAnswer, db
from services.evaluation import EvaluationService
from services import case_learning_service


def _get_eval_service():
    return EvaluationService(current_app.extensions.get('ai_evaluator'))


@nurse_bp.route('/cases')
@login_or_jwt_required
@nurse_required
def get_cases():
    data = case_learning_service.list_learning_cases(
        user_id=current_user.id,
        category_id=request.args.get('category_id', type=int),
        page=request.args.get('page', 1, type=int),
        per_page=request.args.get('per_page', 10, type=int),
    )
    return jsonify({'success': True, 'data': data})


@nurse_bp.route('/cases/<int:case_id>')
@login_or_jwt_required
@nurse_required
def get_case_detail(case_id):
    data, error = case_learning_service.get_case_detail(current_user.id, case_id)
    if error:
        return jsonify({'success': False, 'message': error}), 404
    return jsonify({'success': True, 'data': data})


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

    try:
        svc = _get_eval_service()
        result = svc.process_submission(user, station, user_answer, standard_data, db)
        result['standard_answers'] = [
            {'answer_item': ans.answer_item, 'order_index': ans.order_index}
            for ans in standard_answers
        ]
        return jsonify(result)
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"答案提交失败: {e}", exc_info=True)
        return jsonify({'success': False, 'message': '提交失败，请稍后重试'})
