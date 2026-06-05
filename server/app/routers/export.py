"""数据导出路由"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.middleware.auth import get_current_user_id
from app.services.export_service import ExportService

router = APIRouter()


@router.post("/data")
async def export_data(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """导出全部数据为 JSON（同步，小数据量适用）"""
    svc = ExportService(db)
    data = await svc.export_json(user_id)
    return {"code": 0, "data": data}


@router.get("/report")
async def report(
    baby_id: str = None,
    start: str = None,
    end: str = None,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """成长报告"""
    svc = ExportService(db)
    report = await svc.get_report(user_id, baby_id, start, end)
    return {"code": 0, "data": report}