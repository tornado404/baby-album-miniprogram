"""file_service mock-based 单元测试 — 纯 mock，无外部依赖

测试策略：
- 所有外部依赖（httpx、settings）全部 mock
- 每个 TestClass 独立 mock，不依赖 conftest
- 覆盖所有公共/私有函数
- 覆盖正常路径、边界条件、异常路径
"""

import hashlib
import uuid
from unittest.mock import MagicMock, PropertyMock, patch

import pytest

from app.services.file_service import (
    DIR_MAP,
    _hmac_sha256,
    _is_dev_mode,
    _sign_presigned_url,
    _sign_request_headers,
    check_minio_available,
    delete_file,
    generate_file_path,
    generate_presigned_download_url,
    generate_presigned_upload_url,
    get_file_url,
    get_presigned_file_url,
    get_upload_url,
    reset_availability,
)


# ── 辅助常量 ─────────────────────────────────────────────

_MOCK_BUCKET = "baby-album"
_MOCK_KEY = "photos/user123/abc.jpg"
_MOCK_PUBLIC_URL = "http://minio.example.com:9000"
_MOCK_ENDPOINT = "minio.example.com:9000"
_MOCK_ACCESS_KEY = "test-access-key"
_MOCK_SECRET_KEY = "test-secret-key"


# ══════════════════════════════════════════════════════════
# generate_file_path
# ══════════════════════════════════════════════════════════

class TestGenerateFilePath:
    """generate_file_path: 纯函数，不依赖外部状态"""

    def test_image_type_uses_photos_dir(self):
        path = generate_file_path("user1", "image", "jpg")
        assert path.startswith("photos/user1/")
        assert path.endswith(".jpg")
        # 中间是 uuid
        parts = path.split("/")
        assert len(parts) == 3
        assert len(parts[1]) == 5  # "user1"
        assert len(parts[2].rsplit(".", 1)[0]) == 32  # uuid hex

    def test_video_type_uses_videos_dir(self):
        path = generate_file_path("user1", "video", "mp4")
        assert path.startswith("videos/user1/")

    def test_avatar_type_uses_avatars_dir(self):
        path = generate_file_path("user1", "avatar", "png")
        assert path.startswith("avatars/user1/")

    def test_threedmodel_type_uses_3dmodels_dir(self):
        path = generate_file_path("user1", "threedmodel", "glb")
        assert path.startswith("3dmodels/user1/")

    def test_unknown_type_falls_back_to_others(self):
        path = generate_file_path("user1", "unknown_type", "dat")
        assert path.startswith("others/user1/")

    def test_each_call_generates_unique_path(self):
        paths = {generate_file_path("u1", "image", "jpg") for _ in range(20)}
        assert len(paths) == 20

    def test_user_id_with_special_chars(self):
        path = generate_file_path("user-id_123", "image", "jpg")
        assert path.startswith("photos/user-id_123/")

    def test_ext_with_multiple_dots_is_handled_correctly(self):
        # generate_file_path 只接收 ext 参数，不解析文件名
        path = generate_file_path("u1", "image", "tar.gz")
        assert path.endswith(".tar.gz")

    def test_dir_map_contains_all_expected_types(self):
        assert DIR_MAP == {
            "image": "photos",
            "video": "videos",
            "avatar": "avatars",
            "threedmodel": "3dmodels",
        }


# ══════════════════════════════════════════════════════════
# get_file_url
# ══════════════════════════════════════════════════════════

class TestGetFileUrl:
    """get_file_url: 拼接公开 URL，依赖 settings"""

    def test_returns_public_url_with_bucket_and_key(self):
        with patch("app.services.file_service.settings") as mock_settings:
            mock_settings.MINIO_PUBLIC_URL = _MOCK_PUBLIC_URL
            mock_settings.MINIO_BUCKET = _MOCK_BUCKET
            url = get_file_url(_MOCK_KEY)
            expected = f"{_MOCK_PUBLIC_URL}/{_MOCK_BUCKET}/{_MOCK_KEY}"
            assert url == expected

    def test_empty_key_returns_empty_string(self):
        assert get_file_url("") == ""

    def test_none_key_returns_empty_string(self):
        assert get_file_url(None) == ""

    def test_key_with_spaces_is_concatenated_as_is(self):
        with patch("app.services.file_service.settings") as mock_settings:
            mock_settings.MINIO_PUBLIC_URL = _MOCK_PUBLIC_URL
            mock_settings.MINIO_BUCKET = _MOCK_BUCKET
            url = get_file_url("photos/user1/my photo.jpg")
            # 公开 URL 直接拼接，不编码
            assert "my photo.jpg" in url

    def test_nested_key_path(self):
        with patch("app.services.file_service.settings") as mock_settings:
            mock_settings.MINIO_PUBLIC_URL = _MOCK_PUBLIC_URL
            mock_settings.MINIO_BUCKET = _MOCK_BUCKET
            url = get_file_url("photos/2026/01/15/img.jpg")
            assert url == f"{_MOCK_PUBLIC_URL}/{_MOCK_BUCKET}/photos/2026/01/15/img.jpg"


