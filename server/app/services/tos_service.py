"""火山引擎 TOS 对象存储服务 — httpx + AWS Sig V4 预签名 URL + 文件管理

替代 MinIO file_service.py，使用 TOS（兼容 S3 API）作为对象存储后端。
通过 config.py 中的 TOS_ACCESS_KEY 是否为空来判断使用 TOS 还是 MinIO。
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

# ── TOS 连接状态 ──────────────────────────────────────
_tos_available: bool | None = None


def _is_dev_mode() -> bool:
    return settings.DEBUG


def _get_bucket_host() -> str:
    """获取 virtual-hosted-style 域名（bucket.tos-endpoint）"""
    return f"{settings.TOS_BUCKET}.{settings.TOS_ENDPOINT}"


def check_tos_available() -> bool:
    """检查 TOS 是否可达，结果会缓存"""
    global _tos_available
    if _tos_available is not None:
        return _tos_available
    try:
        resp = httpx.head(
            f"https://{_get_bucket_host()}/",
            timeout=5.0,
        )
        # TOS 返回 403（私有桶）说明服务可达，404（桶不存在）说明不可达
        _tos_available = resp.status_code in (200, 403)
    except Exception:
        logger.warning("TOS unavailable at %s — falling back", settings.TOS_ENDPOINT)
        _tos_available = False
    return _tos_available


def reset_availability() -> None:
    """重置 TOS 可用性缓存（测试用）"""
    global _tos_available
    _tos_available = None


def is_tos_enabled() -> bool:
    """判断是否配置了 TOS（通过检查 TOS_ACCESS_KEY 是否为空）"""
    return bool(settings.TOS_ACCESS_KEY)


# ── 路径生成 ─────────────────────────────────────────────

DIR_MAP = {
    "image": "photos",
    "video": "videos",
    "avatar": "avatars",
    "threedmodel": "3dmodels",
}


def generate_file_path(user_id: str, file_type: str, ext: str) -> str:
    """生成 TOS 对象路径：{type}/{userId}/{uuid}.{ext}"""
    directory = DIR_MAP.get(file_type, "others")
    return f"{directory}/{user_id}/{uuid.uuid4().hex}.{ext}"


# ── AWS Signature V4 签名 ───────────────────────────────
# TOS 兼容 S3 API，使用 AWS Sig V4 签名方案
# TOS 同时接受 X-Amz-* 和 X-Tos-* 两种 Header 前缀

_SERVICE = "s3"
_REGION = "cn-beijing"


def _hmac_sha256(key: bytes, msg: str) -> bytes:
    return hmac.new(key, msg.encode("utf-8"), hashlib.sha256).digest()


def _get_signing_key(date_stamp: str) -> bytes:
    """生成 AWS Sig V4 签名密钥（使用 TOS 密钥）"""
    k_date = _hmac_sha256(("AWS4" + settings.TOS_SECRET_KEY).encode("utf-8"), date_stamp)
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
    """生成预签名 URL（AWS Sig V4），使用 virtual-hosted-style（bucket 域名）

    返回完整的预签名 URL，客户端可直接使用。
    """
    now = datetime.now(timezone.utc)
    date_stamp = now.strftime("%Y%m%d")
    amz_date = now.strftime("%Y%m%dT%H%M%SZ")

    # TOS 要求使用 virtual-hosted-style URL（bucket.tos-endpoint/key）
    host = _get_bucket_host()
    object_path = f"/{key}"

    credential = f"{settings.TOS_ACCESS_KEY}/{date_stamp}/{_REGION}/{_SERVICE}/aws4_request"

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

    # 构建最终 URL（virtual-hosted-style）
    params["X-Amz-Signature"] = signature
    query_string = "&".join(
        f"{quote(k, safe='')}={quote(v, safe='')}" for k, v in sorted(params.items())
    )
    return f"https://{host}{object_path}?{query_string}"


def _sign_request_headers(
    method: str,
    bucket: str,
    key: str,
    headers: dict | None = None,
) -> dict:
    """生成带签名的请求头（用于服务端直接调用 TOS REST API）

    使用 virtual-hosted-style（bucket 域名），TOS 不支持 path-style 写入。
    """
    now = datetime.now(timezone.utc)
    date_stamp = now.strftime("%Y%m%d")
    amz_date = now.strftime("%Y%m%dT%H%M%SZ")

    # 服务器部署在腾讯云，不在火山引擎内网，统一使用公网 bucket 域名
    host = _get_bucket_host()
    object_path = f"/{key}"

    payload_hash = "UNSIGNED-PAYLOAD"

    # 合并额外 header
    extra_headers = headers or {}

    # Canonical headers — 按字母序排列
    canonical_lines = [f"host:{host}", f"x-amz-content-sha256:{payload_hash}", f"x-amz-date:{amz_date}"]
    signed_headers_list = ["host", "x-amz-content-sha256", "x-amz-date"]

    for k, v in sorted(extra_headers.items()):
        kl = k.lower().strip()
        canonical_lines.append(f"{kl}:{v}")
        signed_headers_list.append(kl)

    canonical_headers = "\n".join(canonical_lines) + "\n"
    signed_headers = ";".join(signed_headers_list)

    canonical_request = (
        f"{method}\n"
        f"{object_path}\n"
        f"\n"
        f"{canonical_headers}"
        f"{signed_headers}\n"
        f"{payload_hash}"
    )

    scope = f"{date_stamp}/{_REGION}/{_SERVICE}/aws4_request"
    string_to_sign = (
        f"AWS4-HMAC-SHA256\n"
        f"{amz_date}\n"
        f"{scope}\n"
        f"{hashlib.sha256(canonical_request.encode('utf-8')).hexdigest()}"
    )

    signing_key = _get_signing_key(date_stamp)
    signature = hmac.new(
        signing_key, string_to_sign.encode("utf-8"), hashlib.sha256
    ).hexdigest()

    credential = f"{settings.TOS_ACCESS_KEY}/{date_stamp}/{_REGION}/{_SERVICE}/aws4_request"

    result = {
        "Authorization": f"AWS4-HMAC-SHA256 Credential={credential}, SignedHeaders={signed_headers}, Signature={signature}",
        "x-amz-content-sha256": payload_hash,
        "x-amz-date": amz_date,
        "Host": host,
    }
    # 添加额外 header
    for k, v in extra_headers.items():
        result[k] = v
    return result


# ── 公共 API ─────────────────────────────────────────────


def generate_presigned_upload_url(bucket: str, key: str, expires: int = 3600) -> str:
    """生成预签名上传 URL（PUT）"""
    if not is_tos_enabled():
        logger.warning("TOS not configured")
        return ""
    if not check_tos_available() and _is_dev_mode():
        logger.debug("TOS unavailable — returning mock upload URL for key=%s", key)
        return f"https://{_get_bucket_host()}/{key}?mock=upload&key={key}"
    return _sign_presigned_url("PUT", bucket, key, expires)


def get_upload_url(user_id: str, file_name: str, file_type: str) -> dict:
    """生成预签名 PUT URL（15 分钟有效）

    Returns:
        {"uploadUrl": str, "cosKey": str, "method": "PUT", "uploadType": str}
    """
    ext = file_name.rsplit(".", 1)[-1] if "." in file_name else "bin"
    object_path = generate_file_path(user_id, file_type, ext)
    url = generate_presigned_upload_url(
        settings.TOS_BUCKET, object_path, expires=900  # 15 minutes
    )
    return {
        "uploadUrl": url,
        "cosKey": object_path,
        "method": "PUT",
        "uploadType": "presigned",
    }


def get_file_url(cos_key: str) -> str:
    """获取文件公开访问 URL

    TOS_PUBLIC_URL 是 bucket 域名格式（如 https://baby-album.tos-cn-beijing.volces.com），
    直接拼接对象路径即可（不需要再带 bucket 名）。
    如果配置了 CDN，走 CDN URL 以加速播放。
    """
    if not cos_key:
        return ""
    if settings.TOS_CDN_URL:
        return f"{settings.TOS_CDN_URL}/{cos_key}"
    # TOS_PUBLIC_URL 已经是 bucket 级域名，不需要 /bucket/ 前缀
    return f"{settings.TOS_PUBLIC_URL}/{cos_key}"


def delete_file(cos_key: str) -> bool:
    """删除 TOS 中的文件

    Returns:
        True 表示成功，False 表示失败
    """
    if not is_tos_enabled():
        logger.warning("TOS not configured — skipping delete for key=%s", cos_key)
        return False
    if not check_tos_available():
        logger.warning("TOS unavailable — skipping delete for key=%s", cos_key)
        return False

    try:
        url = _sign_presigned_url("DELETE", settings.TOS_BUCKET, cos_key, expires=300)
        resp = httpx.delete(url, timeout=10.0)
        if resp.status_code in (204, 200):
            return True
        logger.error("TOS DELETE failed: status=%d key=%s", resp.status_code, cos_key)
        return False
    except Exception as e:
        logger.error("TOS DELETE error: %s key=%s", e, cos_key)
        return False


# ── 服务端读写（供缩略图生成等使用） ─────────────────────


def download_file(bucket: str, key: str) -> bytes | None:
    """从 TOS 下载文件（服务端使用，通过预签名 GET URL）"""
    if not is_tos_enabled():
        return None
    try:
        url = _sign_presigned_url("GET", bucket, key, expires=300)
        resp = httpx.get(url, timeout=30.0)
        if resp.status_code == 200:
            return resp.content
        logger.error("TOS download failed: status=%d key=%s", resp.status_code, key)
        return None
    except Exception as e:
        logger.error("TOS download error: %s key=%s", e, key)
        return None


def upload_file(bucket: str, key: str, data: bytes, content_type: str = "application/octet-stream") -> bool:
    """上传文件到 TOS（服务端使用，通过预签名 PUT URL）"""
    if not is_tos_enabled():
        return False
    try:
        url = _sign_presigned_url("PUT", bucket, key, expires=300)
        resp = httpx.put(
            url,
            headers={"Content-Type": content_type},
            content=data,
            timeout=60.0,
        )
        if resp.status_code in (200, 201):
            return True
        logger.error("TOS upload failed: status=%d key=%s", resp.status_code, key)
        return False
    except Exception as e:
        logger.error("TOS upload error: %s key=%s", e, key)
        return False
