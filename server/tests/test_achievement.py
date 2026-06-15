"""成就检测引擎 + API 端点测试"""

from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.achievement import Achievement
from app.models.media import Media, MediaType
from app.services.achievement_service import AchievementService, BADGE_DEFINITIONS


class TestAchievementService:
    """成就服务逻辑测试"""

    async def test_no_badges_initially(self, db_session: AsyncSession, auth_token: str):
        """新用户没有任何成就"""
        svc = AchievementService(db_session)
        badges = await svc.get_all_badges(auth_token)
        assert len(badges) == len(BADGE_DEFINITIONS)
        for b in badges:
            assert b["unlocked"] is False

    async def test_first_upload_badge(self, db_session: AsyncSession, auth_token: str):
        """上传任意媒体后解锁 first_upload"""
        # 直接插入一条媒体记录
        media = Media(
            id="test-media-1",
            user_id=auth_token,
            baby_id="test-baby",
            type=MediaType.image,
            cos_key="photos/test.jpg",
            capture_date="2026-06-15",
        )
        db_session.add(media)
        await db_session.flush()

        svc = AchievementService(db_session)
        new = await svc.check_and_award(auth_token, {})
        assert len(new) >= 1
        keys = [b["key"] for b in new]
        assert "first_upload" in keys

    async def test_photo_10_badge(self, db_session: AsyncSession, auth_token: str):
        """累计 10 张照片解锁 photo_10"""
        for i in range(10):
            media = Media(
                id="test-photo-" + str(i),
                user_id=auth_token,
                baby_id="test-baby",
                type=MediaType.image,
                cos_key="photos/test" + str(i) + ".jpg",
                capture_date="2026-06-15",
            )
            db_session.add(media)
        await db_session.flush()

        svc = AchievementService(db_session)
        new = await svc.check_and_award(auth_token, {})
        keys = [b["key"] for b in new]
        assert "photo_10" in keys

    async def test_photo_50_badge(self, db_session: AsyncSession, auth_token: str):
        """累计 50 张照片解锁 photo_50"""
        for i in range(50):
            media = Media(
                id="test-photo50-" + str(i),
                user_id=auth_token,
                baby_id="test-baby",
                type=MediaType.image,
                cos_key="photos/test50-" + str(i) + ".jpg",
                capture_date="2026-06-15",
            )
            db_session.add(media)
        await db_session.flush()

        svc = AchievementService(db_session)
        new = await svc.check_and_award(auth_token, {})
        keys = [b["key"] for b in new]
        assert "photo_50" in keys

    async def test_video_5_badge(self, db_session: AsyncSession, auth_token: str):
        """5 个视频解锁 video_5"""
        for i in range(5):
            media = Media(
                id="test-video-" + str(i),
                user_id=auth_token,
                baby_id="test-baby",
                type=MediaType.video,
                cos_key="videos/test" + str(i) + ".mp4",
                capture_date="2026-06-15",
            )
            db_session.add(media)
        await db_session.flush()

        svc = AchievementService(db_session)
        new = await svc.check_and_award(auth_token, {})
        keys = [b["key"] for b in new]
        assert "video_5" in keys

    async def test_record_30_days_badge(self, db_session: AsyncSession, auth_token: str):
        """累计 30 天记录解锁 record_30_days"""
        # 创建 30 天的记录，跨月处理
        from datetime import date, timedelta
        base = date(2026, 1, 1)
        for i in range(30):
            d = base + timedelta(days=i)
            media = Media(
                id="test-record30-" + str(i),
                user_id=auth_token,
                baby_id="test-baby",
                type=MediaType.image,
                cos_key="photos/rec30-" + str(i) + ".jpg",
                capture_date=d.isoformat(),
            )
            db_session.add(media)
        await db_session.flush()

        svc = AchievementService(db_session)
        new = await svc.check_and_award(auth_token, {})
        keys = [b["key"] for b in new]
        assert "record_30_days" in keys

    async def test_no_duplicate_award(self, db_session: AsyncSession, auth_token: str):
        """重复调用不会重复发放"""
        media = Media(
            id="test-dup-media",
            user_id=auth_token,
            baby_id="test-baby",
            type=MediaType.image,
            cos_key="photos/dup.jpg",
            capture_date="2026-06-15",
        )
        db_session.add(media)
        await db_session.flush()

        svc = AchievementService(db_session)
        first = await svc.check_and_award(auth_token, {})
        second = await svc.check_and_award(auth_token, {})
        assert len(first) >= 1
        assert len(second) == 0

    async def test_badge_definitions_count(self):
        """9 种徽章定义"""
        assert len(BADGE_DEFINITIONS) == 9


class TestAchievementAPI:
    """成就 API 端点测试"""

    async def test_get_achievements(self, client: AsyncClient, auth_headers: dict):
        """获取全部成就"""
        resp = await client.get("/api/v1/analytics/achievements", headers=auth_headers)
        assert resp.status_code == 200
        body = resp.json()
        assert body["code"] == 0
        assert len(body["data"]["badges"]) == 9

    async def test_check_achievements(self, client: AsyncClient, auth_headers: dict):
        """触发成就检测"""
        resp = await client.post("/api/v1/analytics/achievements/check", headers=auth_headers)
        assert resp.status_code == 200
        body = resp.json()
        assert body["code"] == 0
        assert "newBadges" in body["data"]