# ══════════════════════════════════════════════════════════
# get_presigned_file_url
# ══════════════════════════════════════════════════════════

class TestGetPresignedFileUrl:
    """get_presigned_file_url: 包装 generate_presigned_download_url"""

    def test_empty_key_returns_empty_string(self):
        assert get_presigned_file_url("") == ""

    def test_none_key_returns_empty_string(self):
        assert get_presigned_file_url(None) == ""

    def test_delegates_to_generate_presigned_download_url(self):
        with patch(
            "app.services.file_service.generate_presigned_download_url",
            return_value="http://signed-url/",
        ) as mock_gen:
            result = get_presigned_file_url(_MOCK_KEY, expires=7200)
            mock_gen.assert_called_once_with(_MOCK_BUCKET, _MOCK_KEY, 7200)
            assert result == "http://signed-url/"

    def test_default_expiry_is_3600(self):
        with patch(
            "app.services.file_service.generate_presigned_download_url",
            return_value="http://signed-url/",
        ) as mock_gen:
            get_presigned_file_url(_MOCK_KEY)
            mock_gen.assert_called_once_with(_MOCK_BUCKET, _MOCK_KEY, 3600)


# ══════════════════════════════════════════════════════════
# generate_presigned_upload_url
# ══════════════════════════════════════════════════════════

class TestGeneratePresignedUploadUrl:
    """generate_presigned_upload_url: 降级 + 签名逻辑"""

    def test_minio_available_returns_signed_url(self):
        with patch(
            "app.services.file_service.check_minio_available", return_value=True
        ), patch(
            "app.services.file_service._sign_presigned_url",
            return_value="http://signed/put?X-Amz-Signature=abc",
        ) as mock_sign:
            url = generate_presigned_upload_url("bucket", "key", 3600)
            mock_sign.assert_called_once_with("PUT", "bucket", "key", 3600)
            assert url == "http://signed/put?X-Amz-Signature=abc"

    def test_minio_available_default_expiry(self):
        with patch(
            "app.services.file_service.check_minio_available", return_value=True
        ), patch(
            "app.services.file_service._sign_presigned_url",
            return_value="http://signed/",
        ) as mock_sign:
            generate_presigned_upload_url("bucket", "key")
            mock_sign.assert_called_once_with("PUT", "bucket", "key", 3600)

    def test_minio_unavailable_dev_mode_returns_mock_url(self):
        with patch(
            "app.services.file_service.check_minio_available", return_value=False
        ), patch(
            "app.services.file_service._is_dev_mode", return_value=True
        ), patch(
            "app.services.file_service.settings"
        ) as mock_settings:
            mock_settings.MINIO_PUBLIC_URL = _MOCK_PUBLIC_URL
            mock_settings.MINIO_BUCKET = _MOCK_BUCKET
            url = generate_presigned_upload_url("bucket", _MOCK_KEY)
            assert "mock=upload" in url
            assert _MOCK_KEY in url

    def test_minio_unavailable_non_dev_still_signs(self):
        """非开发模式即使 MinIO 不可用，仍尝试生成签名（签名无需连接 MinIO）"""
        with patch(
            "app.services.file_service.check_minio_available", return_value=False
        ), patch(
            "app.services.file_service._is_dev_mode", return_value=False
        ), patch(
            "app.services.file_service._sign_presigned_url",
            return_value="http://signed/",
        ) as mock_sign:
            url = generate_presigned_upload_url("bucket", "key", 3600)
            mock_sign.assert_called_once()
            assert url == "http://signed/"


# ══════════════════════════════════════════════════════════
# generate_presigned_download_url
# ══════════════════════════════════════════════════════════

