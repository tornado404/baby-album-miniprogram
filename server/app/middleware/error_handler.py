"""全局异常处理器 — 统一错误响应格式"""

import logging
from fastapi import Request
from fastapi import HTTPException
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.responses import Response

logger = logging.getLogger(__name__)


async def value_error_handler(request: Request, exc: ValueError) -> JSONResponse:
    """ValueError → 400 业务校验错误"""
    return JSONResponse(
        status_code=400,
        content={"code": 400, "message": str(exc)},
    )


async def http_exception_handler(request: Request, exc: HTTPException) -> JSONResponse:
    """HTTPException → 保留原始状态码，统一 body 格式"""
    # 兼容 detail 为 dict（如 auth 中间件抛出的 {"code": 40101, "message": ...}）
    detail = exc.detail
    if isinstance(detail, dict):
        content = {"code": detail.get("code", exc.status_code), "message": detail.get("message", "")}
    else:
        content = {"code": exc.status_code, "message": str(detail)}
    return JSONResponse(status_code=exc.status_code, content=content)


class ExceptionCatchMiddleware(BaseHTTPMiddleware):
    """捕获未处理异常的中间件

    FastAPI 的 add_exception_handler(Exception, ...) 在测试环境/开发模式下
    会被 ServerErrorsMiddleware 提前拦截，因此用中间件兜底更可靠。
    """

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        try:
            return await call_next(request)
        except Exception as exc:
            logger.exception("Unhandled exception on %s %s", request.method, request.url.path)
            return JSONResponse(
                status_code=500,
                content={"code": 500, "message": "Internal server error"},
            )
