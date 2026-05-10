"""remove case site_info, add station order_index

Revision ID: 3c7f1e8b2a9d
Revises: 2b811c4a0025
Create Date: 2026-05-10 10:00:00.000000
"""
from alembic import op
import sqlalchemy as sa


revision = '3c7f1e8b2a9d'
down_revision = '2b811c4a0025'
branch_labels = None
depends_on = None


def upgrade():
    op.drop_column('cases', 'site_info')
    op.add_column('stations', sa.Column('order_index', sa.Integer(), nullable=False, server_default='0'))


def downgrade():
    op.add_column('cases', sa.Column('site_info', sa.String(100), nullable=True, comment='站点信息'))
    op.drop_column('stations', 'order_index')
