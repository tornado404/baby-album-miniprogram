"""宝宝相关 Pydantic 模型"""
from pydantic import BaseModel
from typing import Optional


class BabyCreate(BaseModel):
    name: str
    gender: Optional[str] = None
    birthDate: Optional[str] = None
    avatar: Optional[str] = None


class BabyUpdate(BaseModel):
    name: Optional[str] = None
    gender: Optional[str] = None
    birthDate: Optional[str] = None
    dueDate: Optional[str] = None
    weight: Optional[str] = None
    height: Optional[str] = None
    avatar: Optional[str] = None


class BabyResponse(BaseModel):
    id: str
    name: str
    gender: Optional[str] = None
    birthDate: Optional[str] = None
    age: Optional[str] = None
    avatar: Optional[str] = None
    photoCount: int = 0
    videoCount: int = 0
    recordDays: int = 0