class TestGeneratePresignedDownloadUrl:
    """generate_presigned_download_url: 降级 + 签名逻辑 (GET)"""

    def test_minio_available_returns_signed_url(self):
        with patch(
            "app.services.file_service.check_minio_available", return_value=True
        ), patch(
            "app.services.file_service._sign_presigned_url",
            return_value="http://signed/get?X-Amz-Signature=abc",
        ) as mock_sign:
            url = generate_presigned_download_url("bucket", "key", 3600)
            mock_sign.assert_called_once_with("GET", "bucket", "key", 3600)
            assert url == "http://signed/get?X-Amz-Signature=abc"

    def test_minio_available_default_expiry(self):
        with patch(
            "app.services.file_service.check_minio_available", return_value=True
        ), patch(
            "app.services.file_service._sign_presigned_url",
            return_value="http://signed/",
        ) as mock_sign:
            generate_presigned_download_url("bucket", "key")
            mock_sign.assert_called_once_with("GET", "bucket", "key", 3600)

    def test_minio_unavailable_dev_mode_returns_mock_url(self):
        with patch(
            "app.services.file_service.check_minio_available", return_value=False
        ), patch(
            "app.services.file_service._is_dev_mode", return_value=True
        ), patch(
            "app.services.file_service.settings"
        ) as mock_settings:
            mock_settings.MINIO_PUBLIC_URL = _MOCK_PUBLIC_URL
            url = generate_presigned_download_url("bucket", _MOCK_KEY)
            assert "mock=download" in url
            assert _MOCK_KEY in url

    def test_minio_unavailable_non_dev_still_signs(self):
        with patch(
            "app.services.file_service.check_minio_available", return_value=False
        ), patch(
            "app.services.file_service._is_dev_mode", return_value=False
        ), patch(
            "app.services.file_service._sign_presigned_url",
            return_value="http://signed/",
        ) as mock_sign:
            url = generate_presigned_download_url("bucket", "key", 3600)
            mock_sign.assert_called_once()
            assert url == "http://signed/"


# ══════════════════════════════════════════════════════════
# get_upload_url
# ══════════════════════════════════════════════════════════

class TestGetUploadUrl:
    """get_upload_url: 高层接口，组合 generate_file_path + generate_presigned_upload_url"""

    def test_returns_expected_structure(self):
        with patch(
            "app.services.file_service.check_minio_available", return_value=True
        ), patch(
            "app.services.file_service.generate_file_path",
            return_value="photos/user1/abc.jpg",
        ), patch(
            "app.services.file_service.generate_presigned_upload_url",
            return_value="http://signed/",
        ):
            result = get_upload_url("user1", "photo.jpg", "image")
            assert "uploadUrl" in result
            assert "cosKey" in result
            assert result["method"] == "PUT"

    def test_cos_key_format(self):
        with patch(
            "app.services.file_service.check_minio_available", return_value=True
        ), patch(
            "app.services.file_service.generate_file_path",
            return_value="photos/user1/abc.jpg",
        ), patch(
            "app.services.file_service.generate_presigned_upload_url",
            return_value="http://signed/",
        ):
            result = get_upload_url("user1", "photo.jpg", "image")
            assert result["cosKey"] == "photos/user1/abc.jpg"

    def test_ext_extraction_from_file_name(self):
        """文件扩展名从 file_name 提取"""
        with patch(
            "app.services.file_service.check_minio_available", return_value=True
        ), patch(
            "app.services.file_service.generate_presigned_upload_url",
            return_value="http://signed/",
        ):
            result = get_upload_url("user1", "clip.mp4", "video")
            assert result["cosKey"].endswith(".mp4")

    def test_no_ext_defaults_to_bin(self):
        """无扩展名的文件默认 .bin"""
        with patch(
            "app.services.file_service.check_minio_available", return_value=True
        ), patch(
            "app.services.file_service.generate_presigned_upload_url",
            return_value="http://signed/",
        ):
            result = get_upload_url("user1", "noext", "image")
            assert result["cosKey"].endswith(".bin")

    def test_file_name_with_multiple_dots(self):
        """多点的文件名只取最后一个作为 ext"""
        with patch(
            "app.services.file_service.check_minio_available", return_value=True
        ), patch(
            "app.services.file_service.generate_presigned_upload_url",
            return_value="http://signed/",
        ):
            result = get_upload_url("user1", "archive.tar.gz", "image")
            assert result["cosKey"].endswith(".gz")
            assert ".tar.gz" not in result["cosKey"]

    def test_upload_url_is_presigned(self):
        with patch(
            "app.services.file_service.check_minio_available", return_value=True
        ), patch(
            "app.services.file_service.generate_file_path",
            return_value="photos/user1/abc.jpg",
        ), patch(
            "app.services.file_service.generate_presigned_upload_url",
            return_value="http://signed/?X-Amz-Signature=abc",
        ):
            result = get_upload_url("user1", "photo.jpg", "image")
            assert "X-Amz-Signature" in result["uploadUrl"]

    def test_dev_mode_minio_down_returns_mock(self):
        with patch(
            "app.services.file_service.check_minio_available", return_value=False
        ), patch(
            "app.services.file_service._is_dev_mode", return_value=True
        ), patch(
            "app.services.file_service.settings"
        ) as mock_settings:
            mock_settings.MINIO_PUBLIC_URL = _MOCK_PUBLIC_URL
            mock_settings.MINIO_BUCKET = _MOCK_BUCKET
            result = get_upload_url("user1", "photo.jpg", "image")
            assert "uploadUrl" in result
            assert "mock=upload" in result["uploadUrl"]
            assert result["method"] == "PUT"

    def test_expiry_is_900_seconds(self):
        """get_upload_url 使用 15 分钟 (900s) 有效期"""
        with patch(
            "app.services.file_service.check_minio_available", return_value=True
        ), patch(
            "app.services.file_service.generate_presigned_upload_url",
        ) as mock_gen:
            get_upload_url("user1", "photo.jpg", "image")
            _name, _args, kwargs = mock_gen.mock_calls[0]
            assert kwargs.get("expires") == 900


