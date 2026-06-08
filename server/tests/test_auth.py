"""认证模块测试 — JWT 签发/验证 + API 端点"""

import time
from httpx import AsyncClient
from app.services.auth_service import AuthService
from app.config import settings


# ── 单元测试：JWT 工具方法 ─────────────────────────────

class TestJWT:
    """AuthService._sign / verify_access_token 单元测试"""

    def test_sign_and_verify(self):
        """签发 → 验证成功，sub 匹配"""
        uid = "test-user-id"
        token = AuthService._sign(None, uid, 3600)
        payload = AuthService.verify_access_token(token)
        assert payload is not None
        assert payload["sub"] == uid

    def test_expired_token(self):
        """过期 token → verify 返回 None"""
        uid = "expired-user"
        token = AuthService._sign(None, uid, -1)  # 已过期
        payload = AuthService.verify_access_token(token)
        assert payload is None

    def test_invalid_token(self):
        """非法 token → verify 返回 None"""
        assert AuthService.verify_access_token("this.is.not.a.jwt") is None

    def test_wrong_secret(self):
        """其他密钥签发的 token 验证失败"""
        uid = "test-user"
        # 用错误密钥签发
        import jwt
        token = jwt.encode(
            {"sub": uid, "iat": int(time.time()), "exp": int(time.time()) + 3600},
            "wrong-secret",
            algorithm="HS256",
        )
        payload = AuthService.verify_access_token(token)
        assert payload is None


# ── API 测试 ────────────────────────────────────────────

class TestAuthAPI:
    """POST /api/v1/auth/* 端点测试"""

    async def test_login_success(self, client: AsyncClient):
        """正常登录返回 token"""
        resp = await client.post("/api/v1/auth/login", json={"code": "wx_code"})
        assert resp.status_code == 200
        body = resp.json()
        assert "accessToken" in body
        assert "refreshToken" in body
        assert "userId" in body
        assert body["expiresIn"] == 7200
        assert body["isNewUser"] is True  # 首次登录

    async def test_login_returns_different_user_each_time(self, client: AsyncClient):
        """不同 code 返回不同 userId"""
        r1 = await client.post("/api/v1/auth/login", json={"code": "code_a"})
        r2 = await client.post("/api/v1/auth/login", json={"code": "code_b"})
        assert r1.json()["userId"] != r2.json()["userId"]

    async def test_refresh_token(self, client: AsyncClient):
        """用 refreshToken 刷新 accessToken"""
        login = await client.post("/api/v1/auth/login", json={"code": "refresh_test"})
        assert login.status_code == 200
        refresh_token = login.json()["refreshToken"]

        resp = await client.post(
            "/api/v1/auth/refresh",
            json={"refreshToken": refresh_token},
        )
        assert resp.status_code == 200
        body = resp.json()
        assert "accessToken" in body

    async def test_refresh_with_invalid_token(self, client: AsyncClient):
        """非法 refreshToken → 401"""
        resp = await client.post(
            "/api/v1/auth/refresh",
            json={"refreshToken": "invalid-token"},
        )
        assert resp.status_code == 401

    async def test_get_profile(self, client: AsyncClient, auth_token: str):
        """GET /me 返回用户信息"""
        resp = await client.get(
            "/api/v1/auth/me",
            headers={"Authorization": f"Bearer {auth_token}"},
        )
        assert resp.status_code == 200
        body = resp.json()
        assert "userId" in body
        assert body["nickName"] == "微信用户"

    async def test_get_profile_no_auth(self, client: AsyncClient):
        """未认证 → 401"""
        resp = await client.get("/api/v1/auth/me")
        assert resp.status_code == 401

    async def test_get_profile_bad_token(self, client: AsyncClient):
        """无效 token → 401"""
        resp = await client.get(
            "/api/v1/auth/me",
            headers={"Authorization": "Bearer badtoken"},
        )
        assert resp.status_code == 401