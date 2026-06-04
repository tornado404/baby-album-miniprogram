"""上传路由（Mock STS）"""
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from app.middleware.auth import get_current_user_id
import uuid

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
    ext = req.fileName.split(".")[-1] if "." in req.fileName else "jpg"
    cos_key = f"{user_id}/photos/{uuid.uuid4().hex}.{ext}"
    return UploadSignResponse(
        uploadUrl=f"https://mock-cos.example.com/{cos_key}",
        cosKey=cos_key,
    )