from functools import wraps
from flask import jsonify, request, redirect, url_for


def login_or_jwt_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        import logging
        _log = logging.getLogger(__name__)
        from flask_login import current_user, login_user
        from models import User, db

        # If a JWT Bearer token is present, prefer it over session cookie
        auth_header = request.headers.get('Authorization', '')
        has_jwt = auth_header.startswith('Bearer ')

        if not has_jwt and current_user.is_authenticated:
            return f(*args, **kwargs)

        try:
            from flask_jwt_extended import verify_jwt_in_request, get_jwt_identity
            verify_jwt_in_request(optional=True)
            user_id = get_jwt_identity()
            _log.info(f"JWT identity: {user_id}, endpoint: {request.endpoint}")
            if user_id:
                user = db.session.get(User, int(user_id))
                _log.info(f"User found: {user}, active: {user.is_active() if user else 'N/A'}")
                if user and user.is_active():
                    login_user(user, remember=False)
                    return f(*args, **kwargs)
                else:
                    _log.warning(f"User not found or inactive: user_id={user_id}")
            else:
                _log.warning(f"No user_id from JWT for endpoint: {request.endpoint}")
        except Exception as e:
            _log.exception(f"JWT verification failed on {request.endpoint}: {e}")

        _log.warning(f"Falling through to login redirect for {request.endpoint}, "
                     f"has_jwt={has_jwt}, auth_header_len={len(auth_header)}, "
                     f"accept_json={request.accept_mimetypes.accept_json}, "
                     f"accept_html={request.accept_mimetypes.accept_html}")

        if request.accept_mimetypes.accept_json and \
           not request.accept_mimetypes.accept_html:
            return jsonify({'success': False, 'message': '请先登录'}), 401

        return redirect(url_for('auth.login'))

    return decorated_function
