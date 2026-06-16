"""file_service 单元测试 — AWS Sig V4 签名 + 预签名 URL + 优雅降级"""

import hashlib
import hmac
from unittest.mock import patch, MagicMock

import pytest

from app.services.file_service import (
    generate_file_path,
    generate_presigned_upload_url,
    generate_presigned_download_url,
    get_upload_url,
    get_file_url,
    get_presigned_file_url,
    delete_file,
    _sign_presigned_url,
    _sign_request_headers,
    reset_availability,
    check_minio_available,
)


@pytest.fixture(autouse=True)
def _reset_minio_state():
    """每个测试前后重置 MinIO 可用性缓存"""
    reset_availability()
    yield
    reset_availability()


# ── generate_file_path ─────────────────────────────────

class TestGenerateFilePath:
    def test_image_type(self):
        path = generate_file_path("user123", "image", "jpg")
        assert path.startswith("photos/user123/")
        assert path.endswith(".jpg")

    def test_video_type(self):
        path = generate_file_path("user123", "video", "mp4")
        assert path.startswith("videos/user123/")
        assert path.endswith(".mp4")

    def test_avatar_type(self):
        path = generate_file_path("user123", "avatar", "png")
        assert path.startswith("avatars/user123/")

    def test_3dmodel_type(self):
        path = generate_file_path("user123", "threedmodel", "glb")
        assert path.startswith("3dmodels/user123/")

    def test_unknown_type_falls_back_to_others(self):
        path = generate_file_path("user123", "unknown", "dat")
        assert path.startswith("others/user123/")

    def test_unique_paths(self):
        """每次调用生成不同的 UUID 路径"""
        paths = {generate_file_path("u1", "image", "jpg") for _ in range(10)}
        assert len(paths) == 10


# ── get_file_url ────────────────────────────────────────

class TestGetFileUrl:
    def test_basic_url(self):
        url = get_file_url("photos/user123/abc.jpg")
        assert "baby-album/photos/user123/abc.jpg" in url

    def test_empty_key_returns_empty(self):
        assert get_file_url("") == ""

    def test_url_contains_public_host(self):
        url = get_file_url("photos/test/img.jpg")
        # URL 应包含 MINIO_PUBLIC_URL 配置中的 host
        assert "101.126.41.146:9000" in url or "minio" in url.lower()


# ── get_presigned_file_url ──────────────────────────────

class TestGetPresignedFileUrl:
    def test_empty_key_returns_empty(self):
        assert get_presigned_file_url("") == ""

    def test_returns_url_with_key(self):
        """预签名下载 URL 应包含 bucket 和 key"""
        with patch("app.services.file_service.check_minio_available", return_value=False):
            # dev mode 下返回 mock URL
            url = get_presigned_file_url("photos/user1/img.jpg")
            assert "photos/user1/img.jpg" in url


# ── AWS Sig V4 签名 ────────────────────────────────────

class TestSigV4Signing:
    def test_sign_presigned_url_contains_required_params(self):
        """预签名 URL 应包含 AWS Sig V4 必要参数"""
        url = _sign_presigned_url("GET", "test-bucket", "test/key.jpg", 3600)
        assert "X-Amz-Algorithm=AWS4-HMAC-SHA256" in url
        assert "X-Amz-Credential=" in url
        assert "X-Amz-Date=" in url
        assert "X-Amz-Expires=3600" in url
        assert "X-Amz-Signature=" in url
        assert "X-Amz-SignedHeaders=host" in url

    def test_sign_presigned_url_contains_bucket_and_key(self):
        """预签名 URL 路径应包含 bucket 和 key"""
        url = _sign_presigned_url("PUT", "my-bucket", "photos/user1/img.jpg", 900)
        assert "/my-bucket/photos/user1/img.jpg" in url

    def test_sign_presigned_url_different_methods(self):
        """PUT 和 GET 方法的签名应不同"""
        url_put = _sign_presigned_url("PUT", "bucket", "key", 3600)
        url_get = _sign_presigned_url("GET", "bucket", "key", 3600)
        # 签名应不同（因为 canonical request 中 method 不同）
        assert url_put != url_get

    def test_sign_request_headers_structure(self):
        """签名请求头应包含必要的认证头"""
        headers = _sign_request_headers("DELETE", "bucket", "key")
        assert "Authorization" in headers
        assert headers["Authorization"].startswith("AWS4-HMAC-SHA256")
        assert "x-amz-content-sha256" in headers
        assert "x-amz-date" in headers
        assert "Host" in headers

    def test_sign_request_headers_contains_credential(self):
        """Authorization 头应包含 access key 和 credential scope"""
        headers = _sign_request_headers("DELETE", "bucket", "key")
        auth = headers["Authorization"]
        assert "Credential=" in auth
        assert "SignedHeaders=" in auth
        assert "Signature=" in auth


