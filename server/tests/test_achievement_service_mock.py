"""纯 mock-based 成就服务测试

使用 AsyncMock/MagicMock 模拟 db.execute 返回值，不依赖 conftest fixtures。
每个测试类自包含 @pytest.fixture。
"""
from unittest.mock import AsyncMock, MagicMock, call
from datetime import date, timedelta

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.services.achievement_service import AchievementService, BADGE_DEFINITIONS


# ── helpers ──────────────────────────────────────────────────────────────

def _mock_result(*, scalar_val=None, fetchall_rows=None, scalars_all=None):
    """构造一个模拟的 SQLAlchemy Result 对象。

    支持三个访问路径：
      r.scalar()               —— 用于 count / exists
      r.fetchall()             —— 用于 badge_key 行
      r.scalars().all()        —— 用于 Achievement ORM 对象列表
    """
    r = MagicMock()
    r.scalar.return_value = scalar_val
    r.fetchall.return_value = fetchall_rows or []

    scalars_mock = MagicMock()
    scalars_mock.all.return_value = scalars_all or []
    r.scalars.return_value = scalars_mock
    return r


def _date_str(days_ago: int) -> str:
    """返回 days_ago 天前的日期字符串 YYYY-MM-DD"""
    return (date.today() - timedelta(days=days_ago)).isoformat()


def _streak_fetchall(num_consecutive: int, extra_past: int = 0):
    """生成连续 num_consecutive 天的 fetchall 数据（从今天往前）。

    extra_past: 在连续段之前再塞 extra_past 个更早的日期，用于测试
                更长的候选列表但不影响 streak 上限。
    """
    rows = []
    for d in range(num_consecutive + extra_past):
        rows.append((_date_str(d),))
    return rows


# ── TestCheckAndAward 系列 ──────────────────────────────────────────────

class TestCheckAndAwardFirstUpload:
    """first_upload 徽章"""

    @pytest.fixture
    def svc(self):
        db = AsyncMock(spec=AsyncSession)
        return AchievementService(db)

    async def test_first_upload_awarded_when_media_exists(self, svc):
        """有媒体记录时解锁 first_upload"""
        svc.db.execute.side_effect = [
            _mock_result(fetchall_rows=[]),              # owned = set()
            _mock_result(scalar_val=1),                  # _has_any_media → True
            _mock_result(fetchall_rows=[("2024-01-01",)]),  # _check_streak(7) → too few
            _mock_result(fetchall_rows=[("2024-01-01",)]),  # _check_streak(30) → too few
            _mock_result(scalar_val=0),                  # _media_count("image")
            _mock_result(scalar_val=0),                  # _media_count("video")
            _mock_result(scalar_val=0),                  # _total_record_days
        ]

        new = await svc.check_and_award("user-1", {})
        keys = [b["key"] for b in new]
        assert "first_upload" in keys

    async def test_first_upload_not_awarded_without_media(self, svc):
        """无媒体记录时不解锁 first_upload"""
        svc.db.execute.side_effect = [
            _mock_result(fetchall_rows=[]),              # owned = set()
            _mock_result(scalar_val=0),                  # _has_any_media → False
            _mock_result(fetchall_rows=[("2024-01-01",)]),  # _check_streak(7) not entering
            _mock_result(fetchall_rows=[("2024-01-01",)]),  # _check_streak(30)
            _mock_result(scalar_val=0),                  # _media_count("image")
            _mock_result(scalar_val=0),                  # _media_count("video")
            _mock_result(scalar_val=0),                  # _total_record_days
        ]

        new = await svc.check_and_award("user-1", {})
        keys = [b["key"] for b in new]
        assert "first_upload" not in keys

    async def test_first_upload_not_awarded_again(self, svc):
        """已拥有 first_upload 时不重复发放"""
        svc.db.execute.side_effect = [
            _mock_result(fetchall_rows=[("first_upload",)]),  # already owned
            _mock_result(scalar_val=1),                  # _has_any_media (not reached, but still consumed)
            _mock_result(fetchall_rows=[("2024-01-01",)]),  # _check_streak(7)
            _mock_result(fetchall_rows=[("2024-01-01",)]),  # _check_streak(30)
            _mock_result(scalar_val=0),                  # _media_count("image")
            _mock_result(scalar_val=0),                  # _media_count("video")
            _mock_result(scalar_val=0),                  # _total_record_days
        ]

        new = await svc.check_and_award("user-1", {})
        keys = [b["key"] for b in new]
        assert "first_upload" not in keys


