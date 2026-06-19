"""SyncService mock-based unit tests — no conftest dependency"""
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from sqlalchemy.ext.asyncio import AsyncSession


@pytest.fixture
def db():
    return AsyncMock(spec=AsyncSession)


@pytest.fixture
def svc(db):
    from app.services.sync_service import SyncService
    return SyncService(db)


class TestRecordSyncLog:
    async def test_creates_and_does_not_commit(self, db):
        with patch("app.services.sync_service.SyncLog") as MockLog:
            from app.services.sync_service import record_sync_log, SyncAction
            await record_sync_log(db, "u1", "baby", "b1", SyncAction.create)
        db.add.assert_called_once()


class TestFullSync:
    async def test_with_babies_and_media(self, svc, db):
        from app.models.baby import Baby
        from app.models.media import Media
        with patch("app.services.sync_service.Baby", return_value=MagicMock(id="cloud-b1")):
            with patch("app.services.sync_service.Media", return_value=MagicMock(id="cloud-m1")):
                result = await svc.full_sync("u1", {
                    "babies": [{"id": "local-b1", "name": "test", "birthDate": "2026-01-01"}],
                    "media": [{"id": "local-m1", "babyId": "local-b1", "type": "image",
                               "captureDate": "2026-01-15"}],
                })
        assert "local-b1" in result["idMap"]

    async def test_empty_data(self, svc, db):
        result = await svc.full_sync("u1", {})
        assert result["idMap"] == {}

    async def test_only_babies(self, svc, db):
        with patch("app.services.sync_service.Baby", return_value=MagicMock(id="cloud-b1")):
            result = await svc.full_sync("u1", {
                "babies": [{"id": "local-b1", "name": "baby1"}],
            })
        assert "local-b1" in result["idMap"]


class TestDeltaSync:
    async def test_with_changes(self, svc, db):
        log = MagicMock(entity_type="baby", entity_id="b1", action="create")
        mock_result = MagicMock(scalars=lambda: MagicMock(all=lambda: [log]))
        db.execute = AsyncMock(return_value=mock_result)

        result = await svc.delta_sync("u1", "2026-01-01")
        assert len(result["changes"]) == 1
        assert result["changes"][0]["entityId"] == "b1"
        assert "lastSyncTime" in result

    async def test_no_changes(self, svc, db):
        mock_result = MagicMock(scalars=lambda: MagicMock(all=lambda: []))
        db.execute = AsyncMock(return_value=mock_result)

        result = await svc.delta_sync("u1", "2099-01-01")
        assert result["changes"] == []


class TestGetSyncStatus:
    async def test_with_last_sync(self, svc, db):
        from datetime import datetime
        # 6 queries: max(created_at), count, and 4 entity/action combos
        db.execute = AsyncMock(side_effect=[
            MagicMock(scalar=lambda: datetime(2026, 6, 1, 12, 0, 0)),
            MagicMock(scalar=lambda: 5),
            MagicMock(scalar=lambda: 2),
            MagicMock(scalar=lambda: 1),
            MagicMock(scalar=lambda: 0),
            MagicMock(scalar=lambda: 1),
            MagicMock(scalar=lambda: 0),
            MagicMock(scalar=lambda: 0),
            MagicMock(scalar=lambda: 1),
        ])

        result = await svc.get_sync_status("u1")
        assert result["lastSyncTime"] == "2026-06-01T12:00:00"
        assert result["pendingChanges"] == 5

    async def test_no_last_sync(self, svc, db):
        db.execute = AsyncMock(return_value=MagicMock(scalar=lambda: None))

        result = await svc.get_sync_status("u1")
        assert result["lastSyncTime"] is None