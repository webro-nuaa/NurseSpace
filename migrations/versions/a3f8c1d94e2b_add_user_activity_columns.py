"""users 表增加活跃度追踪字段（last_login_at / last_seen_at）。

可空列、无默认值，MySQL 8.0 INSTANT DDL，不锁表；旧数据保持 NULL（前端显示"从未"）。

Revision ID: a3f8c1d94e2b
Revises: c5d8e2a91b40
Create Date: 2026-10-05
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'a3f8c1d94e2b'
down_revision = 'c5d8e2a91b40'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('users', sa.Column('last_login_at', sa.DateTime(), nullable=True))
    op.add_column('users', sa.Column('last_seen_at', sa.DateTime(), nullable=True))


def downgrade():
    op.drop_column('users', 'last_seen_at')
    op.drop_column('users', 'last_login_at')
