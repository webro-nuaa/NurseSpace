"""评论域服务：评论列表、回复列表、创建评论与点赞的业务逻辑与数据访问。

返回值约定与 case_service 等保持一致：`(data, error)` 元组，error 为 None 表示成功。
"""
import logging

from models import db, User, Comment, CommentLike

logger = logging.getLogger(__name__)

# 评论内容类型白名单（当前仅支持站点答案讨论，见 models.Comment.content_type）
VALID_CONTENT_TYPES = ['station_answer']
# 评论类型白名单
VALID_COMMENT_TYPES = ['comment', 'question', 'answer', 'suggestion']
MIN_CONTENT_LENGTH = 5
MAX_CONTENT_LENGTH = 1000


def list_comments(content_type, content_id, page, per_page, viewer_id=None):
    """返回顶级评论分页数据：{'comments': [...], 'pagination': {...}}"""
    query = Comment.query.filter_by(
        content_type=content_type,
        content_id=content_id,
        status='active',
        parent_id=None  # 只查询顶级评论
    ).order_by(Comment.created_at.desc())

    pagination = query.paginate(page=page, per_page=per_page, error_out=False)
    comments_data = []
    for comment in pagination.items:
        data = _serialize_comment(comment, viewer_id, include_replies_count=True)
        if data:
            comments_data.append(data)

    return {
        'comments': comments_data,
        'pagination': _pagination_dict(pagination, page, per_page)
    }


def list_replies(comment_id, page, per_page, viewer_id=None):
    """返回某条评论的回复分页数据：{'replies': [...], 'pagination': {...}}"""
    query = Comment.query.filter_by(
        parent_id=comment_id,
        status='active'
    ).order_by(Comment.created_at.asc())

    pagination = query.paginate(page=page, per_page=per_page, error_out=False)
    replies_data = []
    for reply in pagination.items:
        data = _serialize_comment(reply, viewer_id, include_replies_count=False)
        if data:
            replies_data.append(data)

    return {
        'replies': replies_data,
        'pagination': _pagination_dict(pagination, page, per_page)
    }


def create_comment(user_id, payload):
    """创建评论。返回 (comment, error)。"""
    content_type = payload.get('content_type')
    content_id = payload.get('content_id')
    content = (payload.get('content') or '').strip()
    comment_type = payload.get('comment_type', 'comment')
    parent_id = payload.get('parent_id')

    if not all([content_type, content_id, content]):
        return None, '缺少必要参数'
    if len(content) < MIN_CONTENT_LENGTH:
        return None, '评论内容至少5个字符'
    if len(content) > MAX_CONTENT_LENGTH:
        return None, '评论内容不能超过1000个字符'
    if content_type not in VALID_CONTENT_TYPES:
        return None, '无效的内容类型'
    if comment_type not in VALID_COMMENT_TYPES:
        return None, '无效的评论类型'

    if parent_id:
        parent_comment = db.session.get(Comment, parent_id)
        if not parent_comment or parent_comment.status != 'active':
            return None, '父评论不存在或已被删除'

    try:
        comment = Comment(
            user_id=user_id,
            content_type=content_type,
            content_id=content_id,
            content=content,
            comment_type=comment_type,
            parent_id=parent_id
        )
        db.session.add(comment)
        db.session.commit()
        return comment, None
    except Exception as e:
        db.session.rollback()
        logger.error(f"发布评论失败: {e}", exc_info=True)
        return None, '发布评论失败，请稍后重试'


def toggle_comment_like(user_id, comment):
    """切换点赞状态。返回 (data, error)。"""
    if comment.status != 'active':
        return None, '评论不存在或已被删除'

    existing_like = CommentLike.query.filter_by(
        user_id=user_id,
        comment_id=comment.id
    ).first()

    try:
        if existing_like:
            db.session.delete(existing_like)
            comment.likes_count = max(0, comment.likes_count - 1)
            is_liked = False
            message = '取消点赞成功'
        else:
            db.session.add(CommentLike(user_id=user_id, comment_id=comment.id))
            comment.likes_count += 1
            is_liked = True
            message = '点赞成功'

        db.session.commit()
        data = {
            'likes_count': comment.likes_count,
            'is_liked': is_liked,
            'message': message
        }
        return data, None
    except Exception as e:
        db.session.rollback()
        logger.error(f"评论点赞操作失败: {e}", exc_info=True)
        return None, '操作失败，请稍后重试'


def _serialize_comment(comment, viewer_id, include_replies_count):
    """序列化单条评论；作者已不存在的评论按原行为跳过（返回 None）。"""
    user = db.session.get(User, comment.user_id)
    if not user:
        return None

    data = {
        'id': comment.id,
        'content': comment.content,
        'comment_type': comment.comment_type,
        'likes_count': comment.likes_count,
        'is_liked': _user_has_liked(viewer_id, comment.id),
        'created_at': comment.created_at.isoformat(),
        'user': {
            'id': user.id,
            'real_name': user.real_name,
            'department': user.department
        }
    }
    if include_replies_count:
        data['replies_count'] = Comment.query.filter_by(
            parent_id=comment.id,
            status='active'
        ).count()
    return data


def _user_has_liked(viewer_id, comment_id):
    if not viewer_id:
        return False
    return CommentLike.query.filter_by(
        user_id=viewer_id,
        comment_id=comment_id
    ).first() is not None


def _pagination_dict(pagination, page, per_page):
    return {
        'page': page,
        'per_page': per_page,
        'total': pagination.total,
        'pages': pagination.pages,
        'has_prev': pagination.has_prev,
        'has_next': pagination.has_next
    }
