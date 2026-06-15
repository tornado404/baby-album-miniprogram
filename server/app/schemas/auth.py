"""认证相关 Pydantic 模型"""
from pydantic import BaseModel
from typing import Optional


class LoginRequest(BaseModel):
    code: str


class LoginResponse(BaseModel):
    userId: str
    accessToken: str
    refreshToken: str
    expiresIn: int = 7200
    isNewUser: bool = False


class TokenRefreshRequest(BaseModel):
    refreshToken: str


class UpdateProfileRequest(BaseModel):
    nickName: Optional[str] = None
    avatarUrl: Optional[str] = None


class UserProfileResponse(BaseModel):
    userId: str
    nickName: str = ""
    avatarUrl: str = ""
    recordDays: int = 0
    totalPhotos: int = 0
    totalVideos: int = 0