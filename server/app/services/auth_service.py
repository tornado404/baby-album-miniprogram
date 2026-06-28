"""认证服务"""
import jwt, time, uuid, httpx
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.user import User
from app.config import settings

class AuthService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def login(self, code: str) -> dict:
        open_id = await self._get_wechat_openid(code)
        if not open_id:
            raise ValueError("Invalid wx.login code")
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

    async def _get_wechat_openid(self, code: str) -> str | None:
        """调用微信 jscode2session 获取 openid

        开发/测试模式（DEBUG=True）下，如果微信接口调用失败，自动降级为 mock openid，
        方便本地开发和 ARM 局域网测试。
        """
        appid = settings.WECHAT_APP_ID
        secret = settings.WECHAT_APP_SECRET
        if not appid or not secret:
            return f"mock_openid_{uuid.uuid4().hex[:12]}"
        url = (
            "https://api.weixin.qq.com/sns/jscode2session"
            f"?appid={appid}&secret={secret}&js_code={code}&grant_type=authorization_code"
        )
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.get(url)
                data = resp.json()
                if "openid" in data:
                    return data["openid"]
                if "errcode" in data:
                    print(f"[wechat] jscode2session error: {data}")
        except Exception as e:
            print(f"[wechat] jscode2session request failed: {e}")

        # 开发/测试模式下降级为 mock openid
        if settings.DEBUG:
            print("[wechat] DEBUG mode — falling back to mock openid")
            return f"mock_openid_{uuid.uuid4().hex[:12]}"

        return None

    async def refresh(self, refresh_token: str) -> dict:
        p = self.verify_access_token(refresh_token)
        if not p: raise ValueError("Invalid token")
        return {"userId": p["sub"], "accessToken": self._sign(p["sub"], 7200), "refreshToken": refresh_token, "expiresIn": 7200, "isNewUser": False}

    async def get_profile(self, user_id: str) -> dict:
        r = await self.db.execute(select(User).where(User.id == user_id))
        u = r.scalar_one_or_none()
        if not u: raise ValueError("Not found")
        return {"userId": u.id, "nickName": u.nick_name, "avatarUrl": u.avatar_url or "", "recordDays": u.record_days, "totalPhotos": u.total_photos, "totalVideos": u.total_videos}

    async def update_profile(self, user_id: str, nick_name: str | None = None, avatar_url: str | None = None) -> dict:
        r = await self.db.execute(select(User).where(User.id == user_id))
        u = r.scalar_one_or_none()
        if not u: raise ValueError("Not found")
        if nick_name is not None:
            u.nick_name = nick_name
        if avatar_url is not None:
            u.avatar_url = avatar_url
        await self.db.commit()
        await self.db.refresh(u)
        return {"userId": u.id, "nickName": u.nick_name, "avatarUrl": u.avatar_url or "", "recordDays": u.record_days, "totalPhotos": u.total_photos, "totalVideos": u.total_videos}

    def _sign(self, uid: str, exp: int) -> str:
        return jwt.encode({"sub": uid, "iat": int(time.time()), "exp": int(time.time()) + exp}, settings.JWT_SECRET, algorithm="HS256")

    @staticmethod
    def verify_access_token(token: str) -> dict | None:
        try: return jwt.decode(token, settings.JWT_SECRET, algorithms=["HS256"])
        except: return None