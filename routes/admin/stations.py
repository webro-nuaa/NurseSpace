from routes.admin import admin_bp
from flask import jsonify, request, current_app
from flask_login import current_user
from utils.auth import login_or_jwt_required
from utils.decorators import admin_required
from models import Case, Station, StandardAnswer, LearningRecord, WrongQuestion, db
from sqlalchemy import func


@admin_bp.route('/cases/<int:case_id>/stations', methods=['POST'])
@login_or_jwt_required
@admin_required
def create_case_station(case_id):
    case = db.session.get(Case, case_id)
    if not case:
        return jsonify({'success': False, 'message': '案例不存在'}), 404
    data = request.get_json() or {}
    name = (data.get('name') or '').strip()
    if not name:
        return jsonify({'success': False, 'message': '站点名称不能为空'})
    max_order = db.session.query(func.max(Station.order_index)).filter_by(case_id=case_id).scalar() or 0
    station = Station(
        case_id=case_id, name=name,
        assessment_task=(data.get('assessment_task') or '').strip(),
        question=(data.get('question') or '').strip(),
        order_index=max_order + 1
    )
    db.session.add(station)
    db.session.commit()
    return jsonify({'success': True, 'station': {'id': station.id, 'name': station.name}})


@admin_bp.route('/cases/<int:case_id>/stations/<int:station_id>', methods=['PUT', 'DELETE'])
@login_or_jwt_required
@admin_required
def manage_case_station(case_id, station_id):
    station = Station.query.filter_by(id=station_id, case_id=case_id).first()
    if not station:
        return jsonify({'success': False, 'message': '站点不存在'}), 404

    if request.method == 'DELETE':
        try:
            from models import ExamAnswer
            WrongQuestion.query.filter_by(station_id=station_id).delete()
            LearningRecord.query.filter_by(station_id=station_id).delete()
            ExamAnswer.query.filter_by(station_id=station_id).delete()
            db.session.delete(station)
            db.session.commit()
            return jsonify({'success': True, 'message': '站点已删除'})
        except Exception as e:
            db.session.rollback()
            current_app.logger.error(f"站点删除失败: {e}", exc_info=True)
            return jsonify({'success': False, 'message': '删除失败，请稍后重试'}), 400

    data = request.get_json() or {}
    for field in ['name', 'assessment_task', 'question']:
        if field in data:
            setattr(station, field, (data.get(field) or '').strip())
    if 'order_index' in data:
        station.order_index = int(data['order_index'])
    db.session.commit()
    return jsonify({'success': True, 'message': '站点已更新'})


@admin_bp.route('/cases/<int:case_id>/stations/<int:station_id>/answers', methods=['PUT'])
@login_or_jwt_required
@admin_required
def update_station_answers(case_id, station_id):
    station = Station.query.filter_by(id=station_id, case_id=case_id).first()
    if not station:
        return jsonify({'success': False, 'message': '站点不存在'}), 404
    data = request.get_json() or {}
    items = data.get('answers') or []
    StandardAnswer.query.filter_by(station_id=station_id).delete()
    for i, item in enumerate(items):
        ans = StandardAnswer(
            station_id=station_id,
            answer_item=(item.get('answer_item') or '').strip(),
            score_weight=float(item.get('score_weight', 1.0)),
            order_index=i
        )
        db.session.add(ans)
    db.session.commit()
    return jsonify({'success': True, 'message': '答案已更新'})


# ---- Case knowledge items ----

@admin_bp.route('/cases/<int:case_id>/knowledge', methods=['POST'])
@login_or_jwt_required
@admin_required
def add_case_knowledge(case_id):
    Case.query.get_or_404(case_id)
    data = request.get_json()
    if not data or not data.get('question'):
        return jsonify({'success': False, 'message': '问题不能为空'}), 400
    answers = data.get('answers') or []
    if not answers:
        return jsonify({'success': False, 'message': '至少需要一个答案项'}), 400
    sk = Station(case_id=case_id, question=data['question'], station_type='knowledge')
    db.session.add(sk)
    db.session.flush()
    for idx, a in enumerate(answers):
        db.session.add(StandardAnswer(
            station_id=sk.id,
            answer_item=(a.get('answer_item') or '').strip(),
            score_weight=float(a.get('score_weight', 1)),
            order_index=idx
        ))
    db.session.commit()
    return jsonify({'success': True, 'message': '扩展知识已添加'})


@admin_bp.route('/cases/<int:case_id>/knowledge/<int:knowledge_id>', methods=['DELETE'])
@login_or_jwt_required
@admin_required
def delete_case_knowledge(case_id, knowledge_id):
    sk = Station.query.filter_by(id=knowledge_id, case_id=case_id, station_type='knowledge').first()
    if not sk:
        return jsonify({'success': False, 'message': '扩展知识不存在'}), 404
    db.session.delete(sk)
    db.session.commit()
    return jsonify({'success': True, 'message': '扩展知识已删除'})
