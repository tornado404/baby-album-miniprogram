"""头像上传 API 端点测试

注意：头像上传使用 httpx.put 直接调用 MinIO REST API，测试中 mock httpx.put。
"""

from unittest.mock import patch, MagicMock
import httpx
from httpx import AsyncClient


class TestAvatarUploadAPI:
    """头像上传端点测试"""

    async def test_upload_avatar_success(self, client: AsyncClient, auth_headers: dict, test_baby_id: str):
        """上传头像成功（mock httpx.put）"""
        mock_resp = MagicMock(spec=httpx.Response)
        mock_resp.status_code = 200
        with patch("httpx.put", return_value=mock_resp) as mock_put:
            resp = await client.put(
                f"/api/v1/babies/{test_baby_id}/avatar",
                files={"file": ("avatar.jpg", b"fake-image-bytes", "image/jpeg")},
                headers=auth_headers,
            )
            assert resp.status_code == 200
            body = resp.json()
            assert body["code"] == 0
            assert "avatar" in body["data"]
            mock_put.assert_called_once()

    async def test_upload_avatar_baby_not_found(self, client: AsyncClient, auth_headers: dict):
        """不存在的宝宝返回 404"""
        mock_resp = MagicMock(spec=httpx.Response)
        mock_resp.status_code = 200
        with patch("httpx.put", return_value=mock_resp):
            resp = await client.put(
                "/api/v1/babies/nonexistent/avatar",
                files={"file": ("avatar.jpg", b"fake-image-bytes", "image/jpeg")},
                headers=auth_headers,
            )
            assert resp.status_code == 404

    async def test_upload_avatar_requires_auth(self, client: AsyncClient, test_baby_id: str):
        """未认证返回 401"""
        resp = await client.put(
            f"/api/v1/babies/{test_baby_id}/avatar",
            files={"file": ("avatar.jpg", b"fake-image-bytes", "image/jpeg")},
        )
        assert resp.status_code == 401

    async def test_upload_avatar_ext_validation(self, client: AsyncClient, auth_headers: dict, test_baby_id: str):
        """非图片扩展名默认为 jpg"""
        mock_resp = MagicMock(spec=httpx.Response)
        mock_resp.status_code = 200
        with patch("httpx.put", return_value=mock_resp) as mock_put:
            resp = await client.put(
                f"/api/v1/babies/{test_baby_id}/avatar",
                files={"file": ("avatar.exe", b"fake-bytes", "application/octet-stream")},
                headers=auth_headers,
            )
            assert resp.status_code == 200
            # 检查上传路径中包含 .jpg（非图片扩展名回退为 jpg）
            call_url = mock_put.call_args[0][0]
            assert call_url.endswith(".jpg")