# ══════════════════════════════════════════════════════════
# delete_file
# ══════════════════════════════════════════════════════════

class TestDeleteFile:
    """delete_file: 调用 httpx.delete + 签名头"""

    def test_minio_unavailable_returns_false(self):
        with patch(
            "app.services.file_service.check_minio_available", return_value=False
        ):
            assert delete_file("photos/user1/img.jpg") is False

    def test_delete_success_204(self):
        mock_resp = MagicMock(status_code=204)
        with patch(
            "app.services.file_service.check_minio_available", return_value=True
        ), patch(
            "app.services.file_service._sign_request_headers",
            return_value={"Authorization": "signed"},
        ), patch("httpx.delete", return_value=mock_resp) as mock_httpx:
            assert delete_file(_MOCK_KEY) is True
            mock_httpx.assert_called_once()

    def test_delete_success_200(self):
        mock_resp = MagicMock(status_code=200)
        with patch(
            "app.services.file_service.check_minio_available", return_value=True
        ), patch(
            "app.services.file_service._sign_request_headers",
            return_value={"Authorization": "signed"},
        ), patch("httpx.delete", return_value=mock_resp):
            assert delete_file(_MOCK_KEY) is True

    def test_delete_404_returns_false(self):
        mock_resp = MagicMock(status_code=404)
        with patch(
            "app.services.file_service.check_minio_available", return_value=True
        ), patch(
            "app.services.file_service._sign_request_headers",
            return_value={"Authorization": "signed"},
        ), patch("httpx.delete", return_value=mock_resp):
            assert delete_file(_MOCK_KEY) is False

    def test_delete_500_returns_false(self):
        mock_resp = MagicMock(status_code=500)
        with patch(
            "app.services.file_service.check_minio_available", return_value=True
        ), patch(
            "app.services.file_service._sign_request_headers",
            return_value={"Authorization": "signed"},
        ), patch("httpx.delete", return_value=mock_resp):
            assert delete_file(_MOCK_KEY) is False

    def test_delete_exception_caught_and_returns_false(self):
        with patch(
            "app.services.file_service.check_minio_available", return_value=True
        ), patch(
            "app.services.file_service._sign_request_headers",
            return_value={"Authorization": "signed"},
        ), patch("httpx.delete", side_effect=Exception("connection refused")):
            assert delete_file(_MOCK_KEY) is False

    def test_delete_calls_httpx_with_correct_headers(self):
        mock_resp = MagicMock(status_code=204)
        fake_headers = {
            "Authorization": "AWS4-HMAC-SHA256 Credential=xxx",
            "x-amz-content-sha256": "UNSIGNED-PAYLOAD",
            "x-amz-date": "20260101T000000Z",
            "Host": _MOCK_ENDPOINT,
        }
        with patch(
            "app.services.file_service.check_minio_available", return_value=True
        ), patch(
            "app.services.file_service._sign_request_headers",
            return_value=fake_headers,
        ), patch(
            "app.services.file_service.settings"
        ) as mock_settings, patch(
            "httpx.delete", return_value=mock_resp
        ) as mock_httpx:
            mock_settings.MINIO_ENDPOINT = _MOCK_ENDPOINT
            mock_settings.MINIO_BUCKET = _MOCK_BUCKET
            delete_file(_MOCK_KEY)
            expected_url = f"http://{_MOCK_ENDPOINT}/{_MOCK_BUCKET}/{_MOCK_KEY}"
            mock_httpx.assert_called_once_with(
                expected_url, headers=fake_headers, timeout=10.0
            )

    def test_delete_empty_key_attempts_delete(self):
        """空 key 仍会尝试请求（由 MinIO 决定是否 404）"""
        mock_resp = MagicMock(status_code=404)
        with patch(
            "app.services.file_service.check_minio_available", return_value=True
        ), patch(
            "app.services.file_service._sign_request_headers",
            return_value={"Authorization": "signed"},
        ), patch("httpx.delete", return_value=mock_resp):
            assert delete_file("") is False


