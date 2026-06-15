"""存储统计 API 测试"""

from httpx import AsyncClient


class TestStorageAPI:
    """存储统计端点测试"""

    async def test_storage_stats_requires_auth(self, client: AsyncClient):
        """未认证 → 401"""
        resp = await client.get("/api/v1/storage/stats")
        assert resp.status_code == 401

    async def test_storage_stats_empty(self, client: AsyncClient, auth_headers: dict):
        """新用户存储统计应为 0"""
        resp = await client.get("/api/v1/storage/stats", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()["data"]
        assert data["photoCount"] == 0
        assert data["videoCount"] == 0
        assert data["modelCount"] == 0
        assert data["totalMedia"] == 0
        assert data["totalSizeBytes"] == 0
        assert data["totalSizeMB"] == 0

    async def test_storage_stats_with_media(
        self, client: AsyncClient, auth_headers: dict, test_baby_id: str
    ):
        """创建媒体后统计正确"""
        # 创建照片
        await client.post(
            "/api/v1/media/",
            json={
                "babyId": test_baby_id,
                "type": "image",
                "cosKey": "photos/test/photo1.jpg",
                "captureDate": "2026-06-01",
                "title": "测试照片1",
            },
            headers=auth_headers,
        )

        # 创建视频
        await client.post(
            "/api/v1/media/",
            json={
                "babyId": test_baby_id,
                "type": "video",
                "cosKey": "videos/test/video1.mp4",
                "captureDate": "2026-06-02",
                "title": "测试视频1",
            },
            headers=auth_headers,
        )

        resp = await client.get("/api/v1/storage/stats", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()["data"]
        assert data["photoCount"] == 1
        assert data["videoCount"] == 1
        assert data["totalMedia"] == 2
        # file_size defaults to 0 when not set via create endpoint
        assert data["totalSizeBytes"] >= 0
        assert isinstance(data["totalSizeMB"], (int, float))
