"""上传流程 E2E 测试 — POST /upload/sign → POST /upload/callback → GET /media/

覆盖：
- 存储后端路由选择（TOS vs MinIO）
- 上传回调后 Media 记录落地（含 milestone）
- 完整流程 Login → Sign → Callback → List
- 用户数据隔离
"""

from io import BytesIO
from unittest.mock import MagicMock, patch

import pytest
from PIL import Image

from app.config import settings
from app.services import tos_service


# ── 辅助函数 ──────────────────────────────────────────────


def _make_test_image(width: int = 800, height: int = 600) -> bytes:
    """生成测试图片 bytes"""
    img = Image.new("RGB", (width, height), color=(255, 128, 64))
    buf = BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


# ── Test class ─────────────────────────────────────────────


class TestUploadSignEndpoint:
    """POST /upload/sign 端点测试 — 验证 TOS vs MinIO 路由选择"""

    BASE = "/api/v1/upload"

    async def test_sign_tos_enabled_routes_to_tos(
        self, client, auth_headers, test_baby_id
    ):
        """TOS 开启时，sign 返回火山引擎虚拟主机格式 URL"""
        # Patch TOS 相关状态：开启 TOS + TOS 可达
        with (
            patch.object(settings, "TOS_ACCESS_KEY", "fake-tos-ak"),
            patch.object(tos_service, "is_tos_enabled", return_value=True),
            patch.object(tos_service, "check_tos_available", return_value=True),
            patch(
                "app.routers.upload.tos_get_upload_url",
                return_value={
                    "uploadUrl": "https://baby-album.tos-cn-beijing.volces.com/photos/u1/abc123.png?X-Amz-...",
                    "cosKey": "photos/u1/abc123.png",
                    "method": "PUT",
                    "uploadType": "presigned",
                },
            ) as mock_tos,
            patch(
                "app.routers.upload.minio_get_upload_url",
                return_value={"uploadUrl": "", "cosKey": "", "method": "PUT", "uploadType": "presigned"},
            ) as mock_minio,
        ):
            tos_service.reset_availability()

            resp = await client.post(
                f"{self.BASE}/sign",
                json={"fileName": "test.png", "fileType": "image", "babyId": test_baby_id},
                headers=auth_headers,
            )

        assert resp.status_code == 200
        body = resp.json()
        assert body["uploadType"] == "presigned"
        assert "tos-cn-beijing.volces.com" in body["uploadUrl"]
        assert body["cosKey"].startswith("photos/")
        mock_tos.assert_called_once()
        mock_minio.assert_not_called()

    async def test_sign_tos_disabled_routes_to_minio(
        self, client, auth_headers, test_baby_id
    ):
        """TOS 关闭时，sign 走 MinIO 路径"""
        with (
            patch.object(settings, "TOS_ACCESS_KEY", ""),
            patch.object(tos_service, "is_tos_enabled", return_value=False),
            patch(
                "app.routers.upload.minio_get_upload_url",
                return_value={
                    "uploadUrl": "https://oss.qzjlyouhua.fun/photos/u1/abc123.png?...",
                    "cosKey": "photos/u1/abc123.png",
                    "method": "PUT",
                    "uploadType": "presigned",
                },
            ) as mock_minio,
            patch(
                "app.routers.upload.tos_get_upload_url",
                return_value={"uploadUrl": "", "cosKey": "", "method": "PUT", "uploadType": "presigned"},
            ) as mock_tos,
        ):
            resp = await client.post(
                f"{self.BASE}/sign",
                json={"fileName": "test.png", "fileType": "image", "babyId": test_baby_id},
                headers=auth_headers,
            )

        assert resp.status_code == 200
        body = resp.json()
        assert body["uploadType"] == "presigned"
        assert "photos/" in body["cosKey"]
        mock_minio.assert_called_once()
        mock_tos.assert_not_called()

    async def test_sign_video_type_coskey_prefix(
        self, client, auth_headers, test_baby_id
    ):
        """fileType=video 时，cosKey 以 videos/ 开头"""
        with (
            patch.object(settings, "TOS_ACCESS_KEY", "fake-ak"),
            patch.object(tos_service, "is_tos_enabled", return_value=True),
            patch.object(tos_service, "check_tos_available", return_value=True),
            patch(
                "app.routers.upload.tos_get_upload_url",
                return_value={
                    "uploadUrl": "https://baby-album.tos-cn-beijing.volces.com/videos/u1/abc.mp4?...",
                    "cosKey": "videos/u1/abc.mp4",
                    "method": "PUT",
                    "uploadType": "presigned",
                },
            ),
        ):
            tos_service.reset_availability()

            resp = await client.post(
                f"{self.BASE}/sign",
                json={"fileName": "video.mp4", "fileType": "video", "babyId": test_baby_id},
                headers=auth_headers,
            )

        assert resp.status_code == 200
        assert resp.json()["cosKey"].startswith("videos/")

    async def test_sign_requires_auth(self, client, test_baby_id):
        """未认证 → 401"""
        resp = await client.post(
            f"{self.BASE}/sign",
            json={"fileName": "x.png", "fileType": "image", "babyId": test_baby_id},
        )
        assert resp.status_code == 401


