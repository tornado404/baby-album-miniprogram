"""成就服务 — 徽章检测引擎

9 种徽章，按任务描述定义：
  first_upload     — 首次上传
  first_week       — 连续 7 天记录
  first_month      — 连续 30 天记录
  photo_10         — 累计 10 张照片
  photo_50         — 累计 50 张照片
  photo_100        — 累计 100 张照片
  video_5          — 上传 5 个视频
  record_30_days   — 累计 30 天有记录
  record_100_days  — 累计 100 天有记录
"""
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from app.models.achievement import Achievement
from app.models.media import Media
from datetime import datetime, timedelta


BADGE_DEFINITIONS = [
    {"key": "first_upload",    "name": "初来乍到",     "icon": "🏅", "desc": "首次上传照片"},
    {"key": "first_week",      "name": "坚持之星",     "icon": "🗓️", "desc": "连续 7 天记录"},
    {"key": "first_month",     "name": "月度记录者",   "icon": "📅", "desc": "连续 30 天记录"},
    {"key": "photo_10",        "name": "小有成就",     "icon": "📷", "desc": "累计 10 张照片"},
    {"key": "photo_50",        "name": "记录能手",     "icon": "📸", "desc": "累计 50 张照片"},
    {"key": "photo_100",       "name": "记录达人",     "icon": "🎞️", "desc": "累计 100 张照片"},
    {"key": "video_5",         "name": "影像记录者",   "icon": "🎬", "desc": "上传 5 个视频"},
    {"key": "record_30_days",  "name": "三十而立",     "icon": "🌟", "desc": "累计 30 天有记录"},
    {"key": "record_100_days", "name": "百日坚持",     "icon": "🏆", "desc": "累计 100 天有记录"},
]

# 阈值表：badge_key -> (check_function_suffix, threshold)
_BADGE_THRESHOLDS = {
    "photo_10":  10,
    "photo_50":  50,
    "photo_100": 100,
    "video_5":   5,
}


class AchievementService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def check_and_award(self, user_id: str, context: dict) -> list[dict]:
        """检查所有成就条件，返回新获得的成就列表"""
        new_badges = []

        # 获取用户已有的成就 key 集合
        r = await self.db.execute(
            select(Achievement.badge_key).where(Achievement.user_id == user_id)
        )
        owned = {row[0] for row in r.fetchall()}

        # ── first_upload ──
        if "first_upload" not in owned and await self._has_any_media(user_id):
            new_badges.append(await self._award(user_id, "first_upload"))

        # ── first_week ──
        if "first_week" not in owned and await self._check_streak(user_id, 7):
            new_badges.append(await self._award(user_id, "first_week"))

        # ── first_month ──
        if "first_month" not in owned and await self._check_streak(user_id, 30):
            new_badges.append(await self._award(user_id, "first_month"))

        # ── photo_N 系列阈值徽章 ──
        photo_count = await self._media_count(user_id, "image")
        for key in ("photo_10", "photo_50", "photo_100"):
            if key not in owned and photo_count >= _BADGE_THRESHOLDS[key]:
                new_badges.append(await self._award(user_id, key))

        # ── video_5 ──
        if "video_5" not in owned:
            video_count = await self._media_count(user_id, "video")
            if video_count >= _BADGE_THRESHOLDS["video_5"]:
                new_badges.append(await self._award(user_id, "video_5"))

        # ── record_30_days / record_100_days ──
        total_record_days = await self._total_record_days(user_id)
        if "record_30_days" not in owned and total_record_days >= 30:
            new_badges.append(await self._award(user_id, "record_30_days"))
        if "record_100_days" not in owned and total_record_days >= 100:
            new_badges.append(await self._award(user_id, "record_100_days"))

        return new_badges

    async def get_all_badges(self, user_id: str) -> list[dict]:
        """获取用户所有成就（含已获得和未获得）"""
        r = await self.db.execute(
            select(Achievement).where(Achievement.user_id == user_id)
        )
        owned = {a.badge_key: a.awarded_at for a in r.scalars().all()}

        result = []
        for badge in BADGE_DEFINITIONS:
            awarded_at = owned.get(badge["key"])
            result.append({
                "key": badge["key"],
                "name": badge["name"],
                "icon": badge["icon"],
                "desc": badge["desc"],
                "unlocked": awarded_at is not None,
                "unlockedAt": awarded_at.isoformat() if awarded_at else None,
            })
        return result

    async def _award(self, user_id: str, badge_key: str) -> dict:
        """发放成就（幂等）"""
        a = Achievement(user_id=user_id, badge_key=badge_key)
        self.db.add(a)
        await self.db.flush()
        return {"key": badge_key, "newlyAwarded": True}

    async def _has_any_media(self, user_id: str) -> bool:
        r = await self.db.execute(
            select(func.count(Media.id)).where(
                Media.user_id == user_id, Media.is_deleted == False
            )
        )
        return r.scalar() > 0

    async def _media_count(self, user_id: str, media_type: str) -> int:
        r = await self.db.execute(
            select(func.count(Media.id)).where(
                Media.user_id == user_id,
                Media.type == media_type,
                Media.is_deleted == False,
            )
        )
        return r.scalar() or 0

    async def _total_record_days(self, user_id: str) -> int:
        """累计有记录的天数（不要求连续）"""
        r = await self.db.execute(
            select(func.count(func.distinct(Media.capture_date))).where(
                Media.user_id == user_id, Media.is_deleted == False
            )
        )
        return r.scalar() or 0

    async def _check_streak(self, user_id: str, days: int) -> bool:
        """检查是否有连续 days 天的记录"""
        r = await self.db.execute(
            select(Media.capture_date)
            .where(Media.user_id == user_id, Media.is_deleted == False)
            .distinct()
            .order_by(Media.capture_date.desc())
            .limit(days + 5)
        )
        dates = sorted({row[0] for row in r.fetchall()}, reverse=True)
        if len(dates) < days:
            return False
        streak = 1
        for i in range(1, len(dates)):
            d1 = datetime.strptime(dates[i - 1], "%Y-%m-%d")
            d2 = datetime.strptime(dates[i], "%Y-%m-%d")
            if (d1 - d2).days == 1:
                streak += 1
                if streak >= days:
                    return True
            else:
                streak = 1
        return streak >= days