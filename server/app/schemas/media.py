"""媒体相关 Pydantic 模型"""
from pydantic import BaseModel
from typing import Optional

class MediaCreate(BaseModel):
    babyId: str
    title: str = ""
    type: str = "image"
    cosKey: str
    captureDate: str
    locationName: Optional[str] = None
    tags: Optional[list[str]] = None
    moment: Optional[str] = None
    milestone: Optional[str] = None

class MediaUpdate(BaseModel):
    title: Optional[str] = None
    locationName: Optional[str] = None
    tags: Optional[list[str]] = None
    moment: Optional[str] = None
    milestone: Optional[str] = None
    isArchived: Optional[bool] = None

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
    locationName: Optional[str] = None
    tags: Optional[list[str]] = None
    moment: Optional[str] = None
    milestone: Optional[str] = None
    isArchived: bool = False