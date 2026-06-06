from routes.admin import admin_bp
import os
import uuid

from flask import jsonify, request, current_app
from flask_login import current_user
from utils.auth import login_or_jwt_required
from utils.decorators import admin_required
from models import Case, ExtensionVideo, ExtensionLink, db
from sqlalchemy import func


# ---- Video Upload ----

@admin_bp.route('/videos/upload', methods=['POST'])
@login_or_jwt_required
@admin_required
def upload_video_file():
    if 'file' not in request.files:
        return jsonify({'success': False, 'message': '未选择文件'})
    f = request.files['file']
    if f.filename == '':
        return jsonify({'success': False, 'message': '未选择文件'})
    from utils.file_upload import validate_upload
    ok, err = validate_upload(f, ('.mp4', '.webm', '.ogg', '.mov', '.avi', '.mkv'), check_magic=False)
    if not ok:
        return jsonify({'success': False, 'message': err})
    ext = os.path.splitext(f.filename)[1].lower()
    videos_dir = os.path.join(current_app.config.get('UPLOAD_DIR', '/app/uploads'), 'videos')
    os.makedirs(videos_dir, exist_ok=True)
    filename = f"{uuid.uuid4().hex}{ext}"
    f.save(os.path.join(videos_dir, filename))
    return jsonify({'success': True, 'url': f'/uploads/videos/{filename}'})


# ---- Video CRUD under Case ----

@admin_bp.route('/cases/<int:case_id>/videos', methods=['POST'])
@login_or_jwt_required
@admin_required
def create_case_video(case_id):
    case = db.session.get(Case, case_id)
    if not case:
        return jsonify({'success': False, 'message': '案例不存在'}), 404
    data = request.get_json() or {}
    title = (data.get('title') or '').strip()
    url = (data.get('url') or '').strip()
    if not title or not url:
        return jsonify({'success': False, 'message': '视频标题和URL不能为空'})
    max_order = db.session.query(func.max(ExtensionVideo.order_index)).filter_by(case_id=case_id).scalar() or 0
    video = ExtensionVideo(case_id=case_id, title=title, url=url,
                           description=(data.get('description') or '').strip(),
                           order_index=max_order + 1)
    db.session.add(video)
    db.session.commit()
    return jsonify({'success': True, 'video': {'id': video.id, 'title': video.title}})


@admin_bp.route('/cases/<int:case_id>/videos/<int:video_id>', methods=['DELETE'])
@login_or_jwt_required
@admin_required
def delete_case_video(case_id, video_id):
    video = ExtensionVideo.query.filter_by(id=video_id, case_id=case_id).first()
    if not video:
        return jsonify({'success': False, 'message': '视频不存在'}), 404
    db.session.delete(video)
    db.session.commit()
    return jsonify({'success': True, 'message': '视频已删除'})


# ---- Link CRUD under Case ----

@admin_bp.route('/cases/<int:case_id>/links', methods=['POST'])
@login_or_jwt_required
@admin_required
def create_case_link(case_id):
    case = db.session.get(Case, case_id)
    if not case:
        return jsonify({'success': False, 'message': '案例不存在'}), 404
    data = request.get_json() or {}
    title = (data.get('title') or '').strip()
    url = (data.get('url') or '').strip()
    if not title or not url:
        return jsonify({'success': False, 'message': '链接标题和URL不能为空'})
    max_order = db.session.query(func.max(ExtensionLink.order_index)).filter_by(case_id=case_id).scalar() or 0
    link = ExtensionLink(case_id=case_id, title=title, url=url,
                         description=(data.get('description') or '').strip(),
                         order_index=max_order + 1)
    db.session.add(link)
    db.session.commit()
    return jsonify({'success': True, 'link': {'id': link.id, 'title': link.title}})


@admin_bp.route('/cases/<int:case_id>/links/<int:link_id>', methods=['DELETE'])
@login_or_jwt_required
@admin_required
def delete_case_link(case_id, link_id):
    link = ExtensionLink.query.filter_by(id=link_id, case_id=case_id).first()
    if not link:
        return jsonify({'success': False, 'message': '链接不存在'}), 404
    db.session.delete(link)
    db.session.commit()
    return jsonify({'success': True, 'message': '链接已删除'})
