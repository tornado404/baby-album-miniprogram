"""共享路由"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.middleware.auth import get_current_user_id
from app.middleware.permission import require_baby_access
from app.models.baby import Baby
from app.models.share import ShareRelation
from app.services.share_service import ShareService
from app.services.media_service import MediaService

router = APIRouter()


class InviteRequest(BaseModel):
    babyId: str
    permission: str = "viewer"


class AcceptRequest(BaseModel):
    token: str


@router.post("/invitations")
async def create_invitation(
    data: InviteRequest,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    result = await ShareService(db).invite(data.babyId, user_id, data.permission)
    return {"code": 0, "data": result}


@router.post("/accept")
async def accept_invitation(
    data: AcceptRequest,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    try:
        result = await ShareService(db).accept(data.token, user_id)
        return {"code": 0, "data": result}
    except ValueError as e:
        raise HTTPException(400, str(e))


<<<<<<< HEAD
=======
@router.get("/relations")
async def list_relations(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """列出当前用户发起的所有共享关系"""
    relations = await ShareService(db).list_relations(user_id)
    return {"code": 0, "data": relations}


>>>>>>> worktree-issue-8-p2-optimize
@router.delete("/relations/{relation_id}")
async def revoke_relation(
    relation_id: str,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
<<<<<<< HEAD
    """取消共享 — 仅所有者可操作"""
    try:
        await ShareService(db).revoke(relation_id, user_id)
        return {"code": 0, "message": "Revoked"}
    except ValueError as e:
        raise HTTPException(404, str(e))


@router.get("/babies")
async def list_shared_babies(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """获取共享给我的宝宝列表"""
    r = await db.execute(
        select(ShareRelation, Baby)
        .join(Baby, ShareRelation.baby_id == Baby.id)
        .where(
            ShareRelation.viewer_user_id == user_id,
            Baby.is_deleted == False,
        )
    )
    rows = r.all()
    result = []
    for relation, baby in rows:
        result.append({
            "id": baby.id,
            "name": baby.name,
            "gender": baby.gender,
            "birthDate": baby.birth_date,
            "avatar": baby.avatar,
            "permission": relation.permission,
            "ownerUserId": relation.owner_user_id,
            "relationId": relation.id,
        })
    return {"code": 0, "data": result}


@router.get("/babies/{baby_id}/media")
async def list_shared_baby_media(
    baby_id: str,
    access=Depends(require_baby_access(min_permission="viewer")),
    db: AsyncSession = Depends(get_db),
):
    """查看共享宝宝的媒体列表"""
    page = 1
    page_size = 50
    items = await MediaService(db).list_media(baby_id, page, page_size)
    media_list = []
    for m in items:
        media_list.append({
            "id": m.id,
            "type": m.type.value if m.type else "image",
            "title": m.title,
            "thumbnailUrl": m.thumbnail_url,
            "cosUrl": m.cos_url,
            "captureDate": m.capture_date,
            "fileSize": m.file_size or 0,
            "width": m.width,
            "height": m.height,
            "locationName": m.location_name,
            "tags": m.tags,
            "moment": m.moment,
            "milestone": m.milestone,
            "isArchived": m.is_archived,
        })
    return {"code": 0, "data": media_list}
=======
    """取消共享关系"""
    try:
        await ShareService(db).revoke(relation_id, user_id)
        return {"code": 0, "data": {"message": "Revoked"}}
    except ValueError as e:
        raise HTTPException(404, str(e))
>>>>>>> worktree-issue-8-p2-optimize
