"""数据分析路由"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.middleware.auth import get_current_user_id
from app.services.achievement_service import AchievementService
from app.services.export_service import ExportService

router = APIRouter()


@router.get("/stats")
async def get_stats(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """用户全局统计"""
    from app.models.user import User
    from sqlalchemy import select

    r = await db.execute(select(User).where(User.id == user_id))
    user = r.scalar_one_or_none()
    if not user:
        return {"code": 0, "data": {}}

    return {
        "code": 0,
        "data": {
            "photoCount": user.total_photos,
            "videoCount": user.total_videos,
            "modelCount": user.total_3d_models,
            "recordDays": user.record_days,
        },
    }


@router.get("/achievements")
async def get_achievements(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """获取全部成就（含已获得/未获得）"""
    badges = await AchievementService(db).get_all_badges(user_id)
    return {"code": 0, "data": {"badges": badges}}


@router.post("/achievements/check")
async def check_achievements(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """主动触发成就检测（上传/分享等操作后调用）"""
    svc = AchievementService(db)
    new_badges = await svc.check_and_award(user_id, {})
    await db.commit()
    return {"code": 0, "data": {"newBadges": new_badges}}


@router.get("/report")
async def get_report(
    baby_id: str = Query(None),
    start: str = Query(None),
    end: str = Query(None),
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """成长报告"""
    svc = ExportService(db)
    report = await svc.get_report(user_id, baby_id, start, end)
    return {"code": 0, "data": report}