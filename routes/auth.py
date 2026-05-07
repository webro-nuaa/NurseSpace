from flask import Blueprint, request, jsonify, render_template, redirect, url_for, flash
from flask_login import current_user, login_user, logout_user
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from utils.auth import login_or_jwt_required
from utils.decorators import admin_required
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity
from models import User, db
import re

auth_bp = Blueprint('auth', __name__)


def _limiter():
    from flask import current_app
    return current_app.extensions.get('limiter')


@auth_bp.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'GET':
        return render_template('auth/login.html')

    # 对 POST 登录请求做频率限制
    data = request.get_json() if request.is_json else request.form
    username = data.get('username')
    password = data.get('password')

    if not username or not password:
        if request.is_json:
            return jsonify({'success': False, 'message': '用户名和密码不能为空'})
        flash('用户名和密码不能为空', 'error')
        return redirect(url_for('auth.login'))

    user = User.query.filter_by(username=username).first()

    if user and user.check_password(password) and user.is_active():
        login_user(user, remember=True)
        access_token = create_access_token(identity=str(user.id))

        if request.is_json:
            return jsonify({
                'success': True,
                'message': '登录成功',
                'access_token': access_token,
                'user': {
                    'id': user.id,
                    'username': user.username,
                    'real_name': user.real_name,
                    'role': user.role,
                    'department': user.department,
                    'points': user.points
                }
            })

        if user.role == 'admin':
            return redirect('/admin')
        else:
            return redirect('/nurse')
    else:
        if request.is_json:
            return jsonify({'success': False, 'message': '用户名或密码错误，或账号已被禁用'})
        flash('用户名或密码错误，或账号已被禁用', 'error')
        return redirect(url_for('auth.login'))


@auth_bp.route('/logout', methods=['GET', 'POST'])
@login_or_jwt_required
def logout():
    logout_user()
    if request.method == 'POST' or request.is_json:
        return jsonify({'success': True, 'message': '已成功退出登录'})
    flash('已成功退出登录', 'info')
    return redirect(url_for('auth.login'))


@auth_bp.route('/register', methods=['POST'])
@login_or_jwt_required
@admin_required
def register():
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')
    real_name = data.get('real_name')
    email = data.get('email')
    phone = data.get('phone')
    department = data.get('department')
    role = data.get('role', 'nurse')

    if not all([username, password, real_name]):
        return jsonify({'success': False, 'message': '用户名、密码和真实姓名不能为空'})

    if not re.match(r'^[a-zA-Z0-9_]{3,50}$', username):
        return jsonify({'success': False, 'message': '用户名只能包含字母、数字和下划线，长度3-50位'})

    if len(password) < 8:
        return jsonify({'success': False, 'message': '密码长度至少8位，需包含字母和数字'})
    if not re.search(r'[a-zA-Z]', password) or not re.search(r'[0-9]', password):
        return jsonify({'success': False, 'message': '密码必须同时包含字母和数字'})

    if email and not re.match(r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$', email):
        return jsonify({'success': False, 'message': '邮箱格式不正确'})

    if phone and not re.match(r'^1[3-9]\d{9}$', phone):
        return jsonify({'success': False, 'message': '手机号格式不正确'})

    if User.query.filter_by(username=username).first():
        return jsonify({'success': False, 'message': '用户名已存在'})

    if email and User.query.filter_by(email=email).first():
        return jsonify({'success': False, 'message': '邮箱已被使用'})

    try:
        user = User(
            username=username,
            real_name=real_name,
            email=email,
            phone=phone,
            department=department,
            role=role
        )
        user.set_password(password)

        db.session.add(user)
        db.session.commit()

        return jsonify({
            'success': True,
            'message': '用户注册成功',
            'user': {
                'id': user.id,
                'username': user.username,
                'real_name': user.real_name,
                'role': user.role,
                'department': user.department
            }
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': f'注册失败：{str(e)}'})


@auth_bp.route('/profile', methods=['GET', 'PUT'])
@login_or_jwt_required
def profile():
    if not current_user.is_authenticated:
        return jsonify({'success': False, 'message': '用户不存在'})

    user = current_user

    if request.method == 'GET':
        return jsonify({
            'success': True,
            'user': {
                'id': user.id,
                'username': user.username,
                'real_name': user.real_name,
                'email': user.email,
                'phone': user.phone,
                'department': user.department,
                'role': user.role,
                'points': user.points,
                'status': user.status,
                'created_at': user.created_at.isoformat()
            }
        })

    data = request.get_json()
    allowed_fields = ['real_name', 'email', 'phone', 'department']
    if user.role == 'nurse':
        allowed_fields.remove('department')

    for field in allowed_fields:
        if field in data:
            value = data[field]

            if field == 'email' and value and not re.match(r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$', value):
                return jsonify({'success': False, 'message': '邮箱格式不正确'})

            if field == 'phone' and value and not re.match(r'^1[3-9]\d{9}$', value):
                return jsonify({'success': False, 'message': '手机号格式不正确'})

            if field == 'email' and value:
                existing_user = User.query.filter_by(email=value).first()
                if existing_user and existing_user.id != user.id:
                    return jsonify({'success': False, 'message': '邮箱已被其他用户使用'})

            setattr(user, field, value)

    try:
        db.session.commit()
        return jsonify({'success': True, 'message': '个人信息更新成功'})
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': f'更新失败：{str(e)}'})


@auth_bp.route('/change-password', methods=['POST'])
@login_or_jwt_required
def change_password():
    if not current_user.is_authenticated:
        return jsonify({'success': False, 'message': '用户不存在'})

    user = current_user

    data = request.get_json()
    old_password = data.get('old_password')
    new_password = data.get('new_password')

    if not all([old_password, new_password]):
        return jsonify({'success': False, 'message': '旧密码和新密码不能为空'})

    if not user.check_password(old_password):
        return jsonify({'success': False, 'message': '旧密码不正确'})

    if len(new_password) < 8:
        return jsonify({'success': False, 'message': '新密码长度至少8位'})
    if not re.search(r'[a-zA-Z]', new_password) or not re.search(r'[0-9]', new_password):
        return jsonify({'success': False, 'message': '新密码必须同时包含字母和数字'})

    try:
        user.set_password(new_password)
        db.session.commit()
        return jsonify({'success': True, 'message': '密码修改成功'})
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': f'密码修改失败：{str(e)}'})


@auth_bp.route('/users/<int:user_id>/toggle-status', methods=['POST'])
@login_or_jwt_required
@admin_required
def toggle_user_status(user_id):
    user = User.query.get(user_id)
    if not user:
        return jsonify({'success': False, 'message': '用户不存在'})

    if user.id == current_user.id:
        return jsonify({'success': False, 'message': '不能禁用自己的账号'})

    user.status = 'disabled' if user.status == 'active' else 'active'

    try:
        db.session.commit()
        return jsonify({
            'success': True,
            'message': f'用户状态已更新为：{user.status}',
            'status': user.status
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': f'状态更新失败：{str(e)}'})
