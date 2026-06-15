"""数据同步路由"""
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Any
from app.database import get_db
from app.middleware.auth import get_current_user_id
from app.services.sync_service import SyncService

router = APIRouter()


class FullSyncRequest(BaseModel):
    babies: list[dict] = []
    media: list[dict] = []


@router.post("/full")
async def full_sync(
    data: FullSyncRequest,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    result = await SyncService(db).full_sync(user_id, {"babies": data.babies, "media": data.media})
    return {"code": 0, "data": result}


@router.get("/delta")
async def delta_sync(
    since: str,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    result = await SyncService(db).delta_sync(user_id, since)
    return {"code": 0, "data": result}


@router.get("/status")
async def sync_status(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    result = await SyncService(db).get_sync_status(user_id)
    return {"code": 0, "data": result}