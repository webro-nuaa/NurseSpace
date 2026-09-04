"""expand_point_record_reason

Revision ID: 93dc4402a202
Revises: 92dc4402a201
Create Date: 2026-07-04 12:05:00.000000
"""
from alembic import op
import sqlalchemy as sa


revision = '93dc4402a202'
down_revision = '92dc4402a201'
branch_labels = None
depends_on = None


def upgrade():
    op.alter_column(
        'point_records',
        'reason',
        existing_type=sa.String(length=200),
        type_=sa.String(length=300),
        existing_nullable=True,
    )


def downgrade():
    op.alter_column(
        'point_records',
        'reason',
        existing_type=sa.String(length=300),
        type_=sa.String(length=200),
        existing_nullable=True,
    )
