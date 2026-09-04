"""案例压缩包批量导入服务 — 负责压缩包解压与 docx 文件扫描入库。

与 case_service 的职责边界：本模块只处理"压缩包 → docx 文件集合"的落地与
逐文件解析汇总，案例实体的创建由 utils.docx_parser 完成。
"""
import logging
import os
import shutil
import zipfile

import rarfile

logger = logging.getLogger(__name__)


def extract_archive(stream, filename, dest_dir):
    """把上传的 zip/rar 压缩包安全解压到 dest_dir。

    安全措施：拒绝压缩包内任何成员路径逃逸出 dest_dir（Zip Slip 攻击）。

    返回 error_message 或 None；失败时不产生解压产物。
    """
    fname_lower = (filename or '').lower()
    if fname_lower.endswith('.zip'):
        return _extract_zip(stream, dest_dir)
    if fname_lower.endswith('.rar'):
        return _extract_rar(stream, dest_dir)
    return '只支持 .zip 或 .rar 格式的压缩包'


def _extract_zip(stream, dest_dir):
    import zipfile
    try:
        with zipfile.ZipFile(stream, 'r') as zf:
            if not _members_within_dest(zf.namelist(), dest_dir):
                return 'ZIP文件包含非法路径，已拒绝'
            zf.extractall(dest_dir)
    except zipfile.BadZipFile:
        return '无效的ZIP文件，请检查压缩包是否完整'
    return None


def _extract_rar(stream, dest_dir):
    import rarfile
    try:
        with rarfile.RarFile(stream, 'r') as rf:
            if not _members_within_dest(rf.namelist(), dest_dir):
                return 'RAR文件包含非法路径，已拒绝'
            rf.extractall(dest_dir)
    except rarfile.BadRarFile:
        return '无效的RAR文件，请检查压缩包是否完整'
    except rarfile.NotRarFile:
        return '文件不是有效的RAR格式'
    return None


def _members_within_dest(names, dest_dir):
    """校验压缩包成员路径是否全部位于 dest_dir 内（防路径逃逸）。"""
    real_dest = os.path.realpath(dest_dir)
    for member in names:
        member_real = os.path.realpath(os.path.join(dest_dir, member))
        if not member_real.startswith(real_dest + os.sep) and member_real != real_dest:
            return False
    return True


def import_docx_files_from_dir(source_dir, parse_case):
    """遍历目录解析所有 docx 案例。

    parse_case: callable(filepath) -> Case 实例（由 docx_parser 提供）。

    返回汇总 dict：total_in_archive / total_found / success_count / error_count /
    results / errors / skipped。
    """
    results, errors, skipped = [], [], []
    total_in_archive = 0

    for root, dirs, files in os.walk(source_dir):
        dirs[:] = [d for d in dirs if d != '__MACOSX']
        for fname in files:
            total_in_archive += 1
            if not fname.lower().endswith('.docx'):
                continue
            if fname.startswith('~') or fname.startswith('._'):
                skipped.append(fname)
                continue
            fpath = os.path.join(root, fname)
            try:
                case = parse_case(fpath)
                results.append({
                    'filename': fname,
                    'case_id': case.id,
                    'case_title': case.title,
                    'status': 'success'
                })
            except Exception as e:
                errors.append({'filename': fname, 'error': str(e), 'status': 'error'})

    total_found = len(results) + len(errors)
    return {
        'total_in_archive': total_in_archive,
        'total_found': total_found,
        'success_count': len(results),
        'error_count': len(errors),
        'results': results,
        'errors': errors,
        'skipped': skipped,
    }


def cleanup_dir(dir_path):
    """清理临时解压目录（静默容错）。"""
    shutil.rmtree(dir_path, ignore_errors=True)
