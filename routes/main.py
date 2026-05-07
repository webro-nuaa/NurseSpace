from flask import Blueprint, render_template, redirect, url_for
from flask_login import current_user

main_bp = Blueprint('main', __name__)

@main_bp.route('/')
def index():
    """首页"""
    if current_user.is_authenticated:
        if current_user.role == 'admin':
            return redirect(url_for('admin.dashboard'))
        else:
            return redirect(url_for('nurse.dashboard'))
    return redirect(url_for('auth.login'))

@main_bp.route('/admin')
@main_bp.route('/admin/')
def admin_index():
    """管理员首页"""
    return render_template('admin/index.html')

@main_bp.route('/nurse')
@main_bp.route('/nurse/')
def nurse_index():
    """护士端首页"""
    return render_template('nurse/index.html')

@main_bp.route('/nurse/station')
def nurse_station_page():
    """护士作答单页（?id=站点ID&case=案例ID）"""
    return render_template('nurse/station.html')

@main_bp.route('/nurse/knowledge')
def nurse_knowledge_page():
    """扩展知识作答单页（?id=题目ID）"""
    return render_template('nurse/knowledge.html')

@main_bp.route('/nurse/wrong-detail')
def nurse_wrong_detail_page():
    """护士错题详情单页（?station=站点ID）"""
    return render_template('nurse/wrong_detail.html')

@main_bp.route('/nurse/answer-view')
def nurse_answer_view_page():
    """护士答案查看单页（?id=站点ID&case=案例ID）"""
    return render_template('nurse/answer_view.html')

@main_bp.route('/nurse/knowledge-answer-view')
def nurse_knowledge_answer_view_page():
    """护士扩展知识答案查看单页（?id=扩展知识ID）"""
    return render_template('nurse/knowledge_answer_view.html')
