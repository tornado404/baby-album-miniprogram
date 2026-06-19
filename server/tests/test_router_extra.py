"""Router extra coverage tests — targets uncovered endpoints"""

import httpx
from unittest.mock import patch, MagicMock


class TestAnalyticsGrowthCompare:
    """GET /api/v1/analytics/growth-compare (全覆盖)"""

    async def test_growth_compare_requires_auth(self, client):
        resp = await client.get("/api/v1/analytics/growth-compare", params={"baby_id": "x"})
        assert resp.status_code == 401

    async def test_growth_compare_baby_not_found(self, client, auth_headers):
        resp = await client.get(
            "/api/v1/analytics/growth-compare",
            params={"baby_id": "nonexistent"},
            headers=auth_headers,
        )
        assert resp.status_code == 404

    async def test_growth_compare_empty(self, client, auth_headers, test_baby_id):
        resp = await client.get(
            "/api/v1/analytics/growth-compare",
            params={"baby_id": test_baby_id},
            headers=auth_headers,
        )
        assert resp.status_code == 200
        data = resp.json()["data"]
        assert data["milestones"] == []
        assert data["latestPhoto"] is None

    async def test_growth_compare_with_milestone(self, client, auth_headers, test_baby_id):
        await client.post(
            "/api/v1/media/",
            json={
                "babyId": test_baby_id,
                "type": "image",
                "cosKey": "photos/test/gc_1.jpg",
                "captureDate": "2026-03-15",
                "title": "翻身",
                "milestone": "翻身",
            },
            headers=auth_headers,
        )
        await client.post(
            "/api/v1/media/",
            json={
                "babyId": test_baby_id,
                "type": "image",
                "cosKey": "photos/test/gc_2.jpg",
                "captureDate": "2026-06-01",
                "title": "学坐",
                "milestone": "学坐",
            },
            headers=auth_headers,
        )

        resp = await client.get(
            "/api/v1/analytics/growth-compare",
            params={"baby_id": test_baby_id},
            headers=auth_headers,
        )
        assert resp.status_code == 200
        data = resp.json()["data"]
        assert len(data["milestones"]) == 2
        keys = [m["key"] for m in data["milestones"]]
        assert "翻身" in keys
        assert "学坐" in keys
        assert data["latestPhoto"] is not None


