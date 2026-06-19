"""ExportService mock-based unit tests — no conftest dependency"""
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from sqlalchemy.ext.asyncio import AsyncSession


@pytest.fixture
def db():
    return AsyncMock(spec=AsyncSession)


class TestExportJson:
    async def test_with_baby_and_media(self, db):
        from app.services.export_service import ExportService
        svc = ExportService(db)

        baby = MagicMock()
        baby.configure_mock(id="b1", gender="male", birth_date="2026-01-01")
        baby.name = "test"
        m_type = MagicMock()
        m_type.value = "image"
        media = MagicMock(id="m1", type=m_type, title="photo", cos_url="url",
                          capture_date="2026-01-15", file_size=100, width=200, height=300,
                          location_name="home", tags=["tag1"], moment="happy", milestone="born",
                          is_archived=False)

        mock_baby_result = MagicMock(scalars=lambda: MagicMock(all=lambda: [baby]))
        mock_media_result = MagicMock(scalars=lambda: MagicMock(all=lambda: [media]))
        db.execute = AsyncMock(side_effect=[mock_baby_result, mock_media_result])

        result = await svc.export_json("u1")
        assert len(result["babies"]) == 1
        assert result["babies"][0]["name"] == "test"

    async def test_empty(self, db):
        from app.services.export_service import ExportService
        svc = ExportService(db)

        mock_empty = MagicMock(scalars=lambda: MagicMock(all=lambda: []))
        db.execute = AsyncMock(return_value=mock_empty)

        result = await svc.export_json("u1")
        assert result["babies"] == []
        assert result["media"] == []


class TestGetReport:
    async def test_empty(self, db):
        from app.services.export_service import ExportService
        svc = ExportService(db)

        mock_empty = MagicMock(scalars=lambda: MagicMock(all=lambda: []))
        db.execute = AsyncMock(return_value=mock_empty)

        result = await svc.get_report("u1")
        assert result["totalMedia"] == 0
        assert result["totalImages"] == 0
        assert result["totalVideos"] == 0

    async def test_with_filters(self, db):
        from app.services.export_service import ExportService
        svc = ExportService(db)

        media = MagicMock(id="m1", capture_date="2026-06-01",
                          baby_id="b1")
        media.type = MagicMock(value="image")
        mock_result = MagicMock(scalars=lambda: MagicMock(all=lambda: [media]))
        db.execute = AsyncMock(return_value=mock_result)

        result = await svc.get_report("u1", start="2026-01-01", end="2026-12-31")
        assert result["totalMedia"] == 1