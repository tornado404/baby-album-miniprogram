"""宝宝成长相册 API — FastAPI 应用入口"""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings


@asynccontextmanager
async def lifespan(app_: FastAPI):
    """应用生命周期管理"""
    # 启动时
    from app.database import engine, Base
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    # 关闭时
    await engine.dispose()


app = FastAPI(
    title=settings.APP_NAME,
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# 全局 CORS 中间件
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://小程序域名",
        "http://localhost:*",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health_check():
    """健康检查"""
    return {"status": "ok", "app": settings.APP_NAME}


# 路由注册
from app.routers import auth as auth_router
app.include_router(auth_router.router, prefix="/api/v1/auth", tags=["认证"])