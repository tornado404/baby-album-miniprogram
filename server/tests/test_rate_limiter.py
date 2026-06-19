"""Rate limiter middleware mock-based tests"""
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from starlette.requests import Request
from starlette.responses import Response


def _reset_redis_global():
    import app.middleware.rate_limiter as m
    m._redis = None


class _FakePipeline:
    """模拟 redis pipeline — 链式调用返回 self，execute 可配置"""
    def __init__(self, execute_result=None, execute_side_effect=None):
        self.zremrangebyscore = MagicMock(return_value=self)
        self.zadd = MagicMock(return_value=self)
        self.zcard = MagicMock(return_value=self)
        self.expire = MagicMock(return_value=self)
        self.execute = AsyncMock(return_value=execute_result, side_effect=execute_side_effect)


class TestGetRedis:
    def test_already_initialized(self):
        import app.middleware.rate_limiter as m
        _reset_redis_global()
        m._redis = "fake_conn"
        from app.middleware.rate_limiter import _get_redis
        assert _get_redis() == "fake_conn"
        _reset_redis_global()

    def test_new_connection(self):
        _reset_redis_global()
        with patch("redis.asyncio.from_url", return_value="new_conn"):
            from app.middleware.rate_limiter import _get_redis
            assert _get_redis() == "new_conn"
        _reset_redis_global()

    def test_unavailable(self):
        _reset_redis_global()
        with patch("redis.asyncio.from_url", side_effect=Exception("no redis")):
            from app.middleware.rate_limiter import _get_redis
            assert _get_redis() is None
        _reset_redis_global()


class TestGetRateLimitKey:
    @pytest.fixture
    def mw(self):
        from app.middleware.rate_limiter import RateLimitMiddleware
        return RateLimitMiddleware(None)

    def test_valid_jwt(self, mw):
        req = MagicMock(spec=Request)
        req.headers.get.return_value = "Bearer valid"
        with patch("app.services.auth_service.AuthService.verify_access_token",
                   return_value={"sub": "u1"}):
            assert mw._get_rate_limit_key(req) == "rate_limit:user:u1"

    def test_no_auth(self, mw):
        req = MagicMock(spec=Request)
        req.headers.get.return_value = ""
        req.client.host = "1.2.3.4"
        assert mw._get_rate_limit_key(req) == "rate_limit:ip:1.2.3.4"

    def test_no_client(self, mw):
        req = MagicMock(spec=Request)
        req.headers.get.return_value = ""
        req.client = None
        assert mw._get_rate_limit_key(req) == "rate_limit:ip:unknown"


class TestCheckRateLimit:
    @pytest.fixture
    def mw(self):
        from app.middleware.rate_limiter import RateLimitMiddleware
        return RateLimitMiddleware(None)

    @pytest.mark.asyncio
    async def test_redis_unavailable(self, mw):
        with patch("app.middleware.rate_limiter._get_redis", return_value=None):
            assert await mw._check_rate_limit("k") is None

    @pytest.mark.asyncio
    async def test_within_limit(self, mw):
        mock_redis = AsyncMock()
        # pipeline() 是同步方法，用 MagicMock 避免 AsyncMock 返回协程
        mock_redis.pipeline = MagicMock(return_value=_FakePipeline(execute_result=[None, 1, 5, 1]))

        with patch("app.middleware.rate_limiter._get_redis", return_value=mock_redis), \
                patch("app.middleware.rate_limiter.settings.RATE_LIMIT_PER_MINUTE", 100):
            assert await mw._check_rate_limit("k") is True

    @pytest.mark.asyncio
    async def test_over_limit(self, mw):
        mock_redis = AsyncMock()
        mock_redis.pipeline = MagicMock(return_value=_FakePipeline(execute_result=[None, 1, 150, 1]))

        with patch("app.middleware.rate_limiter._get_redis", return_value=mock_redis), \
                patch("app.middleware.rate_limiter.settings.RATE_LIMIT_PER_MINUTE", 100):
            assert await mw._check_rate_limit("k") is False

    @pytest.mark.asyncio
    async def test_redis_error(self, mw):
        mock_redis = AsyncMock()
        mock_redis.pipeline = MagicMock(return_value=_FakePipeline(execute_side_effect=Exception("err")))

        with patch("app.middleware.rate_limiter._get_redis", return_value=mock_redis):
            assert await mw._check_rate_limit("k") is None


class TestDispatch:
    @pytest.mark.asyncio
    async def test_health_bypass(self):
        from app.middleware.rate_limiter import RateLimitMiddleware
        mw = RateLimitMiddleware(None)
        req = MagicMock(spec=Request)
        req.url.path = "/health"
        async def ok(req): return Response("ok")
        assert (await mw.dispatch(req, ok)).status_code == 200

    @pytest.mark.asyncio
    async def test_rate_limited_429(self):
        from app.middleware.rate_limiter import RateLimitMiddleware
        mw = RateLimitMiddleware(None)
        req = MagicMock(spec=Request)
        req.url.path = "/api/test"
        with patch.object(mw, "_get_rate_limit_key", return_value="k"), \
                patch.object(mw, "_check_rate_limit", return_value=False):
            assert (await mw.dispatch(req, None)).status_code == 429

    @pytest.mark.asyncio
    async def test_normal_passes(self):
        from app.middleware.rate_limiter import RateLimitMiddleware
        mw = RateLimitMiddleware(None)
        req = MagicMock(spec=Request)
        req.url.path = "/api/test"
        async def ok(req): return Response("ok")
        with patch.object(mw, "_get_rate_limit_key", return_value="k"), \
                patch.object(mw, "_check_rate_limit", return_value=True):
            assert (await mw.dispatch(req, ok)).status_code == 200


class TestResetRedis:
    @pytest.mark.asyncio
    async def test_reset_with_conn(self):
        import app.middleware.rate_limiter as m
        _reset_redis_global()
        conn = AsyncMock()
        m._redis = conn
        from app.middleware.rate_limiter import _reset_redis
        await _reset_redis()
        assert m._redis is None
        conn.close.assert_awaited_once()
        _reset_redis_global()

    @pytest.mark.asyncio
    async def test_reset_none(self):
        import app.middleware.rate_limiter as m
        _reset_redis_global()
        from app.middleware.rate_limiter import _reset_redis
        await _reset_redis()
        assert m._redis is None
        _reset_redis_global()
