"""Pillow 缩略图生成服务"""
from io import BytesIO
from PIL import Image
from minio import Minio
from app.config import settings

minio_client = Minio(
    settings.MINIO_ENDPOINT,
    access_key=settings.MINIO_ACCESS_KEY,
    secret_key=settings.MINIO_SECRET_KEY,
    secure=False,
)


def generate_thumbnail(cos_key: str, user_id: str) -> tuple[str, str]:
    """生成 300×300 WebP 缩略图，返回 (thumbnail_key, thumbnail_url)"""
    response = minio_client.get_object(settings.MINIO_BUCKET, cos_key)
    image_data = response.read()

    img = Image.open(BytesIO(image_data))
    img.thumbnail((300, 300))

    thumb_key = (
        cos_key.replace("photos/", "thumbnails/")
        .rsplit(".", 1)[0]
        + "_300x300.webp"
    )
    buffer = BytesIO()
    img.save(buffer, format="WEBP", quality=80)
    buffer.seek(0)

    minio_client.put_object(
        settings.MINIO_BUCKET,
        thumb_key,
        buffer,
        buffer.getbuffer().nbytes,
        content_type="image/webp",
    )
    thumb_url = f"{settings.MINIO_PUBLIC_URL}/{settings.MINIO_BUCKET}/{thumb_key}"
    return thumb_key, thumb_url


def generate_avatar_thumbnail(cos_key: str, user_id: str) -> tuple[str, str]:
    """生成头像缩略图（200×200 正方形裁剪）"""
    response = minio_client.get_object(settings.MINIO_BUCKET, cos_key)
    image_data = response.read()

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
    buffer.seek(0)

    minio_client.put_object(
        settings.MINIO_BUCKET,
        thumb_key,
        buffer,
        buffer.getbuffer().nbytes,
        content_type="image/webp",
    )
    thumb_url = f"{settings.MINIO_PUBLIC_URL}/{settings.MINIO_BUCKET}/{thumb_key}"
    return thumb_key, thumb_url