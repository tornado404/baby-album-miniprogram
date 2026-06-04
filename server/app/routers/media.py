"""媒体路由"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.middleware.auth import get_current_user_id
from app.services.media_service import MediaService
from app.schemas.media import MediaCreate, MediaResponse

router = APIRouter()


@router.get("/", response_model=list[MediaResponse])
async def list_media(
    babyId: str,
    page: int = 1,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    items = await MediaService(db).list_media(babyId, page)
    return [
        MediaResponse(
            id=m.id, type=m.type.value, title=m.title,
            thumbnailUrl=m.thumbnail_url, cosUrl=m.cos_url,
            captureDate=m.capture_date, fileSize=m.file_size or 0,
            width=m.width, height=m.height,
        ) for m in items
    ]


@router.post("/", response_model=MediaResponse)
async def create_media(
    data: MediaCreate,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    m = await MediaService(db).create_media(user_id, data.dict())
    return MediaResponse(
        id=m.id, type=m.type.value, title=m.title,
        thumbnailUrl=m.thumbnail_url, cosUrl=m.cos_url,
        captureDate=m.capture_date, fileSize=m.file_size or 0,
    )


@router.delete("/{media_id}")
async def delete_media(
    media_id: str,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    try:
        await MediaService(db).soft_delete(media_id, user_id)
        return {"message": "Deleted"}
    except ValueError as e:
        raise HTTPException(404, str(e))