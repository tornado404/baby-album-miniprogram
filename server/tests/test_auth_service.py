"""AuthService mock-based unit tests — no conftest dependency"""
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from sqlalchemy.ext.asyncio import AsyncSession


@pytest.fixture
def db():
    return AsyncMock(spec=AsyncSession)


class TestGetWechatOpenid:
    async def test_no_credentials_returns_mock(self, db):
        from app.services.auth_service import AuthService
        svc = AuthService(db)
        open_id = await svc._get_wechat_openid("code")
        assert open_id is not None
        assert open_id.startswith("mock_openid_")

    async def test_successful_wx_response(self, db):
        from app.services.auth_service import AuthService
        svc = AuthService(db)

        mock_resp = MagicMock()
        mock_resp.json.return_value = {"openid": "wx_openid_123"}
        mock_client = AsyncMock()
        mock_client.__aenter__.return_value.get.return_value = mock_resp

        with patch("app.services.auth_service.httpx.AsyncClient", return_value=mock_client), \
                patch("app.services.auth_service.settings.WECHAT_APP_ID", "appid"), \
                patch("app.services.auth_service.settings.WECHAT_APP_SECRET", "secret"):
            open_id = await svc._get_wechat_openid("code")
        assert open_id == "wx_openid_123"

    async def test_wx_returns_errcode(self, db):
        from app.services.auth_service import AuthService
        svc = AuthService(db)

        mock_resp = MagicMock()
        mock_resp.json.return_value = {"errcode": 40029}
        mock_client = AsyncMock()
        mock_client.__aenter__.return_value.get.return_value = mock_resp

        with patch("app.services.auth_service.httpx.AsyncClient", return_value=mock_client), \
                patch("app.services.auth_service.settings.WECHAT_APP_ID", "appid"), \
                patch("app.services.auth_service.settings.WECHAT_APP_SECRET", "secret"):
            open_id = await svc._get_wechat_openid("bad_code")
        assert open_id is None

    async def test_httpx_exception(self, db):
        from app.services.auth_service import AuthService
        svc = AuthService(db)

        mock_client = AsyncMock()
        mock_client.__aenter__.return_value.get.side_effect = Exception("timeout")

        with patch("app.services.auth_service.httpx.AsyncClient", return_value=mock_client), \
                patch("app.services.auth_service.settings.WECHAT_APP_ID", "appid"), \
                patch("app.services.auth_service.settings.WECHAT_APP_SECRET", "secret"):
            open_id = await svc._get_wechat_openid("code")
        assert open_id is None


class TestLogin:
    async def test_existing_user(self, db):
        from app.services.auth_service import AuthService
        svc = AuthService(db)

        user = MagicMock(id="uid-1", open_id="open-1", nick_name="wx_user")
        mock_result = MagicMock(scalar_one_or_none=lambda: user)
        db.execute = AsyncMock(return_value=mock_result)

        with patch.object(svc, "_get_wechat_openid", return_value="open-1"):
            with patch.object(svc, "_sign", return_value="token-xxx"):
                result = await svc.login("code")
        assert result["isNewUser"] is False
        assert result["userId"] == "uid-1"

    async def test_new_user(self, db):
        from app.services.auth_service import AuthService
        svc = AuthService(db)

        mock_none = MagicMock(scalar_one_or_none=lambda: None)
        db.execute = AsyncMock(return_value=mock_none)
        db.add = MagicMock()
        db.commit = AsyncMock()

        with patch.object(svc, "_get_wechat_openid", return_value="new_open_id"):
            with patch.object(svc, "_sign", return_value="new_token"):
                result = await svc.login("code")

        assert result["isNewUser"] is True
        assert result["accessToken"] == "new_token"
        db.add.assert_called_once()
        db.commit.assert_awaited_once()

    async def test_login_invalid_code(self, db):
        from app.services.auth_service import AuthService
        svc = AuthService(db)
        with patch.object(svc, "_get_wechat_openid", return_value=None):
            with pytest.raises(ValueError, match="Invalid wx.login code"):
                await svc.login("bad_code")


