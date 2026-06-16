"""认证模块测试 — JWT 签发/验证 + API 端点"""

import time
from httpx import AsyncClient
from sqlalchemy import select
from app.services.auth_service import AuthService
from app.models.user import User
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


# ── 单元测试：auth_service.update_profile ──────────────

class TestAuthServiceUpdateProfile:
    """AuthService.update_profile 单元测试"""

    async def test_update_nickname(self, db_session):
        """更新昵称"""
        svc = AuthService(db_session)
        login_result = await svc.login(code="update_nick_test")
        user_id = login_result["userId"]

        result = await svc.update_profile(user_id, nick_name="新昵称")
        assert result["nickName"] == "新昵称"
        # avatar_url 应保持原值
        assert result["avatarUrl"] == ""

    async def test_update_avatar(self, db_session):
        """更新头像"""
        svc = AuthService(db_session)
        login_result = await svc.login(code="update_avatar_test")
        user_id = login_result["userId"]

        result = await svc.update_profile(user_id, avatar_url="https://example.com/avatar.png")
        assert result["avatarUrl"] == "https://example.com/avatar.png"
        # nick_name 应保持原值
        assert result["nickName"] == "微信用户"

    async def test_update_both(self, db_session):
        """同时更新昵称和头像"""
        svc = AuthService(db_session)
        login_result = await svc.login(code="update_both_test")
        user_id = login_result["userId"]

        result = await svc.update_profile(
            user_id, nick_name="双更新", avatar_url="https://cdn.example.com/img.jpg"
        )
        assert result["nickName"] == "双更新"
        assert result["avatarUrl"] == "https://cdn.example.com/img.jpg"

    async def test_update_with_none_keeps_old(self, db_session):
        """传 None 不修改原值"""
        svc = AuthService(db_session)
        login_result = await svc.login(code="update_none_test")
        user_id = login_result["userId"]

        # 先更新
        await svc.update_profile(user_id, nick_name="已有昵称", avatar_url="https://old.avatar/url")
        # 传 None 不改动
        result = await svc.update_profile(user_id, nick_name=None, avatar_url=None)
        assert result["nickName"] == "已有昵称"
        assert result["avatarUrl"] == "https://old.avatar/url"

    async def test_update_empty_string(self, db_session):
        """空字符串是合法值（清空字段）"""
        svc = AuthService(db_session)
        login_result = await svc.login(code="update_empty_test")
        user_id = login_result["userId"]

        # 先设值
        await svc.update_profile(user_id, nick_name="要清空的", avatar_url="https://some/url")
        # 用空字符串清空
        result = await svc.update_profile(user_id, nick_name="", avatar_url="")
        assert result["nickName"] == ""
        assert result["avatarUrl"] == ""

    async def test_update_nonexistent_user(self, db_session):
        """不存在的 user_id → ValueError"""
        svc = AuthService(db_session)
        try:
            await svc.update_profile("nonexistent-id", nick_name="不存在")
            assert False, "应抛出 ValueError"
        except ValueError as e:
            assert "Not found" in str(e)

    async def test_update_persists_in_db(self, db_session):
        """更新后数据库确实保存了新值"""
        svc = AuthService(db_session)
        login_result = await svc.login(code="update_persist_test")
        user_id = login_result["userId"]

        await svc.update_profile(user_id, nick_name="持久化测试", avatar_url="https://persist.test/a.png")

        # 直接查数据库验证
        r = await db_session.execute(select(User).where(User.id == user_id))
        user = r.scalar_one()
        assert user.nick_name == "持久化测试"
        assert user.avatar_url == "https://persist.test/a.png"

    async def test_update_nickname_only_does_not_change_avatar(self, db_session):
        """只更新昵称不影响头像"""
        svc = AuthService(db_session)
        login_result = await svc.login(code="update_nick_only")
        user_id = login_result["userId"]

        # 先设头像
        await svc.update_profile(user_id, avatar_url="https://keep.this/avatar.png")
        # 再只改昵称
        result = await svc.update_profile(user_id, nick_name="只改昵称")
        assert result["nickName"] == "只改昵称"
        assert result["avatarUrl"] == "https://keep.this/avatar.png"


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


# ── API 测试：PUT /me ──────────────────────────────────

