"""媒体服务"""
import asyncio
import logging
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from app.models.media import Media
from app.models.sync_log import SyncAction
from app.services.sync_service import record_sync_log
from app.services.file_service import get_file_url, delete_file

logger = logging.getLogger(__name__)


async def _cleanup_minio_files_async(cos_key: Optional[str], thumbnail_key: Optional[str]):
    """后台任务：清理 MinIO 中的原图和缩略图文件，失败仅记录日志"""
    if cos_key:
        try:
            await asyncio.to_thread(delete_file, cos_key)
        except Exception:
            logger.exception("Failed to delete original file from MinIO: %s", cos_key)
    if thumbnail_key:
        try:
            await asyncio.to_thread(delete_file, thumbnail_key)
        except Exception:
            logger.exception("Failed to delete thumbnail from MinIO: %s", thumbnail_key)


class MediaService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_media(self, media_id: str, user_id: str) -> Optional[Media]:
        r = await self.db.execute(
            select(Media).where(Media.id == media_id, Media.user_id == user_id, Media.is_deleted == False)
        )
        return r.scalar_one_or_none()

    async def list_media(self, baby_id: str, page: int = 1, page_size: int = 20):
        q = (
            select(Media)
            .where(Media.baby_id == baby_id, Media.is_deleted == False)
            .order_by(desc(Media.capture_date))
        )
        r = await self.db.execute(q.offset((page - 1) * page_size).limit(page_size))
        return r.scalars().all()

    async def create_media(self, user_id: str, data: dict):
        cos_key = data.get("cos_key", "")
        cos_url = get_file_url(cos_key) if cos_key else ""
        m = Media(user_id=user_id, cos_url=cos_url, **data)
        self.db.add(m)
        await self.db.flush()
        await record_sync_log(self.db, user_id, "media", m.id, SyncAction.create)
        await self.db.commit()

        # 同步生成缩略图（图片类型），同时提取原图尺寸和文件大小
        # MediaType 继承 str，新建对象时 m.type 可能是字符串而非枚举，直接字符串比较更稳妥
        media_type = m.type.value if hasattr(m.type, "value") else m.type
        if cos_key and media_type == "image":
            try:
                from app.services.thumbnail_service import process_thumbnail
                await process_thumbnail(str(m.id), cos_key, str(user_id), self.db)
            except Exception:
                logger.exception("Thumbnail generation failed for media_id=%s", m.id)

        await self.db.refresh(m)
        return m

    async def soft_delete(self, media_id: str, user_id: str):
        r = await self.db.execute(
            select(Media).where(Media.id == media_id, Media.user_id == user_id)
        )
        m = r.scalar_one_or_none()
        if not m:
            raise ValueError("Media not found")

        cos_key = m.cos_key
        thumbnail_key = m.thumbnail_key

        m.is_deleted = True
        await record_sync_log(self.db, user_id, "media", media_id, SyncAction.delete)
        await self.db.commit()

        # 异步清理 MinIO 文件（不阻塞 API 响应），失败仅记录日志
        if cos_key or thumbnail_key:
            asyncio.create_task(_cleanup_minio_files_async(cos_key, thumbnail_key))