"""Pillow 缩略图生成服务

提供两层接口：
1. process_thumbnail(media_id, cos_key, user_id) — 完整流程（下载 → 缩放 → 上传 → 更新 DB）
   由 Celery task 调用，也可直接调用（方便测试）
2. resize_image(image_data, width, height, quality) — 纯 Pillow 缩放，无 IO 依赖，可独立测试

底层存储自动适配 TOS / MinIO（通过 tos_service 统一接口）。
"""

import uuid
import logging
from io import BytesIO
from typing import Optional

from PIL import Image
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.services.tos_service import is_tos_enabled, download_file, upload_file
from app.services.tos_service import get_file_url as tos_get_file_url

logger = logging.getLogger(__name__)

# ── 纯 Pillow 缩放（无 IO，方便单测） ─────────────────────

def resize_image(
    image_data: bytes,
    width: int = 300,
    height: int = 300,
    quality: int = 80,
) -> bytes:
    """将图片缩放至指定尺寸，输出 WebP 格式 bytes

    Args:
        image_data: 原图二进制数据
        width: 目标宽度（保持纵横比，最大值）
        height: 目标高度（保持纵横比，最大值）
        quality: WebP 输出质量 (1-100)

    Returns:
        WebP 缩略图 bytes
    """
    img = Image.open(BytesIO(image_data))

    # 统一转 RGB（RGBA/P 模式无法直接存 WebP）
    if img.mode not in ("RGB", "L"):
        img = img.convert("RGB")

    img.thumbnail((width, height), Image.Resampling.LANCZOS)

    buffer = BytesIO()
    img.save(buffer, format="WEBP", quality=quality)
    return buffer.getvalue()


def build_thumbnail_key(user_id: str) -> str:
    """生成缩略图存储路径: thumbnails/{userId}/{uuid}.webp"""
    return f"thumbnails/{user_id}/{uuid.uuid4().hex}.webp"


def build_thumbnail_url(thumb_key: str) -> str:
    """拼接缩略图公开访问 URL

    优先使用 TOS CDN URL（如有配置），否则用 TOS 公网 URL 或 MinIO URL 回退。
    """
    if is_tos_enabled():
        return tos_get_file_url(thumb_key)
    return f"{settings.MINIO_PUBLIC_URL}/{settings.MINIO_BUCKET}/{thumb_key}"


# ── 存储读写适配层 ──────────────────────────────────────
# 自动选择 TOS 或 MinIO 后端

def _download_from_store(bucket: str, key: str) -> Optional[bytes]:
    """从对象存储下载文件（自动适配 TOS / MinIO）"""
    if is_tos_enabled():
        return download_file(bucket, key)
    # MinIO 回退
    try:
        from minio import Minio
        client = Minio(
            settings.MINIO_ENDPOINT,
            access_key=settings.MINIO_ACCESS_KEY,
            secret_key=settings.MINIO_SECRET_KEY,
            secure=False,
        )
        response = client.get_object(bucket, key)
        data = response.read()
        response.close()
        response.release_conn()
        return data
    except Exception:
        logger.exception("MinIO download failed: bucket=%s key=%s", bucket, key)
        return None


def _upload_to_store(bucket: str, key: str, data: bytes, content_type: str) -> bool:
    """上传文件到对象存储（自动适配 TOS / MinIO）"""
    if is_tos_enabled():
        return upload_file(bucket, key, data, content_type)
    # MinIO 回退
    try:
        from minio import Minio
        client = Minio(
            settings.MINIO_ENDPOINT,
            access_key=settings.MINIO_ACCESS_KEY,
            secret_key=settings.MINIO_SECRET_KEY,
            secure=False,
        )
        client.put_object(bucket, key, BytesIO(data), len(data), content_type=content_type)
        return True
    except Exception:
        logger.exception("MinIO upload failed: bucket=%s key=%s", bucket, key)
        return False


# ── 完整流程（下载 → 缩放 → 上传 → 更新 DB） ─────────────