class TestUploadCallbackEndpoint:
    """POST /upload/callback 端点测试"""

    BASE = "/api/v1/upload"

    async def test_callback_happy_path(
        self, client, auth_headers, test_baby_id, db_session
    ):
        """回调成功后 Media 记录存在，task 被 dispatch"""
        from app.models.media import Media

        # 1. 先通过 sign 获取 cosKey
        with (
            patch.object(settings, "TOS_ACCESS_KEY", "fake-ak"),
            patch.object(tos_service, "is_tos_enabled", return_value=True),
            patch.object(tos_service, "check_tos_available", return_value=True),
            patch(
                "app.routers.upload.tos_get_upload_url",
                return_value={
                    "uploadUrl": "https://bucket.tos-cn-beijing.volces.com/photos/u1/abc.png?X-Amz-...",
                    "cosKey": "photos/u1/abc.png",
                    "method": "PUT",
                    "uploadType": "presigned",
                },
            ),
        ):
            tos_service.reset_availability()
            sign_resp = await client.post(
                f"{self.BASE}/sign",
                json={"fileName": "test.png", "fileType": "image", "babyId": test_baby_id},
                headers=auth_headers,
            )
        cos_key = sign_resp.json()["cosKey"]

        # 2. 直接在 DB 中创建 Media（模拟客户端已上传文件到存储）
        media = Media(
            baby_id=test_baby_id,
            user_id=(await client.post("/api/v1/auth/login", json={"code": "test_code"})).json()["userId"],
            type="image",
            cos_key=cos_key,
            cos_url=f"https://bucket.tos-cn-beijing.volces.com/{cos_key}",
            capture_date="2026-06-01",
            title="回调测试",
        )
        db_session.add(media)
        await db_session.commit()
        media_id = str(media.id)

        # 3. Mock Celery task dispatch
        mock_task = MagicMock(id="fake-task-id-123")
        with patch(
            "app.routers.upload.generate_thumbnail.delay",
            return_value=mock_task,
        ) as mock_thumb:
            resp = await client.post(
                f"{self.BASE}/callback",
                json={"mediaId": media_id},
                headers=auth_headers,
            )

        assert resp.status_code == 200
        body = resp.json()
        assert body["taskId"] == "fake-task-id-123"
        assert body["message"] == "Thumbnail generation started"
        mock_thumb.assert_called_once_with(media_id, cos_key, str(media.user_id))

        # 4. Media 记录确实存在于 DB
        from sqlalchemy import select
        r = await db_session.execute(select(Media).where(Media.id == media_id))
        fetched = r.scalar_one()
        assert fetched.cos_key == cos_key

    async def test_callback_with_milestone_and_tags(
        self, client, auth_headers, test_baby_id, db_session
    ):
        """带 milestone / moment / locationName / tags 的完整数据落地"""
        from app.models.media import Media
        from sqlalchemy import select

        # 1. 获取 cosKey
        with (
            patch.object(settings, "TOS_ACCESS_KEY", "fake-ak"),
            patch.object(tos_service, "is_tos_enabled", return_value=True),
            patch.object(tos_service, "check_tos_available", return_value=True),
            patch(
                "app.routers.upload.tos_get_upload_url",
                return_value={
                    "uploadUrl": "https://bucket.tos-cn-beijing.volces.com/photos/u1/abc.png?X-Amz-...",
                    "cosKey": "photos/u1/abc.png",
                    "method": "PUT",
                    "uploadType": "presigned",
                },
            ),
        ):
            tos_service.reset_availability()
            sign_resp = await client.post(
                f"{self.BASE}/sign",
                json={"fileName": "milestone.png", "fileType": "image", "babyId": test_baby_id},
                headers=auth_headers,
            )
        cos_key = sign_resp.json()["cosKey"]

        # 2. 创建带完整字段的 Media
        login_resp = await client.post("/api/v1/auth/login", json={"code": "test_code"})
        user_id = login_resp.json()["userId"]

        media = Media(
            baby_id=test_baby_id,
            user_id=user_id,
            type="image",
            cos_key=cos_key,
            cos_url=f"https://bucket.tos-cn-beijing.volces.com/{cos_key}",
            capture_date="2026-06-15",
            title="第一次走路",
            moment="今天终于自己走了三步",
            milestone="12个月",
            location_name="客厅",
            tags=["走路", "里程碑"],
        )
        db_session.add(media)
        await db_session.commit()
        media_id = str(media.id)

        # 3. 调用回调
        with patch("app.routers.upload.generate_thumbnail.delay", return_value=MagicMock(id="task-2")):
            resp = await client.post(
                f"{self.BASE}/callback",
                json={"mediaId": media_id},
                headers=auth_headers,
            )
        assert resp.status_code == 200

        # 4. GET /media/ 验证完整字段
        list_resp = await client.get(
            "/api/v1/media/",
            params={"babyId": test_baby_id},
            headers=auth_headers,
        )
        assert list_resp.status_code == 200
        items = list_resp.json()
        assert len(items) >= 1
        # 找刚创建的那条
        found = next((m for m in items if m["id"] == media_id), None)
        assert found is not None
        assert found["title"] == "第一次走路"
        assert found["milestone"] == "12个月"
        assert found["moment"] == "今天终于自己走了三步"
        assert found["locationName"] == "客厅"
        assert found["tags"] == ["走路", "里程碑"]

    async def test_callback_media_not_found(self, client, auth_headers):
        """mediaId 不存在 → 404 + code 40401"""
        with patch("app.routers.upload.generate_thumbnail.delay", return_value=MagicMock(id="task-x")):
            resp = await client.post(
                f"{self.BASE}/callback",
                json={"mediaId": "00000000-0000-0000-0000-000000000000"},
                headers=auth_headers,
            )
        assert resp.status_code == 404
        assert resp.json()["detail"]["code"] == 40401

    async def test_callback_missing_cos_key(self, client, auth_headers, test_baby_id, db_session):
        """Media 存在但 cos_key 为空 → 400 + code 40002"""
        from app.models.media import Media

        login_resp = await client.post("/api/v1/auth/login", json={"code": "test_code"})
        user_id = login_resp.json()["userId"]

        media = Media(
            baby_id=test_baby_id,
            user_id=user_id,
            type="image",
            cos_key=None,  # 空 cos_key
            cos_url="",
            capture_date="2026-07-01",
        )
        db_session.add(media)
        await db_session.commit()
        media_id = str(media.id)

        with patch("app.routers.upload.generate_thumbnail.delay", return_value=MagicMock(id="task-y")):
            resp = await client.post(
                f"{self.BASE}/callback",
                json={"mediaId": media_id},
                headers=auth_headers,
            )
        assert resp.status_code == 400
        assert resp.json()["detail"]["code"] == 40002

    async def test_callback_requires_auth(self, client):
        """未认证 → 401"""
        resp = await client.post(
            f"{self.BASE}/callback",
            json={"mediaId": "00000000-0000-0000-0000-000000000000"},
        )
        assert resp.status_code == 401


