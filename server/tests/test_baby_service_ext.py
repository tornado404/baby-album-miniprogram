"""Mock-based tests for BabyService (covers lines 19, 93-99, 105-107)"""
import pytest
from unittest.mock import AsyncMock, MagicMock
from sqlalchemy.ext.asyncio import AsyncSession


@pytest.fixture
def db():
    return AsyncMock(spec=AsyncSession)


@pytest.fixture
def svc(db):
    from app.services.baby_service import BabyService
    return BabyService(db)


class TestBabyServiceExt:
    """BabyService 补充覆盖"""

    async def test_list_babies(self, svc, db):
        """list_babies 返回 scalars"""
        m = MagicMock()
        m.scalars.return_value.all.return_value = ["b1"]
        db.execute.return_value = m
        result = await svc.list_babies("u1")
        assert result == ["b1"]

    async def test_update_baby_success(self, svc, db):
        """update_baby 成功路径"""
        from app.schemas.baby import BabyUpdate
        baby = MagicMock()
        baby.name = "old"
        m = MagicMock()
        m.scalar_one_or_none.return_value = baby
        db.execute.return_value = m

        result = await svc.update_baby("b1", "u1", BabyUpdate(name="new"))
        assert result.name == "new"
        db.commit.assert_called_once()
        db.refresh.assert_called_once()

    async def test_delete_baby_success(self, svc, db):
        """delete_baby 成功路径"""
        baby = MagicMock()
        baby.is_deleted = False
        m = MagicMock()
        m.scalar_one_or_none.return_value = baby
        db.execute.return_value = m

        await svc.delete_baby("b1", "u1")
        assert baby.is_deleted is True
        db.commit.assert_called_once()

    async def test_get_baby_stats_none(self, svc, db):
        """get_baby_stats 空数据"""
        m = MagicMock()
        m.one_or_none.return_value = None
        m.scalar.return_value = 0
        db.execute.return_value = m

        result = await svc.get_baby_stats("b1", "u1")
        assert result == {"photoCount": 0, "videoCount": 0, "recordDays": 0}

    async def test_get_babies_stats_empty(self, svc, db):
        """get_babies_stats 空列表"""
        result = await svc.get_babies_stats([], "u1")
        assert result == {}

    async def test_get_babies_stats_some_missing(self, svc, db):
        """get_babies_stats 部分宝宝无数据"""
        m = MagicMock()
        row = MagicMock()
        row.baby_id = "b1"
        row.photos = 3
        row.videos = 2
        row.record_days = 5
        m.all.return_value = [row]
        db.execute.return_value = m

        result = await svc.get_babies_stats(["b1", "b2"], "u1")
        assert result["b1"]["photoCount"] == 3
        assert result["b2"]["photoCount"] == 0