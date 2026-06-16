"""上传路由 — 对接 MinIO 预签名 URL + 上传回调"""
import logging
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.middleware.auth import get_current_user_id
from app.services.file_service import get_upload_url

logger = logging.getLogger(__name__)

router = APIRouter()


class UploadSignRequest(BaseModel):
    fileName: str
    fileType: str
    babyId: str


class UploadSignResponse(BaseModel):
    uploadUrl: str = ""
    cosKey: str = ""
    method: str = "PUT"


class UploadCallbackRequest(BaseModel):
    mediaId: str


class UploadCallbackResponse(BaseModel):
    taskId: str = ""
    message: str = ""


@router.post("/sign", response_model=UploadSignResponse)
async def upload_sign(
    req: UploadSignRequest,
    user_id: str = Depends(get_current_user_id),
):
    """获取 MinIO 预签名上传 URL（15 分钟有效）"""
    result = get_upload_url(user_id, req.fileName, req.fileType)
    return UploadSignResponse(**result)


@router.post("/callback", response_model=UploadCallbackResponse)
async def upload_callback(
    req: UploadCallbackRequest,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """上传完成回调 — 触发异步缩略图生成

    客户端上传文件到 MinIO 后调用此接口，
    后端异步生成缩略图并更新 Media 记录。
    """
    from app.models.media import Media

    # 查找 Media 记录，确认存在且属于当前用户
    r = await db.execute(
        select(Media).where(
            Media.id == req.mediaId,
            Media.user_id == user_id,
            Media.is_deleted == False,
        )
    )
    media = r.scalar_one_or_none()
    if not media:
        raise HTTPException(status_code=404, detail={"code": 40401, "message": "Media not found"})

    if not media.cos_key:
        raise HTTPException(
            status_code=400,
            detail={"code": 40002, "message": "Media has no file key"},
        )

    # 触发 Celery 异步任务
    from app.tasks.thumbnail import generate_thumbnail

    task = generate_thumbnail.delay(str(media.id), media.cos_key, str(media.user_id))

    logger.info(
        "Thumbnail task dispatched: media_id=%s task_id=%s",
        media.id,
        task.id,
    )

    return UploadCallbackResponse(
        taskId=task.id,
        message="Thumbnail generation started",
    )