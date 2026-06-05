"""成就服务 — 徽章检测引擎"""
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from app.models.achievement import Achievement
from app.models.media import Media
from app.models.share import ShareRelation
from app.models.user import User
from datetime import datetime, timedelta


BADGE_DEFINITIONS = [
    {"key": "first_upload",   "name": "初来乍到",   "icon": "🏅", "desc": "首次上传照片"},
    {"key": "photo_100",      "name": "记录达人",   "icon": "📸", "desc": "累计 100 张照片"},
    {"key": "first_video",    "name": "影像记录者",  "icon": "🎬", "desc": "上传第一个视频"},
    {"key": "streak_7",       "name": "坚持之星",   "icon": "🗓️", "desc": "连续 7 天记录"},
    {"key": "full_moon",      "name": "满月纪念",   "icon": "🍼", "desc": "宝宝满月时有记录"},
    {"key": "first_birthday", "name": "周岁纪念",   "icon": "🎂", "desc": "宝宝一岁时有记录"},
    {"key": "family_3",       "name": "全家福",     "icon": "👨‍👩‍👧", "desc": "邀请 2 位以上家人"},
    {"key": "photo_1000",     "name": "千张达人",   "icon": "🏆", "desc": "累计 1000 张照片"},
]


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

        # 逐个检查
        if "first_upload" not in owned and await self._has_any_media(user_id):
            new_badges.append(await self._award(user_id, "first_upload"))

        if "photo_100" not in owned:
            count = await self._media_count(user_id, "image")
            if count >= 100:
                new_badges.append(await self._award(user_id, "photo_100"))

        if "first_video" not in owned and await self._has_media_type(user_id, "video"):
            new_badges.append(await self._award(user_id, "first_video"))

        if "streak_7" not in owned and await self._check_streak(user_id, 7):
            new_badges.append(await self._award(user_id, "streak_7"))

        if "photo_1000" not in owned:
            count = await self._media_count(user_id, "image")
            if count >= 1000:
                new_badges.append(await self._award(user_id, "photo_1000"))

        if "family_3" not in owned:
            count = await self._share_count(user_id)
            if count >= 2:
                new_badges.append(await self._award(user_id, "family_3"))

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

    async def _has_media_type(self, user_id: str, media_type: str) -> bool:
        r = await self.db.execute(
            select(func.count(Media.id)).where(
                Media.user_id == user_id,
                Media.type == media_type,
                Media.is_deleted == False,
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

    async def _share_count(self, user_id: str) -> int:
        r = await self.db.execute(
            select(func.count(ShareRelation.id)).where(
                ShareRelation.owner_user_id == user_id
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