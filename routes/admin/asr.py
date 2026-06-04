from routes.admin import admin_bp
from flask import jsonify, request, current_app
from flask_login import current_user
from utils.auth import login_or_jwt_required
from utils.decorators import admin_required
from utils.crypto import encrypt_value, decrypt_value
from models import BaiduAsrKey, db


@admin_bp.route('/baidu-asr-keys', methods=['GET'])
@login_or_jwt_required
@admin_required
def list_baidu_asr_keys():
    keys = BaiduAsrKey.query.order_by(BaiduAsrKey.id).all()
    return jsonify({'success': True, 'data': [{
        'id': k.id,
        'app_id': k.app_id,
        'api_key_masked': '***' + decrypt_value(k.api_key)[-4:] if decrypt_value(k.api_key) and len(decrypt_value(k.api_key)) > 4 else '***',
        'is_active': k.is_active,
        'created_at': k.created_at.isoformat(),
    } for k in keys]})


@admin_bp.route('/baidu-asr-keys', methods=['POST'])
@login_or_jwt_required
@admin_required
def add_baidu_asr_key():
    data = request.get_json() or {}
    app_id = data.get('app_id', '').strip()
    api_key = data.get('api_key', '').strip()
    secret_key = data.get('secret_key', '').strip()
    if not api_key or not secret_key:
        return jsonify({'success': False, 'message': 'API Key 和 Secret Key 不能为空'})
    try:
        k = BaiduAsrKey(
            app_id=app_id,
            api_key=encrypt_value(api_key),
            secret_key=encrypt_value(secret_key),
        )
        db.session.add(k)
        db.session.commit()
        return jsonify({'success': True, 'message': 'Key 已添加', 'data': {'id': k.id}})
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"百度ASR Key添加失败: {e}", exc_info=True)
        return jsonify({'success': False, 'message': '添加失败，请稍后重试'})


@admin_bp.route('/baidu-asr-keys/<int:key_id>', methods=['DELETE'])
@login_or_jwt_required
@admin_required
def delete_baidu_asr_key(key_id):
    k = db.session.get(BaiduAsrKey, key_id)
    if not k:
        return jsonify({'success': False, 'message': 'Key 不存在'})
    try:
        db.session.delete(k)
        db.session.commit()
        return jsonify({'success': True, 'message': 'Key 已删除'})
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"百度ASR Key删除失败: {e}", exc_info=True)
        return jsonify({'success': False, 'message': '删除失败，请稍后重试'})


@admin_bp.route('/baidu-asr-keys/<int:key_id>/toggle', methods=['POST'])
@login_or_jwt_required
@admin_required
def toggle_baidu_asr_key(key_id):
    k = db.session.get(BaiduAsrKey, key_id)
    if not k:
        return jsonify({'success': False, 'message': 'Key 不存在'})
    k.is_active = not k.is_active
    db.session.commit()
    return jsonify({'success': True, 'message': f'Key 已{"启用" if k.is_active else "禁用"}', 'is_active': k.is_active})
