"""JWT 鉴权中间件"""
from fastapi import Request, HTTPException, status
from app.services.auth_service import AuthService

async def get_current_user_id(request: Request) -> str:
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(status_code=401, detail={"code": 40101, "message": "Missing token"})
    payload = AuthService.verify_access_token(auth[7:])
    if payload is None:
        raise HTTPException(status_code=401, detail={"code": 40102, "message": "Token expired"})
    return payload["sub"]