"""媒体模块测试 — CRUD + GET single + PUT update + Batch Archive + Batch Tag"""

from io import BytesIO
from unittest.mock import patch, MagicMock

import pytest
from httpx import AsyncClient
from PIL import Image


def _make_test_image(width=800, height=600) -> bytes:
    """生成测试图片 bytes，供 mock MinIO 返回"""
    img = Image.new("RGB", (width, height), color=(255, 128, 64))
    buf = BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


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


# ══════════════════════════════════════════════════════════
# create_media 的 type 字段类型一致性回归测试
#
# 背景：MediaCreateBody.type 是 str，路由转成 dict 传给 MediaService.create_media，
# 新建的 Media 对象 type 是字符串而非 MediaType 枚举；flush 后未从 DB 重新加载，
# 访问 m.type.value 会抛 AttributeError: 'str' object has no attribute 'value'。
# 这些测试确保 create_media 对字符串和枚举两种形态都能正确处理。
# ══════════════════════════════════════════════════════════


def _mock_minio_with_image(width=1339, height=700):
    """构造 mock MinIO client，get_object 返回测试图片 bytes"""
    test_image = _make_test_image(width, height)
    mock_response = MagicMock()
    mock_response.read.return_value = test_image
    mock_response.close = MagicMock()
    mock_response.release_conn = MagicMock()

    mock_minio = MagicMock()
    mock_minio.get_object.return_value = mock_response
    mock_minio.put_object.return_value = None
    return mock_minio


class TestCreateMediaTypeConsistency:
    """create_media 中 m.type 形态兼容性回归测试"""

    BASE = "/api/v1/media/"

    async def test_create_image_triggers_thumbnail(
        self, client: AsyncClient, auth_headers: dict, test_baby_id: str
    ):
        """图片类型应触发缩略图生成并回填尺寸/文件大小

        若 create_media 用 m.type.value 访问，此测试会因 AttributeError 触发 500。
        """
        with patch("app.services.thumbnail_service.minio_client", _mock_minio_with_image()):
            body = await self._create_media_via_api(client, auth_headers, test_baby_id, type="image")

        assert body["thumbnailUrl"] is not None
        assert "thumbnails/" in body["thumbnailUrl"]
        assert body["width"] == 1339
        assert body["height"] == 700
        assert body["fileSize"] > 0

    @pytest.mark.parametrize("media_type", ["image", "video", "threedmodel"])
    async def test_create_all_types_no_500(
        self, client: AsyncClient, auth_headers: dict, test_baby_id: str, media_type: str
    ):
        """所有 type 值传入字符串都不应抛 AttributeError

        覆盖 m.type.value 在字符串形态下的兼容性。
        video/threedmodel 不会触发缩略图，但 create_media 仍需走完 type 判断。
        """
        with patch("app.services.thumbnail_service.minio_client", _mock_minio_with_image()):
            body = await self._create_media_via_api(
                client, auth_headers, test_baby_id, type=media_type
            )

        assert body["type"] == media_type
        if media_type == "image":
            assert body["thumbnailUrl"] is not None
        else:
            assert body["thumbnailUrl"] is None

    async def test_create_then_list_type_consistency(
        self, client: AsyncClient, auth_headers: dict, test_baby_id: str
    ):
        """create 返回与 list 返回的 type 字段都应能安全比较

        确保新建对象（type 为字符串）和数据库加载对象（type 为枚举）
        两种生命周期阶段返回的 type 值一致。
        """
        with patch("app.services.thumbnail_service.minio_client", _mock_minio_with_image()):
            created = await self._create_media_via_api(client, auth_headers, test_baby_id)

        resp = await client.get(self.BASE, params={"babyId": test_baby_id}, headers=auth_headers)
        listed = resp.json()

        assert created["type"] == "image"
        assert listed[0]["type"] == "image"

    @staticmethod
    async def _create_media_via_api(
        client: AsyncClient, headers: dict, baby_id: str, **overrides
    ) -> dict:
        payload = {
            "babyId": baby_id,
            "type": "image",
            "cosKey": f"photos/test/{baby_id[:8]}_photo.png",
            "captureDate": "2026-06-17",
            "title": "类型一致性测试",
        }
        payload.update(overrides)
        resp = await client.post("/api/v1/media/", json=payload, headers=headers)
        assert resp.status_code == 200, f"create_media failed: {resp.status_code} {resp.text}"
        return resp.json()