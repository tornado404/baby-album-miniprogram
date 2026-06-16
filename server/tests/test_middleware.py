"""中间件 + 工具函数测试"""

from datetime import date, timedelta
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import FastAPI, HTTPException
from httpx import AsyncClient, ASGITransport
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.middleware.error_handler import (
    value_error_handler,
    http_exception_handler,
    ExceptionCatchMiddleware,
)
from app.middleware.rate_limiter import RateLimitMiddleware
from app.utils.age import calculate_baby_age
from app.utils.response import success_response, error_response, paginated_response


# ── 辅助：创建测试用 FastAPI 应用 ────────────────────


def _make_test_app() -> FastAPI:
    """创建带异常处理器和测试路由的 FastAPI 应用"""
    app = FastAPI()
    app.add_middleware(ExceptionCatchMiddleware)
    app.add_exception_handler(ValueError, value_error_handler)
    app.add_exception_handler(StarletteHTTPException, http_exception_handler)

    @app.get("/test/value-error")
    async def raise_value_error():
        raise ValueError("Invalid input data")

    @app.get("/test/http-404")
    async def raise_404():
        raise HTTPException(status_code=404, detail="Not found")

    @app.get("/test/http-dict")
    async def raise_dict_detail():
        raise HTTPException(
            status_code=401,
            detail={"code": 40101, "message": "Missing token"},
        )

    @app.get("/test/unhandled")
    async def raise_runtime_error():
        raise RuntimeError("database connection lost: password=secret")

    @app.get("/test/ok")
    async def ok_endpoint():
        return {"ok": True}

    return app


# ── 错误处理器测试 ────────────────────────────────────


class TestErrorHandler:
    """全局异常处理器测试"""

    async def test_value_error_returns_400(self):
        """ValueError → 400 + 结构化错误体"""
        test_app = _make_test_app()
        async with AsyncClient(
            transport=ASGITransport(app=test_app), base_url="http://test"
        ) as client:
            resp = await client.get("/test/value-error")
            assert resp.status_code == 400
            body = resp.json()
            assert body["code"] == 400
            assert body["message"] == "Invalid input data"

    async def test_http_exception_preserves_status(self):
        """HTTPException → 保留状态码，统一 body"""
        test_app = _make_test_app()
        async with AsyncClient(
            transport=ASGITransport(app=test_app), base_url="http://test"
        ) as client:
            resp = await client.get("/test/http-404")
            assert resp.status_code == 404
            body = resp.json()
            assert body["code"] == 404
            assert body["message"] == "Not found"

    async def test_http_exception_dict_detail(self):
        """HTTPException with dict detail → 提取 code 和 message"""
        test_app = _make_test_app()
        async with AsyncClient(
            transport=ASGITransport(app=test_app), base_url="http://test"
        ) as client:
            resp = await client.get("/test/http-dict")
            assert resp.status_code == 401
            body = resp.json()
            assert body["code"] == 40101
            assert body["message"] == "Missing token"

    async def test_unhandled_exception_returns_500(self):
        """未捕获异常 → 500 + 通用消息，不泄露内部细节"""
        test_app = _make_test_app()
        async with AsyncClient(
            transport=ASGITransport(app=test_app), base_url="http://test"
        ) as client:
            resp = await client.get("/test/unhandled")
            assert resp.status_code == 500
            body = resp.json()
            assert body["code"] == 500
            assert body["message"] == "Internal server error"
            # 确保不泄露内部错误
            assert "password" not in body["message"]
            assert "database" not in body["message"]

    async def test_normal_request_not_affected(self):
        """正常请求不受异常处理器影响"""
        test_app = _make_test_app()
        async with AsyncClient(
            transport=ASGITransport(app=test_app), base_url="http://test"
        ) as client:
            resp = await client.get("/test/ok")
            assert resp.status_code == 200
            assert resp.json() == {"ok": True}


# ── 限流中间件测试 ────────────────────────────────────


def _make_rate_limited_app() -> FastAPI:
    """创建带限流中间件的测试应用"""
    app = FastAPI()
    app.add_middleware(RateLimitMiddleware)

    @app.get("/health")
    async def health():
        return {"status": "ok"}

    @app.get("/api/test")
    async def api_test():
        return {"ok": True}

    return app