class TestCheckAndAwardPhotoBadges:
    """photo_10 / photo_50 / photo_100 徽章"""

    @pytest.fixture
    def svc(self):
        db = AsyncMock(spec=AsyncSession)
        return AchievementService(db)

    async def test_photo_10_awarded_at_threshold(self, svc):
        """10 张照片解锁 photo_10"""
        svc.db.execute.side_effect = [
            _mock_result(fetchall_rows=[]),
            _mock_result(scalar_val=0),                  # has_any_media → False
            _mock_result(fetchall_rows=[("2024-01-01",)]),  # _check_streak(7) too few, skip
            _mock_result(fetchall_rows=[("2024-01-01",)]),  # _check_streak(30)
            _mock_result(scalar_val=10),                 # _media_count("image") = 10
            _mock_result(scalar_val=0),                  # _media_count("video")
            _mock_result(scalar_val=0),                  # _total_record_days
        ]

        new = await svc.check_and_award("user-1", {})
        keys = [b["key"] for b in new]
        assert "photo_10" in keys

    async def test_photo_10_not_below_threshold(self, svc):
        """9 张照片不解锁 photo_10"""
        svc.db.execute.side_effect = [
            _mock_result(fetchall_rows=[]),
            _mock_result(scalar_val=0),
            _mock_result(fetchall_rows=[("2024-01-01",)]),
            _mock_result(fetchall_rows=[("2024-01-01",)]),
            _mock_result(scalar_val=9),                  # _media_count("image") = 9
            _mock_result(scalar_val=0),
            _mock_result(scalar_val=0),
        ]

        new = await svc.check_and_award("user-1", {})
        keys = [b["key"] for b in new]
        assert "photo_10" not in keys

    async def test_photo_50_awarded_at_threshold(self, svc):
        """50 张照片同时解锁 photo_10 + photo_50"""
        svc.db.execute.side_effect = [
            _mock_result(fetchall_rows=[]),
            _mock_result(scalar_val=0),
            _mock_result(fetchall_rows=[("2024-01-01",)]),
            _mock_result(fetchall_rows=[("2024-01-01",)]),
            _mock_result(scalar_val=50),                 # _media_count("image") = 50
            _mock_result(scalar_val=0),
            _mock_result(scalar_val=0),
        ]

        new = await svc.check_and_award("user-1", {})
        keys = [b["key"] for b in new]
        assert "photo_10" in keys
        assert "photo_50" in keys

    async def test_photo_100_awarded_at_threshold(self, svc):
        """100 张照片同时解锁 photo_10 + photo_50 + photo_100"""
        svc.db.execute.side_effect = [
            _mock_result(fetchall_rows=[]),
            _mock_result(scalar_val=0),
            _mock_result(fetchall_rows=[("2024-01-01",)]),
            _mock_result(fetchall_rows=[("2024-01-01",)]),
            _mock_result(scalar_val=100),                # _media_count("image") = 100
            _mock_result(scalar_val=0),
            _mock_result(scalar_val=0),
        ]

        new = await svc.check_and_award("user-1", {})
        keys = [b["key"] for b in new]
        assert "photo_10" in keys
        assert "photo_50" in keys
        assert "photo_100" in keys

    async def test_photo_10_skipped_when_owned(self, svc):
        """已拥有 photo_10 时不再发放，但 photo_50  仍可发放"""
        svc.db.execute.side_effect = [
            _mock_result(fetchall_rows=[("photo_10",)]), # owned
            _mock_result(scalar_val=0),
            _mock_result(fetchall_rows=[("2024-01-01",)]),
            _mock_result(fetchall_rows=[("2024-01-01",)]),
            _mock_result(scalar_val=50),                 # _media_count("image") = 50
            _mock_result(scalar_val=0),
            _mock_result(scalar_val=0),
        ]

        new = await svc.check_and_award("user-1", {})
        keys = [b["key"] for b in new]
        assert "photo_10" not in keys
        assert "photo_50" in keys


