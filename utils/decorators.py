from functools import wraps
from flask import jsonify
from flask_login import current_user
from flask_jwt_extended import get_jwt_identity
from models import User, db


def admin_required(f):
    """要求管理员身份 —— 需配合 @login_or_jwt_required 使用"""

    @wraps(f)
    def decorated(*args, **kwargs):
        if current_user.is_authenticated and current_user.role == 'admin':
            return f(*args, **kwargs)

        user_id = get_jwt_identity()
        if user_id:
            user = db.session.get(User, int(user_id))
            if user and user.role == 'admin' and user.is_active():
                return f(*args, **kwargs)

        return jsonify({'success': False, 'message': '权限不足，需要管理员身份'}), 403

    return decorated


def nurse_required(f):
    """要求护士身份 —— 需配合 @login_or_jwt_required 使用"""

    @wraps(f)
    def decorated(*args, **kwargs):
        if current_user.is_authenticated and current_user.role == 'nurse':
            return f(*args, **kwargs)

        user_id = get_jwt_identity()
        if user_id:
            user = db.session.get(User, int(user_id))
            if user and user.role == 'nurse' and user.is_active():
                return f(*args, **kwargs)

        return jsonify({'success': False, 'message': '权限不足，需要护士身份'}), 403

    return decorated
