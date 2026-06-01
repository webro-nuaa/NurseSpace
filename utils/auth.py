from functools import wraps
from flask import jsonify, request, redirect, url_for


def login_or_jwt_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        from flask_login import current_user, login_user
        from models import User, db

        # If a JWT Bearer token is present, prefer it over session cookie
        auth_header = request.headers.get('Authorization', '')
        has_jwt = auth_header.startswith('Bearer ')

        if not has_jwt and current_user.is_authenticated:
            return f(*args, **kwargs)

        try:
            from flask_jwt_extended import verify_jwt_in_request, get_jwt_identity, get_jwt
            verify_jwt_in_request(optional=True)
            user_id = get_jwt_identity()
            claims = get_jwt()
        except Exception:
            user_id = None
            claims = {}

        if user_id:
            try:
                uid = int(user_id)
            except (ValueError, TypeError):
                uid = None
            if uid:
                user = db.session.get(User, uid)
                if user and user.is_active():
                    token_ver = claims.get('v', 0) if claims else 0
                    if token_ver != (user.token_version or 0):
                        return jsonify({'success': False, 'message': '密码已修改，请重新登录'}), 401
                    login_user(user, remember=False)
                    return f(*args, **kwargs)

        if request.accept_mimetypes.accept_json and \
           not request.accept_mimetypes.accept_html:
            return jsonify({'success': False, 'message': '请先登录'}), 401

        return redirect(url_for('auth.login'))

    return decorated_function
