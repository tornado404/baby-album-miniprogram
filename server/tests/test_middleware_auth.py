"""Auth middleware mock-based tests"""
import pytest
from unittest.mock import MagicMock, patch
from fastapi import HTTPException


class TestGetCurrentUserId:
    @pytest.mark.asyncio
    async def test_missing_token(self):
        from app.middleware.auth import get_current_user_id

        request = MagicMock()
        request.headers.get.return_value = ""

        with pytest.raises(HTTPException) as exc:
            await get_current_user_id(request)
        assert exc.value.status_code == 401
        assert exc.value.detail["code"] == 40101

    @pytest.mark.asyncio
    async def test_invalid_token(self):
        from app.middleware.auth import get_current_user_id

        request = MagicMock()
        request.headers.get.return_value = "Bearer bad-token"

        with patch("app.services.auth_service.AuthService.verify_access_token", return_value=None):
            with pytest.raises(HTTPException) as exc:
                await get_current_user_id(request)
        assert exc.value.status_code == 401
        assert exc.value.detail["code"] == 40102

    @pytest.mark.asyncio
    async def test_valid_token(self):
        from app.middleware.auth import get_current_user_id

        request = MagicMock()
        request.headers.get.return_value = "Bearer valid-token"

        with patch("app.services.auth_service.AuthService.verify_access_token", return_value={"sub": "user-1"}):
            uid = await get_current_user_id(request)
        assert uid == "user-1"
