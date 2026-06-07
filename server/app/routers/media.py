"""媒体路由 — 含 v2.0 扩展（PUT / batch-archive / batch-tag）"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update as sa_update
from app.database import get_db
from app.middleware.auth import get_current_user_id
from app.services.media_service import MediaService
from app.models.media import Media
from datetime import datetime

router = APIRouter()


class BatchArchiveRequest(BaseModel):
    ids: list[str]
    archived: bool = True


class BatchTagRequest(BaseModel):
    ids: list[str]
    tags: list[str]
    action: str = "add"


class MediaCreateBody(BaseModel):
    babyId: str
    title: str = ""
    type: str = "image"
    cosKey: str
    captureDate: str
    locationName: Optional[str] = None
    tags: Optional[list[str]] = None
    moment: Optional[str] = None
    milestone: Optional[str] = None


class MediaUpdateBody(BaseModel):
    title: Optional[str] = None
    locationName: Optional[str] = None
    tags: Optional[list[str]] = None
    moment: Optional[str] = None
    milestone: Optional[str] = None
    isArchived: Optional[bool] = None


class MediaOut(BaseModel):
    id: str
    type: str
    title: str
    thumbnailUrl: Optional[str] = None
    cosUrl: Optional[str] = None
    captureDate: str
    fileSize: int = 0
    width: Optional[int] = None
    height: Optional[int] = None
    locationName: Optional[str] = None
    tags: Optional[list[str]] = None
    moment: Optional[str] = None
    milestone: Optional[str] = None
    isArchived: bool = False


@router.get("/", response_model=list[MediaOut])
async def list_media(
    babyId: str = "",
    page: int = 1,
    archived: Optional[str] = None,
    tags: Optional[str] = None,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    svc = MediaService(db)
    items = await svc.list_media(babyId, page)
    result = []
    for m in items:
        result.append(MediaOut(
            id=m.id, type=m.type.value, title=m.title,
            thumbnailUrl=m.thumbnail_url, cosUrl=m.cos_url,
            captureDate=m.capture_date, fileSize=m.file_size or 0,
            width=m.width, height=m.height,
            locationName=m.location_name, tags=m.tags,
            moment=m.moment, milestone=m.milestone,
            isArchived=m.is_archived,
        ))
    return result


@router.post("/", response_model=MediaOut)
async def create_media(
    data: MediaCreateBody,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    create_data = data.dict(exclude_unset=True)
    if "tags" not in create_data or create_data["tags"] is None:
        create_data.pop("tags", None)
    m = await MediaService(db).create_media(user_id, create_data)
    return MediaOut(
        id=m.id, type=m.type.value, title=m.title,
        thumbnailUrl=m.thumbnail_url, cosUrl=m.cos_url,
        captureDate=m.capture_date, fileSize=m.file_size or 0,
        width=m.width, height=m.height,
        locationName=m.location_name, tags=m.tags,
        moment=m.moment, milestone=m.milestone,
        isArchived=m.is_archived,
    )


@router.put("/{media_id}", response_model=MediaOut)
async def update_media(
    media_id: str,
    data: MediaUpdateBody,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    r = await db.execute(select(Media).where(Media.id == media_id, Media.user_id == user_id))
    m = r.scalar_one_or_none()
    if not m:
        raise HTTPException(404, "Media not found")
    updates = data.dict(exclude_unset=True, exclude_none=True)
    for k, v in updates.items():
        setattr(m, k, v)
    m.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(m)
    return MediaOut(
        id=m.id, type=m.type.value, title=m.title,
        thumbnailUrl=m.thumbnail_url, cosUrl=m.cos_url,
        captureDate=m.capture_date, fileSize=m.file_size or 0,
        width=m.width, height=m.height,
        locationName=m.location_name, tags=m.tags,
        moment=m.moment, milestone=m.milestone,
        isArchived=m.is_archived,
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


@router.put("/batch-archive")
async def batch_archive(
    data: BatchArchiveRequest,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    now = datetime.utcnow()
    for mid in data.ids:
        r = await db.execute(select(Media).where(Media.id == mid, Media.user_id == user_id))
        m = r.scalar_one_or_none()
        if m:
            m.is_archived = data.archived
            m.archived_at = now if data.archived else None
    await db.commit()
    return {"message": f"{len(data.ids)} media updated", "archived": data.archived}


@router.put("/batch-tag")
async def batch_tag(
    data: BatchTagRequest,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    for mid in data.ids:
        r = await db.execute(select(Media).where(Media.id == mid, Media.user_id == user_id))
        m = r.scalar_one_or_none()
        if m:
            current = set(m.tags or [])
            if data.action == "add":
                current.update(data.tags)
            elif data.action == "remove":
                current -= set(data.tags)
            m.tags = list(current)
    await db.commit()
    return {"message": f"{len(data.ids)} media tagged", "tags": data.tags}