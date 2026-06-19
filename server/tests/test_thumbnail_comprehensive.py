"""Thumbnail service + tasks mock-based tests — no conftest dependency"""
import pytest
from unittest.mock import AsyncMock, MagicMock, patch, PropertyMock
from io import BytesIO
from sqlalchemy.ext.asyncio import AsyncSession

# ── resize_image (pure function, no IO) ─────────────────────────────────

class TestResizeImage:
    def test_resizes_to_webp(self):
        from app.services.thumbnail_service import resize_image
        from PIL import Image

        img = Image.new("RGB", (800, 600), color=(255, 0, 0))
        buf = BytesIO()
        img.save(buf, format="PNG")
        data = buf.getvalue()

        result = resize_image(data, width=300, height=300)
        result_img = Image.open(BytesIO(result))
        assert result_img.format == "WEBP"
        assert result_img.width <= 300

    def test_rgba_converted(self):
        from app.services.thumbnail_service import resize_image
        from PIL import Image

        img = Image.new("RGBA", (100, 100), color=(255, 0, 0, 128))
        buf = BytesIO()
        img.save(buf, format="PNG")
        data = buf.getvalue()

        result = resize_image(data)
        result_img = Image.open(BytesIO(result))
        assert result_img.mode == "RGB"


# ── build_thumbnail_key / build_thumbnail_url ───────────────────────────

class TestBuildKey:
    def test_generates_key(self):
        from app.services.thumbnail_service import build_thumbnail_key
        key = build_thumbnail_key("user-1")
        assert key.startswith("thumbnails/user-1/")
        assert key.endswith(".webp")

    def test_builds_url(self):
        from app.services.thumbnail_service import build_thumbnail_url
        with patch("app.services.thumbnail_service.settings.MINIO_PUBLIC_URL", "http://minio:9000"):
            with patch("app.services.thumbnail_service.settings.MINIO_BUCKET", "baby-album"):
                url = build_thumbnail_url("thumbnails/u1/abc.webp")
        assert "http://minio:9000" in url


# ── process_thumbnail (async, needs mocks) ──────────────────────────────

class TestProcessThumbnail:
    @pytest.mark.asyncio
    async def test_success_path(self):
        from app.services.thumbnail_service import process_thumbnail
        from PIL import Image

        img = Image.new("RGB", (400, 300), color=(0, 255, 0))
        buf = BytesIO()
        img.save(buf, format="JPEG")
        img_data = buf.getvalue()

        mock_response = MagicMock()
        mock_response.read.return_value = img_data
        mock_response.close = MagicMock()
        mock_response.release_conn = MagicMock()

        mock_db = AsyncMock(spec=AsyncSession)
        mock_media = MagicMock(id="m1", thumbnail_key=None, thumbnail_url=None,
                               width=None, height=None, file_size=None)
        mock_execute_result = MagicMock(scalar_one_or_none=lambda: mock_media)
        mock_db.execute = AsyncMock(return_value=mock_execute_result)
        mock_db.commit = AsyncMock()

        with patch("app.services.thumbnail_service.minio_client") as mock_minio:
            mock_minio.get_object.return_value = mock_response
            with patch("app.services.thumbnail_service.settings") as mock_settings:
                mock_settings.MINIO_BUCKET = "baby-album"
                mock_settings.THUMBNAIL_WIDTH = 300
                mock_settings.THUMBNAIL_HEIGHT = 300
                mock_settings.THUMBNAIL_QUALITY = 80
                mock_settings.MINIO_PUBLIC_URL = "http://minio:9000"
                result = await process_thumbnail("m1", "photos/test.jpg", "u1", mock_db)

        assert result is not None
        assert "thumbnails/" in result

    @pytest.mark.asyncio
    async def test_minio_failure_returns_none(self):
        from app.services.thumbnail_service import process_thumbnail

        mock_db = AsyncMock(spec=AsyncSession)
        with patch("app.services.thumbnail_service.minio_client") as mock_minio:
            mock_minio.get_object.side_effect = Exception("MinIO down")
            result = await process_thumbnail("m1", "photos/test.jpg", "u1", mock_db)

        assert result is None


# ── _update_media_thumbnail ─────────────────────────────────────────────

