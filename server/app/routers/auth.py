"""认证路由"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.schemas.auth import LoginRequest, LoginResponse, TokenRefreshRequest, UserProfileResponse
from app.services.auth_service import AuthService
from app.middleware.auth import get_current_user_id

router = APIRouter()

@router.post("/login", response_model=LoginResponse)
async def login(req: LoginRequest, db: AsyncSession = Depends(get_db)):
    try:
        return await AuthService(db).login(code=req.code)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/refresh", response_model=LoginResponse)
async def refresh(req: TokenRefreshRequest, db: AsyncSession = Depends(get_db)):
    try:
        return await AuthService(db).refresh(refresh_token=req.refreshToken)
    except ValueError as e:
        raise HTTPException(status_code=401, detail=str(e))

@router.get("/me", response_model=UserProfileResponse)
async def get_profile(user_id: str = Depends(get_current_user_id), db: AsyncSession = Depends(get_db)):
    try:
        return await AuthService(db).get_profile(user_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))