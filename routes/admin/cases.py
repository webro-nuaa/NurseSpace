"""管理员端案例管理路由 — 请求解析与响应组装，业务逻辑在 services.case_service。"""
from routes.admin import admin_bp
import os
import tempfile
from io import BytesIO

from flask import jsonify, request, send_file, current_app
from utils.auth import login_or_jwt_required
from utils.decorators import admin_required
from utils.docx_parser import DocxParser
from models import db, Case
from services import case_service, case_archive_import, category_service

docx_parser = DocxParser()


@admin_bp.route('/cases', methods=['GET', 'POST'])
@login_or_jwt_required
@admin_required
def manage_cases():
    if request.method == 'GET':
        data = case_service.list_cases(
            page=request.args.get('page', 1, type=int),
            per_page=request.args.get('per_page', 20, type=int),
            category_id=request.args.get('category_id', type=int),
            search=request.args.get('search', '').strip(),
            case_type=request.args.get('case_type', '').strip(),
            include_stations=request.args.get('include_stations', '').strip() == 'true',
        )
        return jsonify({'success': True, 'data': data})

    # POST: JSON 创建 或 文件上传解析
    if request.is_json:
        return _create_case_from_json()

    return _create_case_from_docx()


@admin_bp.route('/categories/<int:category_id>', methods=['PUT'])
@login_or_jwt_required
@admin_required
def rename_category(category_id):
    """类别重命名；目标名已存在时把案例并入目标类别（见 category_service）。"""
    data = request.get_json(silent=True) or {}
    result, error = category_service.rename_category(
        category_id, data.get('name', ''))
    if error:
        return jsonify({'success': False, 'message': error})
    message = (f'已并入目标类别，迁移 {result["moved"]} 个案例'
               if result['merged'] else '类别重命名成功')
    return jsonify({'success': True, 'message': message, 'data': result})


def _create_case_from_json():
    """JSON 载荷创建案例。"""
    data = request.get_json() or {}
    case, error = case_service.create_case_from_payload(data)
    if error:
        return jsonify({'success': False, 'message': error})

    from models import Station
    station_count = Station.query.filter_by(case_id=case.id).count()
    return jsonify({
        'success': True,
        'message': f'案例创建成功（含{station_count}个站点）',
        'case': {'id': case.id, 'title': case.title}
    })


def _create_case_from_docx():
    """上传单个 docx 创建案例：临时文件解析入库后立即删除，不保留 docx 副本。"""
    if 'file' not in request.files:
        return jsonify({'success': False, 'message': '未选择文件'})

    file = request.files['file']
    if file.filename == '':
        return jsonify({'success': False, 'message': '未选择文件'})

    from utils.file_upload import validate_upload
    ok, err = validate_upload(file, ('.docx',))
    if not ok:
        return jsonify({'success': False, 'message': err})

    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix='.docx') as tmp:
            file.save(tmp.name)
            tmp_path = tmp.name
        try:
            case = docx_parser.parse_file(tmp_path)
        finally:
            os.unlink(tmp_path)

        return jsonify({
            'success': True,
            'message': '案例上传并解析成功',
            'case': {
                'id': case.id,
                'title': case.title,
                'category_name': case.category.name,
                'file_path': case.file_path
            }
        })
    except Exception as e:
        current_app.logger.error(f"案例上传失败: {e}", exc_info=True)
        return jsonify({'success': False, 'message': '上传失败，请稍后重试'})


@admin_bp.route('/cases/<int:case_id>', methods=['PUT', 'DELETE'])
@login_or_jwt_required
@admin_required
def update_or_delete_case(case_id: int):
    case = db.session.get(Case, case_id)
    if not case:
        return jsonify({'success': False, 'message': '案例不存在'}), 404

    if request.method == 'DELETE':
        error = case_service.delete_case(case)
        if error:
            return jsonify({'success': False, 'message': error})
        return jsonify({'success': True, 'message': '案例已删除'})

    error = case_service.update_case_fields(case, request.get_json() or {})
    if error:
        return jsonify({'success': False, 'message': error})
    return jsonify({'success': True, 'message': '案例已更新'})


@admin_bp.route('/cases/<int:case_id>')
@login_or_jwt_required
@admin_required
def get_case_detail(case_id):
    data = case_service.get_case_detail(case_id)
    if not data:
        return jsonify({'success': False, 'message': '案例不存在'}), 404
    return jsonify({'success': True, 'data': data})


