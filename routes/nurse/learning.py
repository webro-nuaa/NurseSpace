"""护士端学习路由 — 请求解析与响应组装，业务逻辑在 services.learning_service。"""
from routes.nurse import nurse_bp

from flask import jsonify, request, current_app
from flask_login import current_user
from utils.auth import login_or_jwt_required
from utils.decorators import nurse_required
from models import Station
from services.evaluation import EvaluationService
from services import learning_service


def _get_eval_service():
    return EvaluationService(current_app.extensions.get('ai_evaluator'))


@nurse_bp.route('/wrong-questions')
@login_or_jwt_required
@nurse_required
def get_wrong_questions():
    data = learning_service.list_wrong_questions(
        user_id=current_user.id,
        page=request.args.get('page', 1, type=int),
        per_page=request.args.get('per_page', 10, type=int),
    )
    return jsonify({'success': True, 'data': data})


@nurse_bp.route('/wrong-questions/<int:station_id>')
@login_or_jwt_required
@nurse_required
def get_wrong_question_detail(station_id: int):
    station = Station.query.get_or_404(station_id)
    data = learning_service.get_wrong_question_detail(current_user.id, station)
    return jsonify({'success': True, 'data': data})


@nurse_bp.route('/weakness-analysis')
@login_or_jwt_required
@nurse_required
def get_weakness_analysis():
    data = learning_service.get_weakness_analysis(current_user.id)
    return jsonify({'success': True, 'data': data})


@nurse_bp.route('/weakness-analysis/run', methods=['POST'])
@login_or_jwt_required
@nurse_required
def run_weakness_analysis():
    data, error = learning_service.run_weakness_analysis(
        user_id=current_user.id,
        evaluation_service=_get_eval_service(),
    )
    if error:
        return jsonify({'success': False, 'message': error})
    return jsonify({'success': True, 'data': data})


@nurse_bp.route('/point-records')
@login_or_jwt_required
@nurse_required
def get_point_records():
    data = learning_service.list_point_records(
        user_id=current_user.id,
        current_points=current_user.points,
        page=request.args.get('page', 1, type=int),
        per_page=request.args.get('per_page', 20, type=int),
    )
    return jsonify({'success': True, 'data': data})
