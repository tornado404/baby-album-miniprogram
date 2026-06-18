"""数据分析路由补充测试 — growth-compare + 统计边缘情况"""
from unittest.mock import MagicMock
from httpx import AsyncClient


class TestAnalyticsExt:
    """分析路由补充覆盖"""

    async def test_growth_compare_no_auth(self, client: AsyncClient):
        """未认证 → 401"""
        resp = await client.get(
            "/api/v1/analytics/growth-compare", params={"baby_id": "x"}
        )
        assert resp.status_code == 401

    async def test_growth_compare_baby_not_found(self, client: AsyncClient, auth_headers: dict):
        """不存在的宝宝 → 404"""
        resp = await client.get(
            "/api/v1/analytics/growth-compare",
            params={"baby_id": "nonexistent"},
            headers=auth_headers,
        )
        assert resp.status_code == 404

    async def test_growth_compare_no_media(self, client: AsyncClient, auth_headers: dict, test_baby_id: str):
        """无媒体 """
        resp = await client.get(
            "/api/v1/analytics/growth-compare",
            params={"baby_id": test_baby_id},
            headers=auth_headers,
        )
        assert resp.status_code == 200
        d = resp.json()["data"]
        assert d["milestones"] == []
        assert d["latestPhoto"] is None

    async def test_growth_compare_with_data(self, client: AsyncClient, auth_headers: dict, test_baby_id: str):
        """有里程碑媒体时"""
        from unittest.mock import patch
        from io import BytesIO
        from PIL import Image

        img = Image.new("RGB", (50, 50))
        buf = BytesIO()
        img.save(buf, format="PNG")
        img_bytes = buf.getvalue()

        mock_resp = MagicMock()
        mock_resp.read.return_value = img_bytes
        mock_resp.close = MagicMock()
        mock_resp.release_conn = MagicMock()
        mock_minio = MagicMock()
        mock_minio.get_object.return_value = mock_resp
        mock_minio.put_object.return_value = None

        with patch("app.services.thumbnail_service.minio_client", mock_minio):
            await client.post(
                "/api/v1/media/",
                json={
                    "babyId": test_baby_id, "type": "image",
                    "cosKey": "photos/ext/gc1.jpg",
                    "captureDate": "2026-01-15", "milestone": "出生",
                },
                headers=auth_headers,
            )

        resp = await client.get(
            "/api/v1/analytics/growth-compare",
            params={"baby_id": test_baby_id},
            headers=auth_headers,
        )
        assert resp.status_code == 200
        milestones = resp.json()["data"]["milestones"]
        assert len(milestones) >= 1