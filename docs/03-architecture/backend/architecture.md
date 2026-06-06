# 后端架构深度设计

> 版本：v3.0 | 最后更新：2026-06-04 | 配套：README.md（总览）
> 技术栈：**Python 3.11+ / FastAPI / SQLAlchemy 2.0 / PostgreSQL**
> 本文档涵盖工程项目结构、数据库模型、Docker 部署、安全设计

---

## 1. 工程项目结构

```
server/
├── pyproject.toml                  # 项目元数据 + 依赖（Poetry）
├── Dockerfile                      # 多阶段构建
├── docker-compose.yml              # PostgreSQL + Redis + API + Celery
├── alembic.ini                     # 数据库迁移配置
├── nginx/
│   └── default.conf                # TLS 反向代理
├── app/
│   ├── __init__.py
│   ├── main.py                     # FastAPI 应用入口 + 生命周期
│   ├── config.py                   # Pydantic Settings（环境变量）
│   ├── database.py                 # SQLAlchemy async engine + session
│   ├── dependencies.py             # FastAPI Depends 公共依赖
│   ├── models/                     # SQLAlchemy ORM 模型
│   │   ├── __init__.py
│   │   ├── user.py                 # 用户模型
│   │   ├── baby.py                 # 宝宝模型
│   │   ├── media.py                # 媒体模型
│   │   ├── share.py                # 共享模型
│   │   └── sync_log.py             # 同步日志模型
│   ├── schemas/                    # Pydantic 请求/响应模型
│   │   ├── __init__.py
│   │   ├── auth.py                 # 认证相关 schema
│   │   ├── baby.py
│   │   ├── media.py
│   │   └── ...
│   ├── routers/                    # 路由（FastAPI APIRouter）
│   │   ├── __init__.py
│   │   ├── auth.py
│   │   ├── baby.py
│   │   ├── media.py
│   │   ├── upload.py
│   │   ├── sync.py
│   │   ├── share.py
│   │   ├── analytics.py
│   │   └── export.py
│   ├── services/                   # 业务逻辑层
│   │   ├── __init__.py
│   │   ├── auth_service.py         # JWT + 微信 code2Session
│   │   ├── baby_service.py
│   │   ├── media_service.py
│   │   ├── file_service.py         # COS/OSS 操作封装
│   │   ├── thumbnail_service.py    # Pillow 缩略图生成
│   │   ├── sync_service.py
│   │   ├── achievement_service.py
│   │   └── export_service.py
│   ├── middleware/                 # ASGI 中间件
│   │   ├── __init__.py
│   │   └── auth.py                 # JWT 鉴权中间件
│   ├── utils/
│   │   ├── __init__.py
│   │   ├── age.py                  # 年龄计算
│   │   ├── response.py             # 统一响应格式
│   │   └── cos.py                  # COS SDK 封装
│   └── tasks/                      # Celery 异步任务
│       ├── __init__.py
│       ├── thumbnail.py            # 缩略图生成任务
│       └── export.py               # 导出打包任务
├── tests/
│   ├── conftest.py                 # pytest fixtures + 测试数据库
│   ├── test_auth.py
│   ├── test_baby.py
│   ├── test_media.py
│   └── ...
├── scripts/
│   ├── seed.py                     # 测试数据填充
│   └── migrate_local_to_cloud.py   # 本地→云端迁移工具
└── migrations/                     # Alembic 迁移文件
    ├── versions/
    └── env.py
```

---

## 2. 数据库设计（SQLAlchemy 2.0）

### 2.1 ORM 模型定义

```python
# app/models/user.py
import uuid
from datetime import datetime
from sqlalchemy import String, Integer, DateTime, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base

class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    open_id: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    union_id: Mapped[str | None] = mapped_column(String(64))
    nick_name: Mapped[str] = mapped_column(String(50), default="")
    avatar_url: Mapped[str | None] = mapped_column(String(500))
    record_days: Mapped[int] = mapped_column(Integer, default=0)
    total_photos: Mapped[int] = mapped_column(Integer, default=0)
    total_videos: Mapped[int] = mapped_column(Integer, default=0)
    total_3d_models: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    # 关系
    babies = relationship("Baby", back_populates="user")
    media = relationship("Media", back_populates="user")
    achievements = relationship("Achievement", back_populates="user")
```