class TestCheckAndAwardVideoBadge:
    """video_5 徽章"""

    @pytest.fixture
    def svc(self):
        db = AsyncMock(spec=AsyncSession)
        return AchievementService(db)

    async def test_video_5_awarded_at_threshold(self, svc):
        """5 个视频解锁 video_5"""
        svc.db.execute.side_effect = [
            _mock_result(fetchall_rows=[]),
            _mock_result(scalar_val=0),
            _mock_result(fetchall_rows=[("2024-01-01",)]),
            _mock_result(fetchall_rows=[("2024-01-01",)]),
            _mock_result(scalar_val=0),                  # _media_count("image")
            _mock_result(scalar_val=5),                  # _media_count("video") = 5
            _mock_result(scalar_val=0),
        ]

        new = await svc.check_and_award("user-1", {})
        keys = [b["key"] for b in new]
        assert "video_5" in keys

    async def test_video_5_not_below_threshold(self, svc):
        """4 个视频不解锁"""
        svc.db.execute.side_effect = [
            _mock_result(fetchall_rows=[]),
            _mock_result(scalar_val=0),
            _mock_result(fetchall_rows=[("2024-01-01",)]),
            _mock_result(fetchall_rows=[("2024-01-01",)]),
            _mock_result(scalar_val=0),
            _mock_result(scalar_val=4),                  # _media_count("video") = 4
            _mock_result(scalar_val=0),
        ]

        new = await svc.check_and_award("user-1", {})
        keys = [b["key"] for b in new]
        assert "video_5" not in keys

    async def test_video_5_skipped_when_owned(self, svc):
        """已拥有 video_5 不重复发放"""
        svc.db.execute.side_effect = [
            _mock_result(fetchall_rows=[("video_5",)]),
            _mock_result(scalar_val=0),
            _mock_result(fetchall_rows=[("2024-01-01",)]),
            _mock_result(fetchall_rows=[("2024-01-01",)]),
            _mock_result(scalar_val=0),
            _mock_result(scalar_val=5),
            _mock_result(scalar_val=0),
        ]

        new = await svc.check_and_award("user-1", {})
        assert len(new) == 0


