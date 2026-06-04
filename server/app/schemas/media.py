"""媒体相关 Pydantic 模型"""
from pydantic import BaseModel
from typing import Optional

class MediaCreate(BaseModel):
    babyId: str
    title: str = ""
    type: str = "image"
    cosKey: str
    captureDate: str

class MediaResponse(BaseModel):
    id: str
    type: str
    title: str
    thumbnailUrl: Optional[str] = None
    cosUrl: Optional[str] = None
    captureDate: str
    fileSize: int = 0
    width: Optional[int] = None
    height: Optional[int] = None