# ══════════════════════════════════════════════════════════
# check_minio_available
# ══════════════════════════════════════════════════════════

class TestCheckMinioAvailable:
    """check_minio_available: 健康检查 + 缓存"""

    def setup_method(self):
        reset_availability()

    def teardown_method(self):
        reset_availability()

    def test_available_when_httpx_returns_200(self):
        with patch("httpx.get", return_value=MagicMock(status_code=200)):
            assert check_minio_available() is True

    def test_unavailable_when_httpx_returns_non_200(self):
        with patch("httpx.get", return_value=MagicMock(status_code=503)):
            assert check_minio_available() is False

    def test_unavailable_when_httpx_raises(self):
        with patch("httpx.get", side_effect=Exception("timeout")):
            assert check_minio_available() is False

    def test_caches_result(self):
        with patch("httpx.get", return_value=MagicMock(status_code=200)) as mock_get:
            assert check_minio_available() is True
            assert check_minio_available() is True
            mock_get.assert_called_once()

    def test_caches_false_result(self):
        with patch("httpx.get", side_effect=Exception("timeout")) as mock_get:
            assert check_minio_available() is False
            assert check_minio_available() is False
            mock_get.assert_called_once()

    def test_reset_clears_cache(self):
        with patch("httpx.get", return_value=MagicMock(status_code=200)) as mock_get:
            assert check_minio_available() is True
            reset_availability()
            assert check_minio_available() is True
            assert mock_get.call_count == 2

    def test_uses_correct_health_url(self):
        with patch("httpx.get") as mock_get, patch(
            "app.services.file_service.settings"
        ) as mock_settings:
            mock_settings.MINIO_ENDPOINT = _MOCK_ENDPOINT
            mock_get.return_value = MagicMock(status_code=200)
            check_minio_available()
            expected_url = f"http://{_MOCK_ENDPOINT}/minio/health/live"
            mock_get.assert_called_once_with(expected_url, timeout=3.0)


# ══════════════════════════════════════════════════════════
# reset_availability
# ══════════════════════════════════════════════════════════

class TestResetAvailability:
    """reset_availability: 重置缓存标志"""

    def setup_method(self):
        reset_availability()

    def teardown_method(self):
        reset_availability()

    def test_reset_clears_cached_true(self):
        with patch("httpx.get", return_value=MagicMock(status_code=200)):
            check_minio_available()  # 缓存 True
            reset_availability()
            # 再次调用应重新执行 httpx.get
            with patch("httpx.get", return_value=MagicMock(status_code=503)):
                assert check_minio_available() is False

    def test_reset_clears_cached_false(self):
        with patch("httpx.get", side_effect=Exception("timeout")):
            check_minio_available()  # 缓存 False
            reset_availability()
            with patch("httpx.get", return_value=MagicMock(status_code=200)):
                assert check_minio_available() is True

    def test_reset_on_fresh_state_does_not_raise(self):
        reset_availability()


# ══════════════════════════════════════════════════════════
# _is_dev_mode
# ══════════════════════════════════════════════════════════

class TestIsDevMode:
    """_is_dev_mode: 私有函数，检查 settings.DEBUG"""

    def test_returns_true_when_debug_is_true(self):
        with patch("app.services.file_service.settings") as mock_settings:
            mock_settings.DEBUG = True
            assert _is_dev_mode() is True

    def test_returns_false_when_debug_is_false(self):
        with patch("app.services.file_service.settings") as mock_settings:
            mock_settings.DEBUG = False
            assert _is_dev_mode() is False


# ══════════════════════════════════════════════════════════
# _hmac_sha256
# ══════════════════════════════════════════════════════════