class TestUpdateProfileAPI:
    """PUT /api/v1/auth/me 端点测试"""

    async def test_update_nickname(self, client: AsyncClient, auth_headers: dict):
        """更新昵称"""
        resp = await client.put(
            "/api/v1/auth/me",
            json={"nickName": "新昵称"},
            headers=auth_headers,
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["nickName"] == "新昵称"

    async def test_update_avatar(self, client: AsyncClient, auth_headers: dict):
        """更新头像"""
        resp = await client.put(
            "/api/v1/auth/me",
            json={"avatarUrl": "https://example.com/new-avatar.png"},
            headers=auth_headers,
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["avatarUrl"] == "https://example.com/new-avatar.png"

    async def test_update_both(self, client: AsyncClient, auth_headers: dict):
        """同时更新昵称和头像"""
        resp = await client.put(
            "/api/v1/auth/me",
            json={"nickName": "全量更新", "avatarUrl": "https://cdn.test/pic.jpg"},
            headers=auth_headers,
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["nickName"] == "全量更新"
        assert body["avatarUrl"] == "https://cdn.test/pic.jpg"

    async def test_update_nickname_only_preserves_avatar(self, client: AsyncClient, auth_headers: dict):
        """只更新昵称不影响头像"""
        # 先设头像
        await client.put(
            "/api/v1/auth/me",
            json={"avatarUrl": "https://keep.this/avatar.png"},
            headers=auth_headers,
        )
        # 再只改昵称
        resp = await client.put(
            "/api/v1/auth/me",
            json={"nickName": "只改昵称"},
            headers=auth_headers,
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["nickName"] == "只改昵称"
        assert body["avatarUrl"] == "https://keep.this/avatar.png"

    async def test_update_avatar_only_preserves_nickname(self, client: AsyncClient, auth_headers: dict):
        """只更新头像不影响昵称"""
        # 先设昵称
        await client.put(
            "/api/v1/auth/me",
            json={"nickName": "保持不变"},
            headers=auth_headers,
        )
        # 再只改头像
        resp = await client.put(
            "/api/v1/auth/me",
            json={"avatarUrl": "https://new.avatar/url.png"},
            headers=auth_headers,
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["nickName"] == "保持不变"
        assert body["avatarUrl"] == "https://new.avatar/url.png"

    async def test_update_with_empty_body(self, client: AsyncClient, auth_headers: dict):
        """空请求体（两个字段都不传）→ 200，值不变"""
        resp = await client.put(
            "/api/v1/auth/me",
            json={},
            headers=auth_headers,
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["nickName"] == "微信用户"  # 默认值不变

    async def test_update_no_auth(self, client: AsyncClient):
        """未认证 → 401"""
        resp = await client.put(
            "/api/v1/auth/me",
            json={"nickName": "未认证"},
        )
        assert resp.status_code == 401

    async def test_update_bad_token(self, client: AsyncClient):
        """无效 token → 401"""
        resp = await client.put(
            "/api/v1/auth/me",
            json={"nickName": "坏token"},
            headers={"Authorization": "Bearer invalid-token-here"},
        )
        assert resp.status_code == 401

    async def test_update_cannot_affect_other_user(self, client: AsyncClient):
        """用户 A 的 token 不能更新用户 B 的资料"""
        # 用户 A 登录
        login_a = await client.post("/api/v1/auth/login", json={"code": "user_a"})
        token_a = login_a.json()["accessToken"]
        headers_a = {"Authorization": f"Bearer {token_a}"}
        user_a_id = login_a.json()["userId"]

        # 用户 B 登录
        login_b = await client.post("/api/v1/auth/login", json={"code": "user_b"})
        user_b_id = login_b.json()["userId"]

        # 用户 A 更新自己的资料
        resp = await client.put(
            "/api/v1/auth/me",
            json={"nickName": "A的昵称"},
            headers=headers_a,
        )
        assert resp.status_code == 200
        assert resp.json()["userId"] == user_a_id

        # 用户 B 的资料应保持不变
        token_b = login_b.json()["accessToken"]
        headers_b = {"Authorization": f"Bearer {token_b}"}
        profile_b = await client.get("/api/v1/auth/me", headers=headers_b)
        assert profile_b.json()["nickName"] == "微信用户"  # 默认值，未被修改

    async def test_update_response_matches_get_profile(self, client: AsyncClient, auth_headers: dict):
        """PUT /me 返回值与 GET /me 一致"""
        await client.put(
            "/api/v1/auth/me",
            json={"nickName": "一致性测试", "avatarUrl": "https://consistency.test/img.png"},
            headers=auth_headers,
        )
        get_resp = await client.get("/api/v1/auth/me", headers=auth_headers)
        body = get_resp.json()
        assert body["nickName"] == "一致性测试"
        assert body["avatarUrl"] == "https://consistency.test/img.png"

    async def test_update_empty_string_clears_field(self, client: AsyncClient, auth_headers: dict):
        """空字符串可清空已设置的值"""
        # 先设值
        await client.put(
            "/api/v1/auth/me",
            json={"nickName": "待清空", "avatarUrl": "https://to.be.cleared/a.png"},
            headers=auth_headers,
        )
        # 用空字符串清空
        resp = await client.put(
            "/api/v1/auth/me",
            json={"nickName": "", "avatarUrl": ""},
            headers=auth_headers,
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["nickName"] == ""
        assert body["avatarUrl"] == ""