```python
# app/models/baby.py
from sqlalchemy import String, Integer, Date, Numeric, Boolean, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

class Baby(Base):
    __tablename__ = "babies"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id"), index=True
    )
    name: Mapped[str] = mapped_column(String(50))
    gender: Mapped[str | None] = mapped_column(String(10))  # male / female
    birth_date: Mapped[date | None] = mapped_column(Date)
    due_date: Mapped[date | None] = mapped_column(Date)
    weight: Mapped[Decimal | None] = mapped_column(Numeric(5, 2))
    height: Mapped[Decimal | None] = mapped_column(Numeric(5, 1))
    avatar: Mapped[str | None] = mapped_column(String(500))
    order: Mapped[int] = mapped_column(Integer, default=0)
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    user = relationship("User", back_populates="babies")
    media = relationship("Media", back_populates="baby")
```

```python
# app/models/media.py
from sqlalchemy import (
    String, Integer, BigInteger, Date, Boolean, ForeignKey, Enum as SAEnum
)
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import Mapped, mapped_column, relationship
import enum

class MediaType(str, enum.Enum):
    image = "image"
    video = "video"
    threedmodel = "threedmodel"

class Media(Base):
    __tablename__ = "media"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id"), index=True
    )
    baby_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("babies.id"), index=True
    )
    type: Mapped[MediaType] = mapped_column(
        SAEnum(MediaType, create_constraint=True)
    )
    title: Mapped[str] = mapped_column(String(200), default="")
    cos_key: Mapped[str] = mapped_column(String(500))
    cos_url: Mapped[str | None] = mapped_column(String(1000))
    thumbnail_key: Mapped[str | None] = mapped_column(String(500))
    thumbnail_url: Mapped[str | None] = mapped_column(String(1000))
    width: Mapped[int | None] = mapped_column(Integer)
    height: Mapped[int | None] = mapped_column(Integer)
    file_size: Mapped[int | None] = mapped_column(BigInteger, default=0)
    mime_type: Mapped[str | None] = mapped_column(String(50))
    capture_date: Mapped[date] = mapped_column(Date)
    baby_age_yrs: Mapped[int | None] = mapped_column(Integer)
    baby_age_mos: Mapped[int | None] = mapped_column(Integer)
    baby_age_days: Mapped[int | None] = mapped_column(Integer)
    tags: Mapped[list[str]] = mapped_column(ARRAY(String), default=list)
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    user = relationship("User", back_populates="media")
    baby = relationship("Baby", back_populates="media")

    __table_args__ = (
        Index("idx_baby_capture", "baby_id", "capture_date", postgresql_using="btree"),
        Index("idx_baby_active", "baby_id", postgresql_where=~is_deleted),
    )
```

```python
# app/models/share.py
import enum

class SharePermission(str, enum.Enum):
    viewer = "viewer"
    editor = "editor"

class InvitationStatus(str, enum.Enum):
    pending = "pending"
    accepted = "accepted"
    rejected = "rejected"
    expired = "expired"

class ShareInvitation(Base):
    __tablename__ = "share_invitations"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    from_user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"))
    baby_id: Mapped[str] = mapped_column(String(36), ForeignKey("babies.id"))
    token: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    permission: Mapped[SharePermission] = mapped_column(SAEnum(SharePermission))
    status: Mapped[InvitationStatus] = mapped_column(SAEnum(InvitationStatus), default=InvitationStatus.pending)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    expires_at: Mapped[datetime] = mapped_column(DateTime)

class ShareRelation(Base):
    __tablename__ = "share_relations"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    owner_user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"))
    viewer_user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"))
    baby_id: Mapped[str] = mapped_column(String(36), ForeignKey("babies.id"))
    permission: Mapped[SharePermission] = mapped_column(SAEnum(SharePermission))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    __table_args__ = (UniqueConstraint("baby_id", "viewer_user_id"),)
```

