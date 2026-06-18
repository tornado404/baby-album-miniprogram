"""补充成就服务测试 — record_100_days / get_all_badges / streak_reset"""
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.achievement import Achievement
from app.models.media import Media, MediaType
from app.services.achievement_service import AchievementService, BADGE_DEFINITIONS


class TestAchievementExtra:
    """成就服务补充覆盖"""

    async def test_record_100_days_badge(self, db_session: AsyncSession, auth_token: str):
        """累计 100 天记录解锁 record_100_days"""
        from datetime import date, timedelta
        base = date(2026, 1, 1)
        for i in range(100):
            d = base + timedelta(days=i)
            db_session.add(Media(
                id="xa-rec100-" + str(i), user_id=auth_token, baby_id="t",
                type=MediaType.image, cos_key="x/" + str(i) + ".jpg",
                capture_date=d.isoformat(),
            ))
        await db_session.flush()

        svc = AchievementService(db_session)
        new = await svc.check_and_award(auth_token, {})
        keys = [b["key"] for b in new]
        assert "record_100_days" in keys

    async def test_photo_100(self, db_session: AsyncSession, auth_token: str):
        """累计 100 张照片"""
        for i in range(100):
            db_session.add(Media(
                id="xa-ph100-" + str(i), user_id=auth_token, baby_id="t",
                type=MediaType.image, cos_key="x/" + str(i) + ".jpg",
                capture_date="2026-06-15",
            ))
        await db_session.flush()

        svc = AchievementService(db_session)
        new = await svc.check_and_award(auth_token, {})
        keys = [b["key"] for b in new]
        assert "photo_100" in keys

    async def test_first_month_streak(self, db_session: AsyncSession, auth_token: str):
        """连续 30 天记录"""
        from datetime import date, timedelta
        base = date(2026, 1, 1)
        for i in range(30):
            d = base + timedelta(days=i)
            db_session.add(Media(
                id="xa-fm-" + str(i), user_id=auth_token, baby_id="t",
                type=MediaType.image, cos_key="x/" + str(i) + ".jpg",
                capture_date=d.isoformat(),
            ))
        await db_session.flush()

        svc = AchievementService(db_session)
        new = await svc.check_and_award(auth_token, {})
        keys = [b["key"] for b in new]
        assert "first_month" in keys

    async def test_streak_gap_resets(self, db_session: AsyncSession, auth_token: str):
        """gap 导致 streak 重置"""
        from datetime import date, timedelta
        base = date(2026, 6, 1)
        for i in [0, 1, 2, 4, 5, 6, 7, 8, 9]:  # gap at index 3
            d = base + timedelta(days=i)
            db_session.add(Media(
                id="xa-gap-" + str(i), user_id=auth_token, baby_id="t",
                type=MediaType.image, cos_key="x/" + str(i) + ".jpg",
                capture_date=d.isoformat(),
            ))
        await db_session.flush()

        svc = AchievementService(db_session)
        new = await svc.check_and_award(auth_token, {})
        keys = [b["key"] for b in new]
        assert "first_week" not in keys

    async def test_get_all_badges_partial(self, db_session: AsyncSession, auth_token: str):
        """部分成就解锁的 get_all_badges"""
        db_session.add(Achievement(user_id=auth_token, badge_key="first_upload"))
        db_session.add(Achievement(user_id=auth_token, badge_key="photo_10"))
        await db_session.flush()

        svc = AchievementService(db_session)
        badges = await svc.get_all_badges(auth_token)

        assert len(badges) == len(BADGE_DEFINITIONS)
        for b in badges:
            if b["key"] in ("first_upload", "photo_10"):
                assert b["unlocked"] is True
            else:
                assert b["unlocked"] is False