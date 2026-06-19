"""BabyService mock-based unit tests — no conftest dependency"""
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from sqlalchemy.ext.asyncio import AsyncSession


@pytest.fixture
def db():
    return AsyncMock(spec=AsyncSession)


@pytest.fixture
def svc(db):
    from app.services.baby_service import BabyService
    return BabyService(db)


class TestGetBabyStats:
    async def test_returns_counts(self, svc, db):
        mock_row = MagicMock(photos=5, videos=3)
        r1 = MagicMock(one_or_none=lambda: mock_row)
        r2 = MagicMock(scalar=lambda: 10)
        db.execute = AsyncMock(side_effect=[r1, r2])

        got = await svc.get_baby_stats("b1", "u1")
        assert got == {"photoCount": 5, "videoCount": 3, "recordDays": 10}

    async def test_no_data_returns_zeros(self, svc, db):
        r1 = MagicMock(one_or_none=lambda: None)
        r2 = MagicMock(scalar=lambda: 0)
        db.execute = AsyncMock(side_effect=[r1, r2])

        got = await svc.get_baby_stats("b1", "u1")
        assert got == {"photoCount": 0, "videoCount": 0, "recordDays": 0}


class TestGetBabiesStats:
    async def test_batch_query(self, svc, db):
        r1 = MagicMock()
        r1.baby_id = "b1"
        r1.photos = 10
        r1.videos = 2
        r1.record_days = 8
        r2 = MagicMock()
        r2.baby_id = "b2"
        r2.photos = 3
        r2.videos = 1
        r2.record_days = 4

        mock_result = MagicMock(all=lambda: [r1, r2])
        db.execute = AsyncMock(return_value=mock_result)

        got = await svc.get_babies_stats(["b1", "b2"], "u1")
        assert got["b1"]["photoCount"] == 10
        assert got["b2"]["videoCount"] == 1

    async def test_empty_ids_returns_empty(self, svc, db):
        got = await svc.get_babies_stats([], "u1")
        assert got == {}

    async def test_missing_baby_in_results(self, svc, db):
        r1 = MagicMock(baby_id="b1", photos=5, videos=1, record_days=3)
        mock_result = MagicMock(all=lambda: [r1])
        db.execute = AsyncMock(return_value=mock_result)

        got = await svc.get_babies_stats(["b1", "b_no_media"], "u1")
        assert got["b1"]["photoCount"] == 5
        assert got["b_no_media"]["photoCount"] == 0


class TestCreateBaby:
    async def test_creates_and_returns(self, svc, db):
        from app.models.baby import Baby
        from app.schemas.baby import BabyCreate

        with patch("app.services.baby_service.Baby", return_value=MagicMock(id="new-id", name="test", gender="male", birth_date="2026-01-01")):
            with patch("app.services.baby_service.record_sync_log", AsyncMock()):
                data = BabyCreate(name="test", gender="male", birthDate="2026-01-01")
                baby = await svc.create_baby("u1", data)

        assert baby.id == "new-id"


class TestListBabies:
    async def test_returns_list(self, svc, db):
        baby = MagicMock(id="b1", name="test", gender="male")
        mock_result = MagicMock(scalars=lambda: MagicMock(all=lambda: [baby]))
        db.execute = AsyncMock(return_value=mock_result)

        result = await svc.list_babies("u1")
        assert len(result) == 1
        assert result[0].id == "b1"

    async def test_empty(self, svc, db):
        mock_result = MagicMock(scalars=lambda: MagicMock(all=lambda: []))
        db.execute = AsyncMock(return_value=mock_result)

        result = await svc.list_babies("u1")
        assert result == []


class TestGetBaby:
    async def test_found(self, svc, db):
        baby = MagicMock(id="b1", name="test")
        mock_result = MagicMock(scalar_one_or_none=lambda: baby)
        db.execute = AsyncMock(return_value=mock_result)

        result = await svc.get_baby("b1", "u1")
        assert result.id == "b1"

    async def test_not_found(self, svc, db):
        mock_result = MagicMock(scalar_one_or_none=lambda: None)
        db.execute = AsyncMock(return_value=mock_result)

        result = await svc.get_baby("nonexistent", "u1")
        assert result is None


class TestUpdateBaby:
    async def test_not_found_raises(self, svc, db):
        mock_result = MagicMock(scalar_one_or_none=lambda: None)
        db.execute = AsyncMock(return_value=mock_result)

        from app.schemas.baby import BabyUpdate
        with pytest.raises(ValueError, match="Baby not found"):
            await svc.update_baby("nonexistent", "u1", BabyUpdate(name="x"))

    async def test_updates_fields_and_commits(self, svc, db):
        from app.schemas.baby import BabyUpdate
        baby = MagicMock(id="b1", name="old", gender="male", birth_date="2026-01-01")
        mock_result = MagicMock(scalar_one_or_none=lambda: baby)
        db.execute = AsyncMock(return_value=mock_result)
        db.commit = AsyncMock()
        db.refresh = AsyncMock()

        with patch("app.services.baby_service.record_sync_log", AsyncMock()):
            result = await svc.update_baby("b1", "u1", BabyUpdate(name="new_name"))

        assert baby.name == "new_name"
        db.commit.assert_awaited_once()


class TestDeleteBaby:
    async def test_not_found_raises(self, svc, db):
        mock_result = MagicMock(scalar_one_or_none=lambda: None)
        db.execute = AsyncMock(return_value=mock_result)

        with pytest.raises(ValueError, match="Baby not found"):
            await svc.delete_baby("nonexistent", "u1")

    async def test_soft_deletes(self, svc, db):
        baby = MagicMock(id="b1", is_deleted=False)
        mock_result = MagicMock(scalar_one_or_none=lambda: baby)
        db.execute = AsyncMock(return_value=mock_result)
        db.commit = AsyncMock()

        with patch("app.services.baby_service.record_sync_log", AsyncMock()):
            await svc.delete_baby("b1", "u1")

        assert baby.is_deleted is True
        db.commit.assert_awaited_once()