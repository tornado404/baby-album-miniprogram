"""Error handler middleware tests"""
import pytest
from fastapi import HTTPException
from fastapi.responses import JSONResponse


class TestValueErrorHandler:
    @pytest.mark.asyncio
    async def test_returns_400(self):
        from app.middleware.error_handler import value_error_handler

        request = None
        exc = ValueError("Invalid input")
        response = await value_error_handler(request, exc)

        assert response.status_code == 400
        assert response.body is not None


class TestHttpExceptionHandler:
    @pytest.mark.asyncio
    async def test_dict_detail(self):
        from app.middleware.error_handler import http_exception_handler

        request = None
        exc = HTTPException(status_code=403, detail={"code": 40301, "message": "No access"})
        response = await http_exception_handler(request, exc)

        assert response.status_code == 403
        body = response.body.decode()

    @pytest.mark.asyncio
    async def test_str_detail(self):
        from app.middleware.error_handler import http_exception_handler

        request = None
        exc = HTTPException(status_code=404, detail="Not found")
        response = await http_exception_handler(request, exc)
        assert response.status_code == 404


class TestExceptionCatchMiddleware:
    @pytest.mark.asyncio
    async def test_dispatch_unhandled(self):
        from app.middleware.error_handler import ExceptionCatchMiddleware
        from starlette.requests import Request
        from unittest.mock import AsyncMock

        middleware = ExceptionCatchMiddleware(None)
        request = AsyncMock(spec=Request)
        request.method = "GET"
        request.url.path = "/test"

        async def failing_call_next(request):
            raise RuntimeError("Unexpected error")

        response = await middleware.dispatch(request, failing_call_next)
        assert response.status_code == 500
        body = response.body.decode()
        assert "Internal server error" in body
