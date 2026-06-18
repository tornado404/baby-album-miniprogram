"""存储统计补充测试 — 3D 模型计数"""
from unittest.mock import MagicMock
from httpx import AsyncClient
from io import BytesIO
from PIL import Image


class TestStorageExt:
    """存储统计补充覆盖"""

    async def test_stats_with_threedmodel(self, client: AsyncClient, auth_headers: dict, test_baby_id: str):
        """3D 模型计入 modelCount"""
        from unittest.mock import patch

        img = Image.new("RGB", (50, 50))
        buf = BytesIO()
        img.save(buf, format="PNG")
        mock_resp = MagicMock()
        mock_resp.read.return_value = buf.getvalue()
        mock_resp.close = MagicMock()
        mock_resp.release_conn = MagicMock()
        mc = MagicMock()
        mc.get_object.return_value = mock_resp
        mc.put_object.return_value = None

        with patch("app.services.thumbnail_service.minio_client", mc):
            await client.post(
                "/api/v1/media/",
                json={
                    "babyId": test_baby_id, "type": "threedmodel",
                    "cosKey": "models/ext/test.glb",
                    "captureDate": "2026-06-15",
                },
                headers=auth_headers,
            )

        resp = await client.get("/api/v1/storage/stats", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()["data"]
        assert data["modelCount"] == 1
        assert data["totalMedia"] >= 1