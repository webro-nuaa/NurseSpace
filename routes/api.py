from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from models import User, Case, CaseCategory, Station, StandardAnswer, ExtendedKnowledge, KnowledgeAnswer, Comment, CommentLike, CommentReport, db
from sqlalchemy import func

api_bp = Blueprint('api', __name__)


def _cache():
    from app import cache
    return cache


def _limiter():
    return current_app.extensions.get('limiter')

@api_bp.route('/categories')
@jwt_required()
def get_categories():
    """获取所有案例类别（缓存5分钟）"""
    cached = _cache()
    if cached:
        result = cached.get('api_categories')
        if result:
            return jsonify(result)

    categories = CaseCategory.query.all()
    categories_data = []
    for category in categories:
        case_count = Case.query.filter_by(category_id=category.id).count()
        categories_data.append({
            'id': category.id,
            'name': category.name,
            'description': category.description,
            'case_count': case_count
        })

    cache_data = {'success': True, 'data': categories_data}
    if cached:
        cached.set('api_categories', cache_data, timeout=300)
    return jsonify(cache_data)


@api_bp.route('/stations/<int:station_id>')
@jwt_required()
def get_station_detail(station_id: int):
    """获取单个站点详情（题干/考核任务/标准答案）"""
    station = Station.query.get_or_404(station_id)
    answers = StandardAnswer.query.filter_by(station_id=station_id).order_by(StandardAnswer.order_index).all()
    return jsonify({
        'success': True,
        'data': {
            'id': station.id,
            'name': station.name,
            'assessment_task': station.assessment_task,
            'question': station.question,
            'standard_answers': [
                {
                    'answer_item': a.answer_item,
                    'order_index': a.order_index,
                    'score_weight': float(a.score_weight)
                } for a in answers
            ]
        }
    })

@api_bp.route('/stations/<int:station_id>/answers')
@jwt_required()
def get_station_answers(station_id: int):
    """获取站点的标准答案"""
    station = Station.query.get_or_404(station_id)
    answers = StandardAnswer.query.filter_by(station_id=station_id).order_by(StandardAnswer.order_index).all()
    
    answers_data = []
    for answer in answers:
        answers_data.append({
            'id': answer.id,
            'answer_item': answer.answer_item,
            'score_weight': float(answer.score_weight),
            'order_index': answer.order_index
        })
    
    return jsonify({
        'success': True,
        'data': answers_data
    })

@api_bp.route('/stations/search')
@jwt_required()
def search_stations():
    """搜索站点（用于考试组卷）"""
    current_user_id = get_jwt_identity()
    user = db.session.get(User, current_user_id)
    
    if not user or user.role != 'admin':
        return jsonify({'success': False, 'message': '权限不足'})
    
    category_id = request.args.get('category_id', type=int)
    case_type = request.args.get('case_type', '').strip()
    keyword = request.args.get('keyword', '').strip()
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 20, type=int)

    query = db.session.query(Station, Case, CaseCategory)\
        .join(Case, Station.case_id == Case.id)\
        .join(CaseCategory, Case.category_id == CaseCategory.id)

    if category_id:
        query = query.filter(Case.category_id == category_id)

    if case_type in ('learning', 'exam'):
        query = query.filter(Case.case_type == case_type)

    if keyword:
        query = query.filter(
            db.or_(
                Station.name.contains(keyword),
                Station.question.contains(keyword),
                Case.title.contains(keyword)
            )
        )
    
    pagination = query.paginate(page=page, per_page=per_page, error_out=False)
    
    stations_data = []
    for station, case, category in pagination.items:
        # 检查是否有标准答案
        has_answers = StandardAnswer.query.filter_by(station_id=station.id).count() > 0
        
        stations_data.append({
            'id': station.id,
            'name': station.name,
            'question': station.question,
            'assessment_task': station.assessment_task,
            'case_id': case.id,
            'case_title': case.title,
            'case_type': case.case_type or 'learning',
            'difficulty': case.difficulty or 'intermediate',
            'category_id': category.id,
            'category_name': category.name,
            'has_answers': has_answers
        })
    
    return jsonify({
        'success': True,
        'data': {
            'stations': stations_data,
            'pagination': {
                'page': page,
                'per_page': per_page,
                'total': pagination.total,
                'pages': pagination.pages,
                'has_prev': pagination.has_prev,
                'has_next': pagination.has_next
            }
        }
    })

