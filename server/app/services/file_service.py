"""MinIO 文件操作服务 — 预签名 URL + 文件管理"""

import uuid
from datetime import timedelta
from minio import Minio
from app.config import settings

minio_client = Minio(
    settings.MINIO_ENDPOINT,
    access_key=settings.MINIO_ACCESS_KEY,
    secret_key=settings.MINIO_SECRET_KEY,
    secure=False,
)

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


def get_upload_url(user_id: str, file_name: str, file_type: str) -> dict:
    """生成预签名 PUT URL（15 分钟有效）"""
    ext = file_name.rsplit(".", 1)[-1] if "." in file_name else "bin"
    object_path = generate_file_path(user_id, file_type, ext)
    url = minio_client.presigned_put_object(
        settings.MINIO_BUCKET,
        object_path,
        expires=timedelta(minutes=15),
    )
    return {"uploadUrl": url, "cosKey": object_path, "method": "PUT"}


def get_file_url(cos_key: str) -> str:
    """获取文件公开访问 URL"""
    return f"{settings.MINIO_PUBLIC_URL}/{settings.MINIO_BUCKET}/{cos_key}"


def delete_file(cos_key: str) -> None:
    """删除 MinIO 中的文件"""
    minio_client.remove_object(settings.MINIO_BUCKET, cos_key)