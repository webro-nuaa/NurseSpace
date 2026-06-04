from routes.nurse import nurse_bp
from flask import jsonify, request, current_app
from flask_login import current_user
from utils.auth import login_or_jwt_required
from utils.decorators import nurse_required
from models import User, Case, CaseCategory, Station, StandardAnswer, LearningRecord, WrongQuestion, ExtensionVideo, ExtensionLink, db
from services.evaluation import EvaluationService
from sqlalchemy import desc, func


def _get_eval_service():
    return EvaluationService(current_app.extensions.get('ai_evaluator'))


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
        total_stations = Station.query.filter_by(case_id=case.id, station_type='assessment').count()
        completed_stations = db.session.query(LearningRecord)\
            .join(Station, LearningRecord.station_id == Station.id)\
            .filter(Station.case_id == case.id, Station.station_type == 'assessment', LearningRecord.user_id == current_user.id)\
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
        answers = StandardAnswer.query.filter_by(station_id=station.id)\
            .order_by(StandardAnswer.order_index).all()

        stations_data.append({
            'id': station.id,
            'name': station.name or '',
            'assessment_task': station.assessment_task,
            'condition_report': station.condition_report,
            'question': station.question,
            'station_type': station.station_type,
            'completed': learning_record is not None,
            'score': float(learning_record.score) if (learning_record is not None and learning_record.score is not None) else (None if learning_record is None else 0.0),
            'completed_at': learning_record.completed_at.isoformat() if learning_record else None,
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
            'videos': [{'id': v.id, 'title': v.title, 'url': v.url,
                        'description': v.description or '', 'order_index': v.order_index}
                       for v in videos],
            'links': [{'id': l.id, 'title': l.title, 'url': l.url,
                       'description': l.description or '', 'order_index': l.order_index}
                      for l in links]
        }
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
