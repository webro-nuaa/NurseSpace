from routes.nurse import nurse_bp
from flask import jsonify, request, current_app
from flask_login import current_user
from utils.auth import login_or_jwt_required
from utils.decorators import nurse_required
from utils.rag import KnowledgeQAAgent
from utils.crypto import decrypt_value, encrypt_value
from models import db


@nurse_bp.route('/knowledge/ask', methods=['POST'])
@login_or_jwt_required
@nurse_required
def knowledge_ask():
    user = current_user
    if not user.knowledge_provider or not user.knowledge_key:
        return jsonify({'success': False, 'message': '请先在个人设置中配置知识问答AI'})

    data = request.get_json() or {}
    question = (data.get('question') or '').strip()
    if not question:
        return jsonify({'success': False, 'message': '请输入问题'})

    try:
        store = current_app.extensions['knowledge_service'].get_store()
        api_key = decrypt_value(user.knowledge_key)
        agent = KnowledgeQAAgent(user.knowledge_provider, api_key, user.knowledge_model or 'gpt-4o-mini', store)
        result = agent.ask(question)
        return jsonify({'success': True, 'data': result})
    except Exception as e:
        current_app.logger.error(f"知识问答失败: {e}", exc_info=True)
        return jsonify({'success': False, 'message': '知识问答服务暂不可用，请稍后重试'})


@nurse_bp.route('/ai-settings', methods=['GET', 'PUT'])
@login_or_jwt_required
@nurse_required
def nurse_ai_settings():
    user = current_user
    if request.method == 'GET':
        return jsonify({'success': True, 'data': {
            'knowledge_provider': user.knowledge_provider or '',
            'knowledge_model': user.knowledge_model or '',
            'knowledge_embedding_model': user.knowledge_embedding_model or '',
            'has_knowledge_key': bool(user.knowledge_key),
        }})

    data = request.get_json() or {}
    for field in ['knowledge_provider', 'knowledge_model', 'knowledge_embedding_model']:
        if field in data:
            setattr(user, field, data[field] or None)
    if data.get('knowledge_key'):
        user.knowledge_key = encrypt_value(data['knowledge_key'])
    db.session.commit()
    return jsonify({'success': True, 'message': 'AI设置已更新'})
