"""月龄计算工具函数"""

import calendar
from datetime import date, datetime


def calculate_baby_age(birth_date: str) -> dict:
    """计算宝宝年龄

    Args:
        birth_date: 出生日期字符串，格式 YYYY-MM-DD

    Returns:
        {"years": int, "months": int, "days": int}

    Raises:
        ValueError: 日期格式无效
    """
    try:
        birth = datetime.strptime(birth_date, "%Y-%m-%d").date()
    except (ValueError, TypeError):
        raise ValueError(f"Invalid date format: {birth_date}, expected YYYY-MM-DD")

    today = date.today()

    # 未来日期 → 返回零
    if birth > today:
        return {"years": 0, "months": 0, "days": 0}

    # 计算年份差
    years = today.year - birth.year
    months = today.month - birth.month
    days = today.day - birth.day

    # 借位修正
    if days < 0:
        months -= 1
        # 上个月的天数
        if today.month == 1:
            prev_month = 12
            prev_year = today.year - 1
        else:
            prev_month = today.month - 1
            prev_year = today.year
        # 考虑闰年
        days_in_prev_month = calendar.monthrange(prev_year, prev_month)[1]
        days += days_in_prev_month

    if months < 0:
        years -= 1
        months += 12

    return {"years": years, "months": months, "days": days}