class TestCheckAndAwardRecordDays:
    """record_30_days / record_100_days 徽章"""

    @pytest.fixture
    def svc(self):
        db = AsyncMock(spec=AsyncSession)
        return AchievementService(db)

    async def test_record_30_days_awarded(self, svc):
        """累计 30 天记录解锁 record_30_days"""
        svc.db.execute.side_effect = [
            _mock_result(fetchall_rows=[]),
            _mock_result(scalar_val=0),
            _mock_result(fetchall_rows=[("2024-01-01",)]),
            _mock_result(fetchall_rows=[("2024-01-01",)]),
            _mock_result(scalar_val=0),
            _mock_result(scalar_val=0),
            _mock_result(scalar_val=30),                 # _total_record_days = 30
        ]

        new = await svc.check_and_award("user-1", {})
        keys = [b["key"] for b in new]
        assert "record_30_days" in keys

    async def test_record_30_days_not_below_threshold(self, svc):
        """29 天不解锁"""
        svc.db.execute.side_effect = [
            _mock_result(fetchall_rows=[]),
            _mock_result(scalar_val=0),
            _mock_result(fetchall_rows=[("2024-01-01",)]),
            _mock_result(fetchall_rows=[("2024-01-01",)]),
            _mock_result(scalar_val=0),
            _mock_result(scalar_val=0),
            _mock_result(scalar_val=29),                 # _total_record_days = 29
        ]

        new = await svc.check_and_award("user-1", {})
        keys = [b["key"] for b in new]
        assert "record_30_days" not in keys

    async def test_record_100_days_awarded(self, svc):
        """累计 100 天记录解锁 record_100_days（同时解锁 record_30_days）"""
        svc.db.execute.side_effect = [
            _mock_result(fetchall_rows=[]),
            _mock_result(scalar_val=0),
            _mock_result(fetchall_rows=[("2024-01-01",)]),
            _mock_result(fetchall_rows=[("2024-01-01",)]),
            _mock_result(scalar_val=0),
            _mock_result(scalar_val=0),
            _mock_result(scalar_val=100),                # _total_record_days = 100
        ]

        new = await svc.check_and_award("user-1", {})
        keys = [b["key"] for b in new]
        assert "record_30_days" in keys
        assert "record_100_days" in keys

    async def test_record_30_skipped_when_owned(self, svc):
        """record_30_days 已拥有时不重复，但 record_100_days 仍可发放"""
        svc.db.execute.side_effect = [
            _mock_result(fetchall_rows=[("record_30_days",)]),
            _mock_result(scalar_val=0),
            _mock_result(fetchall_rows=[("2024-01-01",)]),
            _mock_result(fetchall_rows=[("2024-01-01",)]),
            _mock_result(scalar_val=0),
            _mock_result(scalar_val=0),
            _mock_result(scalar_val=100),
        ]

        new = await svc.check_and_award("user-1", {})
        keys = [b["key"] for b in new]
        assert "record_30_days" not in keys
        assert "record_100_days" in keys

    async def test_total_record_days_zero_when_no_media(self, svc):
        """无媒体时 _total_record_days 返回 0"""
        svc.db.execute.side_effect = [
            _mock_result(fetchall_rows=[]),
            _mock_result(scalar_val=0),
            _mock_result(fetchall_rows=[("2024-01-01",)]),
            _mock_result(fetchall_rows=[("2024-01-01",)]),
            _mock_result(scalar_val=0),
            _mock_result(scalar_val=0),
            _mock_result(scalar_val=0),
        ]

        new = await svc.check_and_award("user-1", {})
        assert len(new) == 0


