"""case_categories.name 加唯一约束

类别改名/合并功能（services.category_service）的并发安全兜底：
阻止两个类别同名。现有数据各类别名互不相同，迁移直接生效。

Revision ID: c5d8e2a91b40
Revises: e2865754a9a9
Create Date: 2026-09-04
"""
from alembic import op

revision = 'c5d8e2a91b40'
down_revision = 'e2865754a9a9'
branch_labels = None
depends_on = None


def upgrade():
    op.create_unique_constraint(
        'uq_case_categories_name', 'case_categories', ['name'])


def downgrade():
    op.drop_constraint(
        'uq_case_categories_name', 'case_categories', type_='unique')
