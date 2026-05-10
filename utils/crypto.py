from cryptography.fernet import Fernet
import os


def _get_cipher():
    key = os.environ.get('ENCRYPTION_KEY')
    if not key:
        raise RuntimeError("ENCRYPTION_KEY 环境变量未设置，生产环境必须配置")
    return Fernet(key.encode() if isinstance(key, str) else key)


def encrypt_value(value):
    if not value:
        return None
    return _get_cipher().encrypt(value.encode()).decode()


def decrypt_value(ciphertext):
    if not ciphertext:
        return None
    return _get_cipher().decrypt(ciphertext.encode()).decode()