class TestHmacSha256:
    """_hmac_sha256: HMAC-SHA256 哈希"""

    def test_returns_consistent_output_for_same_input(self):
        result1 = _hmac_sha256(b"key", "message")
        result2 = _hmac_sha256(b"key", "message")
        assert result1 == result2

    def test_different_keys_produce_different_output(self):
        result1 = _hmac_sha256(b"key1", "message")
        result2 = _hmac_sha256(b"key2", "message")
        assert result1 != result2

    def test_different_messages_produce_different_output(self):
        result1 = _hmac_sha256(b"key", "msg1")
        result2 = _hmac_sha256(b"key", "msg2")
        assert result1 != result2

    def test_output_length_is_32(self):
        result = _hmac_sha256(b"key", "message")
        assert len(result) == 32  # SHA-256 输出 32 字节

    def test_returns_bytes(self):
        result = _hmac_sha256(b"key", "message")
        assert isinstance(result, bytes)


# ══════════════════════════════════════════════════════════
# _sign_presigned_url
# ══════════════════════════════════════════════════════════

class TestSignPresignedUrl:
    """_sign_presigned_url: AWS Sig V4 预签名 URL 生成"""

    def test_contains_all_required_query_params(self):
        with patch("app.services.file_service.settings") as mock_settings:
            mock_settings.MINIO_EXTERNAL_ENDPOINT = _MOCK_ENDPOINT
            mock_settings.MINIO_ACCESS_KEY = _MOCK_ACCESS_KEY
            mock_settings.MINIO_SECRET_KEY = _MOCK_SECRET_KEY
            url = _sign_presigned_url("GET", "bucket", "key", 3600)
            assert "X-Amz-Algorithm=AWS4-HMAC-SHA256" in url
            assert "X-Amz-Credential=" in url
            assert "X-Amz-Date=" in url
            assert "X-Amz-Expires=3600" in url
            assert "X-Amz-Signature=" in url
            assert "X-Amz-SignedHeaders=host" in url

    def test_url_contains_bucket_and_key(self):
        with patch("app.services.file_service.settings") as mock_settings:
            mock_settings.MINIO_EXTERNAL_ENDPOINT = _MOCK_ENDPOINT
            mock_settings.MINIO_ACCESS_KEY = _MOCK_ACCESS_KEY
            mock_settings.MINIO_SECRET_KEY = _MOCK_SECRET_KEY
            url = _sign_presigned_url("PUT", "my-bucket", "photos/user1/img.jpg", 900)
            assert "/my-bucket/photos/user1/img.jpg" in url

    def test_put_and_get_have_different_signatures(self):
        with patch("app.services.file_service.settings") as mock_settings:
            mock_settings.MINIO_EXTERNAL_ENDPOINT = _MOCK_ENDPOINT
            mock_settings.MINIO_ACCESS_KEY = _MOCK_ACCESS_KEY
            mock_settings.MINIO_SECRET_KEY = _MOCK_SECRET_KEY
            url_put = _sign_presigned_url("PUT", "bucket", "key", 3600)
            url_get = _sign_presigned_url("GET", "bucket", "key", 3600)
            assert url_put != url_get

    def test_different_expiry_produces_different_signature(self):
        with patch("app.services.file_service.settings") as mock_settings:
            mock_settings.MINIO_EXTERNAL_ENDPOINT = _MOCK_ENDPOINT
            mock_settings.MINIO_ACCESS_KEY = _MOCK_ACCESS_KEY
            mock_settings.MINIO_SECRET_KEY = _MOCK_SECRET_KEY
            url_short = _sign_presigned_url("GET", "bucket", "key", 60)
            url_long = _sign_presigned_url("GET", "bucket", "key", 86400)
            assert url_short != url_long

    def test_url_starts_with_http_and_host(self):
        with patch("app.services.file_service.settings") as mock_settings:
            mock_settings.MINIO_EXTERNAL_ENDPOINT = _MOCK_ENDPOINT
            mock_settings.MINIO_ACCESS_KEY = _MOCK_ACCESS_KEY
            mock_settings.MINIO_SECRET_KEY = _MOCK_SECRET_KEY
            url = _sign_presigned_url("GET", "bucket", "key", 3600)
            assert url.startswith(f"http://{_MOCK_ENDPOINT}/bucket/key?")

    def test_expires_in_url_matches_input(self):
        with patch("app.services.file_service.settings") as mock_settings:
            mock_settings.MINIO_EXTERNAL_ENDPOINT = _MOCK_ENDPOINT
            mock_settings.MINIO_ACCESS_KEY = _MOCK_ACCESS_KEY
            mock_settings.MINIO_SECRET_KEY = _MOCK_SECRET_KEY
            url = _sign_presigned_url("GET", "bucket", "key", 7200)
            assert "X-Amz-Expires=7200" in url

    def test_credential_contains_access_key_and_scope(self):
        with patch("app.services.file_service.settings") as mock_settings:
            mock_settings.MINIO_EXTERNAL_ENDPOINT = _MOCK_ENDPOINT
            mock_settings.MINIO_ACCESS_KEY = _MOCK_ACCESS_KEY
            mock_settings.MINIO_SECRET_KEY = _MOCK_SECRET_KEY
            url = _sign_presigned_url("GET", "bucket", "key", 3600)
            assert _MOCK_ACCESS_KEY in url
            # Credential scope 在 URL 中被编码，/ 转义为 %2F
            assert "us-east-1%2Fs3%2Faws4_request" in url


