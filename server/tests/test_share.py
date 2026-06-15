"""共享模块测试 — 权限中间件 + 取消共享 + 共享内容查看"""

from httpx import AsyncClient


class TestShareAPI:
    """共享 API 端点测试"""

    async def _create_baby(self, client: AsyncClient, headers: dict, **overrides) -> dict:
        """辅助：创建宝宝并返回响应 JSON"""
        payload = {"name": "共享宝宝", "gender": "female", "birthDate": "2026-01-01"}
        payload.update(overrides)
        resp = await client.post("/api/v1/babies/", json=payload, headers=headers)
        assert resp.status_code == 200
        return resp.json()

    async def _login_user(self, client: AsyncClient, code: str) -> dict:
        """辅助：登录并返回 {token, headers, userId}"""
        resp = await client.post("/api/v1/auth/login", json={"code": code})
        assert resp.status_code == 200
        data = resp.json()
        return {
            "token": data["accessToken"],
            "headers": {"Authorization": f"Bearer {data['accessToken']}"},
            "userId": data["userId"],
        }

    # ── POST /invitations + POST /accept ──────────────

    async def test_create_invitation(self, client: AsyncClient, auth_headers: dict):
        """创建共享邀请"""
        baby = await self._create_baby(client, auth_headers)
        resp = await client.post(
            "/api/v1/share/invitations",
            json={"babyId": baby["id"], "permission": "viewer"},
            headers=auth_headers,
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["code"] == 0
        assert "token" in body["data"]
        assert "expiresAt" in body["data"]

    async def test_accept_invitation(self, client: AsyncClient):
        """接受共享邀请"""
        # 所有者创建宝宝 + 邀请
        owner = await self._login_user(client, "share_owner_1")
        baby = await self._create_baby(client, owner["headers"])
        inv = await client.post(
            "/api/v1/share/invitations",
            json={"babyId": baby["id"], "permission": "viewer"},
            headers=owner["headers"],
        )
        token = inv.json()["data"]["token"]

        # 另一个用户接受
        viewer = await self._login_user(client, "share_viewer_1")
        resp = await client.post(
            "/api/v1/share/accept",
            json={"token": token},
            headers=viewer["headers"],
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["code"] == 0
        assert body["data"]["babyId"] == baby["id"]

    # ── DELETE /relations/:id ──────────────────────────

    async def test_revoke_relation_by_owner(self, client: AsyncClient):
        """所有者取消共享"""
        owner = await self._login_user(client, "share_owner_2")
        baby = await self._create_baby(client, owner["headers"])
        inv = await client.post(
            "/api/v1/share/invitations",
            json={"babyId": baby["id"], "permission": "viewer"},
            headers=owner["headers"],
        )
        token = inv.json()["data"]["token"]

        viewer = await self._login_user(client, "share_viewer_2")
        accept = await client.post(
            "/api/v1/share/accept",
            json={"token": token},
            headers=viewer["headers"],
        )
        assert accept.status_code == 200

        # 获取 relation_id
        shared = await client.get(
            "/api/v1/share/babies",
            headers=viewer["headers"],
        )
        assert shared.status_code == 200
        shared_babies = shared.json()["data"]
        assert len(shared_babies) == 1
        relation_id = shared_babies[0]["relationId"]

        # 所有者取消共享
        resp = await client.delete(
            f"/api/v1/share/relations/{relation_id}",
            headers=owner["headers"],
        )
        assert resp.status_code == 200
        assert resp.json()["message"] == "Revoked"

        # 取消后 viewer 无法再看到共享宝宝
        shared2 = await client.get(
            "/api/v1/share/babies",
            headers=viewer["headers"],
        )
        assert shared2.json()["data"] == []

    async def test_revoke_relation_nonexistent(self, client: AsyncClient, auth_headers: dict):
        """删除不存在的 relation → 404"""
        resp = await client.delete(
            "/api/v1/share/relations/nonexistent-id",
            headers=auth_headers,
        )
        assert resp.status_code == 404

    async def test_revoke_relation_not_by_owner(self, client: AsyncClient):
        """非所有者不能取消共享 — 返回 404"""
        owner = await self._login_user(client, "share_owner_3")
        baby = await self._create_baby(client, owner["headers"])
        inv = await client.post(
            "/api/v1/share/invitations",
            json={"babyId": baby["id"], "permission": "viewer"},
            headers=owner["headers"],
        )
        token = inv.json()["data"]["token"]

        viewer = await self._login_user(client, "share_viewer_3")
        await client.post(
            "/api/v1/share/accept",
            json={"token": token},
            headers=viewer["headers"],
        )

        # 获取 relation_id
        shared = await client.get(
            "/api/v1/share/babies",
            headers=viewer["headers"],
        )
        relation_id = shared.json()["data"][0]["relationId"]

        # viewer 尝试删除 relation（owner_id 不匹配 → ShareService 找不到 → 404）
        resp = await client.delete(
            f"/api/v1/share/relations/{relation_id}",
            headers=viewer["headers"],
        )
        assert resp.status_code == 404

    # ── GET /share/babies ──────────────────────────────

    async def test_list_shared_babies(self, client: AsyncClient):
        """获取共享给我的宝宝列表"""
        owner = await self._login_user(client, "share_owner_4")
        baby = await self._create_baby(client, owner["headers"], name="共享宝宝A")
        inv = await client.post(
            "/api/v1/share/invitations",
            json={"babyId": baby["id"], "permission": "editor"},
            headers=owner["headers"],
        )
        token = inv.json()["data"]["token"]

        viewer = await self._login_user(client, "share_viewer_4")
        await client.post(
            "/api/v1/share/accept",
            json={"token": token},
            headers=viewer["headers"],
        )

        resp = await client.get(
            "/api/v1/share/babies",
            headers=viewer["headers"],
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["code"] == 0
        assert len(body["data"]) == 1
        shared = body["data"][0]
        assert shared["id"] == baby["id"]
        assert shared["name"] == "共享宝宝A"
        assert shared["permission"] == "editor"
        assert shared["ownerUserId"] == owner["userId"]

    async def test_list_shared_babies_empty(self, client: AsyncClient, auth_headers: dict):
        """无共享宝宝时返回空列表"""
        resp = await client.get(
            "/api/v1/share/babies",
            headers=auth_headers,
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["code"] == 0
        assert body["data"] == []

    async def test_list_shared_babies_no_auth(self, client: AsyncClient):
        """未认证 → 401"""
        resp = await client.get("/api/v1/share/babies")
        assert resp.status_code == 401

    # ── GET /share/babies/:id/media ────────────────────

    async def test_list_shared_baby_media_as_viewer(self, client: AsyncClient):
        """Viewer 可以查看共享宝宝的媒体"""
        owner = await self._login_user(client, "share_owner_5")
        baby = await self._create_baby(client, owner["headers"])
        inv = await client.post(
            "/api/v1/share/invitations",
            json={"babyId": baby["id"], "permission": "viewer"},
            headers=owner["headers"],
        )
        token = inv.json()["data"]["token"]

        viewer = await self._login_user(client, "share_viewer_5")
        await client.post(
            "/api/v1/share/accept",
            json={"token": token},
            headers=viewer["headers"],
        )

        resp = await client.get(
            f"/api/v1/share/babies/{baby['id']}/media",
            headers=viewer["headers"],
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["code"] == 0
        assert isinstance(body["data"], list)

    async def test_list_shared_baby_media_as_owner(self, client: AsyncClient):
        """Owner 也可以通过共享接口查看媒体"""
        owner = await self._login_user(client, "share_owner_6")
        baby = await self._create_baby(client, owner["headers"])

        resp = await client.get(
            f"/api/v1/share/babies/{baby['id']}/media",
            headers=owner["headers"],
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["code"] == 0
        assert isinstance(body["data"], list)

    async def test_list_shared_baby_media_no_access(self, client: AsyncClient):
        """无访问权限 → 403"""
        owner = await self._login_user(client, "share_owner_7")
        baby = await self._create_baby(client, owner["headers"])

        stranger = await self._login_user(client, "share_stranger_1")
        resp = await client.get(
            f"/api/v1/share/babies/{baby['id']}/media",
            headers=stranger["headers"],
        )
        assert resp.status_code == 403

    async def test_list_shared_baby_media_no_auth(self, client: AsyncClient):
        """未认证 → 401"""
        resp = await client.get("/api/v1/share/babies/some-id/media")
        assert resp.status_code == 401


class TestPermissionMiddleware:
    """权限中间件逻辑测试（通过 API 端点间接验证）"""

    async def _login_user(self, client: AsyncClient, code: str) -> dict:
        resp = await client.post("/api/v1/auth/login", json={"code": code})
        assert resp.status_code == 200
        data = resp.json()
        return {
            "token": data["accessToken"],
            "headers": {"Authorization": f"Bearer {data['accessToken']}"},
            "userId": data["userId"],
        }

    async def test_owner_has_full_access(self, client: AsyncClient):
        """Owner 有完全访问权限"""
        owner = await self._login_user(client, "perm_owner_1")
        baby_resp = await client.post(
            "/api/v1/babies/",
            json={"name": "权限测试宝宝", "gender": "male", "birthDate": "2026-03-01"},
            headers=owner["headers"],
        )
        baby_id = baby_resp.json()["id"]

        # Owner 通过共享接口访问自己的宝宝
        resp = await client.get(
            f"/api/v1/share/babies/{baby_id}/media",
            headers=owner["headers"],
        )
        assert resp.status_code == 200

    async def test_viewer_can_view_but_not_edit(self, client: AsyncClient):
        """Viewer 可以查看但不能编辑"""
        owner = await self._login_user(client, "perm_owner_2")
        baby_resp = await client.post(
            "/api/v1/babies/",
            json={"name": "Viewer测试", "gender": "male", "birthDate": "2026-03-01"},
            headers=owner["headers"],
        )
        baby_id = baby_resp.json()["id"]

        # Owner 创建 viewer 邀请
        inv = await client.post(
            "/api/v1/share/invitations",
            json={"babyId": baby_id, "permission": "viewer"},
            headers=owner["headers"],
        )
        token = inv.json()["data"]["token"]

        viewer = await self._login_user(client, "perm_viewer_2")
        await client.post(
            "/api/v1/share/accept",
            json={"token": token},
            headers=viewer["headers"],
        )

        # Viewer 可以查看媒体
        resp = await client.get(
            f"/api/v1/share/babies/{baby_id}/media",
            headers=viewer["headers"],
        )
        assert resp.status_code == 200

        # Viewer 不能通过 owner API 修改宝宝
        resp = await client.put(
            f"/api/v1/babies/{baby_id}",
            json={"name": "被修改了"},
            headers=viewer["headers"],
        )
        # Baby update requires owner check → 404 (BabyService.get_baby checks user_id)
        assert resp.status_code == 404

    async def test_no_access_returns_403(self, client: AsyncClient):
        """无权限用户 → 403"""
        owner = await self._login_user(client, "perm_owner_3")
        baby_resp = await client.post(
            "/api/v1/babies/",
            json={"name": "隔离测试", "gender": "female", "birthDate": "2026-03-01"},
            headers=owner["headers"],
        )
        baby_id = baby_resp.json()["id"]

        stranger = await self._login_user(client, "perm_stranger_3")
        resp = await client.get(
            f"/api/v1/share/babies/{baby_id}/media",
            headers=stranger["headers"],
        )
        assert resp.status_code == 403
        body = resp.json()
        assert body["detail"]["code"] == 40301

    async def test_editor_has_access(self, client: AsyncClient):
        """Editor 有访问权限"""
        owner = await self._login_user(client, "perm_owner_4")
        baby_resp = await client.post(
            "/api/v1/babies/",
            json={"name": "Editor测试", "gender": "male", "birthDate": "2026-03-01"},
            headers=owner["headers"],
        )
        baby_id = baby_resp.json()["id"]

        inv = await client.post(
            "/api/v1/share/invitations",
            json={"babyId": baby_id, "permission": "editor"},
            headers=owner["headers"],
        )
        token = inv.json()["data"]["token"]

        editor = await self._login_user(client, "perm_editor_4")
        await client.post(
            "/api/v1/share/accept",
            json={"token": token},
            headers=editor["headers"],
        )

        # Editor 可以查看媒体
        resp = await client.get(
            f"/api/v1/share/babies/{baby_id}/media",
            headers=editor["headers"],
        )
        assert resp.status_code == 200
