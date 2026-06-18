"""媒体路由补充测试 — 边缘路径覆盖"""
from unittest.mock import patch, MagicMock
from httpx import AsyncClient
from io import BytesIO
from PIL import Image


def _mock_minio():
    img = Image.new("RGB", (50, 50))
    buf = BytesIO()
    img.save(buf, format="PNG")
    img_bytes = buf.getvalue()
    mock_resp = MagicMock()
    mock_resp.read.return_value = img_bytes
    mock_resp.close = MagicMock()
    mock_resp.release_conn = MagicMock()
    mc = MagicMock()
    mc.get_object.return_value = mock_resp
    mc.put_object.return_value = None
    return mc


class TestMediaRoutesExt:
    """媒体路由未覆盖路径"""

    BASE = "/api/v1/media/"

    async def test_list_missing_baby_id(self, client: AsyncClient, auth_headers: dict):
        """缺少 babyId 参数 → 400"""
        resp = await client.get(self.BASE, headers=auth_headers)
        assert resp.status_code == 400

    async def test_update_all_fields(self, client: AsyncClient, auth_headers: dict, test_baby_id: str):
        """更新所有可选字段"""
        with patch("app.services.thumbnail_service.minio_client", _mock_minio()):
            resp = await client.post(
                self.BASE,
                json={
                    "babyId": test_baby_id, "type": "image",
                    "cosKey": "photos/ext/update_all.jpg",
                    "captureDate": "2026-06-01",
                },
                headers=auth_headers,
            )
        media_id = resp.json()["id"]

        resp = await client.put(
            f"{self.BASE}{media_id}",
            json={
                "title": "全新标题", "locationName": "公园",
                "tags": ["新标签"], "moment": "新时刻",
                "milestone": "新里程碑", "isArchived": True,
            },
            headers=auth_headers,
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["title"] == "全新标题"
        assert body["locationName"] == "公园"
        assert body["tags"] == ["新标签"]
        assert body["moment"] == "新时刻"
        assert body["milestone"] == "新里程碑"
        assert body["isArchived"] is True

    async def test_update_empty_body(self, client: AsyncClient, auth_headers: dict, test_baby_id: str):
        """空 body 更新"""
        with patch("app.services.thumbnail_service.minio_client", _mock_minio()):
            resp = await client.post(
                self.BASE,
                json={
                    "babyId": test_baby_id, "type": "image",
                    "cosKey": "photos/ext/empty_update.jpg",
                    "captureDate": "2026-06-01",
                },
                headers=auth_headers,
            )
        media_id = resp.json()["id"]

        resp = await client.put(
            f"{self.BASE}{media_id}", json={}, headers=auth_headers,
        )
        assert resp.status_code == 200