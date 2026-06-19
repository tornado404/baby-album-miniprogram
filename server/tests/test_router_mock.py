"""Mock-based router tests — patch FastAPI Depends to call handlers directly"""
import pytest
from unittest.mock import AsyncMock, MagicMock, patch


class _FakeScalarResult:
    def __init__(self, val):
        self._val = val
    def scalar(self):
        return self._val


class TestStorageRouter:
    @pytest.mark.asyncio
    async def test_storage_stats(self):
        """Mock the DB query to return specific counts"""
        from app.routers.storage import get_storage_stats
        mock_db = AsyncMock()
        mock_db.execute = AsyncMock(side_effect=[
            _FakeScalarResult(5),    # photo_count
            _FakeScalarResult(3),    # video_count
            _FakeScalarResult(1000), # total_size
            _FakeScalarResult(1),    # model_count
        ])

        result = await get_storage_stats(user_id="u1", db=mock_db)
        assert result["code"] == 0
        assert result["data"]["photoCount"] == 5
        assert result["data"]["videoCount"] == 3
        assert result["data"]["modelCount"] == 1
        assert result["data"]["totalSizeBytes"] == 1000

    @pytest.mark.asyncio
    async def test_storage_stats_empty(self):
        from app.routers.storage import get_storage_stats
        mock_db = AsyncMock()
        mock_db.execute = AsyncMock(side_effect=[
            _FakeScalarResult(0),
            _FakeScalarResult(0),
            _FakeScalarResult(0),
            _FakeScalarResult(0),
        ])

        result = await get_storage_stats(user_id="u1", db=mock_db)
        assert result["data"]["totalMedia"] == 0
        assert result["data"]["totalSizeMB"] == 0


class TestSyncRouter:
    @pytest.mark.asyncio
    async def test_sync_status_endpoint(self):
        """通过 client 测试 sync/status 端点"""
        from httpx import AsyncClient, ASGITransport
        from app.main import app

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            response = await ac.get("/api/v1/sync/status", headers={"Authorization": "Bearer test"})
            assert response.status_code == 401  # invalid token


class TestAuthRouter:
    @pytest.mark.asyncio
    async def test_login_exception(self):
        from app.routers.auth import login
        from app.schemas.auth import LoginRequest
        from fastapi import HTTPException

        with patch("app.services.auth_service.AuthService.login",
                   side_effect=ValueError("Invalid wx.login code")):
            mock_db = MagicMock()
            with pytest.raises(HTTPException):
                await login(LoginRequest(code="bad_code"), mock_db)

    @pytest.mark.asyncio
    async def test_refresh_exception(self):
        from app.routers.auth import refresh
        from app.schemas.auth import TokenRefreshRequest
        from fastapi import HTTPException

        with patch("app.services.auth_service.AuthService.refresh",
                   side_effect=ValueError("Invalid token")):
            mock_db = MagicMock()
            with pytest.raises(HTTPException):
                await refresh(TokenRefreshRequest(refreshToken="bad"), mock_db)

    @pytest.mark.asyncio
    async def test_get_profile_not_found(self):
        from app.routers.auth import get_profile
        from fastapi import HTTPException

        with patch("app.services.auth_service.AuthService.get_profile",
                   side_effect=ValueError("Not found")):
            mock_db = MagicMock()
            with pytest.raises(HTTPException) as exc:
                await get_profile(user_id="nonexistent", db=mock_db)
            assert exc.value.status_code == 404

    @pytest.mark.asyncio
    async def test_update_profile_not_found(self):
        from app.routers.auth import update_profile
        from app.schemas.auth import UpdateProfileRequest
        from fastapi import HTTPException

        with patch("app.services.auth_service.AuthService.update_profile",
                   side_effect=ValueError("Not found")):
            mock_db = MagicMock()
            with pytest.raises(HTTPException) as exc:
                await update_profile(
                    req=UpdateProfileRequest(),
                    user_id="nonexistent",
                    db=mock_db,
                )
            assert exc.value.status_code == 404


class TestExportRouter:
    @pytest.mark.asyncio
    async def test_report_no_baby_id(self):
        from app.routers.export import report

        with patch("app.services.export_service.ExportService.get_report",
                   AsyncMock(return_value={"totalMedia": 0})):
            result = await report(baby_id=None, start=None, end=None, user_id="u1", db=AsyncMock())
        assert result["code"] == 0

    @pytest.mark.asyncio
    async def test_export_data(self):
        from app.routers.export import export_data

        with patch("app.services.export_service.ExportService.export_json",
                   AsyncMock(return_value={"babies": []})):
            result = await export_data(user_id="u1", db=AsyncMock())
        assert result["code"] == 0
        assert result["data"]["babies"] == []


class TestUploadRouter:
    @pytest.mark.asyncio
    async def test_upload_sign_with_service(self):
        from app.services.file_service import get_upload_url
        with patch("app.services.file_service.settings") as mock_s:
            mock_s.DEBUG = True
            mock_s.MINIO_PUBLIC_URL = "http://minio:9000"
            mock_s.MINIO_ACCESS_KEY = "key"
            mock_s.MINIO_SECRET_KEY = "secret"
            mock_s.MINIO_REGION = "us-east-1"
            mock_s.MINIO_BUCKET = "baby-album"
            result = get_upload_url("u1", "test.jpg", "image")
        assert "uploadUrl" in result or "url" in result