"""共享路由"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.middleware.auth import get_current_user_id
from app.services.share_service import ShareService

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