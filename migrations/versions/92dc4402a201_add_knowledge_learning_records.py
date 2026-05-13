"""add_knowledge_learning_records

Revision ID: 92dc4402a201
Revises: 91dc4402a200
Create Date: 2026-05-13 20:45:00.000000
"""
from alembic import op
import sqlalchemy as sa


revision = '92dc4402a201'
down_revision = '91dc4402a200'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table('knowledge_learning_records',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('user_id', sa.Integer(), nullable=False),
    sa.Column('knowledge_id', sa.Integer(), nullable=False),
    sa.Column('user_answer', sa.Text(), nullable=True),
    sa.Column('score', sa.Numeric(precision=5, scale=2), nullable=True),
    sa.Column('max_score', sa.Numeric(precision=5, scale=2), nullable=True),
    sa.Column('ai_feedback', sa.Text(), nullable=True),
    sa.Column('completed_at', sa.DateTime(), nullable=True),
    sa.ForeignKeyConstraint(['knowledge_id'], ['extended_knowledge.id'], ),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_table('knowledge_wrong_questions',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('user_id', sa.Integer(), nullable=False),
    sa.Column('knowledge_id', sa.Integer(), nullable=False),
    sa.Column('score', sa.Numeric(precision=5, scale=2), nullable=True),
    sa.Column('created_at', sa.DateTime(), nullable=True),
    sa.ForeignKeyConstraint(['knowledge_id'], ['extended_knowledge.id'], ),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('user_id', 'knowledge_id', name='unique_user_knowledge')
    )
    op.execute("ALTER TABLE point_records MODIFY COLUMN related_type ENUM('learning', 'exam', 'knowledge')")


def downgrade():
    op.drop_table('knowledge_wrong_questions')
    op.drop_table('knowledge_learning_records')
    op.execute("ALTER TABLE point_records MODIFY COLUMN related_type ENUM('learning', 'exam')")
