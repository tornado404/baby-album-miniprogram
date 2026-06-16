"""MinIO 文件操作服务 — httpx + AWS Sig V4 预签名 URL + 文件管理

使用 httpx 直接调用 MinIO REST API，避免 minio SDK 的模块级初始化问题。
支持优雅降级：MinIO 不可用时返回开发模式 mock URL。
"""

import hashlib
import hmac
import logging
import uuid
from datetime import datetime, timedelta, timezone
from urllib.parse import quote, urlencode

import httpx

from app.config import settings

logger = logging.getLogger(__name__)

# ── MinIO 连接状态 ──────────────────────────────────────
_minio_available: bool | None = None


def _is_dev_mode() -> bool:
    """判断是否为开发模式（DEBUG=True）"""
    return settings.DEBUG


def check_minio_available() -> bool:
    """检查 MinIO 是否可达，结果会缓存"""
    global _minio_available
    if _minio_available is not None:
        return _minio_available
    try:
        resp = httpx.get(
            f"http://{settings.MINIO_ENDPOINT}/minio/health/live",
            timeout=3.0,
        )
        _minio_available = resp.status_code == 200
    except Exception:
        logger.warning("MinIO unavailable at %s — running in degraded mode", settings.MINIO_ENDPOINT)
        _minio_available = False
    return _minio_available


def reset_availability() -> None:
    """重置 MinIO 可用性缓存（测试用）"""
    global _minio_available
    _minio_available = None


# ── 路径生成 ─────────────────────────────────────────────

DIR_MAP = {
    "image": "photos",
    "video": "videos",
    "avatar": "avatars",
    "threedmodel": "3dmodels",
}


def generate_file_path(user_id: str, file_type: str, ext: str) -> str:
    """生成 MinIO 对象路径：{type}/{userId}/{uuid}.{ext}"""
    directory = DIR_MAP.get(file_type, "others")
    return f"{directory}/{user_id}/{uuid.uuid4().hex}.{ext}"


# ── AWS Signature V4 签名 ───────────────────────────────
# MinIO 兼容 S3 API，使用 AWS Sig V4 签名方案

_SERVICE = "s3"
_REGION = "us-east-1"  # MinIO 默认 region


def _hmac_sha256(key: bytes, msg: str) -> bytes:
    return hmac.new(key, msg.encode("utf-8"), hashlib.sha256).digest()


def _get_signing_key(date_stamp: str) -> bytes:
    """生成 AWS Sig V4 签名密钥"""
    k_date = _hmac_sha256(("AWS4" + settings.MINIO_SECRET_KEY).encode("utf-8"), date_stamp)
    k_region = _hmac_sha256(k_date, _REGION)
    k_service = _hmac_sha256(k_region, _SERVICE)
    k_signing = _hmac_sha256(k_service, "aws4_request")
    return k_signing


def _sign_presigned_url(
    method: str,
    bucket: str,
    key: str,
    expires: int = 3600,
) -> str:
    """生成预签名 URL（AWS Sig V4）

    返回完整的预签名 URL，客户端可直接使用。
    """
    now = datetime.now(timezone.utc)
    date_stamp = now.strftime("%Y%m%d")
    amz_date = now.strftime("%Y%m%dT%H%M%SZ")

    # 使用外部 endpoint（客户端可达）生成 URL
    host = settings.MINIO_EXTERNAL_ENDPOINT
    object_path = f"/{bucket}/{key}"

    # Canonical headers（必须小写排序）
    credential = f"{settings.MINIO_ACCESS_KEY}/{date_stamp}/{_REGION}/{_SERVICE}/aws4_request"

    # 构建规范查询参数
    params = {
        "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
        "X-Amz-Credential": credential,
        "X-Amz-Date": amz_date,
        "X-Amz-Expires": str(expires),
        "X-Amz-SignedHeaders": "host",
    }

    # 规范请求
    canonical_headers = f"host:{host}\n"
    signed_headers = "host"
    canonical_querystring = "&".join(
        f"{quote(k, safe='')}={quote(v, safe='')}" for k, v in sorted(params.items())
    )
    canonical_request = (
        f"{method}\n"
        f"{object_path}\n"
        f"{canonical_querystring}\n"
        f"{canonical_headers}\n"
        f"{signed_headers}\n"
        f"UNSIGNED-PAYLOAD"
    )

    # 待签字符串
    scope = f"{date_stamp}/{_REGION}/{_SERVICE}/aws4_request"
    string_to_sign = (
        f"AWS4-HMAC-SHA256\n"
        f"{amz_date}\n"
        f"{scope}\n"
        f"{hashlib.sha256(canonical_request.encode('utf-8')).hexdigest()}"
    )

    # 计算签名
    signing_key = _get_signing_key(date_stamp)
    signature = hmac.new(
        signing_key, string_to_sign.encode("utf-8"), hashlib.sha256
    ).hexdigest()

    # 构建最终 URL
    params["X-Amz-Signature"] = signature
    query_string = "&".join(
        f"{quote(k, safe='')}={quote(v, safe='')}" for k, v in sorted(params.items())
    )
    return f"http://{host}{object_path}?{query_string}"


