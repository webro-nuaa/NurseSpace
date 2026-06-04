import logging

logger = logging.getLogger(__name__)


class PointService:
    """积分管理服务"""

    @staticmethod
    def award_points(db, user_id, points, reason_prefix, score, related_id, related_type):
        """
        原子操作：更新 User.points + 创建 PointRecord

        Returns: PointRecord 实例或 None
        """
        from models import User, PointRecord

        User.query.filter_by(id=user_id).update(
            {'points': User.points + points},
            synchronize_session=False
        )
        record = PointRecord(
            user_id=user_id,
            points=points,
            reason=f"{reason_prefix} (得分: {score})",
            related_id=related_id,
            related_type=related_type
        )
        db.session.add(record)
        return record

    @staticmethod
    def award_exam_participation(db, user_id, exam_title, exam_id):
        """考试参与积分（固定5分）"""
        from models import User, PointRecord

        point_record = PointRecord(
            user_id=user_id,
            points=5,
            reason=f'参加考试：{exam_title}',
            related_id=exam_id,
            related_type='exam'
        )
        db.session.add(point_record)
        User.query.filter_by(id=user_id).update(
            {'points': User.points + 5},
            synchronize_session=False
        )
        return point_record
