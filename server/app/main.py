"""宝宝成长相册 API — FastAPI 应用入口"""
import os
import subprocess
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.exceptions import HTTPException as StarletteHTTPException
from app.config import settings
from app.middleware.error_handler import (
    value_error_handler,
    http_exception_handler,
    ExceptionCatchMiddleware,
)
from app.middleware.rate_limiter import RateLimitMiddleware

# 读取部署时的 commit hash
COMMIT_HASH = "unknown"
_version_file = os.path.join(os.path.dirname(__file__), "VERSION")
if os.path.isfile(_version_file):
    try:
        v = open(_version_file).read().strip()
        if v:
            COMMIT_HASH = v
    except Exception:
        pass
else:
    try:
        COMMIT_HASH = subprocess.run(
            ["git", "rev-parse", "HEAD"],
            capture_output=True, text=True, timeout=5,
        ).stdout.strip()
    except Exception:
        pass


@asynccontextmanager
async def lifespan(app_: FastAPI):
    yield


app = FastAPI(
    title=settings.APP_NAME,
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

app.add_middleware(RateLimitMiddleware)
app.add_middleware(ExceptionCatchMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 注册全局异常处理器（ValueError / HTTPException）
# 未捕获的 Exception 由 ExceptionCatchMiddleware 中间件兜底
app.add_exception_handler(ValueError, value_error_handler)
app.add_exception_handler(StarletteHTTPException, http_exception_handler)


@app.get("/health")
async def health_check():
    return {"status": "ok", "app": settings.APP_NAME, "commit": COMMIT_HASH}


from app.routers import auth as auth_router
from app.routers import baby as baby_router
from app.routers import media as media_router
from app.routers import upload as upload_router
from app.routers import sync as sync_router
from app.routers import share as share_router
from app.routers import analytics as analytics_router
from app.routers import export as export_router

app.include_router(auth_router.router, prefix="/api/v1/auth", tags=["认证"])
app.include_router(baby_router.router, prefix="/api/v1/babies", tags=["宝宝"])
app.include_router(media_router.router, prefix="/api/v1/media", tags=["媒体"])
app.include_router(upload_router.router, prefix="/api/v1/upload", tags=["上传"])
app.include_router(sync_router.router, prefix="/api/v1/sync", tags=["同步"])
app.include_router(share_router.router, prefix="/api/v1/share", tags=["共享"])
app.include_router(analytics_router.router, prefix="/api/v1/analytics", tags=["分析"])
app.include_router(export_router.router, prefix="/api/v1/export", tags=["导出"])