"""数据分析路由"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.database import get_db
from app.middleware.auth import get_current_user_id
from app.services.achievement_service import AchievementService
from app.services.export_service import ExportService
from app.models.media import Media

router = APIRouter()


async def _count_media(db: AsyncSession, user_id: str, baby_id: str, media_type: str) -> int:
    """统计某个宝宝的指定类型媒体数量"""
    r = await db.execute(
        select(func.count(Media.id)).where(
            Media.user_id == user_id,
            Media.baby_id == baby_id,
            Media.type == media_type,
            Media.is_deleted == False,
        )
    )
    return r.scalar() or 0


async def _count_record_days(db: AsyncSession, user_id: str, baby_id: str) -> int:
    """统计某个宝宝有记录的天数"""
    r = await db.execute(
        select(func.count(func.distinct(Media.capture_date))).where(
            Media.user_id == user_id,
            Media.baby_id == baby_id,
            Media.is_deleted == False,
        )
    )
    return r.scalar() or 0


@router.get("/stats")
async def get_stats(
    baby_id: str = Query(None),
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """用户统计 — 支持按宝宝筛选"""
    if baby_id:
        # 按宝宝统计
        photo_count = await _count_media(db, user_id, baby_id, "image")
        video_count = await _count_media(db, user_id, baby_id, "video")
        model_count = await _count_media(db, user_id, baby_id, "threedmodel")
        record_days = await _count_record_days(db, user_id, baby_id)
    else:
        # 用户全局统计（向后兼容）
        from app.models.user import User
        r = await db.execute(select(User).where(User.id == user_id))
        user = r.scalar_one_or_none()
        if not user:
            return {"code": 0, "data": {}}
        photo_count = user.total_photos
        video_count = user.total_videos
        model_count = user.total_3d_models
        record_days = user.record_days

    return {
        "code": 0,
        "data": {
            "photoCount": photo_count,
            "videoCount": video_count,
            "modelCount": model_count,
            "recordDays": record_days,
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


@router.get("/growth-compare")
async def get_growth_compare(
    baby_id: str = Query(...),
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """获取宝宝里程碑对比数据"""
    from app.models.media import Media
    from app.services.baby_service import BabyService
    from sqlalchemy import func, select

    # 1. 验证宝宝归属
    baby = await BabyService(db).get_baby(baby_id, user_id)
    if not baby:
        raise HTTPException(404, "Baby not found")

    # 2. 按里程碑分组查询
    rows = await db.execute(
        select(
            Media.milestone,
            func.count(Media.id).label("cnt"),
            func.min(Media.capture_date).label("first_date"),
            func.max(Media.capture_date).label("last_date"),
        ).where(
            Media.baby_id == baby_id,
            Media.is_deleted == False,
            Media.milestone.isnot(None),
            Media.milestone != "",
        ).group_by(Media.milestone)
        .order_by(func.min(Media.capture_date).asc())
    )
    group_rows = rows.all()

    milestones = []
    for row in group_rows:
        # 取该里程碑最新照片作封面
        cover = await db.execute(
            select(Media).where(
                Media.baby_id == baby_id,
                Media.milestone == row.milestone,
                Media.is_deleted == False,
            ).order_by(Media.capture_date.desc()).limit(1)
        )
        cover_media = cover.scalar_one_or_none()

        milestones.append({
            "key": row.milestone,
            "name": row.milestone,
            "coverUrl": cover_media.cos_url if cover_media else None,
            "thumbnailUrl": cover_media.thumbnail_url if cover_media else None,
            "photoCount": row.cnt,
            "firstDate": row.first_date,
            "lastDate": row.last_date,
        })

    # 3. 查询最新照片
    latest = await db.execute(
        select(Media).where(
            Media.baby_id == baby_id,
            Media.is_deleted == False,
        ).order_by(Media.capture_date.desc()).limit(1)
    )
    latest_media = latest.scalar_one_or_none()

    latest_photo = None
    if latest_media:
        baby_age = None
        if latest_media.baby_age_yrs is not None:
            baby_age = {
                "years": latest_media.baby_age_yrs,
                "months": latest_media.baby_age_mos,
                "days": latest_media.baby_age_days,
            }
        latest_photo = {
            "id": latest_media.id,
            "url": latest_media.cos_url,
            "thumbnailUrl": latest_media.thumbnail_url,
            "captureDate": latest_media.capture_date,
            "babyAge": baby_age,
        }

    return {"code": 0, "data": {"milestones": milestones, "latestPhoto": latest_photo}}