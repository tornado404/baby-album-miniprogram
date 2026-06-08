"""宝宝模块测试 — CRUD API 端点"""

from httpx import AsyncClient


class TestBabyAPI:
    """宝宝 CRUD 端点测试"""

    BASE = "/api/v1/babies/"

    async def _create_baby(self, client: AsyncClient, headers: dict, **overrides) -> dict:
        """辅助：创建宝宝并返回响应 JSON"""
        payload = {"name": "小明", "gender": "male", "birthDate": "2026-01-15"}
        payload.update(overrides)
        resp = await client.post(self.BASE, json=payload, headers=headers)
        assert resp.status_code == 200
        return resp.json()

    # ── Create ────────────────────────────────────────

    async def test_create_baby(self, client: AsyncClient, auth_headers: dict):
        """创建宝宝成功"""
        body = await self._create_baby(client, auth_headers)
        assert body["name"] == "小明"
        assert body["gender"] == "male"
        assert body["birthDate"] == "2026-01-15"
        assert "id" in body

    async def test_create_baby_minimal(self, client: AsyncClient, auth_headers: dict):
        """最少字段创建"""
        body = await self._create_baby(client, auth_headers, name="豆豆")
        assert body["name"] == "豆豆"

    async def test_create_baby_requires_auth(self, client: AsyncClient):
        """未认证 → 401"""
        resp = await client.post(self.BASE, json={"name": "test"})
        assert resp.status_code == 401

    # ── List ──────────────────────────────────────────

    async def test_list_babies_empty(self, client: AsyncClient, auth_headers: dict):
        """空列表"""
        resp = await client.get(self.BASE, headers=auth_headers)
        assert resp.status_code == 200
        assert resp.json() == []

    async def test_list_babies(self, client: AsyncClient, auth_headers: dict):
        """返回已创建的宝宝列表"""
        await self._create_baby(client, auth_headers, name="大宝")
        await self._create_baby(client, auth_headers, name="二宝")

        resp = await client.get(self.BASE, headers=auth_headers)
        assert resp.status_code == 200
        body = resp.json()
        assert len(body) == 2
        names = [b["name"] for b in body]
        assert "大宝" in names
        assert "二宝" in names

    # ── Get ───────────────────────────────────────────

    async def test_get_baby(self, client: AsyncClient, auth_headers: dict):
        """按 ID 获取宝宝"""
        created = await self._create_baby(client, auth_headers, name="团团")
        resp = await client.get(f"{self.BASE}{created['id']}", headers=auth_headers)
        assert resp.status_code == 200
        assert resp.json()["name"] == "团团"

    async def test_get_baby_not_found(self, client: AsyncClient, auth_headers: dict):
        """不存在的宝宝 → 404"""
        resp = await client.get(f"{self.BASE}nonexistent-id", headers=auth_headers)
        assert resp.status_code == 404

    # ── Update ────────────────────────────────────────

    async def test_update_baby(self, client: AsyncClient, auth_headers: dict):
        """更新宝宝信息"""
        created = await self._create_baby(client, auth_headers, name="旧名")
        resp = await client.put(
            f"{self.BASE}{created['id']}",
            json={"name": "新名", "gender": "female"},
            headers=auth_headers,
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["name"] == "新名"
        assert body["gender"] == "female"
        assert body["birthDate"] == "2026-01-15"  # 未更新字段不变

    async def test_update_baby_partial(self, client: AsyncClient, auth_headers: dict):
        """部分更新（仅传 name）"""
        created = await self._create_baby(client, auth_headers)
        resp = await client.put(
            f"{self.BASE}{created['id']}",
            json={"name": "只改名字"},
            headers=auth_headers,
        )
        assert resp.status_code == 200
        assert resp.json()["name"] == "只改名字"

    async def test_update_baby_not_found(self, client: AsyncClient, auth_headers: dict):
        """更新不存在的宝宝 → 404"""
        resp = await client.put(
            f"{self.BASE}nonexistent",
            json={"name": "nope"},
            headers=auth_headers,
        )
        assert resp.status_code == 404

    # ── Delete ────────────────────────────────────────

    async def test_delete_baby(self, client: AsyncClient, auth_headers: dict):
        """软删除宝宝"""
        created = await self._create_baby(client, auth_headers)
        resp = await client.delete(f"{self.BASE}{created['id']}", headers=auth_headers)
        assert resp.status_code == 200
        assert resp.json()["message"] == "Deleted"

        # 删除后查询不到
        get_resp = await client.get(f"{self.BASE}{created['id']}", headers=auth_headers)
        assert get_resp.status_code == 404

    async def test_delete_baby_not_found(self, client: AsyncClient, auth_headers: dict):
        """删除不存在的宝宝 → 404"""
        resp = await client.delete(f"{self.BASE}nonexistent", headers=auth_headers)
        assert resp.status_code == 404

    # ── 用户隔离 ─────────────────────────────────────

    async def test_baby_isolation(self, client: AsyncClient):
        """用户 A 创建 → 用户 B 看不到"""
        # 用户 A 创建宝宝
        ra = await client.post("/api/v1/auth/login", json={"code": "user_a"})
        token_a = ra.json()["accessToken"]
        await self._create_baby(client, {"Authorization": f"Bearer {token_a}"}, name="A的宝宝")

        # 用户 B 只能看到空列表
        rb = await client.post("/api/v1/auth/login", json={"code": "user_b"})
        token_b = rb.json()["accessToken"]
        resp = await client.get(self.BASE, headers={"Authorization": f"Bearer {token_b}"})
        assert resp.json() == []