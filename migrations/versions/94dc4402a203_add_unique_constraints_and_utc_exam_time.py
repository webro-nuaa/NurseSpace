"""数据库设计加固：学习/考试记录唯一约束 + 考试时间窗转 UTC。

Revision ID: 94dc4402a203
Revises: 93dc4402a202
Create Date: 2026-09-03

变更内容：
1. learning_records 加 UNIQUE(user_id, station_id)——与既有 upsert 语义一致
   （evaluation.process_submission 重做时更新原记录），防止重做产生重复行
   导致进度统计多算、first() 取值不确定。
2. exam_records 加 UNIQUE(exam_id, user_id)——与 start_exam 的"已参加过"
   业务守卫一致，由 DB 层兜底。
3. exams.start_time/end_time 由"管理员输入的 naive 本地时间"统一换算为
   naive UTC（按 Asia/Shanghai 减 8 小时），与全库 created_at 的 UTC 约定
   及 exam_taking_service 的 UTC 时间窗比较对齐。
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '94dc4402a203'
down_revision = '93dc4402a202'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('learning_records') as batch_op:
        batch_op.create_unique_constraint(
            'unique_user_station_record', ['user_id', 'station_id'])

    with op.batch_alter_table('exam_records') as batch_op:
        batch_op.create_unique_constraint(
            'unique_exam_user_record', ['exam_id', 'user_id'])

    # 存量考试时间窗：本地时间（Asia/Shanghai）→ naive UTC
    op.execute("""
        UPDATE exams
        SET start_time = DATE_SUB(start_time, INTERVAL 8 HOUR),
            end_time = DATE_SUB(end_time, INTERVAL 8 HOUR)
        WHERE start_time IS NOT NULL
    """)


def downgrade():
    op.execute("""
        UPDATE exams
        SET start_time = DATE_ADD(start_time, INTERVAL 8 HOUR),
            end_time = DATE_ADD(end_time, INTERVAL 8 HOUR)
        WHERE start_time IS NOT NULL
    """)
    with op.batch_alter_table('exam_records') as batch_op:
        batch_op.drop_unique_constraint('unique_exam_user_record')
    with op.batch_alter_table('learning_records') as batch_op:
        batch_op.drop_unique_constraint('unique_user_station_record')