```python
# app/models/sync_log.py
class SyncAction(str, enum.Enum):
    create = "create"
    update = "update"
    delete = "delete"

class SyncLog(Base):
    __tablename__ = "sync_logs"
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), index=True)
    entity_type: Mapped[str] = mapped_column(String(20))  # baby / media
    entity_id: Mapped[str] = mapped_column(String(36))
    action: Mapped[SyncAction] = mapped_column(SAEnum(SyncAction))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    __table_args__ = (Index("idx_sync_user_time", "user_id", "created_at"),)
```

```python
# app/models/achievement.py
class Achievement(Base):
    __tablename__ = "achievements"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), index=True)
    badge_key: Mapped[str] = mapped_column(String(32))
    awarded_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="achievements")
    __table_args__ = (UniqueConstraint("user_id", "badge_key"),)
```

### 2.2 与前端数据模型映射

| 前端字段 → 后端 | 类型转换 | 说明 |
|----------------|----------|------|
| Baby.id | UUID str | 前端客户端 UUID 或服务端返回 |
| Baby.birthDate | Date | 前端 string "YYYY-MM-DD" → Python date |
| Media.tags | ARRAY(String) | 前端 JSON array → PostgreSQL TEXT[] |
| Media.captureDate | Date | 前端 string → Python date |

---

## 3. FastAPI 核心配置

### 3.1 应用入口

```python
# app/main.py
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.database import engine, Base
from app.routers import auth, baby, media, upload, sync, share, analytics, export
from app.middleware.auth import JWTAuthMiddleware

@asynccontextmanager
async def lifespan(app: FastAPI):
    # 启动时：创建数据库表（生产应使用 Alembic）
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    # 关闭时：释放连接
    await engine.dispose()

app = FastAPI(
    title="宝宝成长相册 API",
    version="1.0.0",
    docs_url="/docs",        # Swagger UI
    redoc_url="/redoc",      # ReDoc
    lifespan=lifespan,
)

# 全局中间件
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://小程序域名", "http://localhost:*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 路由注册
app.include_router(auth.router, prefix="/api/v1/auth", tags=["认证"])
app.include_router(baby.router, prefix="/api/v1/babies", tags=["宝宝"])
app.include_router(media.router, prefix="/api/v1/media", tags=["媒体"])
app.include_router(upload.router, prefix="/api/v1/upload", tags=["上传"])
app.include_router(sync.router, prefix="/api/v1/sync", tags=["同步"])
app.include_router(share.router, prefix="/api/v1/share", tags=["共享"])
app.include_router(analytics.router, prefix="/api/v1/analytics", tags=["统计"])
app.include_router(export.router, prefix="/api/v1/export", tags=["导出"])
```

### 3.2 异步数据库会话

```python
# app/database.py
from sqlalchemy.ext.asyncio import (
    create_async_engine, async_sessionmaker, AsyncSession
)
from sqlalchemy.orm import DeclarativeBase
from app.config import settings

engine = create_async_engine(
    settings.DATABASE_URL,          # postgresql+asyncpg://user:pass@host:5432/db
    echo=settings.DEBUG,
    pool_size=10,
    max_overflow=20,
)

AsyncSessionLocal = async_sessionmaker(
    engine, class_=AsyncSession, expire_on_commit=False
)

class Base(DeclarativeBase):
    pass

async def get_db() -> AsyncSession:
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()
```

### 3.3 Pydantic 配置管理