@api_bp.route('/statistics/overview')
@jwt_required()
def get_overview_statistics():
    """获取系统概览统计"""
    current_user_id = get_jwt_identity()
    user = db.session.get(User, current_user_id)
    
    if not user:
        return jsonify({'success': False, 'message': '用户不存在'})
    
    # 基础统计
    total_cases = Case.query.count()
    total_stations = Station.query.count()
    
    if user.role == 'admin':
        # 管理员可以看到所有统计
        from models import LearningRecord, ExamRecord
        
        total_users = User.query.filter_by(role='nurse').count()
        total_learning_records = LearningRecord.query.count()
        total_exam_records = ExamRecord.query.count()
        
        # 最近7天的学习活动
        from datetime import datetime, timedelta, timezone
        recent_date = datetime.now(timezone.utc) - timedelta(days=7)
        recent_activities = LearningRecord.query.filter(
            LearningRecord.completed_at >= recent_date
        ).count()
        
        return jsonify({
            'success': True,
            'data': {
                'total_cases': total_cases,
                'total_stations': total_stations,
                'total_users': total_users,
                'total_learning_records': total_learning_records,
                'total_exam_records': total_exam_records,
                'recent_activities': recent_activities
            }
        })
    
    else:
        # 护士只能看到自己的统计
        from models import LearningRecord, WrongQuestion
        
        my_learning_records = LearningRecord.query.filter_by(user_id=current_user_id).count()
        my_wrong_questions = WrongQuestion.query.filter_by(user_id=current_user_id).count()
        
        # 我的平均分
        avg_score = db.session.query(func.avg(LearningRecord.score))\
            .filter_by(user_id=current_user_id).scalar()
        
        return jsonify({
            'success': True,
            'data': {
                'total_cases': total_cases,
                'total_stations': total_stations,
                'my_learning_records': my_learning_records,
                'my_wrong_questions': my_wrong_questions,
                'my_avg_score': round(float(avg_score), 1) if avg_score else 0,
                'my_points': user.points
            }
        })

@api_bp.route('/health')
def health_check():
    """健康检查接口 —— 验证应用与数据库连通性"""
    db_ok = False
    try:
        db.session.execute(db.text('SELECT 1'))
        db_ok = True
    except Exception:
        pass

    status_code = 200 if db_ok else 503
    return jsonify({
        'status': 'healthy' if db_ok else 'degraded',
        'service': 'nurse_training_system',
        'version': current_app.config.get('VERSION', 'unknown'),
        'database': 'connected' if db_ok else 'disconnected'
    }), status_code

# 评论相关接口
@api_bp.route('/comments', methods=['GET'])
@jwt_required(optional=True)
def get_comments():
    """获取评论列表"""
    content_type = request.args.get('content_type', type=str)
    content_id = request.args.get('content_id', type=int)
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 20, type=int)
    
    if not content_type or not content_id:
        return jsonify({'success': False, 'message': '缺少必要参数'})
    
    # 查询评论
    query = Comment.query.filter_by(
        content_type=content_type,
        content_id=content_id,
        status='active',
        parent_id=None  # 只查询顶级评论
    ).order_by(Comment.created_at.desc())
    
    pagination = query.paginate(page=page, per_page=per_page, error_out=False)
    
    comments_data = []
    for comment in pagination.items:
        # 获取用户信息
        user = db.session.get(User, comment.user_id)
        if not user:
            continue
            
        # 获取回复数量
        replies_count = Comment.query.filter_by(
            parent_id=comment.id,
            status='active'
        ).count()
        
        # 获取当前用户是否点赞
        current_user_id = get_jwt_identity()
        is_liked = False
        if current_user_id:
            is_liked = CommentLike.query.filter_by(
                user_id=current_user_id,
                comment_id=comment.id
            ).first() is not None
        
        comments_data.append({
            'id': comment.id,
            'content': comment.content,
            'comment_type': comment.comment_type,
            'likes_count': comment.likes_count,
            'replies_count': replies_count,
            'is_liked': is_liked,
            'created_at': comment.created_at.isoformat(),
            'user': {
                'id': user.id,
                'real_name': user.real_name,
                'department': user.department
            }
        })
    
    return jsonify({
        'success': True,
        'data': {
            'comments': comments_data,
            'pagination': {
                'page': page,
                'per_page': per_page,
                'total': pagination.total,
                'pages': pagination.pages,
                'has_prev': pagination.has_prev,
                'has_next': pagination.has_next
            }
        }
    })