# ══════════════════════════════════════════════════════════
# _sign_request_headers
# ══════════════════════════════════════════════════════════

class TestSignRequestHeaders:
    """_sign_request_headers: AWS Sig V4 签名请求头"""

    def test_contains_all_required_headers(self):
        with patch("app.services.file_service.settings") as mock_settings:
            mock_settings.MINIO_ENDPOINT = _MOCK_ENDPOINT
            mock_settings.MINIO_ACCESS_KEY = _MOCK_ACCESS_KEY
            mock_settings.MINIO_SECRET_KEY = _MOCK_SECRET_KEY
            headers = _sign_request_headers("DELETE", "bucket", "key")
            assert "Authorization" in headers
            assert headers["Authorization"].startswith("AWS4-HMAC-SHA256")
            assert headers["x-amz-content-sha256"] == "UNSIGNED-PAYLOAD"
            assert "x-amz-date" in headers
            assert headers["Host"] == _MOCK_ENDPOINT

    def test_authorization_contains_credential_and_signature(self):
        with patch("app.services.file_service.settings") as mock_settings:
            mock_settings.MINIO_ENDPOINT = _MOCK_ENDPOINT
            mock_settings.MINIO_ACCESS_KEY = _MOCK_ACCESS_KEY
            mock_settings.MINIO_SECRET_KEY = _MOCK_SECRET_KEY
            auth = _sign_request_headers("DELETE", "bucket", "key")["Authorization"]
            assert "Credential=" in auth
            assert "SignedHeaders=host;x-amz-content-sha256;x-amz-date" in auth
            assert "Signature=" in auth

    def test_get_method_headers(self):
        with patch("app.services.file_service.settings") as mock_settings:
            mock_settings.MINIO_ENDPOINT = _MOCK_ENDPOINT
            mock_settings.MINIO_ACCESS_KEY = _MOCK_ACCESS_KEY
            mock_settings.MINIO_SECRET_KEY = _MOCK_SECRET_KEY
            headers = _sign_request_headers("GET", "bucket", "key")
            assert "Authorization" in headers

    def test_put_method_headers(self):
        with patch("app.services.file_service.settings") as mock_settings:
            mock_settings.MINIO_ENDPOINT = _MOCK_ENDPOINT
            mock_settings.MINIO_ACCESS_KEY = _MOCK_ACCESS_KEY
            mock_settings.MINIO_SECRET_KEY = _MOCK_SECRET_KEY
            headers = _sign_request_headers("PUT", "bucket", "key")
            assert "Authorization" in headers

    def test_different_methods_produce_different_signatures(self):
        with patch("app.services.file_service.settings") as mock_settings:
            mock_settings.MINIO_ENDPOINT = _MOCK_ENDPOINT
            mock_settings.MINIO_ACCESS_KEY = _MOCK_ACCESS_KEY
            mock_settings.MINIO_SECRET_KEY = _MOCK_SECRET_KEY
            h1 = _sign_request_headers("PUT", "bucket", "key")["Authorization"]
            h2 = _sign_request_headers("DELETE", "bucket", "key")["Authorization"]
            assert h1 != h2

    def test_different_keys_produce_different_signatures(self):
        with patch("app.services.file_service.settings") as mock_settings:
            mock_settings.MINIO_ENDPOINT = _MOCK_ENDPOINT
            mock_settings.MINIO_ACCESS_KEY = _MOCK_ACCESS_KEY
            mock_settings.MINIO_SECRET_KEY = _MOCK_SECRET_KEY
            h1 = _sign_request_headers("DELETE", "bucket", "key1")["Authorization"]
            h2 = _sign_request_headers("DELETE", "bucket", "key2")["Authorization"]
            assert h1 != h2


# ══════════════════════════════════════════════════════════
# 端到端场景 / 优雅降级
# ══════════════════════════════════════════════════════════

