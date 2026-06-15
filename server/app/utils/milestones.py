"""里程碑工具 — 根据宝宝月龄自动推荐里程碑"""

from datetime import datetime, date


MILESTONE_MAP = [
    {"month": 0,  "name": "出生",   "icon": "👶", "desc": "宝宝来到这个世界"},
    {"month": 1,  "name": "满月",   "icon": "🌙", "desc": "宝宝满月了"},
    {"month": 3,  "name": "翻身",   "icon": "🔄", "desc": "宝宝学会翻身"},
    {"month": 6,  "name": "坐",     "icon": "🪑", "desc": "宝宝可以坐稳了"},
    {"month": 8,  "name": "爬",     "icon": "🐛", "desc": "宝宝开始爬行"},
    {"month": 10, "name": "站立",   "icon": "🧍", "desc": "宝宝可以站立"},
    {"month": 12, "name": "走路",   "icon": "🚶", "desc": "宝宝开始走路"},
    {"month": 18, "name": "说话",   "icon": "🗣️", "desc": "宝宝开始说话"},
    {"month": 24, "name": "跑步",   "icon": "🏃", "desc": "宝宝可以跑步了"},
    {"month": 36, "name": "上幼儿园", "icon": "🏫", "desc": "宝宝开始上幼儿园"},
]


def get_recommended_milestones(birth_date: str) -> list[dict]:
    """根据出生日期返回推荐里程碑列表

    Args:
        birth_date: 出生日期，格式 YYYY-MM-DD

    Returns:
        里程碑列表，每项包含 month, name, icon, desc, achieved
    """
    if not birth_date:
        return []

    try:
        birth = datetime.strptime(birth_date, "%Y-%m-%d").date()
    except (ValueError, TypeError):
        return []

    today = date.today()
    age_months = (today.year - birth.year) * 12 + (today.month - birth.month)

    result = []
    for m in MILESTONE_MAP:
        result.append({
            "month": m["month"],
            "name": m["name"],
            "icon": m["icon"],
            "desc": m["desc"],
            "achieved": age_months >= m["month"],
        })
    return result