class TestRefresh:
    async def test_invalid_token_raises(self, db):
        from app.services.auth_service import AuthService
        svc = AuthService(db)
        with patch.object(AuthService, "verify_access_token", return_value=None):
            with pytest.raises(ValueError, match="Invalid token"):
                await svc.refresh("bad-token")

    async def test_valid_token(self, db):
        from app.services.auth_service import AuthService
        svc = AuthService(db)
        with patch.object(AuthService, "verify_access_token", return_value={"sub": "uid-1"}):
            with patch.object(svc, "_sign", return_value="new-token"):
                result = await svc.refresh("good-token")
        assert result["userId"] == "uid-1"
        assert result["accessToken"] == "new-token"


class TestVerifyAccessToken:
    def test_invalid_returns_none(self):
        from app.services.auth_service import AuthService
        assert AuthService.verify_access_token("not-a-token") is None
        assert AuthService.verify_access_token("") is None


class TestGetProfile:
    async def test_not_found_raises(self, db):
        from app.services.auth_service import AuthService
        svc = AuthService(db)
        mock_result = MagicMock(scalar_one_or_none=lambda: None)
        db.execute = AsyncMock(return_value=mock_result)
        with pytest.raises(ValueError, match="Not found"):
            await svc.get_profile("nonexistent")

    async def test_returns_profile(self, db):
        from app.services.auth_service import AuthService
        svc = AuthService(db)
        user = MagicMock(id="u1", nick_name="tester", avatar_url="http://av", record_days=10, total_photos=5, total_videos=2)
        mock_result = MagicMock(scalar_one_or_none=lambda: user)
        db.execute = AsyncMock(return_value=mock_result)
        result = await svc.get_profile("u1")
        assert result["userId"] == "u1"
        assert result["recordDays"] == 10


class TestUpdateProfile:
    async def test_not_found_raises(self, db):
        from app.services.auth_service import AuthService
        svc = AuthService(db)
        mock_result = MagicMock(scalar_one_or_none=lambda: None)
        db.execute = AsyncMock(return_value=mock_result)
        with pytest.raises(ValueError, match="Not found"):
            await svc.update_profile("nonexistent")

    async def test_updates_nick_name(self, db):
        from app.services.auth_service import AuthService
        svc = AuthService(db)
        user = MagicMock(id="u1", nick_name="old", avatar_url=None, record_days=5, total_photos=1, total_videos=0)
        mock_result = MagicMock(scalar_one_or_none=lambda: user)
        db.execute = AsyncMock(return_value=mock_result)
        db.commit = AsyncMock()
        db.refresh = AsyncMock()

        result = await svc.update_profile("u1", nick_name="new_name")
        assert user.nick_name == "new_name"
        assert result["nickName"] == "new_name"
        db.commit.assert_awaited_once()
        db.refresh.assert_awaited_once_with(user)

    async def test_updates_avatar(self, db):
        from app.services.auth_service import AuthService
        svc = AuthService(db)
        user = MagicMock(id="u1", nick_name="tester", avatar_url=None, record_days=0, total_photos=0, total_videos=0)
        mock_result = MagicMock(scalar_one_or_none=lambda: user)
        db.execute = AsyncMock(return_value=mock_result)
        db.commit = AsyncMock()
        db.refresh = AsyncMock()

        result = await svc.update_profile("u1", avatar_url="http://new.av")
        assert user.avatar_url == "http://new.av"
        assert result["avatarUrl"] == "http://new.av"


class TestSign:
    def test_returns_jwt(self, db):
        from app.services.auth_service import AuthService
        svc = AuthService(db)
        token = svc._sign("u1", 3600)
        assert isinstance(token, str)
        assert token.count(".") == 2  # JWT format