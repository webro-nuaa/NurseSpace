"""案例域服务 — 案例实体的查询、创建、更新、删除、导入与导出。

路由层只负责请求解析与响应组装，本模块承载案例域的业务逻辑与数据访问。
"""
import logging
import re
from io import BytesIO

from models import (
    db, Case, CaseCategory, Station, StandardAnswer,
    LearningRecord, ExtensionVideo, ExtensionLink,
    Comment, CommentLike, CommentReport,
)
from utils.docx_exporter import export_case_to_docx
from sqlalchemy import desc, func
from sqlalchemy.exc import IntegrityError

logger = logging.getLogger(__name__)


def list_cases(page, per_page, category_id=None, search='', case_type='', include_stations=False):
    """分页列出案例（含类别、站点数、学习人次），返回可直接序列化的 dict。"""
    query = db.session.query(Case, CaseCategory)\
        .join(CaseCategory, Case.category_id == CaseCategory.id)

    if category_id:
        query = query.filter(Case.category_id == category_id)
    if case_type in ('learning', 'exam'):
        query = query.filter(Case.case_type == case_type)
    if search:
        query = query.filter(
            db.or_(
                Case.title.contains(search),
                CaseCategory.name.contains(search)
            )
        )

    pagination = query.order_by(desc(Case.created_at))\
        .paginate(page=page, per_page=per_page, error_out=False)

    cases_data = []
    for case, category in pagination.items:
        cases_data.append(_serialize_case_summary(case, category, include_stations))

    categories_data = [
        {'id': cat.id, 'name': cat.name, 'description': cat.description}
        for cat in CaseCategory.query.all()
    ]

    return {
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


def _serialize_case_summary(case, category, include_stations):
    """构建案例列表项（含站点数与学习人次，可选附带站点明细）。"""
    case_stations = Station.query.filter_by(case_id=case.id)\
        .order_by(Station.order_index).all()
    learning_count = db.session.query(LearningRecord)\
        .join(Station, LearningRecord.station_id == Station.id)\
        .filter(Station.case_id == case.id).count()

    # 纯知识型：只有知识问答站点、无考核站点（列表展示"知识型"标识用）
    assessment_count = sum(
        1 for s in case_stations if s.station_type == 'assessment')

    case_item = {
        'id': case.id,
        'title': case.title,
        'category_name': category.name,
        'difficulty': case.difficulty or 'intermediate',
        'case_type': case.case_type or 'learning',
        'station_count': len(case_stations),
        'assessment_count': assessment_count,
        'is_knowledge_only': bool(case_stations) and assessment_count == 0,
        'learning_count': learning_count,
        'created_at': case.created_at.isoformat()
    }
    if include_stations:
        case_item['stations'] = [_serialize_station_brief(s) for s in case_stations]
    return case_item


def _serialize_station_brief(station):
    """构建站点摘要（含标准答案项，用于列表展开与组卷选择）。"""
    return {
        'id': station.id,
        'name': station.name,
        'question': station.question,
        'assessment_task': station.assessment_task,
        'order_index': station.order_index,
        'standard_answers': [{
            'answer_item': a.answer_item,
            'score_weight': float(a.score_weight or 1.0)
        } for a in station.standard_answers]
    }


def resolve_category(category_id=None, category_name=''):
    """按 ID 或名称定位类别；名称不存在时自动创建。返回 (category, error_message)。"""
    if category_id:
        category = db.session.get(CaseCategory, category_id)
        if not category:
            return None, '类别不存在'
        return category, None
    if category_name:
        category = CaseCategory.query.filter_by(name=category_name).first()
        if not category:
            category = CaseCategory(name=category_name)
            db.session.add(category)
            db.session.flush()
        return category, None
    return None, None


def create_case_from_payload(data):
    """从 JSON 载荷创建案例（含站点、标准答案、拓展资源、扩展知识）。

    返回 (case, error_message)；错误时已回滚。
    """
    title = (data.get('title') or '').strip()
    if not title:
        return None, '标题不能为空'
    category_id = data.get('category_id')
    category_name = (data.get('category_name') or '').strip()
    if not category_id and not category_name:
        return None, '请选择类别或输入新类别名称'

    try:
        category, error = resolve_category(category_id, category_name)
        if error:
            db.session.rollback()
            return None, error

        case = Case(
            category_id=category.id, title=title,
            case_guide=(data.get('case_guide') or '').strip(),
            difficulty=data.get('difficulty', 'intermediate'),
            case_type=data.get('case_type', 'learning'),
            file_path=''
        )
        db.session.add(case)
        db.session.flush()

        _create_stations(case, data.get('stations') or [])
        _create_videos(case, data.get('videos') or [])
        _create_links(case, data.get('links') or [])
        _create_knowledge_stations(case, data.get('extended_knowledge') or [])

        db.session.commit()
        return case, None
    except Exception as e:
        db.session.rollback()
        logger.error("案例创建失败: %s", e, exc_info=True)
        return None, '创建失败，请稍后重试'


def _create_stations(case, stations_payload):
    """创建考核站点及其标准答案。"""
    for si, s_data in enumerate(stations_payload):
        station = Station(
            case_id=case.id,
            name=(s_data.get('name') or '').strip(),
            assessment_task=(s_data.get('assessment_task') or '').strip(),
            question=(s_data.get('question') or '').strip(),
            order_index=s_data.get('order_index', si)
        )
        db.session.add(station)
        db.session.flush()
        for ai, a_data in enumerate(s_data.get('standard_answers') or []):
            db.session.add(StandardAnswer(
                station_id=station.id,
                answer_item=(a_data.get('answer_item') or '').strip(),
                score_weight=float(a_data.get('score_weight', 1.0)),
                order_index=ai
            ))


def _create_videos(case, videos_payload):
    """创建拓展视频。"""
    for vi, v_data in enumerate(videos_payload):
        db.session.add(ExtensionVideo(
            case_id=case.id,
            title=(v_data.get('title') or '').strip(),
            url=(v_data.get('url') or '').strip(),
            description=(v_data.get('description') or '').strip(),
            order_index=v_data.get('order_index', vi)
        ))


def _create_links(case, links_payload):
    """创建拓展链接。"""
    for li, l_data in enumerate(links_payload):
        db.session.add(ExtensionLink(
            case_id=case.id,
            title=(l_data.get('title') or '').strip(),
            url=(l_data.get('url') or '').strip(),
            description=(l_data.get('description') or '').strip(),
            order_index=l_data.get('order_index', li)
        ))


def _create_knowledge_stations(case, knowledge_payload):
    """创建扩展知识站点（knowledge 类型）及其答案。"""
    for k_data in knowledge_payload:
        station = Station(
            case_id=case.id,
            question=(k_data.get('question') or '').strip(),
            station_type='knowledge',
            order_index=0
        )
        db.session.add(station)
        db.session.flush()
        for idx, a_data in enumerate(k_data.get('answers') or []):
            db.session.add(StandardAnswer(
                station_id=station.id,
                answer_item=(a_data.get('answer_item') or '').strip(),
                score_weight=float(a_data.get('score_weight', 1)),
                order_index=idx
            ))


def update_case_fields(case, data):
    """按白名单字段更新案例。返回 error_message 或 None（错误时已回滚）。"""
    title = (data.get('title') or '').strip()
    case_guide = (data.get('case_guide') or '').strip()
    category_id = data.get('category_id')

    if title:
        case.title = title
    case.case_guide = case_guide
    if category_id:
        category = db.session.get(CaseCategory, category_id)
        if not category:
            return '类别不存在'
        case.category_id = category_id
    if 'difficulty' in data and data['difficulty'] in ('basic', 'intermediate', 'advanced'):
        case.difficulty = data['difficulty']
    if 'case_type' in data and data['case_type'] in ('learning', 'exam'):
        case.case_type = data['case_type']

    try:
        db.session.commit()
        return None
    except Exception as e:
        db.session.rollback()
        logger.error("案例更新失败: %s", e, exc_info=True)
        return '更新失败，请稍后重试'


def _delete_station_comments(case):
    """删除案例下所有站点的讨论评论及其点赞/举报。

    评论表对站点的引用是逻辑多态（content_type + content_id，无 FK），
    站点级联删除后不会清理，必须在此显式删除；CommentLike/CommentReport
    对评论的 FK 是 RESTRICT，需先于评论删除。
    """
    station_ids = [s.id for s in case.stations]
    if not station_ids:
        return
    comment_ids = [c.id for c in Comment.query.filter(
        Comment.content_type == 'station_answer',
        Comment.content_id.in_(station_ids)
    ).all()]
    if comment_ids:
        CommentLike.query.filter(CommentLike.comment_id.in_(comment_ids))\
            .delete(synchronize_session=False)
        CommentReport.query.filter(CommentReport.comment_id.in_(comment_ids))\
            .delete(synchronize_session=False)
        Comment.query.filter(Comment.id.in_(comment_ids))\
            .delete(synchronize_session=False)


def delete_case(case):
    """删除单个案例（级联清理站点与答案）。返回 error_message 或 None。"""
    try:
        _delete_station_comments(case)
        db.session.delete(case)
        db.session.commit()
        return None
    except IntegrityError:
        db.session.rollback()
        logger.warning("案例 %s 删除被外键拦截（可能被考试引用）", case.id)
        return '该案例已被考试引用，无法删除'
    except Exception as e:
        db.session.rollback()
        logger.error("案例删除失败: %s", e, exc_info=True)
        return '删除失败，请稍后重试'


def delete_cases_by_ids(ids):
    """批量删除案例。返回 (deleted_count, error_message)。"""
    try:
        deleted = 0
        for cid in ids:
            case = db.session.get(Case, cid)
            if case:
                _delete_station_comments(case)
                db.session.delete(case)
                deleted += 1
        db.session.commit()
        return deleted, None
    except IntegrityError:
        db.session.rollback()
        logger.warning("案例批量删除被外键拦截（可能被考试引用）: %s", ids)
        return deleted, '部分案例已被考试引用，未删除'
    except Exception as e:
        db.session.rollback()
        logger.error("案例批量删除失败: %s", e, exc_info=True)
        return 0, '批量删除失败，请稍后重试'


def get_case_detail(case_id):
    """获取案例详情（站点、标准答案、学习统计、拓展资源）。不存在时返回 None。"""
    case = db.session.get(Case, case_id)
    if not case:
        return None

    stations_data = []
    for station in Station.query.filter_by(case_id=case_id)\
            .order_by(Station.order_index).all():
        answers = StandardAnswer.query.filter_by(station_id=station.id)\
            .order_by(StandardAnswer.order_index).all()
        learning_count = LearningRecord.query.filter_by(station_id=station.id).count()
        avg_score = db.session.query(func.avg(LearningRecord.score))\
            .filter_by(station_id=station.id).scalar()

        stations_data.append({
            'id': station.id,
            'name': station.name or '',
            'assessment_task': station.assessment_task,
            'condition_report': station.condition_report,
            'question': station.question,
            'station_type': station.station_type,
            'answers': [
                {
                    'id': ans.id,
                    'answer_item': ans.answer_item,
                    'score_weight': float(ans.score_weight),
                    'order_index': ans.order_index
                }
                for ans in answers
            ],
            'learning_count': learning_count,
            'avg_score': float(avg_score) if avg_score else 0
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
            'category_name': case.category.name,
            'difficulty': case.difficulty or 'intermediate',
            'case_type': case.case_type or 'learning',
            'file_path': case.file_path,
            'created_at': case.created_at.isoformat()
        },
        'stations': stations_data,
        'videos': [{'id': v.id, 'title': v.title, 'url': v.url,
                    'description': v.description or '', 'order_index': v.order_index}
                   for v in videos],
        'links': [{'id': l.id, 'title': l.title, 'url': l.url,
                   'description': l.description or '', 'order_index': l.order_index}
                  for l in links]
    }


def build_xlsx_template():
    """生成案例批量导入的 xlsx 模板文件，返回 BytesIO。"""
    from openpyxl import Workbook
    wb = Workbook()
    ws = wb.active
    ws.title = 'cases'
    headers = ['类别', '案例标题', '站点', '案例指引', '站点名称', '考核任务', '题目',
               '答案项1', '答案项2', '答案项3', '知识问1', '知识答1', '知识问2', '知识答2']
    ws.append(headers)
    ws.append(['儿科模块', '案例：新生儿黄疸（东22区新生儿科）', '东22区新生儿科',
               '这里填写案例指引文本', '护理评估', '有条理采集病史；选择性体格评估',
               '请写出护理评估要点', '评估胎龄与喂养', '评估皮肤黄染范围', '评估家长认知',
               '病理性黄疸的特点是什么？', '出生24h内出现；程度重；持续时间长', '', ''])
    bio = BytesIO()
    wb.save(bio)
    bio.seek(0)
    return bio


def import_cases_from_xlsx(stream):
    """从 xlsx 文件流批量导入案例。

    返回 (created, skipped, error_message)；错误时已回滚。
    """
    from openpyxl import load_workbook
    try:
        wb = load_workbook(filename=BytesIO(stream.read()))
        ws = wb.active
        rows = list(ws.iter_rows(values_only=True))
        if not rows:
            return 0, 0, '空文件'

        header = [str(h).strip() if h is not None else '' for h in rows[0]]
        idx = {name: i for i, name in enumerate(header)}
        for required in ('类别', '案例标题'):
            if required not in idx:
                return 0, 0, f'缺少列：{required}'

        def get(row, key, default=''):
            i = idx.get(key)
            return (str(row[i]).strip() if i is not None and row[i] is not None else default)

        answer_cols = [k for k in header if re.match(r'^答案项\d+$', str(k))]
        q_cols = [k for k in header if re.match(r'^知识问\d+$', str(k))]

        created, skipped = 0, 0
        for row in rows[1:]:
            if not row:
                continue
            category_name = get(row, '类别')
            case_title = get(row, '案例标题')
            if not category_name or not case_title:
                continue

            category = CaseCategory.query.filter_by(name=category_name).first()
            if not category:
                category = CaseCategory(name=category_name, description=f"{category_name}相关医疗案例")
                db.session.add(category)
                db.session.flush()

            existing = Case.query.filter_by(title=case_title, category_id=category.id).first()
            if existing:
                skipped += 1
                continue

            case = Case(category_id=category.id, title=case_title,
                        case_guide=get(row, '案例指引'), file_path='')
            db.session.add(case)
            db.session.flush()

            station_name = get(row, '站点名称')
            if station_name:
                station = Station(case_id=case.id, name=station_name,
                                  assessment_task=get(row, '考核任务'), question=get(row, '题目'))
                db.session.add(station)
                db.session.flush()
                order = 0
                for col in answer_cols:
                    val = get(row, col)
                    if val:
                        db.session.add(StandardAnswer(station_id=station.id, answer_item=val, order_index=order))
                        order += 1

            for qc in q_cols:
                suffix = qc.replace('知识问', '')
                ac = f'知识答{suffix}'
                qv = get(row, qc)
                av = get(row, ac)
                if qv:
                    knowledge_station = Station(case_id=case.id, question=qv, station_type='knowledge', order_index=0)
                    db.session.add(knowledge_station)
                    db.session.flush()
                    if av:
                        db.session.add(StandardAnswer(station_id=knowledge_station.id, answer_item=av, order_index=0))

            created += 1

        db.session.commit()
        return created, skipped, None
    except Exception as e:
        db.session.rollback()
        logger.error("案例导入失败: %s", e, exc_info=True)
        return 0, 0, '导入失败，请稍后重试'


def export_case_docx(case):
    """导出单个案例为 docx。返回 (BytesIO, filename)；类别缺失时返回 None。"""
    category = db.session.get(CaseCategory, case.category_id)
    if not category:
        return None

    assessment_stations = Station.query.filter_by(
        case_id=case.id, station_type='assessment'
    ).order_by(Station.order_index).all()
    knowledge_stations = Station.query.filter_by(
        case_id=case.id, station_type='knowledge'
    ).order_by(Station.order_index).all()

    buf = export_case_to_docx(case, category, assessment_stations, knowledge_stations)
    return buf, f'【{category.name}】{case.title}.docx'


def export_cases_zip(case_ids):
    """批量导出案例为 zip。返回 (BytesIO, filename)；无有效案例时返回 None。"""
    import zipfile

    cases = Case.query.filter(Case.id.in_(case_ids)).all()
    if not cases:
        return None

    zip_buf = BytesIO()
    with zipfile.ZipFile(zip_buf, 'w', zipfile.ZIP_DEFLATED) as zf:
        for case in cases:
            result = export_case_docx(case)
            if not result:
                continue
            buf, filename = result
            zf.writestr(filename, buf.read())

    zip_buf.seek(0)
    return zip_buf, f'案例批量导出_{datetime_now_str()}.zip'


def datetime_now_str():
    """当前本地日期串（用于导出文件名）。"""
    from datetime import datetime
    return datetime.now().strftime('%Y%m%d')