# ── get_upload_url ──────────────────────────────────────

class TestGetUploadUrl:
    def test_returns_expected_structure(self):
        """返回结构应包含 uploadUrl、cosKey、method"""
        with patch("app.services.file_service.check_minio_available", return_value=True):
            result = get_upload_url("user123", "photo.jpg", "image")
            assert "uploadUrl" in result
            assert "cosKey" in result
            assert result["method"] == "PUT"

    def test_cos_key_format(self):
        """cosKey 应按 {type}/{userId}/{uuid}.{ext} 格式生成"""
        with patch("app.services.file_service.check_minio_available", return_value=True):
            result = get_upload_url("user123", "photo.jpg", "image")
            key = result["cosKey"]
            assert key.startswith("photos/user123/")
            assert key.endswith(".jpg")

    def test_ext_extraction(self):
        """文件扩展名应从 fileName 提取"""
        with patch("app.services.file_service.check_minio_available", return_value=True):
            result = get_upload_url("user123", "clip.mp4", "video")
            assert result["cosKey"].endswith(".mp4")

    def test_no_ext_defaults_to_bin(self):
        """无扩展名的文件默认为 .bin"""
        with patch("app.services.file_service.check_minio_available", return_value=True):
            result = get_upload_url("user123", "noext", "image")
            assert result["cosKey"].endswith(".bin")

    def test_upload_url_is_presigned(self):
        """uploadUrl 应为预签名 URL（包含 X-Amz 参数）"""
        with patch("app.services.file_service.check_minio_available", return_value=True):
            result = get_upload_url("user123", "photo.jpg", "image")
            assert "X-Amz-Algorithm" in result["uploadUrl"]


# ── generate_presigned_upload_url ───────────────────────

class TestGeneratePresignedUploadUrl:
    def test_minio_available_returns_signed_url(self):
        """MinIO 可用时返回带签名的 URL"""
        with patch("app.services.file_service.check_minio_available", return_value=True):
            url = generate_presigned_upload_url("bucket", "key", 3600)
            assert "X-Amz-Signature" in url

    def test_minio_unavailable_dev_mode_returns_mock_url(self):
        """MinIO 不可用 + 开发模式 → 返回 mock URL"""
        with patch("app.services.file_service.check_minio_available", return_value=False), \
             patch("app.services.file_service._is_dev_mode", return_value=True):
            url = generate_presigned_upload_url("bucket", "my/key.jpg", 3600)
            assert "mock=upload" in url
            assert "my/key.jpg" in url

    def test_minio_unavailable_non_dev_still_signs(self):
        """MinIO 不可用 + 非开发模式 → 仍然尝试签名"""
        with patch("app.services.file_service.check_minio_available", return_value=False), \
             patch("app.services.file_service._is_dev_mode", return_value=False):
            url = generate_presigned_upload_url("bucket", "key", 3600)
            # 非开发模式仍然生成签名 URL（签名不需要实际连接 MinIO）
            assert "X-Amz-Signature" in url


# ── generate_presigned_download_url ─────────────────────

class TestGeneratePresignedDownloadUrl:
    def test_minio_available_returns_signed_url(self):
        """MinIO 可用时返回带签名的下载 URL"""
        with patch("app.services.file_service.check_minio_available", return_value=True):
            url = generate_presigned_download_url("bucket", "key", 3600)
            assert "X-Amz-Signature" in url

    def test_minio_unavailable_dev_mode_returns_mock_url(self):
        """MinIO 不可用 + 开发模式 → 返回 mock 下载 URL"""
        with patch("app.services.file_service.check_minio_available", return_value=False), \
             patch("app.services.file_service._is_dev_mode", return_value=True):
            url = generate_presigned_download_url("bucket", "my/key.jpg", 3600)
            assert "mock=download" in url

    def test_custom_expiry(self):
        """自定义过期时间应反映在 URL 中"""
        with patch("app.services.file_service.check_minio_available", return_value=True):
            url = generate_presigned_download_url("bucket", "key", 7200)
            assert "X-Amz-Expires=7200" in url


