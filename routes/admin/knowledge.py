from routes.admin import admin_bp
import os
from datetime import datetime

from flask import jsonify, request, current_app
from flask_login import current_user
from utils.auth import login_or_jwt_required
from utils.decorators import admin_required
from utils.rag import KnowledgeQAAgent, DocumentParser
from utils.crypto import decrypt_value, encrypt_value
from models import AiSetting, db


@admin_bp.route('/ai-settings', methods=['GET', 'PUT'])
@login_or_jwt_required
@admin_required
def ai_settings():
    setting = AiSetting.get_singleton()

    if request.method == 'GET':
        def _mask_key(key):
            if not key:
                return ''
            try:
                plain = decrypt_value(key)
            except Exception:
                return '***'
            if not plain:
                return ''
            return '***' + plain[-4:] if len(plain) > 4 else '***'
        return jsonify({'success': True, 'data': {
            'provider': setting.provider,
            'openai_key': _mask_key(setting.openai_key),
            'openai_model': setting.openai_model or '',
            'openai_base_url': setting.openai_base_url or '',
            'zhipu_key': _mask_key(setting.zhipu_key),
            'zhipu_model': setting.zhipu_model or '',
            'zhipu_base_url': setting.zhipu_base_url or ''
        }})

    data = request.get_json() or {}
    provider = data.get('provider') or setting.provider
    if provider not in ['glm', 'openai', 'local']:
        return jsonify({'success': False, 'message': 'provider 取值必须是 glm | openai | local'})

    setting.provider = provider
    for field in ['openai_key', 'openai_model', 'openai_base_url', 'zhipu_key', 'zhipu_model', 'zhipu_base_url']:
        if field in data:
            value = data.get(field) or None
            if field in ('openai_key', 'zhipu_key') and value:
                if value.startswith('***'):
                    continue
                value = encrypt_value(value)
            setattr(setting, field, value)
    try:
        db.session.commit()
        return jsonify({'success': True, 'message': 'AI设置已更新'})
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"AI设置保存失败: {e}", exc_info=True)
        return jsonify({'success': False, 'message': '保存失败，请稍后重试'})


@admin_bp.route('/ai-settings/test', methods=['POST'])
@login_or_jwt_required
@admin_required
def test_ai_connection():
    import time
    data = request.get_json() or {}
    provider = data.get('provider', 'openai')
    api_key = data.get('api_key', '').strip()
    model = data.get('model', '').strip()
    base_url = data.get('base_url', '').strip()

    if not api_key:
        return jsonify({'success': False, 'message': '请提供 API Key'})

    try:
        start = time.time()
        if provider == 'openai':
            import openai
            openai_client = openai.OpenAI(api_key=api_key, base_url=base_url or None)
            openai_client.chat.completions.create(
                model=model or 'gpt-4o-mini',
                messages=[{'role': 'user', 'content': 'ping'}],
                max_tokens=5
            )
        elif provider == 'glm':
            from zhipuai import ZhipuAI
            client_kwargs = {'api_key': api_key}
            if base_url:
                client_kwargs['base_url'] = base_url
            client = ZhipuAI(**client_kwargs)
            client.chat.completions.create(
                model=model or 'glm-4-air',
                messages=[{'role': 'user', 'content': 'ping'}],
                max_tokens=5
            )
        else:
            return jsonify({'success': False, 'message': '不支持的 provider'})
        latency = round((time.time() - start) * 1000)
        return jsonify({'success': True, 'message': f'连接成功，延迟 {latency}ms', 'latency_ms': latency})
    except Exception as e:
        current_app.logger.error(f"AI连接测试失败: {e}", exc_info=True)
        return jsonify({'success': False, 'message': '连接失败，请稍后重试'})


# ---- 知识库文档管理 ----

@admin_bp.route('/knowledge/docs', methods=['GET', 'POST'])
@login_or_jwt_required
@admin_required
def knowledge_docs():
    store = current_app.extensions['knowledge_service'].get_store()

    if request.method == 'GET':
        return jsonify({'success': True, 'data': {
            'doc_count': store.get_doc_count(),
            'docs': store.get_all_docs(),
        }})

    if 'file' not in request.files:
        return jsonify({'success': False, 'message': '未选择文件'})
    f = request.files['file']
    if not f.filename:
        return jsonify({'success': False, 'message': '未选择文件'})

    try:
        import tempfile
        ext = os.path.splitext(f.filename)[1].lower()
        if ext not in ('.pdf', '.docx', '.doc', '.txt'):
            return jsonify({'success': False, 'message': '仅支持 PDF/Word/TXT 文件'})

        with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as tmp:
            f.save(tmp.name)
            tmp_path = tmp.name

        text = DocumentParser.parse_file(tmp_path)
        os.unlink(tmp_path)

        if not text.strip():
            return jsonify({'success': False, 'message': '文档内容为空'})

        doc_id = f"admin_{datetime.now().strftime('%Y%m%d%H%M%S%f')}"
        store.add_doc(doc_id, text, {'filename': f.filename, 'uploaded_at': datetime.now().isoformat()})

        return jsonify({'success': True, 'message': '文档已上传并索引'})
    except Exception as e:
        current_app.logger.error(f"知识文档上传失败: {e}", exc_info=True)
        return jsonify({'success': False, 'message': '上传失败，请稍后重试'})


@admin_bp.route('/knowledge/docs/<doc_id>', methods=['DELETE'])
@login_or_jwt_required
@admin_required
def delete_knowledge_doc(doc_id):
    store = current_app.extensions['knowledge_service'].get_store()
    if store.delete_doc(doc_id):
        return jsonify({'success': True, 'message': '文档已删除'})
    return jsonify({'success': False, 'message': '删除失败'})


@admin_bp.route('/knowledge/ask', methods=['POST'])
@login_or_jwt_required
@admin_required
def admin_knowledge_ask():
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
        current_app.logger.error(f"管理员知识问答失败: {e}", exc_info=True)
        return jsonify({'success': False, 'message': '知识问答服务暂不可用，请稍后重试'})


@admin_bp.route('/personal-ai-settings', methods=['GET', 'PUT'])
@login_or_jwt_required
@admin_required
def admin_personal_ai_settings():
    user = current_user
    if request.method == 'GET':
        return jsonify({'success': True, 'data': {
            'knowledge_provider': user.knowledge_provider or '',
            'knowledge_model': user.knowledge_model or '',
            'has_knowledge_key': bool(user.knowledge_key),
        }})

    data = request.get_json() or {}
    for field in ['knowledge_provider', 'knowledge_model']:
        if field in data:
            setattr(user, field, data[field] or None)
    if data.get('knowledge_key'):
        user.knowledge_key = encrypt_value(data['knowledge_key'])
    db.session.commit()
    return jsonify({'success': True, 'message': '个人AI设置已更新'})
