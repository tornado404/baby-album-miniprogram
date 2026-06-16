"""存储统计路由"""
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, case
from app.database import get_db
from app.middleware.auth import get_current_user_id
from app.models.media import Media, MediaType

router = APIRouter()


@router.get("/stats")
async def get_storage_stats(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """用户存储用量统计：照片/视频数量 + 存储大小估算"""
    # 总照片数
    photo_count_q = await db.execute(
        select(func.count(Media.id)).where(
            Media.user_id == user_id,
            Media.type == MediaType.image,
            Media.is_deleted == False,
        )
    )
    photo_count = photo_count_q.scalar() or 0

    # 总视频数
    video_count_q = await db.execute(
        select(func.count(Media.id)).where(
            Media.user_id == user_id,
            Media.type == MediaType.video,
            Media.is_deleted == False,
        )
    )
    video_count = video_count_q.scalar() or 0

    # 存储大小总计（file_size 字段累加）
    total_size_q = await db.execute(
        select(func.coalesce(func.sum(Media.file_size), 0)).where(
            Media.user_id == user_id,
            Media.is_deleted == False,
        )
    )
    total_size = total_size_q.scalar() or 0

    # 3D 模型数
    model_count_q = await db.execute(
        select(func.count(Media.id)).where(
            Media.user_id == user_id,
            Media.type == MediaType.threedmodel,
            Media.is_deleted == False,
        )
    )
    model_count = model_count_q.scalar() or 0

    return {
        "code": 0,
        "data": {
            "photoCount": photo_count,
            "videoCount": video_count,
            "modelCount": model_count,
            "totalMedia": photo_count + video_count + model_count,
            "totalSizeBytes": total_size,
            "totalSizeMB": round(total_size / (1024 * 1024), 2) if total_size else 0,
        },
    }
