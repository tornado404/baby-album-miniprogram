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


def _resolve_media_urls(m: Media) -> dict:
    """返回媒体的访问 URL

    MinIO bucket 策略已允许 photos/、videos/、thumbnails/、avatars/ 公开读取，
    cos_url 和 thumbnail_url 字段在写入时即为公开 URL，直接返回即可。
    预签名 URL 有过期时间和编码问题，公开 URL 更适合小程序 <image> 直接加载。
    """
    return {"cosUrl": m.cos_url, "thumbnailUrl": m.thumbnail_url}


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
    babyAge: Optional[dict] = None  # { years, months, days }


@router.get("/", response_model=list[MediaOut])
async def list_media(
    babyId: str = "",
    page: int = 1,
    archived: Optional[str] = None,
    tags: Optional[str] = None,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    if not babyId:
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail={"code": 40001, "message": "Missing required parameter: babyId"})
    svc = MediaService(db)
    items = await svc.list_media(babyId, page)
    result = []
    for m in items:
        urls = _resolve_media_urls(m)
        result.append(MediaOut(
            id=m.id, type=m.type.value, title=m.title,
            thumbnailUrl=urls["thumbnailUrl"], cosUrl=urls["cosUrl"],
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
    create_data = data.model_dump(exclude_unset=True)
    if "tags" not in create_data or create_data["tags"] is None:
        create_data.pop("tags", None)

    # camelCase → snake_case 字段映射
    field_map = {
        "babyId": "baby_id", "cosKey": "cos_key",
        "captureDate": "capture_date",
        "locationName": "location_name",
    }
    for camel, snake in field_map.items():
        if camel in create_data:
            create_data[snake] = create_data.pop(camel)

    m = await MediaService(db).create_media(user_id, create_data)
    urls = _resolve_media_urls(m)
    return MediaOut(
        id=m.id, type=m.type.value, title=m.title,
        thumbnailUrl=urls["thumbnailUrl"], cosUrl=urls["cosUrl"],
        captureDate=m.capture_date, fileSize=m.file_size or 0,
        width=m.width, height=m.height,
        locationName=m.location_name, tags=m.tags,
        moment=m.moment, milestone=m.milestone,
        isArchived=m.is_archived,
    )


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
    updates = data.model_dump(exclude_unset=True, exclude_none=True)
    # camelCase → snake_case 字段映射
    field_map = {
        "locationName": "location_name",
        "isArchived": "is_archived",
    }
    for camel, snake in field_map.items():
        if camel in updates:
            updates[snake] = updates.pop(camel)
    for k, v in updates.items():
        setattr(m, k, v)
    m.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(m)
    urls = _resolve_media_urls(m)
    return MediaOut(
        id=m.id, type=m.type.value, title=m.title,
        thumbnailUrl=urls["thumbnailUrl"], cosUrl=urls["cosUrl"],
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


@router.get("/{media_id}", response_model=MediaOut)
async def get_media(
    media_id: str,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    m = await MediaService(db).get_media(media_id, user_id)
    if not m:
        raise HTTPException(404, "Media not found")
    urls = _resolve_media_urls(m)
    return MediaOut(
        id=m.id, type=m.type.value, title=m.title,
        thumbnailUrl=urls["thumbnailUrl"], cosUrl=urls["cosUrl"],
        captureDate=m.capture_date, fileSize=m.file_size or 0,
        width=m.width, height=m.height,
        locationName=m.location_name, tags=m.tags,
        moment=m.moment, milestone=m.milestone,
        isArchived=m.is_archived,
        babyAge={
            "years": m.baby_age_yrs or 0,
            "months": m.baby_age_mos or 0,
            "days": m.baby_age_days or 0,
        } if m.baby_age_yrs is not None else None,
    )