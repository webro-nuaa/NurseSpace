from routes.admin import admin_bp
from flask import jsonify
from flask_login import current_user
from utils.auth import login_or_jwt_required
from utils.decorators import admin_required
from models import User, Case, CaseCategory, Station, LearningRecord, WrongQuestion, Exam, db
from sqlalchemy import desc, func


@admin_bp.route('/dashboard')
@login_or_jwt_required
@admin_required
def dashboard():
    total_users = User.query.filter_by(role='nurse').count()
    active_users = User.query.filter_by(role='nurse', status='active').count()
    total_cases = Case.query.count()
    total_stations = Station.query.count()
    total_learning_records = LearningRecord.query.count()
    total_exams = Exam.query.count()

    recent_activities = db.session.query(LearningRecord, User, Station, Case)\
        .join(User, LearningRecord.user_id == User.id)\
        .join(Station, LearningRecord.station_id == Station.id)\
        .join(Case, Station.case_id == Case.id)\
        .order_by(desc(LearningRecord.completed_at))\
        .limit(10).all()

    activities_data = []
    for record, user, station, case in recent_activities:
        activities_data.append({
            'id': record.id,
            'user_name': user.real_name,
            'case_title': case.title,
            'station_name': station.name,
            'score': float(record.score) if record.score else 0,
            'completed_at': record.completed_at.isoformat()
        })

    category_stats = db.session.query(
        CaseCategory.name,
        func.count(func.distinct(Case.id)).label('case_count'),
        func.count(func.distinct(Station.id)).label('station_count')
    ).join(Case, CaseCategory.id == Case.category_id)\
     .outerjoin(Station, Case.id == Station.case_id)\
     .group_by(CaseCategory.id, CaseCategory.name).all()

    category_data = []
    for category_name, case_count, station_count in category_stats:
        category_data.append({
            'category': category_name,
            'case_count': case_count,
            'station_count': station_count
        })

    learning_stats = db.session.query(
        func.avg(LearningRecord.score).label('avg_score'),
        func.count(LearningRecord.id).label('total_records'),
        func.count(WrongQuestion.id).label('wrong_count')
    ).outerjoin(WrongQuestion, LearningRecord.station_id == WrongQuestion.station_id).first()

    return jsonify({
        'success': True,
        'data': {
            'statistics': {
                'total_users': total_users,
                'active_users': active_users,
                'total_cases': total_cases,
                'total_stations': total_stations,
                'total_learning_records': total_learning_records,
                'total_exams': total_exams,
                'avg_score': float(learning_stats.avg_score) if learning_stats.avg_score else 0,
                'wrong_rate': round(learning_stats.wrong_count / learning_stats.total_records * 100, 1) if learning_stats.total_records > 0 else 0
            },
            'recent_activities': activities_data,
            'category_data': category_data
        }
    })


@admin_bp.route('/statistics/learning-data')
@login_or_jwt_required
@admin_required
def get_learning_statistics():
    progress_stats = db.session.query(
        CaseCategory.name,
        func.count(Station.id).label('total_stations'),
        func.count(LearningRecord.id).label('completed_stations'),
        func.avg(LearningRecord.score).label('avg_score')
    ).join(Case, CaseCategory.id == Case.category_id)\
     .join(Station, Case.id == Station.case_id)\
     .outerjoin(LearningRecord, Station.id == LearningRecord.station_id)\
     .group_by(CaseCategory.id, CaseCategory.name).all()

    progress_data = []
    for category_name, total, completed, avg_score in progress_stats:
        progress_data.append({
            'category': category_name,
            'total_stations': total,
            'completed_stations': completed or 0,
            'completion_rate': round((completed or 0) / total * 100, 1) if total > 0 else 0,
            'avg_score': round(float(avg_score), 1) if avg_score else 0
        })

    wrong_stats = db.session.query(
        CaseCategory.name,
        func.count(WrongQuestion.id).label('wrong_count')
    ).join(Case, CaseCategory.id == Case.category_id)\
     .join(Station, Case.id == Station.case_id)\
     .join(WrongQuestion, Station.id == WrongQuestion.station_id)\
     .group_by(CaseCategory.id, CaseCategory.name).all()

    wrong_data = {name: count for name, count in wrong_stats}

    user_activity = db.session.query(
        User.department,
        func.count(LearningRecord.id).label('activity_count'),
        func.avg(LearningRecord.score).label('avg_score')
    ).join(LearningRecord, User.id == LearningRecord.user_id)\
     .filter(User.role == 'nurse')\
     .group_by(User.department).all()

    activity_data = []
    for department, activity_count, avg_score in user_activity:
        activity_data.append({
            'department': department or '未分配科室',
            'activity_count': activity_count,
            'avg_score': round(float(avg_score), 1) if avg_score else 0
        })

    return jsonify({
        'success': True,
        'data': {
            'progress_stats': progress_data,
            'wrong_distribution': wrong_data,
            'user_activity': activity_data
        }
    })


@admin_bp.route('/statistics/group-weakness')
@login_or_jwt_required
@admin_required
def get_group_weakness():
    wrong_questions = db.session.query(WrongQuestion, Station, Case, CaseCategory)\
        .join(Station, WrongQuestion.station_id == Station.id)\
        .join(Case, Station.case_id == Case.id)\
        .join(CaseCategory, Case.category_id == CaseCategory.id).all()

    if not wrong_questions:
        return jsonify({
            'success': True,
            'data': {
                'analysis': {
                    'weak_categories': [],
                    'common_issues': ['暂无错题数据'],
                    'improvement_suggestions': [],
                    'priority_areas': []
                }
            }
        })

    category_errors = {}
    for wrong_q, station, case, category in wrong_questions:
        category_errors[category.name] = category_errors.get(category.name, 0) + 1

    weak_categories = sorted(category_errors.keys(), key=lambda x: category_errors[x], reverse=True)[:5]

    analysis = {
        'weak_categories': weak_categories,
        'common_issues': [f'{cat}领域错误率较高' for cat in weak_categories[:3]],
        'improvement_suggestions': [
            {'category': cat, 'suggestion': f'建议加强{cat}相关培训，重点关注常见错误'}
            for cat in weak_categories[:3]
        ],
        'priority_areas': weak_categories[:2],
        'error_distribution': category_errors
    }

    return jsonify({
        'success': True,
        'data': {
            'analysis': analysis,
            'total_errors': len(wrong_questions)
        }
    })