class TestUploadFullFlow:
    """完整上传流程端到端测试"""

    async def test_full_flow_sign_callback_list(
        self, client, auth_headers, test_baby_id, db_session
    ):
        """Login → Sign → Callback → List 能查到新建媒体及 milestone"""
        from app.models.media import Media
        from sqlalchemy import select

        # Step 1: Sign 获取 cosKey
        with (
            patch.object(settings, "TOS_ACCESS_KEY", "fake-ak"),
            patch.object(tos_service, "is_tos_enabled", return_value=True),
            patch.object(tos_service, "check_tos_available", return_value=True),
            patch(
                "app.routers.upload.tos_get_upload_url",
                return_value={
                    "uploadUrl": "https://baby-album.tos-cn-beijing.volces.com/photos/u1/e2e.png?X-Amz-...",
                    "cosKey": "photos/u1/e2e.png",
                    "method": "PUT",
                    "uploadType": "presigned",
                },
            ),
        ):
            tos_service.reset_availability()
            sign_resp = await client.post(
                "/api/v1/upload/sign",
                json={"fileName": "e2e.png", "fileType": "image", "babyId": test_baby_id},
                headers=auth_headers,
            )
        assert sign_resp.status_code == 200
        cos_key = sign_resp.json()["cosKey"]

        # Step 2: 获取 userId，在 DB 创建 Media
        login_resp = await client.post("/api/v1/auth/login", json={"code": "test_code"})
        user_id = login_resp.json()["userId"]

        media = Media(
            baby_id=test_baby_id,
            user_id=user_id,
            type="image",
            cos_key=cos_key,
            cos_url=f"https://baby-album.tos-cn-beijing.volces.com/{cos_key}",
            capture_date="2026-07-01",
            title="E2E 测试照片",
            milestone="18个月",
            tags=["测试"],
        )
        db_session.add(media)
        await db_session.commit()
        media_id = str(media.id)

        # Step 3: Callback
        with patch("app.routers.upload.generate_thumbnail.delay", return_value=MagicMock(id="task-e2e")):
            cb_resp = await client.post(
                "/api/v1/upload/callback",
                json={"mediaId": media_id},
                headers=auth_headers,
            )
        assert cb_resp.status_code == 200

        # Step 4: List 验证能看到
        list_resp = await client.get(
            "/api/v1/media/",
            params={"babyId": test_baby_id},
            headers=auth_headers,
        )
        assert list_resp.status_code == 200
        items = list_resp.json()

        found = next((m for m in items if m["id"] == media_id), None)
        assert found is not None
        assert found["title"] == "E2E 测试照片"
        assert found["milestone"] == "18个月"
        assert found["tags"] == ["测试"]
        assert found["type"] == "image"

    async def test_user_isolation(
        self, client, auth_headers, test_baby_id, db_session
    ):
        """用户 A 创建的媒体，用户 B 列表中不可见"""
        from app.models.media import Media

        # 用另一个 code 登录获取不同用户
        resp_b = await client.post("/api/v1/auth/login", json={"code": "user_b_code"})
        user_b_id = resp_b.json()["userId"]
        headers_b = {"Authorization": f"Bearer {resp_b.json()['accessToken']}"}

        # 用户 A 的 Media（用已有的 auth_headers）
        with (
            patch.object(settings, "TOS_ACCESS_KEY", "fake-ak"),
            patch.object(tos_service, "is_tos_enabled", return_value=True),
            patch.object(tos_service, "check_tos_available", return_value=True),
            patch(
                "app.routers.upload.tos_get_upload_url",
                return_value={
                    "uploadUrl": "https://bucket.tos-cn-beijing.volces.com/photos/u1/isol.png?X-Amz-...",
                    "cosKey": "photos/u1/isol.png",
                    "method": "PUT",
                    "uploadType": "presigned",
                },
            ),
        ):
            tos_service.reset_availability()
            sign_resp = await client.post(
                "/api/v1/upload/sign",
                json={"fileName": "isol.png", "fileType": "image", "babyId": test_baby_id},
                headers=auth_headers,
            )
        cos_key = sign_resp.json()["cosKey"]

        login_resp_a = await client.post("/api/v1/auth/login", json={"code": "test_code"})
        user_a_id = login_resp_a.json()["userId"]

        media_a = Media(
            baby_id=test_baby_id,
            user_id=user_a_id,
            type="image",
            cos_key=cos_key,
            cos_url=f"https://bucket.tos-cn-beijing.volces.com/{cos_key}",
            capture_date="2026-07-01",
            title="用户 A 的照片",
        )
        db_session.add(media_a)
        await db_session.commit()

        # 用户 B 的列表不应该有用户 A 的媒体
        list_b_resp = await client.get(
            "/api/v1/media/",
            params={"babyId": test_baby_id},
            headers=headers_b,
        )
        assert list_b_resp.status_code == 200
        items_b = list_b_resp.json()
        titles = [m["title"] for m in items_b]
        assert "用户 A 的照片" not in titles