```python
# app/config.py
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    # 应用
    APP_NAME: str = "宝宝成长相册 API"
    DEBUG: bool = False

    # 数据库
    DATABASE_URL: str = "postgresql+asyncpg://app:password@localhost:5432/baby_album"

    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"

    # JWT
    JWT_SECRET: str
    JWT_REFRESH_SECRET: str
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 120
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30

    # 微信小程序
    WECHAT_APP_ID: str
    WECHAT_APP_SECRET: str

    # COS/OSS
    COS_SECRET_ID: str
    COS_SECRET_KEY: str
    COS_BUCKET: str = "baby-album"
    COS_REGION: str = "ap-guangzhou"

    # 上传限制
    UPLOAD_MAX_SIZE: int = 20 * 1024 * 1024  # 20MB
    UPLOAD_ALLOWED_TYPES: list[str] = [
        "image/jpeg", "image/png", "image/webp", "video/mp4"
    ]

    # 缩略图
    THUMBNAIL_WIDTH: int = 300
    THUMBNAIL_HEIGHT: int = 300
    THUMBNAIL_QUALITY: int = 80

    # 限流
    RATE_LIMIT_PER_MINUTE: int = 100

    model_config = {"env_file": ".env", "extra": "ignore"}

settings = Settings()
```

---

## 4. API 示例（FastAPI Router）

### 4.1 认证路由

```python
# app/routers/auth.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.schemas.auth import LoginRequest, LoginResponse, TokenRefreshRequest
from app.services.auth_service import AuthService

router = APIRouter()

@router.post("/login", response_model=LoginResponse)
async def login(
    req: LoginRequest,
    db: AsyncSession = Depends(get_db),
):
    """微信登录：code → JWT"""
    service = AuthService(db)
    result = await service.login(code=req.code)
    return result

@router.post("/refresh", response_model=LoginResponse)
async def refresh_token(
    req: TokenRefreshRequest,
    db: AsyncSession = Depends(get_db),
):
    """刷新 accessToken"""
    service = AuthService(db)
    result = await service.refresh(refresh_token=req.refreshToken)
    return result
```

### 4.2 依赖注入 — JWT 鉴权

```python
# app/dependencies.py
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from app.services.auth_service import AuthService

security = HTTPBearer()

async def get_current_user_id(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> str:
    """JWT 鉴权依赖：注入当前用户 ID"""
    token = credentials.credentials
    payload = AuthService.verify_access_token(token)
    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token 无效或已过期",
        )
    return payload["sub"]  # user_id
```

---

## 5. Docker 部署

### 5.1 docker-compose.yml

```yaml
version: '3.8'
services:
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: baby_album
      POSTGRES_USER: app
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U app -d baby_album"]
    ports:
      - "5432:5432"

  redis:
    image: redis:7-alpine
    volumes:
      - redisdata:/data
    ports:
      - "6379:6379"

  api:
    build: .
    depends_on:
      postgres: { condition: service_healthy }
      redis: { condition: service_started }
    environment:
      DATABASE_URL: postgresql+asyncpg://app:${DB_PASSWORD}@postgres:5432/baby_album
      REDIS_URL: redis://redis:6379/0
      JWT_SECRET: ${JWT_SECRET}
      JWT_REFRESH_SECRET: ${JWT_REFRESH_SECRET}
      WECHAT_APP_ID: ${WECHAT_APP_ID}
      WECHAT_APP_SECRET: ${WECHAT_APP_SECRET}
      COS_SECRET_ID: ${COS_SECRET_ID}
      COS_SECRET_KEY: ${COS_SECRET_KEY}
      COS_BUCKET: ${COS_BUCKET}
      COS_REGION: ${COS_REGION}
    ports:
      - "8000:8000"
    restart: always

  celery_worker:
    build: .
    command: celery -A app.tasks worker --loglevel=info
    depends_on:
      - redis
      - api
    environment:
      DATABASE_URL: postgresql+asyncpg://app:${DB_PASSWORD}@postgres:5432/baby_album
      REDIS_URL: redis://redis:6379/0
      # ...（同 api 环境变量）

  nginx:
    image: nginx:alpine
    volumes:
      - ./nginx/default.conf:/etc/nginx/conf.d/default.conf
      - ./ssl:/etc/nginx/ssl
    ports:
      - "443:443"
      - "80:80"
    depends_on:
      - api

volumes:
  pgdata:
  redisdata:
```

### 5.2 Dockerfile