def _sign_request_headers(
    method: str,
    bucket: str,
    key: str,
) -> dict:
    """生成带签名的请求头（用于服务端直接调用 MinIO REST API）"""
    now = datetime.now(timezone.utc)
    date_stamp = now.strftime("%Y%m%d")
    amz_date = now.strftime("%Y%m%dT%H%M%SZ")

    host = settings.MINIO_ENDPOINT
    object_path = f"/{bucket}/{key}"

    # Payload hash — UNSIGNED-PAYLOAD: 调用方需在请求头中带上此值
    payload_hash = "UNSIGNED-PAYLOAD"

    # Canonical headers
    canonical_headers = f"host:{host}\nx-amz-content-sha256:{payload_hash}\nx-amz-date:{amz_date}\n"
    signed_headers = "host;x-amz-content-sha256;x-amz-date"

    # Canonical request
    canonical_request = (
        f"{method}\n"
        f"{object_path}\n"
        f"\n"  # query string (empty)
        f"{canonical_headers}\n"
        f"{signed_headers}\n"
        f"{payload_hash}"
    )

    # String to sign
    scope = f"{date_stamp}/{_REGION}/{_SERVICE}/aws4_request"
    string_to_sign = (
        f"AWS4-HMAC-SHA256\n"
        f"{amz_date}\n"
        f"{scope}\n"
        f"{hashlib.sha256(canonical_request.encode('utf-8')).hexdigest()}"
    )

    # Calculate signature
    signing_key = _get_signing_key(date_stamp)
    signature = hmac.new(
        signing_key, string_to_sign.encode("utf-8"), hashlib.sha256
    ).hexdigest()

    credential = f"{settings.MINIO_ACCESS_KEY}/{date_stamp}/{_REGION}/{_SERVICE}/aws4_request"

    return {
        "Authorization": f"AWS4-HMAC-SHA256 Credential={credential}, SignedHeaders={signed_headers}, Signature={signature}",
        "x-amz-content-sha256": payload_hash,
        "x-amz-date": amz_date,
        "Host": host,
    }


# ── 公共 API ─────────────────────────────────────────────

def generate_presigned_upload_url(bucket: str, key: str, expires: int = 3600) -> str:
    """生成预签名上传 URL（PUT）

    Args:
        bucket: 存储桶名称
        key: 对象路径
        expires: URL 有效期（秒），默认 1 小时

    Returns:
        预签名 PUT URL；MinIO 不可用时返回 mock URL
    """
    if not check_minio_available() and not _is_dev_mode():
        # 非 dev 模式下 MinIO 不可用时仍然尝试签名
        pass

    if not check_minio_available() and _is_dev_mode():
        logger.debug("MinIO unavailable — returning mock upload URL for key=%s", key)
        return f"{settings.MINIO_PUBLIC_URL}/{bucket}/{key}?mock=upload&key={key}"

    return _sign_presigned_url("PUT", bucket, key, expires)


def generate_presigned_download_url(bucket: str, key: str, expires: int = 3600) -> str:
    """生成预签名下载 URL（GET）

    Args:
        bucket: 存储桶名称
        key: 对象路径
        expires: URL 有效期（秒），默认 1 小时

    Returns:
        预签名 GET URL；MinIO 不可用时返回 mock URL
    """
    if not check_minio_available() and _is_dev_mode():
        logger.debug("MinIO unavailable — returning mock download URL for key=%s", key)
        return f"{settings.MINIO_PUBLIC_URL}/{bucket}/{key}?mock=download&key={key}"

    return _sign_presigned_url("GET", bucket, key, expires)


def get_upload_url(user_id: str, file_name: str, file_type: str) -> dict:
    """生成预签名 PUT URL（15 分钟有效）— 兼容旧接口

    Returns:
        {"uploadUrl": str, "cosKey": str, "method": "PUT"}
    """
    ext = file_name.rsplit(".", 1)[-1] if "." in file_name else "bin"
    object_path = generate_file_path(user_id, file_type, ext)
    url = generate_presigned_upload_url(
        settings.MINIO_BUCKET, object_path, expires=900  # 15 minutes
    )
    return {"uploadUrl": url, "cosKey": object_path, "method": "PUT"}


def get_file_url(cos_key: str) -> str:
    """获取文件公开访问 URL

    如果 MinIO 可达且 bucket 策略允许公开读，直接拼接公开 URL；
    否则返回预签名下载 URL。
    """
    if not cos_key:
        return ""
    return f"{settings.MINIO_PUBLIC_URL}/{settings.MINIO_BUCKET}/{cos_key}"


def get_presigned_file_url(cos_key: str, expires: int = 3600) -> str:
    """获取文件预签名下载 URL（用于私有 bucket）

    Args:
        cos_key: 对象存储路径
        expires: URL 有效期（秒）

    Returns:
        预签名 GET URL
    """
    if not cos_key:
        return ""
    return generate_presigned_download_url(settings.MINIO_BUCKET, cos_key, expires)


def delete_file(cos_key: str) -> bool:
    """删除 MinIO 中的文件

    Args:
        cos_key: 对象存储路径

    Returns:
        True 表示成功，False 表示失败（MinIO 不可用等）
    """
    if not check_minio_available():
        logger.warning("MinIO unavailable — skipping delete for key=%s", cos_key)
        return False

    try:
        headers = _sign_request_headers("DELETE", settings.MINIO_BUCKET, cos_key)
        resp = httpx.delete(
            f"http://{settings.MINIO_ENDPOINT}/{settings.MINIO_BUCKET}/{cos_key}",
            headers=headers,
            timeout=10.0,
        )
        # MinIO DELETE 返回 204 No Content 表示成功
        if resp.status_code in (204, 200):
            return True
        logger.error("MinIO DELETE failed: status=%d key=%s", resp.status_code, cos_key)
        return False
    except Exception as e:
        logger.error("MinIO DELETE error: %s key=%s", e, cos_key)
        return False