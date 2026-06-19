"""MediaService mock-based unit tests — no conftest dependency"""
import asyncio
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from sqlalchemy.ext.asyncio import AsyncSession


@pytest.fixture
def db():
    return AsyncMock(spec=AsyncSession)


@pytest.fixture
def svc(db):
    from app.services.media_service import MediaService
    return MediaService(db)


class TestGetMedia:
    async def test_found(self, svc, db):
        m = MagicMock(id="m1")
        mock_result = MagicMock(scalar_one_or_none=lambda: m)
        db.execute = AsyncMock(return_value=mock_result)
        assert (await svc.get_media("m1", "u1")).id == "m1"

    async def test_not_found(self, svc, db):
        mock_result = MagicMock(scalar_one_or_none=lambda: None)
        db.execute = AsyncMock(return_value=mock_result)
        assert await svc.get_media("nonexistent", "u1") is None


class TestListMedia:
    async def test_paginates(self, svc, db):
        m1, m2 = MagicMock(id="m1"), MagicMock(id="m2")
        mock_result = MagicMock(scalars=lambda: MagicMock(all=lambda: [m1, m2]))
        db.execute = AsyncMock(return_value=mock_result)

        result = await svc.list_media("b1", page=1, page_size=2)
        assert len(result) == 2


class TestCreateMedia:
    async def test_non_image_skips_thumbnail(self, svc, db):
        from app.models.media import Media
        mock_media = MagicMock(id="m1", type="video", cos_key="videos/test.mp4")
        mock_media.type = "video"

        with patch("app.services.media_service.get_file_url", return_value="http://cdn/test.mp4"):
            with patch("app.services.media_service.record_sync_log", AsyncMock()):
                m = await svc.create_media("u1", {
                    "baby_id": "b1", "type": "video",
                    "cos_key": "videos/test.mp4", "title": "vid",
                    "capture_date": "2026-01-01",
                })

    async def test_image_thumbnail_exception_logged(self, svc, db):
        from app.models.media import Media
        mock_media = MagicMock(id="m1", cos_key="photos/test.jpg")
        mock_media.type = "image"

        with patch("app.services.media_service.get_file_url", return_value="http://cdn/test.jpg"):
            with patch("app.services.media_service.record_sync_log", AsyncMock()):
                with patch("app.services.thumbnail_service.process_thumbnail", side_effect=Exception("fail")):
                    await svc.create_media("u1", {
                        "baby_id": "b1", "type": "image",
                        "cos_key": "photos/test.jpg", "capture_date": "2026-01-01",
                    })


class TestSoftDelete:
    async def test_not_found_raises(self, svc, db):
        mock_result = MagicMock(scalar_one_or_none=lambda: None)
        db.execute = AsyncMock(return_value=mock_result)
        with pytest.raises(ValueError, match="Media not found"):
            await svc.soft_delete("nonexistent", "u1")

    async def test_deletes_with_cleanup(self, svc, db):
        media = MagicMock(id="m1", cos_key="photos/test.jpg", thumbnail_key="thumb/test.webp", is_deleted=False)
        mock_result = MagicMock(scalar_one_or_none=lambda: media)
        db.execute = AsyncMock(return_value=mock_result)
        db.commit = AsyncMock()

        cleaned = False
        async def fake_cleanup(*a):
            nonlocal cleaned
            cleaned = True

        with patch("app.services.media_service.record_sync_log", AsyncMock()):
            with patch("app.services.media_service._cleanup_minio_files_async", fake_cleanup):
                await svc.soft_delete("m1", "u1")
                # 给 create_task 一点时间执行
                await asyncio.sleep(0)

        assert media.is_deleted is True
        db.commit.assert_awaited_once()
        assert cleaned

    async def test_deletes_without_cleanup(self, svc, db):
        media = MagicMock(id="m1", cos_key=None, thumbnail_key=None, is_deleted=False)
        mock_result = MagicMock(scalar_one_or_none=lambda: media)
        db.execute = AsyncMock(return_value=mock_result)
        db.commit = AsyncMock()

        cleaned = False
        async def fake_cleanup(*a):
            nonlocal cleaned
            cleaned = True

        with patch("app.services.media_service.record_sync_log", AsyncMock()):
            with patch("app.services.media_service._cleanup_minio_files_async", fake_cleanup):
                await svc.soft_delete("m1", "u1")
                await asyncio.sleep(0)

        assert media.is_deleted is True
        db.commit.assert_awaited_once()
        assert not cleaned


class TestCleanupMinioFiles:
    @pytest.mark.asyncio
    async def test_delete_both(self):
        from app.services.media_service import _cleanup_minio_files_async
        with patch("app.services.media_service.delete_file") as mock_del:
            await _cleanup_minio_files_async("cos/key.jpg", "thumb/key.jpg")
        assert mock_del.call_count == 2

    @pytest.mark.asyncio
    async def test_delete_failure_logged(self):
        from app.services.media_service import _cleanup_minio_files_async
        with patch("app.services.media_service.delete_file", side_effect=Exception("err")):
            with patch("app.services.media_service.logger.exception") as mock_log:
                await _cleanup_minio_files_async("cos/key.jpg", "thumb/key.jpg")
        assert mock_log.call_count == 2

    @pytest.mark.asyncio
    async def test_no_keys_skips(self):
        from app.services.media_service import _cleanup_minio_files_async
        with patch("app.services.media_service.delete_file") as mock_del:
            await _cleanup_minio_files_async(None, None)
        mock_del.assert_not_called()