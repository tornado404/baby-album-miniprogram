"""权限中间件 — 宝宝访问控制"""

from fastapi import Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth import get_current_user_id
from app.models.baby import Baby
from app.models.share import ShareRelation


PERMISSION_LEVELS = {"viewer": 0, "editor": 1, "owner": 2}


def require_baby_access(min_permission: str = "viewer"):
    """FastAPI 依赖工厂：检查用户是否有权限访问指定宝宝

    用法:
        @router.get("/babies/{baby_id}/media")
        async def handler(access=Depends(require_baby_access("viewer"))):
            ...

    Args:
        min_permission: 最低权限要求 (viewer / editor)

    Returns:
        依赖函数，解析为 {"user_id": str, "permission": str, "baby_id": str}
    """

    async def _check(
        baby_id: str,
        user_id: str = Depends(get_current_user_id),
        db: AsyncSession = Depends(get_db),
    ):
        # 1) 检查是否为宝宝所有者
        r = await db.execute(
            select(Baby).where(
                Baby.id == baby_id,
                Baby.user_id == user_id,
                Baby.is_deleted == False,
            )
        )
        baby = r.scalar_one_or_none()
        if baby:
            return {"user_id": user_id, "permission": "owner", "baby_id": baby_id}

        # 2) 检查是否有共享关系
        r = await db.execute(
            select(ShareRelation).where(
                ShareRelation.viewer_user_id == user_id,
                ShareRelation.baby_id == baby_id,
            )
        )
        relation = r.scalar_one_or_none()
        if not relation:
            raise HTTPException(
                status_code=403,
                detail={"code": 40301, "message": "No access to this baby"},
            )

        # 3) 检查权限级别是否足够
        user_level = PERMISSION_LEVELS.get(relation.permission, -1)
        required_level = PERMISSION_LEVELS.get(min_permission, 0)
        if user_level < required_level:
            raise HTTPException(
                status_code=403,
                detail={
                    "code": 40302,
                    "message": f"Insufficient permission, requires {min_permission}",
                },
            )

        return {
            "user_id": user_id,
            "permission": relation.permission,
            "baby_id": baby_id,
        }

    return _check
