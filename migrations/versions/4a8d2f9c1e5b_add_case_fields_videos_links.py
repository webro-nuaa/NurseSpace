"""add case difficulty, case_type, extension_videos, extension_links

Revision ID: 4a8d2f9c1e5b
Revises: 3c7f1e8b2a9d
Create Date: 2026-05-10 12:00:00.000000
"""
from alembic import op
import sqlalchemy as sa


revision = '4a8d2f9c1e5b'
down_revision = '3c7f1e8b2a9d'
branch_labels = None
depends_on = None


def upgrade():
    # Case 新增字段
    op.add_column('cases', sa.Column('difficulty',
                  sa.Enum('basic', 'intermediate', 'advanced'),
                  nullable=False, server_default='intermediate'))
    op.add_column('cases', sa.Column('case_type',
                  sa.Enum('learning', 'exam'),
                  nullable=False, server_default='learning'))

    # 新建 extension_videos 表
    op.create_table('extension_videos',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('case_id', sa.Integer(), nullable=False),
        sa.Column('title', sa.String(200), nullable=False),
        sa.Column('url', sa.String(500), nullable=False),
        sa.Column('description', sa.Text()),
        sa.Column('order_index', sa.Integer(), server_default='0'),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.ForeignKeyConstraint(['case_id'], ['cases.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )

    # 新建 extension_links 表
    op.create_table('extension_links',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('case_id', sa.Integer(), nullable=False),
        sa.Column('title', sa.String(200), nullable=False),
        sa.Column('url', sa.String(500), nullable=False),
        sa.Column('description', sa.Text()),
        sa.Column('order_index', sa.Integer(), server_default='0'),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.ForeignKeyConstraint(['case_id'], ['cases.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )

    # AiSetting key 字段扩容（加密后长度增加）
    op.alter_column('ai_settings', 'openai_key',
                    existing_type=sa.String(200), type_=sa.String(500),
                    existing_nullable=True)
    op.alter_column('ai_settings', 'zhipu_key',
                    existing_type=sa.String(200), type_=sa.String(500),
                    existing_nullable=True)


def downgrade():
    op.drop_table('extension_links')
    op.drop_table('extension_videos')
    op.drop_column('cases', 'case_type')
    op.drop_column('cases', 'difficulty')
    op.alter_column('ai_settings', 'zhipu_key',
                    existing_type=sa.String(500), type_=sa.String(200),
                    existing_nullable=True)
    op.alter_column('ai_settings', 'openai_key',
                    existing_type=sa.String(500), type_=sa.String(200),
                    existing_nullable=True)
