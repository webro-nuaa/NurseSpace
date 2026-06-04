from routes.nurse import nurse_bp
from flask import jsonify, request
from flask_login import current_user
from utils.auth import login_or_jwt_required
from utils.decorators import nurse_required
from models import User, Case, CaseCategory, Station, LearningRecord, WrongQuestion, ExamRecord, db
from sqlalchemy import desc, func


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
     .filter(Station.station_type == 'assessment')\
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
                'points': user.points,
                'consent_accepted': user.consent_accepted
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


@nurse_bp.route('/consent/accept', methods=['POST'])
@login_or_jwt_required
@nurse_required
def accept_consent():
    from datetime import datetime, timezone

    user = current_user
    user.consent_accepted = True
    user.consent_accepted_at = datetime.now(timezone.utc)
    db.session.commit()
    return jsonify({'success': True, 'message': '知情同意已确认'})
