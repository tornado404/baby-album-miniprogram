"""上传路由 — 对接 MinIO 预签名 URL"""
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from app.middleware.auth import get_current_user_id
from app.services.file_service import get_upload_url

router = APIRouter()


class UploadSignRequest(BaseModel):
    fileName: str
    fileType: str
    babyId: str


class UploadSignResponse(BaseModel):
    uploadUrl: str = ""
    cosKey: str = ""
    method: str = "PUT"


@router.post("/sign", response_model=UploadSignResponse)
async def upload_sign(
    req: UploadSignRequest,
    user_id: str = Depends(get_current_user_id),
):
    """获取 MinIO 预签名上传 URL（15 分钟有效）"""
    result = get_upload_url(user_id, req.fileName, req.fileType)
    return UploadSignResponse(**result)