class TestRateLimiter:
    """限流中间件测试（mock Redis）"""

    async def test_health_check_bypasses_rate_limit(self):
        """/health 不受限流影响"""
        test_app = _make_rate_limited_app()
        with patch("app.middleware.rate_limiter._get_redis", return_value=None):
            async with AsyncClient(
                transport=ASGITransport(app=test_app), base_url="http://test"
            ) as client:
                resp = await client.get("/health")
                assert resp.status_code == 200

    async def test_request_allowed_when_redis_unavailable(self):
        """Redis 不可用时，请求正常通过"""
        test_app = _make_rate_limited_app()
        with patch("app.middleware.rate_limiter._get_redis", return_value=None):
            async with AsyncClient(
                transport=ASGITransport(app=test_app), base_url="http://test"
            ) as client:
                resp = await client.get("/api/test")
                assert resp.status_code == 200

    async def test_rate_limit_allows_normal_traffic(self):
        """正常请求量不被限流"""
        mock_redis = AsyncMock()
        mock_pipeline = AsyncMock()
        mock_pipeline.zremrangebyscore = MagicMock(return_value=mock_pipeline)
        mock_pipeline.zadd = MagicMock(return_value=mock_pipeline)
        mock_pipeline.zcard = MagicMock(return_value=mock_pipeline)
        mock_pipeline.expire = MagicMock(return_value=mock_pipeline)
        mock_pipeline.execute = AsyncMock(return_value=[0, 1, 5, True])  # zcard=5
        mock_redis.pipeline = MagicMock(return_value=mock_pipeline)

        test_app = _make_rate_limited_app()
        with patch("app.middleware.rate_limiter._get_redis", return_value=mock_redis):
            async with AsyncClient(
                transport=ASGITransport(app=test_app), base_url="http://test"
            ) as client:
                resp = await client.get("/api/test")
                assert resp.status_code == 200

    async def test_rate_limit_blocks_excess_requests(self):
        """超出限制 → 429"""
        mock_redis = AsyncMock()
        mock_pipeline = AsyncMock()
        mock_pipeline.zremrangebyscore = MagicMock(return_value=mock_pipeline)
        mock_pipeline.zadd = MagicMock(return_value=mock_pipeline)
        mock_pipeline.zcard = MagicMock(return_value=mock_pipeline)
        mock_pipeline.expire = MagicMock(return_value=mock_pipeline)
        # zcard=101，超过默认 100
        mock_pipeline.execute = AsyncMock(return_value=[0, 1, 101, True])
        mock_redis.pipeline = MagicMock(return_value=mock_pipeline)

        test_app = _make_rate_limited_app()
        with patch("app.middleware.rate_limiter._get_redis", return_value=mock_redis):
            async with AsyncClient(
                transport=ASGITransport(app=test_app), base_url="http://test"
            ) as client:
                resp = await client.get("/api/test")
                assert resp.status_code == 429
                body = resp.json()
                assert body["code"] == 429
                assert "Too many" in body["message"]

    async def test_rate_limit_graceful_on_redis_error(self):
        """Redis 操作异常时，请求正常通过"""
        mock_redis = AsyncMock()
        mock_redis.pipeline = MagicMock(side_effect=Exception("Connection refused"))

        test_app = _make_rate_limited_app()
        with patch("app.middleware.rate_limiter._get_redis", return_value=mock_redis):
            async with AsyncClient(
                transport=ASGITransport(app=test_app), base_url="http://test"
            ) as client:
                resp = await client.get("/api/test")
                assert resp.status_code == 200

    async def test_rate_limit_key_uses_ip_for_unauthenticated(self):
        """未认证请求使用 IP 作为限流 key"""
        mock_redis = AsyncMock()
        mock_pipeline = AsyncMock()
        mock_pipeline.zremrangebyscore = MagicMock(return_value=mock_pipeline)
        mock_pipeline.zadd = MagicMock(return_value=mock_pipeline)
        mock_pipeline.zcard = MagicMock(return_value=mock_pipeline)
        mock_pipeline.expire = MagicMock(return_value=mock_pipeline)
        mock_pipeline.execute = AsyncMock(return_value=[0, 1, 1, True])
        mock_redis.pipeline = MagicMock(return_value=mock_pipeline)

        test_app = _make_rate_limited_app()
        with patch("app.middleware.rate_limiter._get_redis", return_value=mock_redis):
            async with AsyncClient(
                transport=ASGITransport(app=test_app), base_url="http://test"
            ) as client:
                resp = await client.get("/api/test")
                assert resp.status_code == 200
                # 验证 zadd 被调用，且 key 包含 "rate_limit:ip:"
                zadd_call = mock_pipeline.zadd.call_args
                assert zadd_call is not None
                key = zadd_call[0][0]
                assert key.startswith("rate_limit:ip:")


# ── 月龄计算测试 ────────────────────────────────────