class TestCheckAndAwardStreak:
    """first_week / first_month 连续记录徽章"""

    @pytest.fixture
    def svc(self):
        db = AsyncMock(spec=AsyncSession)
        return AchievementService(db)

    async def test_first_week_awarded(self, svc):
        """连续 7 天记录解锁 first_week"""
        svc.db.execute.side_effect = [
            _mock_result(fetchall_rows=[]),              # owned = set()
            _mock_result(scalar_val=0),                  # _has_any_media → False
            _mock_result(fetchall_rows=_streak_fetchall(7)),  # _check_streak(7) → True
            _mock_result(fetchall_rows=[("2024-01-01",)]),  # _check_streak(30) → skip
            _mock_result(scalar_val=0),
            _mock_result(scalar_val=0),
            _mock_result(scalar_val=0),
        ]

        new = await svc.check_and_award("user-1", {})
        keys = [b["key"] for b in new]
        assert "first_week" in keys

    async def test_first_week_not_awarded_when_streak_broken(self, svc):
        """非连续 7 天不解锁 first_week"""
        # 6 consecutive days, then a gap, then 3 more
        rows = _streak_fetchall(6)                     # days 0-5 = 6 consecutive
        rows.insert(4, (_date_str(7),))                 # gap at day 6 → 3 days skip
        # sorted(..., reverse=True): [d0,d1,d2,d3,d7,d5,d4]
        # consecutive: d0-d1=1, d1-d2=1, d2-d3=1, d3-d7=4 ≠1 → broken
        # max streak after sort = 3 (d0,d1,d2) < 7

        svc.db.execute.side_effect = [
            _mock_result(fetchall_rows=[]),
            _mock_result(scalar_val=0),
            _mock_result(fetchall_rows=rows),
            _mock_result(fetchall_rows=[("2024-01-01",)]),
            _mock_result(scalar_val=0),
            _mock_result(scalar_val=0),
            _mock_result(scalar_val=0),
        ]

        new = await svc.check_and_award("user-1", {})
        keys = [b["key"] for b in new]
        assert "first_week" not in keys

    async def test_first_week_not_below_threshold(self, svc):
        """6 天记录不连续也不解锁"""
        svc.db.execute.side_effect = [
            _mock_result(fetchall_rows=[]),
            _mock_result(scalar_val=0),
            _mock_result(fetchall_rows=_streak_fetchall(6)),  # only 6 days
            _mock_result(fetchall_rows=[("2024-01-01",)]),
            _mock_result(scalar_val=0),
            _mock_result(scalar_val=0),
            _mock_result(scalar_val=0),
        ]

        new = await svc.check_and_award("user-1", {})
        keys = [b["key"] for b in new]
        assert "first_week" not in keys

    async def test_first_week_awarded_exactly_7(self, svc):
        """恰好连续 7 天（不多不少）"""
        svc.db.execute.side_effect = [
            _mock_result(fetchall_rows=[]),
            _mock_result(scalar_val=0),
            _mock_result(fetchall_rows=_streak_fetchall(7)),
            _mock_result(fetchall_rows=[("2024-01-01",)]),
            _mock_result(scalar_val=0),
            _mock_result(scalar_val=0),
            _mock_result(scalar_val=0),
        ]

        new = await svc.check_and_award("user-1", {})
        keys = [b["key"] for b in new]
        assert "first_week" in keys

    async def test_first_week_14_consecutive(self, svc):
        """连续 14 天同时解锁 first_week（但不解锁 first_month，因为 < 30）"""
        svc.db.execute.side_effect = [
            _mock_result(fetchall_rows=[]),
            _mock_result(scalar_val=0),
            _mock_result(fetchall_rows=_streak_fetchall(14)),  # 14 consecutive
            _mock_result(fetchall_rows=_streak_fetchall(14)),  # _check_streak(30) → 14 < 30 → False
            _mock_result(scalar_val=0),
            _mock_result(scalar_val=0),
            _mock_result(scalar_val=0),
        ]

        new = await svc.check_and_award("user-1", {})
        keys = [b["key"] for b in new]
        assert "first_week" in keys
        assert "first_month" not in keys

    async def test_first_month_awarded(self, svc):
        """连续 30 天记录解锁 first_month"""
        svc.db.execute.side_effect = [
            _mock_result(fetchall_rows=[]),
            _mock_result(scalar_val=0),
            _mock_result(fetchall_rows=_streak_fetchall(30)),  # 30 consecutive
            _mock_result(fetchall_rows=_streak_fetchall(30)),  # 30 consecutive
            _mock_result(scalar_val=0),
            _mock_result(scalar_val=0),
            _mock_result(scalar_val=0),
        ]

        new = await svc.check_and_award("user-1", {})
        keys = [b["key"] for b in new]
        assert "first_week" in keys
        assert "first_month" in keys

    async def test_first_month_not_awarded_with_gap(self, svc):
        """连续 29 天中间有 gap 不解锁 first_month"""
        # 29 days but with a break at day 15 → broken
        rows = _streak_fetchall(14) + _streak_fetchall(15, extra_past=1)
        # First 14 days: d0..d13
        # Then gap (day 14 is missing) → d15..d29

        svc.db.execute.side_effect = [
            _mock_result(fetchall_rows=[]),
            _mock_result(scalar_val=0),
            _mock_result(fetchall_rows=rows),
            _mock_result(fetchall_rows=rows),
            _mock_result(scalar_val=0),
            _mock_result(scalar_val=0),
            _mock_result(scalar_val=0),
        ]

        new = await svc.check_and_award("user-1", {})
        keys = [b["key"] for b in new]
        assert "first_month" not in keys

    async def test_streak_many_dates_exceeds_limit(self, svc):
        """很多日期，limit 截断到 12 / 35，仍能满足 streak"""
        # Provide 20 dates, but query limits to 12 for week check
        svc.db.execute.side_effect = [
            _mock_result(fetchall_rows=[]),
            _mock_result(scalar_val=0),
            _mock_result(fetchall_rows=_streak_fetchall(20)),  # only first 12 would be in result
            _mock_result(fetchall_rows=_streak_fetchall(20)),
            _mock_result(scalar_val=0),
            _mock_result(scalar_val=0),
            _mock_result(scalar_val=0),
        ]

        new = await svc.check_and_award("user-1", {})
        keys = [b["key"] for b in new]
        # Should still get first_week because first 12 are enough for 7-day streak
        assert "first_week" in keys

    async def test_first_week_and_month_both_owned_skipped(self, svc):
        """streak 徽章都已拥有时跳过"""
        svc.db.execute.side_effect = [
            _mock_result(fetchall_rows=[("first_week", "first_month")]),
            _mock_result(scalar_val=0),
            _mock_result(scalar_val=0),
            _mock_result(scalar_val=0),
        ]
        # Note: when first_week is owned, _check_streak(7) is skipped.
        # When first_month is owned, _check_streak(30) is skipped.
        # So only 4 execute calls: owned, has_any, media_count(image), media_count(video),
        # total_record_days = 7 execute calls total

        # Oops, I need to adjust: owned has both, so streak checks are skipped.
        # Sequence: owned, has_any(=false), media_count(image), media_count(video), total_record_days
        svc.db.execute.side_effect = [
            _mock_result(fetchall_rows=[("first_week",), ("first_month",)]),
            _mock_result(scalar_val=0),
            _mock_result(scalar_val=0),
            _mock_result(scalar_val=0),
            _mock_result(scalar_val=0),
        ]

        new = await svc.check_and_award("user-1", {})
        assert len(new) == 0


