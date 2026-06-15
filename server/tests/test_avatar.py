"""头像上传 API 端点测试

注意：头像上传依赖 MinIO，测试中 mock minio_client.put_object。
"""

from unittest.mock import patch, MagicMock
from httpx import AsyncClient


class TestAvatarUploadAPI:
    """头像上传端点测试"""

    async def test_upload_avatar_success(self, client: AsyncClient, auth_headers: dict, test_baby_id: str):
        """上传头像成功（mock MinIO）"""
        with patch("app.routers.baby.minio_client") as mock_minio:
            mock_minio.put_object = MagicMock()

            resp = await client.put(
                f"/api/v1/babies/{test_baby_id}/avatar",
                files={"file": ("avatar.jpg", b"fake-image-bytes", "image/jpeg")},
                headers=auth_headers,
            )
            assert resp.status_code == 200
            body = resp.json()
            assert body["code"] == 0
            assert "avatar" in body["data"]
            # 验证 MinIO put_object 被调用
            mock_minio.put_object.assert_called_once()

    async def test_upload_avatar_baby_not_found(self, client: AsyncClient, auth_headers: dict):
        """不存在的宝宝返回 404"""
        with patch("app.routers.baby.minio_client") as mock_minio:
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
        with patch("app.routers.baby.minio_client") as mock_minio:
            mock_minio.put_object = MagicMock()

            resp = await client.put(
                f"/api/v1/babies/{test_baby_id}/avatar",
                files={"file": ("avatar.exe", b"fake-bytes", "application/octet-stream")},
                headers=auth_headers,
            )
            assert resp.status_code == 200
            # 检查上传路径中包含 .jpg（非图片扩展名回退为 jpg）
            call_args = mock_minio.put_object.call_args
            object_path = call_args[0][1]  # 第二个位置参数
            assert object_path.endswith(".jpg")
