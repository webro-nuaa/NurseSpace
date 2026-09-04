"""护士端案例学习视图服务：案例列表（含学习进度）与案例详情聚合。

区别于 case_service（管理员端案例管理），本模块只读，
按"当前学习者"视角组装案例及其站点/视频/链接/学习进度数据。
"""
from models import (
    db, Case, CaseCategory, Station, StandardAnswer,
    LearningRecord, ExtensionVideo, ExtensionLink,
)
from sqlalchemy import func


def list_learning_cases(user_id, category_id=None, page=1, per_page=10):
    """护士端案例列表：分页返回学习型案例及各案例的站点完成进度，返回 dict。"""
    query = db.session.query(Case, CaseCategory)\
        .join(CaseCategory, Case.category_id == CaseCategory.id)\
        .filter(Case.case_type == 'learning')

    if category_id:
        query = query.filter(Case.category_id == category_id)

    pagination = query.paginate(page=page, per_page=per_page, error_out=False)

    cases_data = []
    for case, category in pagination.items:
        total_stations = Station.query.filter_by(
            case_id=case.id, station_type='assessment').count()
        completed_stations = db.session.query(LearningRecord)\
            .join(Station, LearningRecord.station_id == Station.id)\
            .filter(
                Station.case_id == case.id,
                Station.station_type == 'assessment',
                LearningRecord.user_id == user_id
            ).count()
        # 纯知识型：无考核站点但有知识问答（列表展示"知识型"标识用）
        knowledge_stations = Station.query.filter_by(
            case_id=case.id, station_type='knowledge').count()

        cases_data.append({
            'id': case.id,
            'title': case.title,
            'category': category.name,
            'total_stations': total_stations,
            'completed_stations': completed_stations,
            'progress': round(completed_stations / total_stations * 100, 1) if total_stations > 0 else 0,
            'is_knowledge_only': total_stations == 0 and knowledge_stations > 0,
            'created_at': case.created_at.isoformat()
        })

    return {
        'cases': cases_data,
        'categories': _list_learning_categories(),
        'pagination': {
            'page': page,
            'per_page': per_page,
            'total': pagination.total,
            'pages': pagination.pages,
            'has_prev': pagination.has_prev,
            'has_next': pagination.has_next
        }
    }


def get_case_detail(user_id, case_id):
    """护士端案例详情：案例信息 + 站点答题状态 + 扩展视频/链接。返回 (data, error)。"""
    case = db.session.get(Case, case_id)
    if not case:
        return None, '案例不存在'

    stations_data = []
    for station in Station.query.filter_by(case_id=case_id)\
            .order_by(Station.order_index).all():
        record = LearningRecord.query.filter_by(
            user_id=user_id, station_id=station.id).first()
        answers = StandardAnswer.query.filter_by(station_id=station.id)\
            .order_by(StandardAnswer.order_index).all()

        stations_data.append({
            'id': station.id,
            'name': station.name or '',
            'assessment_task': station.assessment_task,
            'condition_report': station.condition_report,
            'question': station.question,
            'station_type': station.station_type,
            'completed': record is not None,
            'score': _station_score(record),
            'completed_at': record.completed_at.isoformat() if record else None,
            'answers': [{'id': a.id, 'answer_item': a.answer_item,
                         'score_weight': float(a.score_weight)} for a in answers]
        })

    videos = ExtensionVideo.query.filter_by(case_id=case_id)\
        .order_by(ExtensionVideo.order_index).all()
    links = ExtensionLink.query.filter_by(case_id=case_id)\
        .order_by(ExtensionLink.order_index).all()

    return {
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
        'videos': [_serialize_attachment(v) for v in videos],
        'links': [_serialize_attachment(l) for l in links]
    }, None


def _station_score(record):
    """站点得分展示规则：未作答为 None；作答但未评分为 0.0；否则为实际分数。"""
    if record is None:
        return None
    if record.score is None:
        return 0.0
    return float(record.score)


def _serialize_attachment(item):
    return {
        'id': item.id,
        'title': item.title,
        'url': item.url,
        'description': item.description or '',
        'order_index': item.order_index
    }


def _list_learning_categories():
    """学习型案例的类别列表，附每类案例数量。"""
    categories = CaseCategory.query.all()
    case_counts = dict(
        db.session.query(Case.category_id, func.count(Case.id))
        .filter(Case.case_type == 'learning')
        .group_by(Case.category_id).all()
    )
    return [
        {
            'id': cat.id, 'name': cat.name, 'description': cat.description,
            'case_count': case_counts.get(cat.id, 0)
        }
        for cat in categories
    ]
