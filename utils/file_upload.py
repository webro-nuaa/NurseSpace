"""
文件上传安全校验 — MIME 类型白名单 + 魔数检测

防御：上传伪装文件（如 .docx 实为 .exe）绕过扩展名检查
"""

import os
import logging

logger = logging.getLogger(__name__)

# MIME 类型白名单（按扩展名分组）
_ALLOWED_MIMETYPES = {
    'docx': [
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/octet-stream',
    ],
    'doc': [
        'application/msword',
        'application/octet-stream',
    ],
    'pdf': [
        'application/pdf',
        'application/octet-stream',
    ],
    'txt': [
        'text/plain',
    ],
    'zip': [
        'application/zip',
        'application/x-zip-compressed',
        'application/octet-stream',
    ],
    'rar': [
        'application/vnd.rar',
        'application/x-rar-compressed',
        'application/octet-stream',
    ],
    'xlsx': [
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/octet-stream',
    ],
    'mp4': [
        'video/mp4',
        'application/octet-stream',
    ],
    'webm': [
        'video/webm',
        'application/octet-stream',
    ],
    'ogg': [
        'video/ogg',
        'audio/ogg',
        'application/octet-stream',
    ],
    'mov': [
        'video/quicktime',
        'application/octet-stream',
    ],
    'avi': [
        'video/x-msvideo',
        'application/octet-stream',
    ],
    'mkv': [
        'video/x-matroska',
        'application/octet-stream',
    ],
}

# 魔数字节签名
_FILE_SIGNATURES = {
    'docx': b'\x50\x4B\x03\x04',   # PK.. (ZIP-based OOXML)
    'zip':  b'\x50\x4B\x03\x04',   # PK..
    'rar':  b'\x52\x61\x72\x21',   # Rar!
    'pdf':  b'\x25\x50\x44\x46',   # %PDF
    'xlsx': b'\x50\x4B\x03\x04',   # PK..
}

# 扩展名 → 魔数映射
_EXPECTED_SIGNATURES = {k: _FILE_SIGNATURES[k] for k in ('docx', 'zip', 'rar', 'pdf', 'xlsx')}


def validate_upload(file, allowed_extensions: tuple, check_magic: bool = True) -> tuple:
    """校验上传文件的扩展名、MIME 类型和文件头魔数。

    Args:
        file: Flask FileStorage 对象
        allowed_extensions: 允许的扩展名元组，如 ('.docx', '.zip')
        check_magic: 是否检测文件头魔数（默认 True）

    Returns:
        (is_valid: bool, error_message: str)
    """
    if not file or not file.filename:
        return False, '未选择文件'

    # 扩展名校验
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in allowed_extensions:
        return False, f'不支持的文件格式: {ext}'

    # MIME 类型校验
    content_type = (file.content_type or '').lower()
    ext_key = ext.lstrip('.')
    allowed_mimes = _ALLOWED_MIMETYPES.get(ext_key, [])
    if allowed_mimes and content_type not in allowed_mimes:
        logger.warning(
            '文件 MIME 不匹配: filename=%s, ext=%s, content_type=%s',
            file.filename, ext, content_type
        )
        return False, f'文件类型不匹配（{content_type}），仅接受: {", ".join(allowed_mimes)}'

    # 魔数检测
    if check_magic and ext_key in _EXPECTED_SIGNATURES:
        expected = _EXPECTED_SIGNATURES[ext_key]
        if expected is not None:
            pos = file.tell()
            file.seek(0)
            actual = file.read(len(expected))
            file.seek(pos)
            if actual != expected:
                logger.warning('文件魔数不匹配: %s, expected=%s, got=%s',
                               file.filename, expected.hex(), actual.hex()[:8])
                return False, '文件内容与扩展名不符，拒绝上传'

    return True, ''
