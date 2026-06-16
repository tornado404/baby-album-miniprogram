"""Redis 滑动窗口限流中间件"""

import logging
import time
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import JSONResponse, Response

from app.config import settings

logger = logging.getLogger(__name__)

# 模块级 Redis 连接，懒初始化
_redis = None


def _get_redis():
    """懒加载 Redis 连接，失败返回 None"""
    global _redis
    if _redis is not None:
        return _redis
    try:
        import redis.asyncio as aioredis

        _redis = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
        return _redis
    except Exception:
        logger.warning("Redis unavailable, rate limiting disabled")
        return None


async def _reset_redis():
    """重置 Redis 连接（测试用）"""
    global _redis
    if _redis is not None:
        try:
            await _redis.close()
        except Exception:
            pass
        _redis = None


class RateLimitMiddleware(BaseHTTPMiddleware):
    """基于 Redis 滑动窗口的限流中间件

    - 已认证请求：按 user_id 限流
    - 未认证请求：按 IP 限流
    - Redis 不可用时静默跳过，不阻断请求
    """

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        # 健康检查不限流
        if request.url.path == "/health":
            return await call_next(request)

        # 尝试获取限流 key
        key = self._get_rate_limit_key(request)

        # 检查限流
        allowed = await self._check_rate_limit(key)
        if allowed is False:
            return JSONResponse(
                status_code=429,
                content={"code": 429, "message": "Too many requests"},
            )

        return await call_next(request)

    def _get_rate_limit_key(self, request: Request) -> str:
        """从 JWT 或 IP 获取限流 key"""
        # 尝试从 Authorization header 解析 user_id（不抛异常）
        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            try:
                from app.services.auth_service import AuthService

                payload = AuthService.verify_access_token(auth[7:])
                if payload and "sub" in payload:
                    return f"rate_limit:user:{payload['sub']}"
            except Exception:
                pass

        # 回退到 IP
        client_ip = request.client.host if request.client else "unknown"
        return f"rate_limit:ip:{client_ip}"

    async def _check_rate_limit(self, key: str) -> bool | None:
        """滑动窗口限流检查

        Returns:
            True  — 未超限
            False — 已超限
            None  — Redis 不可用，跳过限流
        """
        redis = _get_redis()
        if redis is None:
            return None

        try:
            now = time.time()
            window_start = now - 60  # 1 分钟窗口

            pipe = redis.pipeline()
            # 移除窗口外的记录
            pipe.zremrangebyscore(key, 0, window_start)
            # 添加当前请求
            pipe.zadd(key, {str(now): now})
            # 统计窗口内请求数
            pipe.zcard(key)
            # 设置 key 过期时间（防止僵尸 key）
            pipe.expire(key, 120)
            results = await pipe.execute()

            request_count = results[2]
            if request_count > settings.RATE_LIMIT_PER_MINUTE:
                return False
            return True
        except Exception:
            logger.warning("Rate limit check failed, allowing request")
            return None
