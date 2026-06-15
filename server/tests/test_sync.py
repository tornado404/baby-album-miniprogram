"""SyncLog 自动写入 + 同步状态查询测试"""

from httpx import AsyncClient


class TestSyncLogAutoWrite:
    """CRUD 操作后 SyncLog 自动记录"""

    async def _create_baby(self, client: AsyncClient, headers: dict, **overrides) -> dict:
        payload = {"name": "同步测试宝宝", "gender": "female", "birthDate": "2026-01-01"}
        payload.update(overrides)
        resp = await client.post("/api/v1/babies/", json=payload, headers=headers)
        assert resp.status_code == 200
        return resp.json()

    async def _create_media(
        self, client: AsyncClient, headers: dict,
        baby_id: str, **overrides
    ) -> dict:
        payload = {
            "babyId": baby_id,
            "type": "image",
            "cosKey": "photos/test/photo.jpg",
            "captureDate": "2026-06-01",
            "title": "同步测试照片",
        }
        payload.update(overrides)
        resp = await client.post("/api/v1/media/", json=payload, headers=headers)
        assert resp.status_code == 200
        return resp.json()

    # ── Baby CRUD → SyncLog ───────────────────────────

    async def test_baby_create_generates_sync_log(
        self, client: AsyncClient, auth_headers: dict
    ):
        """创建宝宝后 SyncLog 自动记录 create"""
        baby = await self._create_baby(client, auth_headers)

        # 查询同步状态，应有 1 条 baby create 记录
        resp = await client.get("/api/v1/sync/status", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()["data"]
        assert data["pendingChanges"] >= 1
        assert data["entityCounts"]["baby"]["create"] >= 1

        # 增量同步应包含该变更
        resp = await client.get(
            "/api/v1/sync/delta", params={"since": "2000-01-01T00:00:00"}, headers=auth_headers
        )
        assert resp.status_code == 200
        changes = resp.json()["data"]["changes"]
        baby_creates = [
            c for c in changes
            if c["entityType"] == "baby" and c["action"] == "create" and c["entityId"] == baby["id"]
        ]
        assert len(baby_creates) == 1

    async def test_baby_update_generates_sync_log(
        self, client: AsyncClient, auth_headers: dict
    ):
        """更新宝宝后 SyncLog 自动记录 update"""
        baby = await self._create_baby(client, auth_headers)

        resp = await client.put(
            f"/api/v1/babies/{baby['id']}",
            json={"name": "更新名字"},
            headers=auth_headers,
        )
        assert resp.status_code == 200

        # 查询同步状态
        resp = await client.get("/api/v1/sync/status", headers=auth_headers)
        data = resp.json()["data"]
        assert data["entityCounts"]["baby"]["update"] >= 1

        # 增量同步应包含 update 记录
        resp = await client.get(
            "/api/v1/sync/delta", params={"since": "2000-01-01T00:00:00"}, headers=auth_headers
        )
        changes = resp.json()["data"]["changes"]
        baby_updates = [
            c for c in changes
            if c["entityType"] == "baby" and c["action"] == "update" and c["entityId"] == baby["id"]
        ]
        assert len(baby_updates) == 1

    async def test_baby_delete_generates_sync_log(
        self, client: AsyncClient, auth_headers: dict
    ):
        """删除宝宝后 SyncLog 自动记录 delete"""
        baby = await self._create_baby(client, auth_headers)

        resp = await client.delete(
            f"/api/v1/babies/{baby['id']}", headers=auth_headers
        )
        assert resp.status_code == 200

        # 查询同步状态
        resp = await client.get("/api/v1/sync/status", headers=auth_headers)
        data = resp.json()["data"]
        assert data["entityCounts"]["baby"]["delete"] >= 1

        # 增量同步应包含 delete 记录
        resp = await client.get(
            "/api/v1/sync/delta", params={"since": "2000-01-01T00:00:00"}, headers=auth_headers
        )
        changes = resp.json()["data"]["changes"]
        baby_deletes = [
            c for c in changes
            if c["entityType"] == "baby" and c["action"] == "delete" and c["entityId"] == baby["id"]
        ]
        assert len(baby_deletes) == 1

    # ── Media CRUD → SyncLog ──────────────────────────

    async def test_media_create_generates_sync_log(
        self, client: AsyncClient, auth_headers: dict, test_baby_id: str
    ):
        """创建媒体后 SyncLog 自动记录 create"""
        media = await self._create_media(client, auth_headers, test_baby_id)

        # 查询同步状态
        resp = await client.get("/api/v1/sync/status", headers=auth_headers)
        data = resp.json()["data"]
        assert data["entityCounts"]["media"]["create"] >= 1

        # 增量同步应包含该变更
        resp = await client.get(
            "/api/v1/sync/delta", params={"since": "2000-01-01T00:00:00"}, headers=auth_headers
        )
        changes = resp.json()["data"]["changes"]
        media_creates = [
            c for c in changes
            if c["entityType"] == "media" and c["action"] == "create" and c["entityId"] == media["id"]
        ]
        assert len(media_creates) == 1

    async def test_media_delete_generates_sync_log(
        self, client: AsyncClient, auth_headers: dict, test_baby_id: str
    ):
        """删除媒体后 SyncLog 自动记录 delete"""
        media = await self._create_media(client, auth_headers, test_baby_id)

        resp = await client.delete(
            f"/api/v1/media/{media['id']}", headers=auth_headers
        )
        assert resp.status_code == 200

        # 查询同步状态
        resp = await client.get("/api/v1/sync/status", headers=auth_headers)
        data = resp.json()["data"]
        assert data["entityCounts"]["media"]["delete"] >= 1

        # 增量同步应包含 delete 记录
        resp = await client.get(
            "/api/v1/sync/delta", params={"since": "2000-01-01T00:00:00"}, headers=auth_headers
        )
        changes = resp.json()["data"]["changes"]
        media_deletes = [
            c for c in changes
            if c["entityType"] == "media" and c["action"] == "delete" and c["entityId"] == media["id"]
        ]
        assert len(media_deletes) == 1

    # ── SyncLog 字段正确性 ──────────────────────────────

    async def test_sync_log_correct_entity_type_and_action(
        self, client: AsyncClient, auth_headers: dict
    ):
        """SyncLog 的 entity_type 和 action 字段值正确"""
        baby = await self._create_baby(client, auth_headers, name="字段验证宝宝")

        resp = await client.get(
            "/api/v1/sync/delta", params={"since": "2000-01-01T00:00:00"}, headers=auth_headers
        )
        changes = resp.json()["data"]["changes"]

        # 找到该宝宝的 create 记录
        create_log = [
            c for c in changes
            if c["entityId"] == baby["id"] and c["action"] == "create"
        ][0]
        assert create_log["entityType"] == "baby"
        assert create_log["action"] == "create"
        assert create_log["entityId"] == baby["id"]


class TestSyncStatusEndpoint:
    """GET /api/v1/sync/status 端点测试"""

    async def test_sync_status_empty(self, client: AsyncClient, auth_headers: dict):
        """无任何操作时同步状态为零"""
        resp = await client.get("/api/v1/sync/status", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data["code"] == 0
        assert data["data"]["pendingChanges"] == 0
        assert data["data"]["lastSyncTime"] is None
        assert data["data"]["entityCounts"]["baby"]["create"] == 0
        assert data["data"]["entityCounts"]["media"]["create"] == 0

    async def test_sync_status_after_crud(
        self, client: AsyncClient, auth_headers: dict, test_baby_id: str
    ):
        """CRUD 操作后同步状态正确"""
        # test_baby_id fixture 已创建了一个 baby (create)
        # 再创建一条 media
        payload = {
            "babyId": test_baby_id,
            "type": "image",
            "cosKey": "photos/test/status.jpg",
            "captureDate": "2026-06-01",
        }
        resp = await client.post("/api/v1/media/", json=payload, headers=auth_headers)
        assert resp.status_code == 200

        # 查询同步状态
        resp = await client.get("/api/v1/sync/status", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()["data"]
        assert data["pendingChanges"] >= 2  # 至少 baby create + media create
        assert data["lastSyncTime"] is not None
        assert data["entityCounts"]["baby"]["create"] >= 1
        assert data["entityCounts"]["media"]["create"] >= 1

    async def test_sync_status_counts_by_action(
        self, client: AsyncClient, auth_headers: dict
    ):
        """按 action 分类计数正确"""
        # 创建宝宝
        baby = await client.post(
            "/api/v1/babies/",
            json={"name": "计数测试宝宝"},
            headers=auth_headers,
        )
        assert baby.status_code == 200
        baby_id = baby.json()["id"]

        # 更新宝宝
        await client.put(
            f"/api/v1/babies/{baby_id}",
            json={"name": "更新后名字"},
            headers=auth_headers,
        )

        # 删除宝宝
        await client.delete(f"/api/v1/babies/{baby_id}", headers=auth_headers)

        # 查询同步状态
        resp = await client.get("/api/v1/sync/status", headers=auth_headers)
        data = resp.json()["data"]
        # 应有 1 create, 1 update, 1 delete
        assert data["entityCounts"]["baby"]["create"] >= 1
        assert data["entityCounts"]["baby"]["update"] >= 1
        assert data["entityCounts"]["baby"]["delete"] >= 1

    async def test_sync_status_requires_auth(self, client: AsyncClient):
        """未认证 → 401"""
        resp = await client.get("/api/v1/sync/status")
        assert resp.status_code == 401


class TestSyncDeltaIncludesLoggedChanges:
    """GET /sync/delta 包含自动写入的变更"""

    async def test_delta_includes_baby_create(
        self, client: AsyncClient, auth_headers: dict
    ):
        """增量同步返回 baby create 变更"""
        baby = await client.post(
            "/api/v1/babies/",
            json={"name": "增量测试宝宝"},
            headers=auth_headers,
        )
        baby_id = baby.json()["id"]

        resp = await client.get(
            "/api/v1/sync/delta",
            params={"since": "2000-01-01T00:00:00"},
            headers=auth_headers,
        )
        assert resp.status_code == 200
        changes = resp.json()["data"]["changes"]
        matching = [
            c for c in changes
            if c["entityId"] == baby_id and c["entityType"] == "baby" and c["action"] == "create"
        ]
        assert len(matching) == 1

    async def test_delta_includes_media_create_and_delete(
        self, client: AsyncClient, auth_headers: dict, test_baby_id: str
    ):
        """增量同步返回 media 的 create 和 delete 变更"""
        # 创建媒体
        payload = {
            "babyId": test_baby_id,
            "type": "image",
            "cosKey": "photos/test/delta.jpg",
            "captureDate": "2026-06-01",
        }
        media_resp = await client.post("/api/v1/media/", json=payload, headers=auth_headers)
        media_id = media_resp.json()["id"]

        # 删除媒体
        await client.delete(f"/api/v1/media/{media_id}", headers=auth_headers)

        # 增量同步
        resp = await client.get(
            "/api/v1/sync/delta",
            params={"since": "2000-01-01T00:00:00"},
            headers=auth_headers,
        )
        changes = resp.json()["data"]["changes"]

        media_changes = [c for c in changes if c["entityId"] == media_id]
        actions = {c["action"] for c in media_changes}
        assert "create" in actions
        assert "delete" in actions
