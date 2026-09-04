"""类别管理服务：重命名与合并。

全链路不变量：案例 docx 文件名的【类别】段决定导入归属（见
utils.docx_parser.parse_file），本服务只改动持久层，不触碰文件。
重命名类别后若要重新导入旧命名的文件，必须同步重命名文件名，
否则会在导入时复活旧类别。

合并语义：目标名已存在时，源类别下所有案例整体迁移到目标类别，
随后删除源类别。案例 id 不变，考试、学习记录等按案例关联的数据
不受影响（仪表盘等按类别 JOIN 的统计实时生效，无缓存残留）。
"""
from sqlalchemy.exc import IntegrityError

from models import db, Case, CaseCategory

# 与 CaseCategory.name 列宽一致
_NAME_MAX_LEN = 50


def rename_category(category_id, new_name):
    """重命名类别；目标名已存在时并入目标类别。

    返回 (result, error)。result:
        {'category_id': 最终生效的类别 id, 'merged': 是否发生合并,
         'moved': 迁移的案例数}
    """
    new_name = (new_name or '').strip()
    if not new_name:
        return None, '类别名不能为空'
    if len(new_name) > _NAME_MAX_LEN:
        return None, f'类别名不能超过{_NAME_MAX_LEN}个字符'

    source = db.session.get(CaseCategory, category_id)
    if source is None:
        return None, '类别不存在'

    # 同名同 id：无操作
    if source.name == new_name:
        return {'category_id': source.id, 'merged': False, 'moved': 0}, None

    target = CaseCategory.query.filter_by(name=new_name).first()
    try:
        if target is None:
            # 纯改名：目标名不存在
            source.name = new_name
            db.session.commit()
            return {'category_id': source.id, 'merged': False, 'moved': 0}, None

        # 合并：案例整体迁移（单条 UPDATE，不逐个触碰 ORM 对象），删源类别
        moved = Case.query.filter_by(category_id=source.id).update(
            {'category_id': target.id})
        db.session.delete(source)
        db.session.commit()
        return {'category_id': target.id, 'merged': True, 'moved': moved}, None
    except IntegrityError:
        # 并发下另一个请求先占用了目标名，由唯一约束兜底
        db.session.rollback()
        return None, '该类别名已存在（并发冲突），请刷新后重试'