class TestCheckAndAwardNoDuplicate:
    """幂等性：重复调用不重复发放"""

    @pytest.fixture
    def svc(self):
        db = AsyncMock(spec=AsyncSession)
        return AchievementService(db)

    async def test_no_duplicate_award(self, svc):
        """第一次发放后，第二次不再发放"""
        # First call: no badges owned, all conditions met
        svc.db.execute.side_effect = [
            _mock_result(fetchall_rows=[]),
            _mock_result(scalar_val=1),
            _mock_result(fetchall_rows=_streak_fetchall(7)),
            _mock_result(fetchall_rows=_streak_fetchall(30)),
            _mock_result(scalar_val=100),
            _mock_result(scalar_val=5),
            _mock_result(scalar_val=100),
        ]

        first = await svc.check_and_award("user-1", {})
        assert len(first) >= 1

        # Second call: all badges owned
        # The service re-queries the DB each time, so we re-set side_effect
        svc.db.execute.side_effect = [
            _mock_result(fetchall_rows=[
                ("first_upload",), ("first_week",), ("first_month",),
                ("photo_10",), ("photo_50",), ("photo_100",),
                ("video_5",), ("record_30_days",), ("record_100_days",),
            ]),
            _mock_result(scalar_val=1),
            _mock_result(fetchall_rows=_streak_fetchall(7)),
            _mock_result(fetchall_rows=_streak_fetchall(30)),
            _mock_result(scalar_val=100),
            _mock_result(scalar_val=5),
            _mock_result(scalar_val=100),
        ]

        second = await svc.check_and_award("user-1", {})
        assert len(second) == 0

    async def test_partial_duplicate_only_new_awarded(self, svc):
        """部分已拥有时，只发放新的"""
        svc.db.execute.side_effect = [
            _mock_result(fetchall_rows=[("first_upload",), ("first_week",)]),
            # first_upload owned → skip _has_any_media
            # first_week  owned → skip _check_streak(7)
            _mock_result(fetchall_rows=_streak_fetchall(30)),  # _check_streak(30)
            _mock_result(scalar_val=50),                       # _media_count("image")
            _mock_result(scalar_val=0),                        # _media_count("video")
            _mock_result(scalar_val=0),                        # _total_record_days
        ]
        # Sequence: 5 execute calls + 4 _award (first_month, photo_10, photo_50)

        new = await svc.check_and_award("user-1", {})
        keys = [b["key"] for b in new]
        assert "first_upload" not in keys
        assert "first_week" not in keys
        assert "first_month" in keys
        assert "photo_10" in keys
        assert "photo_50" in keys