# ── delete_file ─────────────────────────────────────────

class TestDeleteFile:
    def test_minio_unavailable_returns_false(self):
        """MinIO 不可用时删除返回 False"""
        with patch("app.services.file_service.check_minio_available", return_value=False):
            result = delete_file("photos/user1/img.jpg")
            assert result is False

    def test_delete_success(self):
        """MinIO 返回 204 → 删除成功"""
        mock_resp = MagicMock()
        mock_resp.status_code = 204
        with patch("app.services.file_service.check_minio_available", return_value=True), \
             patch("httpx.delete", return_value=mock_resp):
            result = delete_file("photos/user1/img.jpg")
            assert result is True

    def test_delete_200_success(self):
        """MinIO 返回 200 → 删除成功"""
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        with patch("app.services.file_service.check_minio_available", return_value=True), \
             patch("httpx.delete", return_value=mock_resp):
            result = delete_file("photos/user1/img.jpg")
            assert result is True

    def test_delete_nonexistent_returns_false(self):
        """MinIO 返回 404 → 删除失败"""
        mock_resp = MagicMock()
        mock_resp.status_code = 404
        with patch("app.services.file_service.check_minio_available", return_value=True), \
             patch("httpx.delete", return_value=mock_resp):
            result = delete_file("photos/user1/nonexistent.jpg")
            assert result is False

    def test_delete_exception_returns_false(self):
        """httpx 异常 → 返回 False（不抛出）"""
        with patch("app.services.file_service.check_minio_available", return_value=True), \
             patch("httpx.delete", side_effect=Exception("connection error")):
            result = delete_file("photos/user1/img.jpg")
            assert result is False


# ── check_minio_available ───────────────────────────────

class TestCheckMinioAvailable:
    def test_caches_result(self):
        """第二次调用应使用缓存"""
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        with patch("httpx.get", return_value=mock_resp) as mock_get:
            assert check_minio_available() is True
            assert check_minio_available() is True
            # 只调用一次 httpx.get
            assert mock_get.call_count == 1

    def test_unavailable_caches_false(self):
        """MinIO 不可达时缓存 False"""
        with patch("httpx.get", side_effect=Exception("timeout")):
            assert check_minio_available() is False
            assert check_minio_available() is False

    def test_reset_clears_cache(self):
        """reset_availability 清除缓存"""
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        with patch("httpx.get", return_value=mock_resp) as mock_get:
            assert check_minio_available() is True
            reset_availability()
            assert check_minio_available() is True
            # 重置后应重新检查
            assert mock_get.call_count == 2


# ── 优雅降级集成测试 ───────────────────────────────────

class TestGracefulDegradation:
    def test_full_workflow_minio_down_dev_mode(self):
        """MinIO 完全不可用 + 开发模式：全部操作应返回有效结果"""
        with patch("app.services.file_service.check_minio_available", return_value=False), \
             patch("app.services.file_service._is_dev_mode", return_value=True):

            # 上传签名
            upload_result = get_upload_url("user1", "photo.jpg", "image")
            assert "uploadUrl" in upload_result
            assert "cosKey" in upload_result

            # 文件 URL
            file_url = get_file_url("photos/user1/abc.jpg")
            assert file_url != ""

            # 预签名下载
            dl_url = get_presigned_file_url("photos/user1/abc.jpg")
            assert "mock=download" in dl_url

            # 删除（静默失败）
            assert delete_file("photos/user1/abc.jpg") is False

    def test_full_workflow_minio_up(self):
        """MinIO 可用：全部操作返回签名 URL"""
        with patch("app.services.file_service.check_minio_available", return_value=True):
            # 上传签名
            upload_result = get_upload_url("user1", "photo.jpg", "image")
            assert "X-Amz-Signature" in upload_result["uploadUrl"]

            # 文件 URL
            file_url = get_file_url("photos/user1/abc.jpg")
            assert "baby-album" in file_url

            # 预签名下载
            dl_url = get_presigned_file_url("photos/user1/abc.jpg")
            assert "X-Amz-Signature" in dl_url
