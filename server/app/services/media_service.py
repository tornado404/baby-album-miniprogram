"""媒体服务"""
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from app.models.media import Media
from app.services.file_service import get_file_url


class MediaService:
    def __init__(self, db: AsyncSession):
        self.db = db

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
        await self.db.commit()
        await self.db.refresh(m)
        return m

    async def soft_delete(self, media_id: str, user_id: str):
        r = await self.db.execute(
            select(Media).where(Media.id == media_id, Media.user_id == user_id)
        )
        m = r.scalar_one_or_none()
        if not m:
            raise ValueError("Media not found")
        m.is_deleted = True
        await self.db.commit()