class TestCalculateBabyAge:
    """calculate_baby_age 单元测试"""

    def test_exact_years(self):
        """恰好整年"""
        result = calculate_baby_age("2024-06-15")
        assert result["years"] >= 1

    def test_zero_age_newborn(self):
        """新生儿（今天出生）"""
        today = date.today().isoformat()
        result = calculate_baby_age(today)
        assert result == {"years": 0, "months": 0, "days": 0}

    def test_one_day_old(self):
        """出生1天"""
        yesterday = (date.today() - timedelta(days=1)).isoformat()
        result = calculate_baby_age(yesterday)
        assert result["years"] == 0
        assert result["months"] == 0
        assert result["days"] == 1

    def test_six_months_old(self):
        """6 个月大（近似）"""
        birth = (date.today() - timedelta(days=180)).isoformat()
        result = calculate_baby_age(birth)
        assert result["years"] == 0
        assert result["months"] >= 5  # 大约 6 个月

    def test_future_date_returns_zeros(self):
        """未来日期 → 全零"""
        result = calculate_baby_age("2099-01-01")
        assert result == {"years": 0, "months": 0, "days": 0}

    def test_invalid_format_raises_value_error(self):
        """非法格式 → ValueError"""
        with pytest.raises(ValueError, match="Invalid date format"):
            calculate_baby_age("not-a-date")

    def test_invalid_format_wrong_separator(self):
        """错误分隔符 → ValueError"""
        with pytest.raises(ValueError, match="Invalid date format"):
            calculate_baby_age("2024/01/01")

    def test_empty_string_raises_value_error(self):
        """空字符串 → ValueError"""
        with pytest.raises(ValueError, match="Invalid date format"):
            calculate_baby_age("")

    def test_cross_year_age(self):
        """跨年年龄计算"""
        birth = (date.today() - timedelta(days=365 + 90)).isoformat()
        result = calculate_baby_age(birth)
        assert result["years"] == 1
        assert result["months"] >= 2  # 大约 3 个月

    def test_typical_baby_age(self):
        """典型宝宝年龄：1岁2个月15天"""
        birth = (date.today() - timedelta(days=365 + 60 + 15)).isoformat()
        result = calculate_baby_age(birth)
        assert result["years"] == 1
        assert result["months"] >= 1

    def test_leap_year_baby(self):
        """闰年宝宝（2月29日）"""
        result = calculate_baby_age("2024-02-29")
        assert result["years"] >= 2

    def test_age_2_years_3_months_10_days(self):
        """精确测试：2年3个月10天"""
        birth = (date.today() - timedelta(days=365 * 2 + 30 * 3 + 10)).isoformat()
        result = calculate_baby_age(birth)
        assert result["years"] == 2
        assert result["months"] >= 2


# ── 响应格式化测试 ────────────────────────────────────


class TestResponseFormatter:
    """统一响应格式化工具测试"""

    def test_success_response(self):
        """成功响应默认格式"""
        result = success_response({"id": 1, "name": "test"})
        assert result == {"code": 0, "data": {"id": 1, "name": "test"}}

    def test_success_response_none_data(self):
        """成功响应无数据"""
        result = success_response()
        assert result == {"code": 0, "data": None}

    def test_success_response_custom_code(self):
        """成功响应自定义 code"""
        result = success_response(data="ok", code=100)
        assert result == {"code": 100, "data": "ok"}

    def test_error_response(self):
        """错误响应默认格式"""
        result = error_response("Something went wrong")
        assert result == {"code": 1, "message": "Something went wrong"}

    def test_error_response_custom_code(self):
        """错误响应自定义 code"""
        result = error_response("Not found", code=404)
        assert result == {"code": 404, "message": "Not found"}

    def test_paginated_response(self):
        """分页响应"""
        data = [{"id": 1}, {"id": 2}]
        result = paginated_response(data, total=100, page=1, page_size=20)
        assert result["code"] == 0
        assert result["data"] == data
        assert result["pagination"]["page"] == 1
        assert result["pagination"]["page_size"] == 20
        assert result["pagination"]["total"] == 100

    def test_paginated_response_defaults(self):
        """分页响应默认值"""
        result = paginated_response([], total=0)
        assert result["pagination"]["page"] == 1
        assert result["pagination"]["page_size"] == 20
        assert result["pagination"]["total"] == 0

    def test_success_response_with_list(self):
        """成功响应包含列表"""
        result = success_response([1, 2, 3])
        assert result == {"code": 0, "data": [1, 2, 3]}

    def test_success_response_with_string(self):
        """成功响应包含字符串"""
        result = success_response("hello")
        assert result == {"code": 0, "data": "hello"}