@api_bp.route('/comments', methods=['POST'])
@jwt_required()
def create_comment():
    """创建评论"""
    current_user_id = get_jwt_identity()
    data = request.get_json()
    
    content_type = data.get('content_type')
    content_id = data.get('content_id')
    content = data.get('content', '').strip()
    comment_type = data.get('comment_type', 'comment')
    parent_id = data.get('parent_id')
    
    # 验证参数
    if not all([content_type, content_id, content]):
        return jsonify({'success': False, 'message': '缺少必要参数'})
    
    if len(content) < 5:
        return jsonify({'success': False, 'message': '评论内容至少5个字符'})
    
    if len(content) > 1000:
        return jsonify({'success': False, 'message': '评论内容不能超过1000个字符'})
    
    # 验证内容类型
    if content_type not in ['station_answer', 'knowledge_answer']:
        return jsonify({'success': False, 'message': '无效的内容类型'})
    
    # 验证评论类型
    if comment_type not in ['comment', 'question', 'answer', 'suggestion']:
        return jsonify({'success': False, 'message': '无效的评论类型'})
    
    # 如果有父评论，验证父评论是否存在
    if parent_id:
        parent_comment = db.session.get(Comment, parent_id)
        if not parent_comment or parent_comment.status != 'active':
            return jsonify({'success': False, 'message': '父评论不存在或已被删除'})
    
    try:
        comment = Comment(
            user_id=current_user_id,
            content_type=content_type,
            content_id=content_id,
            content=content,
            comment_type=comment_type,
            parent_id=parent_id
        )
        
        db.session.add(comment)
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': '评论发布成功',
            'data': {
                'id': comment.id,
                'created_at': comment.created_at.isoformat()
            }
        })
        
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"发布评论失败: {e}", exc_info=True)
        return jsonify({'success': False, 'message': '发布评论失败，请稍后重试'})

@api_bp.route('/comments/<int:comment_id>/like', methods=['POST'])
@jwt_required()
def toggle_comment_like(comment_id):
    """切换评论点赞状态"""
    current_user_id = get_jwt_identity()
    
    comment = Comment.query.get_or_404(comment_id)
    if comment.status != 'active':
        return jsonify({'success': False, 'message': '评论不存在或已被删除'})
    
    # 检查是否已经点赞
    existing_like = CommentLike.query.filter_by(
        user_id=current_user_id,
        comment_id=comment_id
    ).first()
    
    try:
        if existing_like:
            # 取消点赞
            db.session.delete(existing_like)
            comment.likes_count = max(0, comment.likes_count - 1)
            is_liked = False
            message = '取消点赞成功'
        else:
            # 添加点赞
            like = CommentLike(
                user_id=current_user_id,
                comment_id=comment_id
            )
            db.session.add(like)
            comment.likes_count += 1
            is_liked = True
            message = '点赞成功'
        
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': message,
            'data': {
                'likes_count': comment.likes_count,
                'is_liked': is_liked
            }
        })
        
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"评论点赞操作失败: {e}", exc_info=True)
        return jsonify({'success': False, 'message': '操作失败，请稍后重试'})

