"""pytest fixtures — 测试数据库 + 异步客户端

使用 SQLite 内存数据库进行测试。
Media.tags 在 PG 中使用 ARRAY(String)，测试时替换为 JSON 以兼容 SQLite。
"""

import sqlite3
from typing import AsyncGenerator

import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy import event
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.pool import NullPool

# ── SQLite ARRAY 兼容 ──────────────────────────────────
# Media.tags 在 PG 中为 ARRAY(String)，SQLite 不原生支持。
# 将 Media.tags 替换为 JSON 类型（SQLAlchemy JSON 自动序列化 list ↔ TEXT）。
from sqlalchemy import JSON as SA_JSON, Integer as SA_Integer
from app.models.media import Media

# Media.tags 在 PG 中为 ARRAY(String)，SQLite 不原生支持 list 参数绑定。
# 在创建表前替换列类型为 JSON，让 SA 自动处理 list ↔ TEXT 序列化。
Media.__table__.columns["tags"].type = SA_JSON()

# ── SQLite BigInteger 自增兼容 ───────────────────────────
# SyncLog.id 在 PG 中为 BigInteger autoincrement，但 SQLite 要求
# 自增主键必须是 INTEGER 类型。替换为 Integer 以兼容 SQLite 测试。
from app.models.sync_log import SyncLog
SyncLog.__table__.columns["id"].type = SA_Integer()

from app.database import Base, get_db
from app.main import app

# ── 测试数据库 ─────────────────────────────────────────
TEST_DATABASE_URL = "sqlite+aiosqlite:///./test.db"


@pytest_asyncio.fixture(scope="function")
async def db_session() -> AsyncGenerator[AsyncSession, None]:
    """创建测试数据库会话（每个测试函数独立，自动建表/拆表）"""
    engine = create_async_engine(
        TEST_DATABASE_URL,
        poolclass=NullPool,
        echo=False,
    )

    # SQLite PRAGMA 优化
    @event.listens_for(engine.sync_engine, "connect")
    def _set_sqlite_pragma(dbapi_connection, connection_record):
        if isinstance(dbapi_connection, sqlite3.Connection):
            cursor = dbapi_connection.cursor()
            cursor.execute("PRAGMA journal_mode=WAL")
            cursor.execute("PRAGMA foreign_keys=ON")
            cursor.close()

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    session = async_sessionmaker(engine, expire_on_commit=False)()

    try:
        yield session
    finally:
        await session.close()
        await engine.dispose()


@pytest_asyncio.fixture(scope="function")
async def client(db_session: AsyncSession) -> AsyncGenerator[AsyncClient, None]:
    """FastAPI 测试客户端（注入测试数据库会话）"""
    async def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac

    app.dependency_overrides.clear()


# ── 认证/宝宝辅助 fixtures ────────────────────────────

@pytest_asyncio.fixture(scope="function")
async def auth_token(client: AsyncClient) -> str:
    """登录并返回 JWT access token"""
    response = await client.post(
        "/api/v1/auth/login",
        json={"code": "test_code"}
    )
    assert response.status_code == 200
    data = response.json()
    return data["accessToken"]


@pytest_asyncio.fixture(scope="function")
async def auth_headers(auth_token: str) -> dict:
    """Bearer 认证请求头"""
    return {"Authorization": f"Bearer {auth_token}"}


@pytest_asyncio.fixture(scope="function")
async def test_baby_id(client: AsyncClient, auth_headers: dict) -> str:
    """创建测试宝宝并返回 ID"""
    response = await client.post(
        "/api/v1/babies/",
        json={"name": "测试宝宝", "gender": "female", "birthDate": "2026-01-01"},
        headers=auth_headers,
    )
    assert response.status_code == 200
    return response.json()["id"]