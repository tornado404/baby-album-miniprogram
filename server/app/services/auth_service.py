"""认证服务"""
import jwt, time, uuid
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.user import User
from app.config import settings

class AuthService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def login(self, code: str) -> dict:
        open_id = f"mock_openid_{uuid.uuid4().hex[:12]}"
        result = await self.db.execute(select(User).where(User.open_id == open_id))
        user = result.scalar_one_or_none()
        is_new = False
        if not user:
            user = User(id=str(uuid.uuid4()), open_id=open_id, nick_name="微信用户")
            self.db.add(user)
            await self.db.commit()
            is_new = True
        at = self._sign(user.id, 7200)
        rt = self._sign(user.id, 30 * 86400)
        return {"userId": user.id, "accessToken": at, "refreshToken": rt, "expiresIn": 7200, "isNewUser": is_new}

    async def refresh(self, refresh_token: str) -> dict:
        p = self.verify_access_token(refresh_token)
        if not p: raise ValueError("Invalid token")
        return {"userId": p["sub"], "accessToken": self._sign(p["sub"], 7200), "refreshToken": refresh_token, "expiresIn": 7200, "isNewUser": False}

    async def get_profile(self, user_id: str) -> dict:
        r = await self.db.execute(select(User).where(User.id == user_id))
        u = r.scalar_one_or_none()
        if not u: raise ValueError("Not found")
        return {"userId": u.id, "nickName": u.nick_name, "avatarUrl": u.avatar_url or "", "recordDays": u.record_days, "totalPhotos": u.total_photos, "totalVideos": u.total_videos}

    def _sign(self, uid: str, exp: int) -> str:
        return jwt.encode({"sub": uid, "iat": int(time.time()), "exp": int(time.time()) + exp}, settings.JWT_SECRET, algorithm="HS256")

    @staticmethod
    def verify_access_token(token: str) -> dict | None:
        try: return jwt.decode(token, settings.JWT_SECRET, algorithms=["HS256"])
        except: return None