@admin_bp.route('/cases/batch-delete', methods=['POST'])
@login_or_jwt_required
@admin_required
def batch_delete_cases():
    data = request.get_json() or {}
    ids = data.get('ids') or []
    if not isinstance(ids, list) or not ids:
        return jsonify({'success': False, 'message': '请提供要删除的案例ID列表'})

    _, error = case_service.delete_cases_by_ids(ids)
    if error:
        return jsonify({'success': False, 'message': error})
    return jsonify({'success': True, 'message': f'已删除 {len(ids)} 个案例'})


@admin_bp.route('/cases/batch-upload', methods=['POST'])
@login_or_jwt_required
@admin_required
def batch_upload_cases():
    """上传 zip/rar 压缩包，批量解析其中的 docx 案例。"""
    if 'file' not in request.files:
        return jsonify({'success': False, 'message': '请选择压缩包文件'})
    f = request.files['file']

    tmp_dir = tempfile.mkdtemp()
    try:
        error = case_archive_import.extract_archive(f.stream, f.filename, tmp_dir)
        if error:
            return jsonify({'success': False, 'message': error})

        summary = case_archive_import.import_docx_files_from_dir(tmp_dir, docx_parser.parse_file)
        return jsonify({
            'success': True,
            'message': (f"批量上传完成，共扫描 {summary['total_found']} 个文件，"
                        f"成功: {summary['success_count']}个，失败: {summary['error_count']}个"),
            'data': {
                'total_in_archive': summary['total_in_archive'],
                'total_found': summary['total_found'],
                'success_count': summary['success_count'],
                'error_count': summary['error_count'],
                'results': summary['results'],
                'errors': summary['errors']
            }
        })
    except Exception as e:
        current_app.logger.error(f"案例批量上传失败: {e}", exc_info=True)
        return jsonify({'success': False, 'message': '批量上传失败，请稍后重试'})
    finally:
        case_archive_import.cleanup_dir(tmp_dir)


@admin_bp.route('/cases/xlsx-template', methods=['GET'])
@login_or_jwt_required
@admin_required
def download_cases_xlsx_template():
    try:
        bio = case_service.build_xlsx_template()
        return send_file(bio, as_attachment=True, download_name='案例批量导入模板.xlsx',
                         mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    except Exception as e:
        current_app.logger.error(f"生成案例导入模板失败: {e}", exc_info=True)
        return jsonify({'success': False, 'message': '生成模板失败，请稍后重试'})


@admin_bp.route('/cases/batch-import-xlsx', methods=['POST'])
@login_or_jwt_required
@admin_required
def batch_import_cases_xlsx():
    if 'file' not in request.files:
        return jsonify({'success': False, 'message': '未选择文件'})
    f = request.files['file']
    if not f.filename.lower().endswith('.xlsx'):
        return jsonify({'success': False, 'message': '只支持 .xlsx 文件'})

    created, skipped, error = case_service.import_cases_from_xlsx(BytesIO(f.read()))
    if error:
        return jsonify({'success': False, 'message': error})
    return jsonify({'success': True, 'message': f'导入完成：新建 {created}，跳过 {skipped}'})


@admin_bp.route('/cases/<int:case_id>/export', methods=['GET'])
@login_or_jwt_required
@admin_required
def export_case(case_id):
    """导出案例为 .docx 文件（格式与上传模板一致，可重新导入）"""
    case = db.session.get(Case, case_id)
    if not case:
        return jsonify({'success': False, 'message': '案例不存在'}), 404

    result = case_service.export_case_docx(case)
    if not result:
        return jsonify({'success': False, 'message': '类别不存在'}), 404

    buf, filename = result
    return send_file(
        buf,
        mimetype='application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        as_attachment=True,
        download_name=filename,
    )


@admin_bp.route('/cases/export-batch', methods=['POST'])
@login_or_jwt_required
@admin_required
def export_cases_batch():
    """批量导出案例为 .zip 文件"""
    data = request.get_json() or {}
    case_ids = data.get('case_ids', [])
    if not case_ids:
        return jsonify({'success': False, 'message': '请选择要导出的案例'}), 400

    result = case_service.export_cases_zip(case_ids)
    if not result:
        return jsonify({'success': False, 'message': '未找到所选案例'}), 404

    zip_buf, filename = result
    return send_file(
        zip_buf,
        mimetype='application/zip',
        as_attachment=True,
        download_name=filename,
    )