@api_bp.route('/comments/<int:comment_id>/replies', methods=['GET'])
@jwt_required(optional=True)
def get_comment_replies(comment_id):
    """获取评论的回复列表"""
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 20, type=int)
    
    comment = Comment.query.get_or_404(comment_id)
    if comment.status != 'active':
        return jsonify({'success': False, 'message': '评论不存在或已被删除'})
    
    # 查询回复
    query = Comment.query.filter_by(
        parent_id=comment_id,
        status='active'
    ).order_by(Comment.created_at.asc())
    
    pagination = query.paginate(page=page, per_page=per_page, error_out=False)
    
    replies_data = []
    for reply in pagination.items:
        user = db.session.get(User, reply.user_id)
        if not user:
            continue
            
        # 获取当前用户是否点赞
        current_user_id = get_jwt_identity()
        is_liked = False
        if current_user_id:
            is_liked = CommentLike.query.filter_by(
                user_id=current_user_id,
                comment_id=reply.id
            ).first() is not None
        
        replies_data.append({
            'id': reply.id,
            'content': reply.content,
            'comment_type': reply.comment_type,
            'likes_count': reply.likes_count,
            'is_liked': is_liked,
            'created_at': reply.created_at.isoformat(),
            'user': {
                'id': user.id,
                'real_name': user.real_name,
                'department': user.department
            }
        })
    
    return jsonify({
        'success': True,
        'data': {
            'replies': replies_data,
            'pagination': {
                'page': page,
                'per_page': per_page,
                'total': pagination.total,
                'pages': pagination.pages,
                'has_prev': pagination.has_prev,
                'has_next': pagination.has_next
            }
        }
    })

@api_bp.route('/knowledge/<int:knowledge_id>')
@jwt_required(optional=True)
def get_knowledge_detail(knowledge_id: int):
    """获取单个扩展知识题目详情"""
    ek = ExtendedKnowledge.query.get_or_404(knowledge_id)
    answers = KnowledgeAnswer.query.filter_by(knowledge_id=knowledge_id)\
        .order_by(KnowledgeAnswer.order_index).all()
    return jsonify({
        'success': True,
        'data': {
            'id': ek.id,
            'question': ek.question,
            'case_id': ek.case_id,
            'answers': [a.answer_item for a in answers]
        }
    })

@api_bp.route('/knowledge/<int:knowledge_id>/answers')
@jwt_required(optional=True)
def get_knowledge_answers(knowledge_id: int):
    """获取扩展知识题目的标准答案"""
    answers = KnowledgeAnswer.query.filter_by(knowledge_id=knowledge_id)\
        .order_by(KnowledgeAnswer.order_index).all()
    answers_data = [{
        'id': a.id,
        'answer_item': a.answer_item,
        'score_weight': float(a.score_weight),
        'order_index': a.order_index
    } for a in answers]
    return jsonify({
        'success': True,
        'data': answers_data
    })

@api_bp.route('/speech-to-text', methods=['POST'])
@jwt_required(optional=True)
def speech_to_text():
    """语音识别 — 接受 PCM 音频，返回文字"""
    if request.content_type and 'application/json' in request.content_type:
        data = request.get_json() or {}
        audio_b64 = data.get('audio')
        if not audio_b64:
            return jsonify({'success': False, 'message': '缺少音频数据'})
        import base64
        try:
            audio_data = base64.b64decode(audio_b64)
        except Exception:
            return jsonify({'success': False, 'message': '音频数据格式错误'})
    else:
        audio_data = request.get_data()
        if not audio_data:
            return jsonify({'success': False, 'message': '缺少音频数据'})

    if len(audio_data) < 160:  # < 10ms PCM
        return jsonify({'success': False, 'message': '音频太短，请重新录制'})

    from utils.speech_to_text import transcribe
    result = transcribe(audio_data)
    return jsonify(result)