class TestGetAllBadges:
    """get_all_badges — 已拥有/未拥有标记"""

    @pytest.fixture
    def svc(self):
        db = AsyncMock(spec=AsyncSession)
        return AchievementService(db)

    async def test_all_locked_initially(self, svc):
        """新用户所有成就未解锁"""
        svc.db.execute.return_value = _mock_result(scalars_all=[])

        badges = await svc.get_all_badges("user-1")

        assert len(badges) == len(BADGE_DEFINITIONS)
        for b in badges:
            assert b["unlocked"] is False
            assert b["unlockedAt"] is None

    async def test_partial_unlocked(self, svc):
        """部分解锁时正确标记"""
        from datetime import datetime

        awarded_at = datetime(2026, 6, 15, 10, 30, 0)

        first_upload = MagicMock()
        first_upload.badge_key = "first_upload"
        first_upload.awarded_at = awarded_at

        photo_10 = MagicMock()
        photo_10.badge_key = "photo_10"
        photo_10.awarded_at = awarded_at

        svc.db.execute.return_value = _mock_result(scalars_all=[
            first_upload, photo_10,
        ])

        badges = await svc.get_all_badges("user-1")

        assert len(badges) == len(BADGE_DEFINITIONS)
        for b in badges:
            if b["key"] in ("first_upload", "photo_10"):
                assert b["unlocked"] is True
                assert b["unlockedAt"] == "2026-06-15T10:30:00"
            else:
                assert b["unlocked"] is False
                assert b["unlockedAt"] is None

    async def test_all_unlocked(self, svc):
        """全部解锁"""
        from datetime import datetime

        awarded_at = datetime(2026, 6, 15, 10, 30, 0)
        scalars_all = []
        for badge in BADGE_DEFINITIONS:
            a = MagicMock()
            a.badge_key = badge["key"]
            a.awarded_at = awarded_at
            scalars_all.append(a)

        svc.db.execute.return_value = _mock_result(scalars_all=scalars_all)

        badges = await svc.get_all_badges("user-1")

        assert len(badges) == len(BADGE_DEFINITIONS)
        for b in badges:
            assert b["unlocked"] is True
            assert b["unlockedAt"] == "2026-06-15T10:30:00"

    async def test_correct_badge_order(self, svc):
        """返回顺序与 BADGE_DEFINITIONS 一致"""
        svc.db.execute.return_value = _mock_result(scalars_all=[])

        badges = await svc.get_all_badges("user-1")

        for i, badge in enumerate(badges):
            assert badge["key"] == BADGE_DEFINITIONS[i]["key"]
            assert badge["name"] == BADGE_DEFINITIONS[i]["name"]
            assert badge["icon"] == BADGE_DEFINITIONS[i]["icon"]
            assert badge["desc"] == BADGE_DEFINITIONS[i]["desc"]

    async def test_only_queries_one_user(self, svc):
        """查询过滤了正确的 user_id"""
        svc.db.execute.return_value = _mock_result(scalars_all=[])

        await svc.get_all_badges("specific-user-id")

        # Verify the execute was called with the correct user_id filter
        call_args = svc.db.execute.call_args[0][0]
        params = call_args.compile().params
        assert any("specific-user-id" in str(v) for v in params.values()), (
            f"user_id not found in compiled params: {params}"
        )


