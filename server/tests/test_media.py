"""媒体模块测试 — CRUD + GET single + PUT update + Batch Archive + Batch Tag"""

from httpx import AsyncClient


class TestMediaAPI:
    """媒体端点测试"""

    BASE = "/api/v1/media/"

    async def _create_media(
        self, client: AsyncClient, headers: dict,
        baby_id: str, **overrides
    ) -> dict:
        """辅助：创建媒体并返回 JSON"""
        payload = {
            "babyId": baby_id,
            "type": "image",
            "cosKey": f"photos/test/{baby_id[:8]}_photo.jpg",
            "captureDate": "2026-06-01",
            "title": "测试照片",
            "tags": ["日常", "第一次"],
            "locationName": "家里",
            "moment": "第一次自己吃饭",
            "milestone": "6个月",
        }
        payload.update(overrides)
        resp = await client.post(self.BASE, json=payload, headers=headers)
        assert resp.status_code == 200, resp.text
        return resp.json()

    # ── Create ────────────────────────────────────────

    async def test_create_media(self, client: AsyncClient, auth_headers: dict, test_baby_id: str):
        """创建媒体成功"""
        body = await self._create_media(client, auth_headers, test_baby_id)
        assert body["type"] == "image"
        assert body["captureDate"] == "2026-06-01"
        assert body["tags"] == ["日常", "第一次"]
        assert body["locationName"] == "家里"
        assert "id" in body

    async def test_create_video_media(self, client: AsyncClient, auth_headers: dict, test_baby_id: str):
        """创建视频媒体"""
        body = await self._create_media(
            client, auth_headers, test_baby_id,
            type="video",
            cosKey="videos/test/sample.mp4",
            title="第一次走路",
        )
        assert body["type"] == "video"
        assert body["title"] == "第一次走路"

    async def test_create_media_requires_auth(self, client: AsyncClient, test_baby_id: str):
        """未认证 → 401"""
        resp = await client.post(self.BASE, json={"babyId": test_baby_id, "type": "image", "cosKey": "x", "captureDate": "2026-01-01"})
        assert resp.status_code == 401

    # ── List ──────────────────────────────────────────

    async def test_list_media_empty(self, client: AsyncClient, auth_headers: dict, test_baby_id: str):
        """暂无媒体"""
        resp = await client.get(self.BASE, params={"babyId": test_baby_id}, headers=auth_headers)
        assert resp.status_code == 200
        assert resp.json() == []

    async def test_list_media(self, client: AsyncClient, auth_headers: dict, test_baby_id: str):
        """列出宝宝媒体"""
        await self._create_media(client, auth_headers, test_baby_id, captureDate="2026-06-01")
        await self._create_media(client, auth_headers, test_baby_id, captureDate="2026-06-02")

        resp = await client.get(self.BASE, params={"babyId": test_baby_id}, headers=auth_headers)
        assert resp.status_code == 200
        # 按 captureDate DESC
        body = resp.json()
        assert len(body) == 2
        assert body[0]["captureDate"] == "2026-06-02"

    # ── GET single media ──────────────────────────────

    async def test_get_media_by_id(self, client: AsyncClient, auth_headers: dict, test_baby_id: str):
        """通过媒体 ID 查询单条详情"""
        created = await self._create_media(client, auth_headers, test_baby_id)
        resp = await client.get(f"{self.BASE}{created['id']}", headers=auth_headers)
        assert resp.status_code == 200
        body = resp.json()
        assert body["id"] == created["id"]
        assert body["type"] == "image"
        assert body["title"] == "测试照片"
        assert body["captureDate"] == "2026-06-01"
        assert body["tags"] == ["日常", "第一次"]
        assert body["locationName"] == "家里"
        assert body["moment"] == "第一次自己吃饭"
        assert body["milestone"] == "6个月"

    async def test_get_media_by_id_not_found(self, client: AsyncClient, auth_headers: dict):
        """查询不存在的媒体 → 404"""
        resp = await client.get(f"{self.BASE}nonexistent-id", headers=auth_headers)
        assert resp.status_code == 404

    async def test_get_media_includes_baby_age(self, client: AsyncClient, auth_headers: dict, test_baby_id: str):
        """GET 单条媒体返回 babyAge 字段（若模型已计算）"""
        created = await self._create_media(client, auth_headers, test_baby_id)
        resp = await client.get(f"{self.BASE}{created['id']}", headers=auth_headers)
        assert resp.status_code == 200
        body = resp.json()
        # babyAge 字段应存在（可为 None 或 dict）
        assert "babyAge" in body

    async def test_get_media_requires_auth(self, client: AsyncClient, test_baby_id: str):
        """未认证 GET 单条 → 401"""
        resp = await client.get(f"{self.BASE}some-id")
        assert resp.status_code == 401

    # ── Update ────────────────────────────────────────

    async def test_update_media(self, client: AsyncClient, auth_headers: dict, test_baby_id: str):
        """更新媒体信息"""
        created = await self._create_media(client, auth_headers, test_baby_id)
        resp = await client.put(
            f"{self.BASE}{created['id']}",
            json={"title": "新标题", "tags": ["更新标签"]},
            headers=auth_headers,
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["title"] == "新标题"
        assert body["tags"] == ["更新标签"]
        assert body["captureDate"] == "2026-06-01"  # 未更新字段不变

    async def test_update_media_location_name(self, client: AsyncClient, auth_headers: dict, test_baby_id: str):
        """更新 locationName 字段（camelCase → snake_case 映射）"""
        created = await self._create_media(client, auth_headers, test_baby_id)
        resp = await client.put(
            f"{self.BASE}{created['id']}",
            json={"locationName": "公园"},
            headers=auth_headers,
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["locationName"] == "公园"

    async def test_update_media_archive(self, client: AsyncClient, auth_headers: dict, test_baby_id: str):
        """更新 isArchived 字段（camelCase → snake_case 映射）"""
        created = await self._create_media(client, auth_headers, test_baby_id)
        resp = await client.put(
            f"{self.BASE}{created['id']}",
            json={"isArchived": True},
            headers=auth_headers,
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["isArchived"] is True

    async def test_update_media_moment_and_milestone(self, client: AsyncClient, auth_headers: dict, test_baby_id: str):
        """更新 moment 和 milestone 字段"""
        created = await self._create_media(client, auth_headers, test_baby_id)
        resp = await client.put(
            f"{self.BASE}{created['id']}",
            json={"moment": "学会翻身", "milestone": "12个月"},
            headers=auth_headers,
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["moment"] == "学会翻身"
        assert body["milestone"] == "12个月"

    async def test_update_media_not_found(self, client: AsyncClient, auth_headers: dict):
        """更新不存在的媒体 → 404"""
        resp = await client.put(
            f"{self.BASE}nonexistent",
            json={"title": "nope"},
            headers=auth_headers,
        )
        assert resp.status_code == 404

    async def test_update_media_requires_auth(self, client: AsyncClient, test_baby_id: str):
        """未认证 PUT → 401"""
        resp = await client.put(f"{self.BASE}some-id", json={"title": "x"})
        assert resp.status_code == 401

    # ── Delete ────────────────────────────────────────

    async def test_delete_media(self, client: AsyncClient, auth_headers: dict, test_baby_id: str):
        """软删除媒体"""
        created = await self._create_media(client, auth_headers, test_baby_id)
        resp = await client.delete(f"{self.BASE}{created['id']}", headers=auth_headers)
        assert resp.status_code == 200
        assert resp.json()["message"] == "Deleted"

        # 删除后列表为空
        resp = await client.get(self.BASE, params={"babyId": test_baby_id}, headers=auth_headers)
        assert resp.json() == []

    async def test_delete_media_not_found(self, client: AsyncClient, auth_headers: dict):
        """删除不存在的媒体 → 404"""
        resp = await client.delete(f"{self.BASE}nonexistent", headers=auth_headers)
        assert resp.status_code == 404

    # ── Batch Archive ─────────────────────────────────

    async def test_batch_archive(self, client: AsyncClient, auth_headers: dict, test_baby_id: str):
        """批量归档媒体"""
        m1 = await self._create_media(client, auth_headers, test_baby_id)
        m2 = await self._create_media(client, auth_headers, test_baby_id)

        resp = await client.put(
            f"{self.BASE}batch-archive",
            json={"ids": [m1["id"], m2["id"]], "archived": True},
            headers=auth_headers,
        )
        assert resp.status_code == 200
        assert resp.json()["archived"] is True

    async def test_batch_unarchive(self, client: AsyncClient, auth_headers: dict, test_baby_id: str):
        """批量取消归档"""
        m1 = await self._create_media(client, auth_headers, test_baby_id)
        await client.put(
            f"{self.BASE}batch-archive",
            json={"ids": [m1["id"]], "archived": True},
            headers=auth_headers,
        )
        resp = await client.put(
            f"{self.BASE}batch-archive",
            json={"ids": [m1["id"]], "archived": False},
            headers=auth_headers,
        )
        assert resp.status_code == 200
        assert resp.json()["archived"] is False

    # ── Batch Tag ─────────────────────────────────────

    async def test_batch_tag_add(self, client: AsyncClient, auth_headers: dict, test_baby_id: str):
        """批量添加标签"""
        m1 = await self._create_media(client, auth_headers, test_baby_id, tags=["日常"])
        m2 = await self._create_media(client, auth_headers, test_baby_id, tags=["日常"])

        resp = await client.put(
            f"{self.BASE}batch-tag",
            json={"ids": [m1["id"], m2["id"]], "tags": ["重要"], "action": "add"},
            headers=auth_headers,
        )
        assert resp.status_code == 200

        # 验证标签已添加（通过列表接口）
        r1 = await client.get(self.BASE, params={"babyId": test_baby_id}, headers=auth_headers)
        items = r1.json()
        assert len(items) >= 2
        for item in items:
            if item["id"] == m1["id"] or item["id"] == m2["id"]:
                assert "重要" in (item["tags"] or [])

    async def test_batch_tag_remove(self, client: AsyncClient, auth_headers: dict, test_baby_id: str):
        """批量移除标签"""
        m1 = await self._create_media(client, auth_headers, test_baby_id, tags=["日常", "重要"])
        m2 = await self._create_media(client, auth_headers, test_baby_id, tags=["日常", "重要"])

        resp = await client.put(
            f"{self.BASE}batch-tag",
            json={"ids": [m1["id"], m2["id"]], "tags": ["重要"], "action": "remove"},
            headers=auth_headers,
        )
        assert resp.status_code == 200

        # 验证标签已移除（通过列表接口）
        r1 = await client.get(self.BASE, params={"babyId": test_baby_id}, headers=auth_headers)
        items = r1.json()
        for item in items:
            if item["id"] == m1["id"]:
                assert "重要" not in (item["tags"] or [])
                assert "日常" in (item["tags"] or [])

    # ── 用户隔离 ─────────────────────────────────────

    async def test_media_isolation(self, client: AsyncClient, auth_headers: dict, test_baby_id: str):
        """用户 A 创建 media 后，用户 B 看不到（用户 B 查询自己的 baby）"""
        ra = await client.post("/api/v1/auth/login", json={"code": "user_a"})
        token_a = ra.json()["accessToken"]
        headers_a = {"Authorization": f"Bearer {token_a}"}

        # 用户 A 创建自己的 baby
        baby_a = await client.post("/api/v1/babies/", json={"name": "A的宝宝"}, headers=headers_a)
        baby_a_id = baby_a.json()["id"]
        await self._create_media(client, headers_a, baby_a_id)

        # 用户 B 登录，创建自己的 baby
        rb = await client.post("/api/v1/auth/login", json={"code": "user_b"})
        token_b = rb.json()["accessToken"]
        headers_b = {"Authorization": f"Bearer {token_b}"}
        baby_b = await client.post("/api/v1/babies/", json={"name": "B的宝宝"}, headers=headers_b)
        baby_b_id = baby_b.json()["id"]

        # 用户 B 的 baby 媒体列表应为空
        resp = await client.get(self.BASE, params={"babyId": baby_b_id}, headers=headers_b)
        assert resp.json() == []