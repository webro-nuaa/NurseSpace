"""时间输入解析。

约定：全库 DateTime 列统一存 naive UTC（datetime.utcnow 语义）。
管理员通过 datetime-local 控件提交的是 naive 本地时间（按 Config.TIMEZONE 解释），
存库前必须经 parse_local_to_utc 转换，避免考试时间窗与 UTC 时钟比较时偏移。
"""
from datetime import datetime, timezone
from zoneinfo import ZoneInfo

from config import Config


def parse_local_to_utc(value):
    """把时间字符串解析为 naive UTC datetime。

    - 带时区的 ISO 字符串（如 "...+08:00"）：按其时区转换
    - naive 字符串（datetime-local 提交格式）：按 Config.TIMEZONE 解释后转换

    解析失败抛 ValueError，由调用方转为校验错误响应。
    """
    dt = datetime.fromisoformat(value)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=ZoneInfo(Config.TIMEZONE))
    return dt.astimezone(timezone.utc).replace(tzinfo=None)