async def process_thumbnail(
    media_id: str,
    cos_key: str,
    user_id: str,
    db: AsyncSession,
) -> Optional[str]:
    """生成缩略图并更新 Media 记录

    Args:
        media_id: 媒体记录 ID
        cos_key: 原图在存储中的 key
        user_id: 用户 ID
        db: 异步数据库会话

    Returns:
        缩略图 URL，失败返回 None
    """
    bucket = settings.TOS_BUCKET if is_tos_enabled() else settings.MINIO_BUCKET
    try:
        # 1. 从存储下载原图
        image_data = _download_from_store(bucket, cos_key)
        if image_data is None:
            raise RuntimeError(f"Failed to download: {cos_key}")

        # 2. 提取原图尺寸
        img = Image.open(BytesIO(image_data))
        original_width, original_height = img.size

        # 3. Pillow 缩放
        thumb_bytes = resize_image(
            image_data,
            width=settings.THUMBNAIL_WIDTH,
            height=settings.THUMBNAIL_HEIGHT,
            quality=settings.THUMBNAIL_QUALITY,
        )

        # 4. 上传缩略图到存储
        thumb_key = build_thumbnail_key(user_id)
        success = _upload_to_store(bucket, thumb_key, thumb_bytes, content_type="image/webp")
        if not success:
            raise RuntimeError(f"Failed to upload thumbnail: {thumb_key}")

        # 5. 更新 Media 记录（含缩略图 + 原图尺寸 + 文件大小）
        thumb_url = build_thumbnail_url(thumb_key)
        await _update_media_thumbnail(
            db, media_id, thumb_key, thumb_url,
            width=original_width, height=original_height,
            file_size=len(image_data),
        )

        logger.info("Thumbnail generated: media_id=%s thumb_key=%s", media_id, thumb_key)
        return thumb_url

    except Exception:
        logger.exception("Failed to generate thumbnail for media_id=%s", media_id)
        return None


async def _update_media_thumbnail(
    db: AsyncSession,
    media_id: str,
    thumb_key: str,
    thumb_url: str,
    width: Optional[int] = None,
    height: Optional[int] = None,
    file_size: Optional[int] = None,
) -> None:
    """更新 Media 记录的缩略图信息及原图元数据"""
    from app.models.media import Media

    r = await db.execute(select(Media).where(Media.id == media_id))
    m = r.scalar_one_or_none()
    if m:
        m.thumbnail_key = thumb_key
        m.thumbnail_url = thumb_url
        if width is not None:
            m.width = width
        if height is not None:
            m.height = height
        if file_size is not None:
            m.file_size = file_size
        await db.commit()


# ── 同步版本（供旧代码兼容） ─────────────────────────────

def generate_thumbnail(cos_key: str, user_id: str) -> tuple[str, str]:
    """生成 300×300 WebP 缩略图，返回 (thumbnail_key, thumbnail_url)

    保留原有接口兼容性。新代码应使用 process_thumbnail。
    """
    bucket = settings.TOS_BUCKET if is_tos_enabled() else settings.MINIO_BUCKET

    image_data = _download_from_store(bucket, cos_key)
    if image_data is None:
        raise RuntimeError(f"Failed to download: {cos_key}")

    thumb_bytes = resize_image(
        image_data,
        width=settings.THUMBNAIL_WIDTH,
        height=settings.THUMBNAIL_HEIGHT,
        quality=settings.THUMBNAIL_QUALITY,
    )

    thumb_key = build_thumbnail_key(user_id)
    _upload_to_store(bucket, thumb_key, thumb_bytes, content_type="image/webp")

    thumb_url = build_thumbnail_url(thumb_key)
    return thumb_key, thumb_url


def generate_avatar_thumbnail(cos_key: str, user_id: str) -> tuple[str, str]:
    """生成头像缩略图（200×200 正方形裁剪）"""
    bucket = settings.TOS_BUCKET if is_tos_enabled() else settings.MINIO_BUCKET

    image_data = _download_from_store(bucket, cos_key)
    if image_data is None:
        raise RuntimeError(f"Failed to download: {cos_key}")

    img = Image.open(BytesIO(image_data))

    # 居中正方形裁剪
    size = min(img.width, img.height)
    left = (img.width - size) // 2
    top = (img.height - size) // 2
    img = img.crop((left, top, left + size, top + size))
    img.thumbnail((200, 200))

    thumb_key = (
        cos_key.replace("avatars/", "thumbnails/")
        .rsplit(".", 1)[0]
        + "_200x200.webp"
    )
    buffer = BytesIO()
    img.save(buffer, format="WEBP", quality=85)

    public_url_base = settings.TOS_PUBLIC_URL if is_tos_enabled() else settings.MINIO_PUBLIC_URL
    _upload_to_store(bucket, thumb_key, buffer.getvalue(), content_type="image/webp")
    thumb_url = f"{public_url_base}/{bucket}/{thumb_key}"
    return thumb_key, thumb_url