class TestBabyExtras:
    """Baby router uncovered endpoints"""

    BASE = "/api/v1/babies/"

    async def test_milestones_not_found(self, client, auth_headers):
        resp = await client.get(f"{TestBabyExtras.BASE}nonexistent/milestones", headers=auth_headers)
        assert resp.status_code == 404

    async def test_milestones_ok(self, client, auth_headers, test_baby_id):
        resp = await client.get(f"{TestBabyExtras.BASE}{test_baby_id}/milestones", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()["data"]
        assert len(data["milestones"]) > 0

    async def test_avatar_upload_file_too_large(self, client, auth_headers, test_baby_id):
        mock_resp = MagicMock(spec=httpx.Response)
        mock_resp.status_code = 200
        with patch("httpx.put", return_value=mock_resp):
            resp = await client.put(
                f"{TestBabyExtras.BASE}{test_baby_id}/avatar",
                files={"file": ("big.jpg", b"x" * 21 * 1024 * 1024, "image/jpeg")},
                headers=auth_headers,
            )
            assert resp.status_code == 400

    async def test_avatar_upload_minio_failure(self, client, auth_headers, test_baby_id):
        mock_resp = MagicMock(spec=httpx.Response)
        mock_resp.status_code = 500
        with patch("httpx.put", return_value=mock_resp):
            resp = await client.put(
                f"{TestBabyExtras.BASE}{test_baby_id}/avatar",
                files={"file": ("avatar.jpg", b"fake", "image/jpeg")},
                headers=auth_headers,
            )
            assert resp.status_code == 500

    async def test_avatar_upload_minio_204(self, client, auth_headers, test_baby_id):
        mock_resp = MagicMock(spec=httpx.Response)
        mock_resp.status_code = 204
        with patch("httpx.put", return_value=mock_resp):
            resp = await client.put(
                f"{TestBabyExtras.BASE}{test_baby_id}/avatar",
                files={"file": ("avatar.png", b"fake-png", "image/png")},
                headers=auth_headers,
            )
            assert resp.status_code == 200
            assert resp.json()["code"] == 0

    async def test_avatar_upload_invalid_ext(self, client, auth_headers, test_baby_id):
        mock_resp = MagicMock(spec=httpx.Response)
        mock_resp.status_code = 200
        with patch("httpx.put", return_value=mock_resp) as mock_put:
            resp = await client.put(
                f"{TestBabyExtras.BASE}{test_baby_id}/avatar",
                files={"file": ("avatar.bmp", b"fake-bmp", "image/bmp")},
                headers=auth_headers,
            )
            assert resp.status_code == 200
            call_url = mock_put.call_args[0][0]
            assert call_url.endswith(".jpg")

    async def test_list_babies_stats(self, client, auth_headers, test_baby_id):
        resp = await client.get(TestBabyExtras.BASE, headers=auth_headers)
        assert resp.status_code == 200
        babies = resp.json()
        assert len(babies) == 1
        assert "photoCount" in babies[0]
        assert "videoCount" in babies[0]


class TestMediaExtras:
    """Media router uncovered endpoints"""

    async def test_list_media_missing_babyid(self, client, auth_headers):
        resp = await client.get("/api/v1/media/", headers=auth_headers)
        assert resp.status_code == 400

    async def test_get_media_not_found(self, client, auth_headers):
        resp = await client.get("/api/v1/media/nonexistent", headers=auth_headers)
        assert resp.status_code == 404

    async def test_delete_media(self, client, auth_headers, test_baby_id):
        cr = await client.post(
            "/api/v1/media/",
            json={"babyId": test_baby_id, "type": "image", "cosKey": "photos/test/del.jpg", "captureDate": "2026-06-01"},
            headers=auth_headers,
        )
        media_id = cr.json()["id"]
        resp = await client.delete(f"/api/v1/media/{media_id}", headers=auth_headers)
        assert resp.status_code == 200
        assert resp.json()["message"] == "Deleted"

    async def test_delete_media_not_found(self, client, auth_headers):
        resp = await client.delete("/api/v1/media/nonexistent", headers=auth_headers)
        assert resp.status_code == 404

    async def test_update_media_not_found(self, client, auth_headers):
        resp = await client.put(
            "/api/v1/media/nonexistent",
            json={"title": "new"},
            headers=auth_headers,
        )
        assert resp.status_code == 404

    async def test_create_media_with_all_fields(self, client, auth_headers, test_baby_id):
        resp = await client.post(
            "/api/v1/media/",
            json={
                "babyId": test_baby_id,
                "type": "video",
                "cosKey": "videos/test/full.mp4",
                "captureDate": "2026-06-15",
                "title": "完整字段",
                "locationName": "北京",
                "tags": ["tag1", "tag2"],
                "moment": "游玩",
                "milestone": "独立行走",
            },
            headers=auth_headers,
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["locationName"] == "北京"
        assert body["tags"] == ["tag1", "tag2"]
        assert body["moment"] == "游玩"
        assert body["milestone"] == "独立行走"

    async def test_batch_archive(self, client, auth_headers, test_baby_id):
        cr1 = await client.post("/api/v1/media/", json={"babyId": test_baby_id, "type": "image", "cosKey": "photos/test/ba1.jpg", "captureDate": "2026-06-01"}, headers=auth_headers)
        cr2 = await client.post("/api/v1/media/", json={"babyId": test_baby_id, "type": "image", "cosKey": "photos/test/ba2.jpg", "captureDate": "2026-06-02"}, headers=auth_headers)
        ids = [cr1.json()["id"], cr2.json()["id"]]

        resp = await client.put("/api/v1/media/batch-archive", json={"ids": ids, "archived": True}, headers=auth_headers)
        assert resp.status_code == 200
        assert resp.json()["archived"] is True

        resp = await client.put("/api/v1/media/batch-archive", json={"ids": ids, "archived": False}, headers=auth_headers)
        assert resp.status_code == 200
        assert resp.json()["archived"] is False

    async def test_batch_tag(self, client, auth_headers, test_baby_id):
        cr = await client.post("/api/v1/media/", json={"babyId": test_baby_id, "type": "image", "cosKey": "photos/test/bt.jpg", "captureDate": "2026-06-01", "tags": ["old"]}, headers=auth_headers)
        mid = cr.json()["id"]

        resp = await client.put("/api/v1/media/batch-tag", json={"ids": [mid], "tags": ["new"], "action": "add"}, headers=auth_headers)
        assert resp.status_code == 200

        resp = await client.get(f"/api/v1/media/{mid}", headers=auth_headers)
        assert "new" in resp.json()["tags"]

        resp = await client.put("/api/v1/media/batch-tag", json={"ids": [mid], "tags": ["old"], "action": "remove"}, headers=auth_headers)
        assert resp.status_code == 200

        resp = await client.get(f"/api/v1/media/{mid}", headers=auth_headers)
        assert "old" not in resp.json()["tags"]


class TestShareExtras:
    """Share router uncovered endpoints"""

    async def test_accept_invitation_invalid_token(self, client, auth_headers):
        resp = await client.post(
            "/api/v1/share/accept",
            json={"token": "invalid-token"},
            headers=auth_headers,
        )
        assert resp.status_code == 400

    async def test_relations_list(self, client, auth_headers):
        resp = await client.get("/api/v1/share/relations", headers=auth_headers)
        assert resp.status_code == 200
        assert resp.json()["code"] == 0


class TestUploadExtras:
    """Upload router uncovered endpoints"""

    async def test_upload_sign(self, client, auth_headers, test_baby_id):
        resp = await client.post(
            "/api/v1/upload/sign",
            json={"fileName": "test.jpg", "fileType": "image/jpeg", "babyId": test_baby_id},
            headers=auth_headers,
        )
        assert resp.status_code == 200
        body = resp.json()
        assert "uploadUrl" in body
        assert "cosKey" in body

    async def test_upload_callback_media_not_found(self, client, auth_headers):
        resp = await client.post(
            "/api/v1/upload/callback",
            json={"mediaId": "nonexistent"},
            headers=auth_headers,
        )
        assert resp.status_code == 404


class TestMainApp:
    """app/main.py uncovered endpoints"""

    async def test_health_check(self, client):
        resp = await client.get("/health")
        assert resp.status_code == 200

    async def test_root_endpoint(self, client):
        resp = await client.get("/")
        assert resp.status_code in (200, 404)

    async def test_invalid_token_rate_limiter(self, client):
        resp = await client.get("/api/v1/babies/", headers={"Authorization": "Bearer invalid.jwt.token"})
        assert resp.status_code == 401


class TestSyncExtras:
    """Sync router uncovered branches"""

    async def test_full_sync_empty(self, client, auth_headers, test_baby_id):
        resp = await client.post(
            "/api/v1/sync/full",
            json={"babies": [], "media": []},
            headers=auth_headers,
        )
        assert resp.status_code == 200
        assert resp.json()["code"] == 0


class TestUploadCallbackSuccess:
    """Upload callback success path (mock Celery)"""

    async def test_upload_callback_success(self, client, auth_headers, test_baby_id, monkeypatch):
        """创建媒体后调用 callback，覆盖 success 路径"""
        from unittest.mock import MagicMock
        mock_task = MagicMock()
        mock_task.id = "mock-task-id-123"
        mock_delay = MagicMock(return_value=mock_task)

        import app.tasks.thumbnail
        monkeypatch.setattr(app.tasks.thumbnail.generate_thumbnail, "delay", mock_delay)

        cr = await client.post(
            "/api/v1/media/",
            json={
                "babyId": test_baby_id,
                "type": "image",
                "cosKey": "photos/test/cb.jpg",
                "captureDate": "2026-06-01",
            },
            headers=auth_headers,
        )
        media_id = cr.json()["id"]

        resp = await client.post(
            "/api/v1/upload/callback",
            json={"mediaId": media_id},
            headers=auth_headers,
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["taskId"] == "mock-task-id-123"
        assert body["message"] == "Thumbnail generation started"
        mock_delay.assert_called_once()


class TestShareBabyMedia:
    """GET /api/v1/share/babies/{id}/media with real media"""

    async def _login(self, client, code):
        resp = await client.post("/api/v1/auth/login", json={"code": code})
        assert resp.status_code == 200
        data = resp.json()
        return data["accessToken"], {"Authorization": f"Bearer {data['accessToken']}"}

    async def test_shared_baby_media_with_content(self, client):
        """共享宝宝的媒体可查看"""
        owner_token, owner_headers = await self._login(client, "share_media_owner")
        baby_resp = await client.post(
            "/api/v1/babies/",
            json={"name": "媒体测试宝宝", "gender": "male", "birthDate": "2026-01-01"},
            headers=owner_headers,
        )
        baby_id = baby_resp.json()["id"]

        # 创建媒体
        await client.post(
            "/api/v1/media/",
            json={"babyId": baby_id, "type": "image", "cosKey": "photos/test/sm.jpg", "captureDate": "2026-06-01"},
            headers=owner_headers,
        )

        # 邀请 viewer
        inv = await client.post(
            "/api/v1/share/invitations",
            json={"babyId": baby_id, "permission": "viewer"},
            headers=owner_headers,
        )
        token = inv.json()["data"]["token"]

        _, viewer_headers = await self._login(client, "share_media_viewer")
        await client.post("/api/v1/share/accept", json={"token": token}, headers=viewer_headers)

        resp = await client.get(f"/api/v1/share/babies/{baby_id}/media", headers=viewer_headers)
        assert resp.status_code == 200
        data = resp.json()["data"]
        assert len(data) == 1
        assert data[0]["type"] == "image"
        assert data[0]["cosUrl"] is not None