```dockerfile
FROM python:3.11-slim AS builder

WORKDIR /app
COPY pyproject.toml poetry.lock ./
RUN pip install poetry && \
    poetry config virtualenvs.create false && \
    poetry install --no-dev --no-interaction --no-ansi

FROM python:3.11-slim
WORKDIR /app
COPY --from=builder /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY . .
RUN useradd -m app && chown -R app:app /app
USER app

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### 5.3 pyproject.toml

```toml
[tool.poetry]
name = "baby-album-api"
version = "1.0.0"
description = "宝宝成长相册后端 API"

[tool.poetry.dependencies]
python = "^3.11"
fastapi = "^0.110.0"
uvicorn = {extras = ["standard"], version = "^0.29.0"}
sqlalchemy = "^2.0.30"
asyncpg = "^0.29.0"
alembic = "^1.13.0"
pydantic = "^2.7.0"
pydantic-settings = "^2.2.0"
pyjwt = "^2.8.0"
redis = "^5.0.0"
celery = "^5.4.0"
httpx = "^0.27.0"        # 微信 API 调用
pillow = "^10.3.0"       # 图片处理
python-multipart = "^0.0.9"

[tool.poetry.group.dev.dependencies]
pytest = "^8.2.0"
pytest-asyncio = "^0.23.0"
ruff = "^0.4.0"
mypy = "^1.10.0"

[build-system]
requires = ["poetry-core"]
build-backend = "poetry.core.masonry.api"
```

---

## 6. 通用响应格式

### 6.1 成功

```json
{
  "code": 0,
  "data": { ... },
  "meta": { "page": 1, "page_size": 20, "total": 100 }
}
```

### 6.2 错误（FastAPI 自动处理 HTTPException）

```python
from fastapi import HTTPException, status

# 使用方式
raise HTTPException(
    status_code=status.HTTP_400_BAD_REQUEST,
    detail={
        "code": 40001,
        "message": "宝宝名称不能为空",
        "details": [{"field": "name", "message": "必填字段"}]
    }
)
```

### 6.3 错误码规范

| 错误码 | HTTP | 含义 |
|--------|------|------|
| 0 | 200 | 成功 |
| 40001 | 400 | 参数校验失败 |
| 40002 | 400 | 文件类型不允许 |
| 40101 | 401 | Token 缺失/过期/无效 |
| 40301 | 403 | 无权限 |
| 40401 | 404 | 资源不存在 |
| 40901 | 409 | 数据冲突 |
| 42901 | 429 | 请求频率超限 |
| 50001 | 500 | 服务器内部错误 |

---

## 7. 中间件管线

```
请求进入
  │
  ├── 1. CORSMiddleware (FastAPI 内置)
  ├── 2. TrustedHostMiddleware (防止 Host 头攻击)
  ├── 3. JWTAuthMiddleware (ASGI 中间件，解析 token)
  │      └─ 注入 request.state.user_id
  ├── 4. RateLimit (Redis 计数，每 IP 100/min)
  ├── 5. Router 匹配
  │      └─ 路由级 Depends(get_current_user_id) 校验
  ├── 6. Pydantic 请求校验（自动）
  ├── 7. Service 层业务逻辑
  ├── 8. Pydantic 响应序列化（自动）
  └── 9. 全局 Exception Handler
```

---

## 8. 安全清单

| 检查项 | 状态 | 实现 |
|--------|------|------|
| HTTPS 强制跳转 | ✅ | Nginx 301 http→https |
| JWT 短有效期 | ✅ | 2h accessToken |
| Refresh Token 轮换 | ✅ | 每次刷新签发新 refreshToken |
| Token 黑名单 | ✅ | Redis SET with TTL |
| 请求限流 | ✅ | slowapi / 自定义 Redis 计数 |
| CORS 白名单 | ✅ | FastAPI CORSMiddleware |
| 输入校验 | ✅ | Pydantic 自动校验所有输入 |
| SQL 注入防护 | ✅ | SQLAlchemy 参数化查询 |
| openId 不暴露 | ✅ | 前端仅使用 user_id |
| COS STS 临时密钥 | ✅ | 30min 有效期 |
| 数据库备份 | ⏳ | pg_dump 定时任务 |