class TestUpdateMediaThumbnail:
    @pytest.mark.asyncio
    async def test_updates_all_fields(self):
        from app.services.thumbnail_service import _update_media_thumbnail

        media = MagicMock(id="m1", thumbnail_key=None, thumbnail_url=None,
                          width=None, height=None, file_size=None)
        mock_result = MagicMock(scalar_one_or_none=lambda: media)
        db = AsyncMock()
        db.execute = AsyncMock(return_value=mock_result)

        await _update_media_thumbnail(db, "m1", "tk", "tu", width=400, height=300, file_size=50000)

        assert media.thumbnail_key == "tk"
        assert media.width == 400
        db.commit.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_nonexistent_media_silent_skip(self):
        from app.services.thumbnail_service import _update_media_thumbnail

        mock_result = MagicMock(scalar_one_or_none=lambda: None)
        db = AsyncMock()
        db.execute = AsyncMock(return_value=mock_result)

        await _update_media_thumbnail(db, "nonexistent", "tk", "tu")


# ── generate_thumbnail (sync version) ───────────────────────────────────

class TestGenerateThumbnailSync:
    def test_returns_key_and_url(self):
        from app.services.thumbnail_service import generate_thumbnail
        from PIL import Image

        img = Image.new("RGB", (400, 300))
        buf = BytesIO()
        img.save(buf, format="JPEG")
        img_data = buf.getvalue()

        mock_response = MagicMock()
        mock_response.read.return_value = img_data
        mock_response.close = MagicMock()
        mock_response.release_conn = MagicMock()

        with patch("app.services.thumbnail_service.minio_client") as mock_minio:
            mock_minio.get_object.return_value = mock_response
            with patch("app.services.thumbnail_service.settings") as mock_settings:
                mock_settings.MINIO_BUCKET = "baby-album"
                mock_settings.THUMBNAIL_WIDTH = 300
                mock_settings.THUMBNAIL_HEIGHT = 300
                mock_settings.THUMBNAIL_QUALITY = 80
                mock_settings.MINIO_PUBLIC_URL = "http://minio:9000"

                key, url = generate_thumbnail("photos/test.jpg", "u1")

        assert key.startswith("thumbnails/")
        assert url.startswith("http://")

    def test_raises_on_minio_failure(self):
        from app.services.thumbnail_service import generate_thumbnail

        with patch("app.services.thumbnail_service.minio_client") as mock_minio:
            mock_minio.get_object.side_effect = Exception("MinIO down")
            with pytest.raises(Exception):
                generate_thumbnail("photos/test.jpg", "u1")


# ── generate_avatar_thumbnail ───────────────────────────────────────────

class TestGenerateAvatarThumbnail:
    def test_landscape_crop(self):
        from app.services.thumbnail_service import generate_avatar_thumbnail
        from PIL import Image

        img = Image.new("RGB", (400, 200))
        buf = BytesIO()
        img.save(buf, format="JPEG")
        img_data = buf.getvalue()

        mock_response = MagicMock()
        mock_response.read.return_value = img_data
        mock_response.close = MagicMock()
        mock_response.release_conn = MagicMock()

        with patch("app.services.thumbnail_service.minio_client") as mock_minio:
            mock_minio.get_object.return_value = mock_response
            with patch("app.services.thumbnail_service.settings") as mock_settings:
                mock_settings.MINIO_BUCKET = "baby-album"
                mock_settings.MINIO_PUBLIC_URL = "http://minio:9000"

                key, url = generate_avatar_thumbnail("avatars/u1/photo.jpg", "u1")

        assert key.endswith("_200x200.webp")
        assert url.startswith("http://")


# ── Celery task: generate_thumbnail (tasks/thumbnail.py) ────────────────

class TestCeleryTask:
    def test_task_executes(self):
        from app.tasks.celery_app import celery_app
        celery_app.conf.task_always_eager = True
        celery_app.conf.task_eager_propagates = True

        try:
            with patch("app.services.thumbnail_service.process_thumbnail") as mock_process, \
                    patch("app.database.AsyncSessionLocal"):
                mock_process.return_value = "http://cdn/thumb.webp"
                from app.tasks.thumbnail import generate_thumbnail
                result = generate_thumbnail.delay("m1", "photos/test.jpg", "u1")
            assert result.successful()
        finally:
            celery_app.conf.task_always_eager = False
            celery_app.conf.task_eager_propagates = False

    def test_celery_task_retry_on_none_result(self):
        from app.tasks.celery_app import celery_app
        celery_app.conf.task_always_eager = True
        celery_app.conf.task_eager_propagates = True

        try:
            with patch("app.services.thumbnail_service.process_thumbnail", return_value=None), \
                    patch("app.database.AsyncSessionLocal"):
                from app.tasks.thumbnail import generate_thumbnail
                with pytest.raises(Exception):
                    generate_thumbnail.delay("m1", "photos/test.jpg", "u1")
        finally:
            celery_app.conf.task_always_eager = False
            celery_app.conf.task_eager_propagates = False