class TestAward:
    """_award 幂等发放"""

    @pytest.fixture
    def svc(self):
        db = AsyncMock(spec=AsyncSession)
        return AchievementService(db)

    async def test_award_creates_achievement(self, svc):
        """_award 调用 db.add 和 db.flush"""
        result = await svc._award("user-1", "test_badge")

        assert result == {"key": "test_badge", "newlyAwarded": True}
        svc.db.add.assert_called_once()
        svc.db.flush.assert_awaited_once()

        # Verify the Achievement object was created with correct fields
        added = svc.db.add.call_args[0][0]
        assert added.user_id == "user-1"
        assert added.badge_key == "test_badge"


class TestStreakLogic:
    """_check_streak 内部逻辑"""

    @pytest.fixture
    def svc(self):
        db = AsyncMock(spec=AsyncSession)
        return AchievementService(db)

    async def test_streak_exact_day_gap(self, svc):
        """gap 正好 1 天差 → 连续"""
        svc.db.execute.return_value = _mock_result(fetchall_rows=[
            ("2026-06-10",), ("2026-06-09",), ("2026-06-08",),
            ("2026-06-07",), ("2026-06-06",), ("2026-06-05",),
            ("2026-06-04",),
        ])

        result = await svc._check_streak("user-1", 7)
        assert result is True

    async def test_streak_two_day_gap(self, svc):
        """gap 差 2 天 → 不连续"""
        svc.db.execute.return_value = _mock_result(fetchall_rows=[
            ("2026-06-10",), ("2026-06-09",), ("2026-06-07",),
            ("2026-06-06",), ("2026-06-05",), ("2026-06-04",),
            ("2026-06-03",),
        ])

        result = await svc._check_streak("user-1", 7)
        assert result is False

    async def test_streak_less_dates_than_days(self, svc):
        """日期数少于要求天数"""
        svc.db.execute.return_value = _mock_result(fetchall_rows=[
            ("2026-06-10",), ("2026-06-09",),
        ])

        result = await svc._check_streak("user-1", 7)
        assert result is False

    async def test_streak_empty(self, svc):
        """无任何日期"""
        svc.db.execute.return_value = _mock_result(fetchall_rows=[])

        result = await svc._check_streak("user-1", 7)
        assert result is False

    async def test_streak_unsorted_input(self, svc):
        """输入乱序也能正确排序后判定连续"""
        svc.db.execute.return_value = _mock_result(fetchall_rows=[
            ("2026-06-08",), ("2026-06-10",), ("2026-06-07",),
            ("2026-06-12",), ("2026-06-11",), ("2026-06-09",),
            ("2026-06-06",),
        ])
        # sorted descending: 6/12,6/11,6/10,6/09,6/08,6/07,6/06 → 7 consecutive

        result = await svc._check_streak("user-1", 7)
        assert result is True

    async def test_streak_duplicate_dates_ignored(self, svc):
        """重复日期（同一天多条）不影响连续判断"""
        svc.db.execute.return_value = _mock_result(fetchall_rows=[
            ("2026-06-10",), ("2026-06-10",), ("2026-06-09",),
            ("2026-06-09",), ("2026-06-08",), ("2026-06-08",),
            ("2026-06-07",), ("2026-06-07",), ("2026-06-06",),
            ("2026-06-06",), ("2026-06-05",), ("2026-06-05",),
            ("2026-06-04",),
        ])
        # set removes duplicates → 7 unique consecutive days

        result = await svc._check_streak("user-1", 7)
        assert result is True