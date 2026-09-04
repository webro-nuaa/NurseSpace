"""category_service：类别重命名与合并（MySQL 集成）。"""
from models import db, Case, CaseCategory
from services import category_service


def _make_category(name):
    cat = CaseCategory(name=name)
    db.session.add(cat)
    db.session.commit()
    return cat


def _make_case(category, title):
    case = Case(category_id=category.id, title=title)
    db.session.add(case)
    db.session.commit()
    return case


class TestRenameCategory:
    def test_rename_simple(self, app):
        with app.app_context():
            cat = _make_category('临时类别甲')
            result, error = category_service.rename_category(cat.id, '临时类别丙')
            assert error is None, error
            assert result['merged'] is False
            assert result['moved'] == 0
            assert result['category_id'] == cat.id
            assert db.session.get(CaseCategory, cat.id).name == '临时类别丙'

    def test_rename_merges_into_existing(self, app):
        with app.app_context():
            src = _make_category('临时类别甲')
            dst = _make_category('临时类别乙')
            _make_case(src, '甲案例1')
            _make_case(src, '甲案例2')
            _make_case(dst, '乙案例1')

            result, error = category_service.rename_category(src.id, '临时类别乙')

            assert error is None, error
            assert result['merged'] is True
            assert result['moved'] == 2
            assert result['category_id'] == dst.id
            # 源类别删除，案例全部迁移
            assert db.session.get(CaseCategory, src.id) is None
            assert Case.query.filter_by(category_id=dst.id).count() == 3

    def test_rename_same_name_is_noop(self, app):
        with app.app_context():
            cat = _make_category('临时类别甲')
            result, error = category_service.rename_category(cat.id, '临时类别甲')
            assert error is None, error
            assert result['merged'] is False
            assert result['moved'] == 0
            assert db.session.get(CaseCategory, cat.id).name == '临时类别甲'

    def test_rename_missing_id_rejected(self, app):
        with app.app_context():
            result, error = category_service.rename_category(99999999, '任意')
            assert result is None
            assert '不存在' in error

    def test_rename_blank_rejected(self, app):
        with app.app_context():
            cat = _make_category('临时类别甲')
            result, error = category_service.rename_category(cat.id, '   ')
            assert result is None
            assert '不能为空' in error

    def test_rename_too_long_rejected(self, app):
        with app.app_context():
            cat = _make_category('临时类别甲')
            result, error = category_service.rename_category(cat.id, '字' * 51)
            assert result is None
            assert '超过' in error
