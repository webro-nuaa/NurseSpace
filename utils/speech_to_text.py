"""语音识别 — 百度 ASR（多 Key 轮转，数据库存储）"""
import logging
import requests
from config import Config

logger = logging.getLogger(__name__)

BAIDU_OAUTH_URL = 'https://aip.baidubce.com/oauth/2.0/token'
BAIDU_ASR_URL = 'https://vop.baidu.com/server_api'


def _get_access_token(api_key, secret_key):
    """获取单个 Key 的 access_token，带内存缓存"""
    cache_key = f'{api_key[:8]}:{secret_key[:8]}'
    if hasattr(_get_access_token, '_cache') and cache_key in _get_access_token._cache:
        token, expires = _get_access_token._cache[cache_key]
        import time
        if time.time() < expires - 300:
            return token

    try:
        resp = requests.post(BAIDU_OAUTH_URL, data={
            'grant_type': 'client_credentials',
            'client_id': api_key,
            'client_secret': secret_key,
        }, timeout=10)
        data = resp.json()
        token = data.get('access_token')
        if token:
            import time
            expires_in = data.get('expires_in', 86400)
            if not hasattr(_get_access_token, '_cache'):
                _get_access_token._cache = {}
            _get_access_token._cache[cache_key] = (token, time.time() + expires_in)
            return token
        logger.warning('百度 OAuth 失败：%s', data)
    except Exception as e:
        logger.warning('百度 OAuth 异常：%s', e)
    return None


def _get_active_keys():
    """从数据库获取所有启用的 Key，解密返回"""
    from models import BaiduAsrKey
    from utils.crypto import decrypt_value
    keys = BaiduAsrKey.query.filter_by(is_active=True).order_by(BaiduAsrKey.id).all()
    result = []
    for k in keys:
        api_key = decrypt_value(k.api_key)
        secret_key = decrypt_value(k.secret_key)
        if api_key and secret_key:
            result.append({'id': k.id, 'app_id': k.app_id or '',
                           'api_key': api_key, 'secret_key': secret_key})
    return result


def transcribe(audio_data: bytes, audio_format: str = 'pcm',
               rate: int = 16000) -> dict:
    """
    语音识别 — 轮转百度 ASR Key，返回第一个成功结果。

    audio_data: PCM 16-bit little-endian, 16000 Hz, mono
    Returns: {'success': True, 'text': '...'} | {'success': False, 'message': '...'}
    """
    keys = _get_active_keys()

    # 也检查 env 中的配置（兼容旧配置或备份）
    env_key = Config.BAIDU_ASR_API_KEY
    env_secret = Config.BAIDU_ASR_SECRET_KEY
    if env_key and env_secret:
        keys.append({'id': 0, 'app_id': Config.BAIDU_ASR_APP_ID or '',
                     'api_key': env_key, 'secret_key': env_secret})

    if not keys:
        return {
            'success': False,
            'message': '未配置百度语音识别。请在系统管理 → AI 设置中添加百度 ASR Key。'
        }

    import base64
    speech_b64 = base64.b64encode(audio_data).decode()

    last_error = None
    for key_info in keys:
        token = _get_access_token(key_info['api_key'], key_info['secret_key'])
        if not token:
            last_error = '获取百度 access_token 失败'
            continue

        try:
            resp = requests.post(BAIDU_ASR_URL, json={
                'format': audio_format,
                'rate': rate,
                'channel': 1,
                'cuid': key_info['app_id'] or 'nursespace',
                'token': token,
                'speech': speech_b64,
                'len': len(audio_data),
            }, timeout=15)
            result = resp.json()

            err_no = result.get('err_no', -1)
            if err_no == 0:
                text = ' '.join(result.get('result', []))
                return {'success': True, 'text': text or ''}

            err_msg = result.get('err_msg', '未知错误')
            logger.warning('百度 ASR Key #%s 失败：%s (err_no=%s)',
                           key_info['id'], err_msg, err_no)

            # 额度耗尽类错误，尝试下一个 Key
            if err_no in (3300, 3301, 3302, 3303, 3304, 3305, 3321):
                last_error = f'当前 Key 额度已用完（{err_msg}），已切换备用 Key'
                continue
            else:
                last_error = f'语音识别失败：{err_msg}'
                break

        except Exception as e:
            logger.warning('百度 ASR Key #%s 异常：%s', key_info['id'], e)
            last_error = f'请求异常：{e}'
            continue

    return {'success': False, 'message': last_error or '所有 Key 均已用完或失效'}
