from functools import wraps
from flask import jsonify, request, redirect, url_for


def login_or_jwt_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        from flask_login import current_user, login_user
        from models import User, db

        if current_user.is_authenticated:
            return f(*args, **kwargs)

        try:
            from flask_jwt_extended import verify_jwt_in_request, get_jwt_identity
            verify_jwt_in_request(optional=True)
            user_id = get_jwt_identity()
            if user_id:
                user = db.session.get(User, int(user_id))
                if user and user.is_active():
                    login_user(user, remember=False)
                    return f(*args, **kwargs)
        except Exception:
            pass

        if request.accept_mimetypes.accept_json and \
           not request.accept_mimetypes.accept_html:
            return jsonify({'success': False, 'message': '请先登录'}), 401

        return redirect(url_for('auth.login'))

    return decorated_function