class TestGracefulDegradation:
    """模拟 MinIO 完全不可用 + 开发模式下的行为"""

    def test_minio_down_dev_mode_all_operations_work(self):
        with patch(
            "app.services.file_service.check_minio_available", return_value=False
        ), patch(
            "app.services.file_service._is_dev_mode", return_value=True
        ), patch(
            "app.services.file_service.settings"
        ) as mock_settings:
            mock_settings.MINIO_PUBLIC_URL = _MOCK_PUBLIC_URL
            mock_settings.MINIO_BUCKET = _MOCK_BUCKET

            # upload URL → mock
            upload_result = get_upload_url("user1", "photo.jpg", "image")
            assert "uploadUrl" in upload_result
            assert "mock=upload" in upload_result["uploadUrl"]

            # file URL → direct public URL (不依赖 MinIO)
            file_url = get_file_url(_MOCK_KEY)
            assert file_url != ""

            # presigned download → mock
            dl_url = get_presigned_file_url(_MOCK_KEY)
            assert "mock=download" in dl_url

            # delete → false (不抛异常)
            assert delete_file(_MOCK_KEY) is False

    def test_minio_up_all_operations_return_signed(self):
        with patch(
            "app.services.file_service.check_minio_available", return_value=True
        ), patch(
            "app.services.file_service._sign_presigned_url",
            return_value="http://signed/?X-Amz-Signature=abc",
        ), patch(
            "app.services.file_service._sign_request_headers",
            return_value={"Authorization": "AWS4-HMAC-SHA256 Credential=xxx"},
        ), patch(
            "app.services.file_service.settings"
        ) as mock_settings, patch(
            "httpx.delete", return_value=MagicMock(status_code=204)
        ):
            mock_settings.MINIO_PUBLIC_URL = _MOCK_PUBLIC_URL
            mock_settings.MINIO_BUCKET = _MOCK_BUCKET

            # upload URL → signed
            upload_result = get_upload_url("user1", "photo.jpg", "image")
            assert "X-Amz-Signature" in upload_result["uploadUrl"]

            # file URL → public URL
            file_url = get_file_url(_MOCK_KEY)
            assert _MOCK_BUCKET in file_url

            # presigned download → signed
            dl_url = get_presigned_file_url(_MOCK_KEY)
            assert "X-Amz-Signature" in dl_url

            # delete → true
            assert delete_file(_MOCK_KEY) is True


class TestEdgeCases:
    """边界条件测试"""

    def test_generate_file_path_with_empty_user_id(self):
        path = generate_file_path("", "image", "jpg")
        assert path.startswith("photos//")

    def test_generate_file_path_with_empty_ext(self):
        path = generate_file_path("user1", "image", "")
        assert path.endswith(".")

    def test_get_file_url_with_only_spaces_key(self):
        with patch("app.services.file_service.settings") as mock_settings:
            mock_settings.MINIO_PUBLIC_URL = _MOCK_PUBLIC_URL
            mock_settings.MINIO_BUCKET = _MOCK_BUCKET
            url = get_file_url("   ")
            assert "   " in url

    def test_get_upload_url_special_chars_in_file_name(self):
        with patch(
            "app.services.file_service.check_minio_available", return_value=True
        ), patch(
            "app.services.file_service.generate_presigned_upload_url",
            return_value="http://signed/",
        ):
            result = get_upload_url("user1", "my photo (1).JPG", "image")
            assert result["cosKey"].endswith(".JPG")

    def test_delete_file_with_none_key(self):
        """delete_file 在 key 为 None 时会尝试处理（需 mock 避免真实请求）"""
        with patch(
            "app.services.file_service.check_minio_available", return_value=False
        ):
            # MinIO 不可用，直接返回 False，不会走到 httpx
            assert delete_file(None) is False

    def test_get_presigned_file_url_with_special_key_chars(self):
        with patch(
            "app.services.file_service.generate_presigned_download_url",
            return_value="http://signed/",
        ) as mock_gen:
            key = "photos/user1/测试/文件.jpg"
            get_presigned_file_url(key)
            mock_gen.assert_called_once_with(_MOCK_BUCKET, key, 3600)

    def test_sign_presigned_url_with_deeply_nested_key(self):
        with patch("app.services.file_service.settings") as mock_settings:
            mock_settings.MINIO_EXTERNAL_ENDPOINT = _MOCK_ENDPOINT
            mock_settings.MINIO_ACCESS_KEY = _MOCK_ACCESS_KEY
            mock_settings.MINIO_SECRET_KEY = _MOCK_SECRET_KEY
            key = "a/b/c/d/e/f/g.jpg"
            url = _sign_presigned_url("GET", "bucket", key, 3600)
            assert f"/bucket/{key}" in url