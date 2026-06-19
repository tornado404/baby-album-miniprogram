"""Alembic env.py — 数据库迁移环境配置

- 从 app.config.settings 读取 DATABASE_URL
- 自动将 asyncpg 驱动转换为 psycopg2（Alembic 使用同步连接）
- 导入所有 ORM 模型以支持 autogenerate
"""

import os
from logging.config import fileConfig

from sqlalchemy import engine_from_config, pool

from alembic import context

# ── 日志配置 ─────────────────────────────────────────────
config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# ── 数据库 URL ───────────────────────────────────────────
# Alembic 使用同步驱动执行迁移，但 app.database 在导入时创建 async engine，
# 所以必须确保 DATABASE_URL 在 app 模块加载时是 async 格式（+asyncpg），
# Alembic 自身使用转换后的同步 URL（+psycopg2）。


def _resolve_database_url() -> str:
    """解析数据库 URL（优先级：alembic.ini > 环境变量 > settings 默认值）"""
    url = config.get_main_option("sqlalchemy.url")
    if url:
        return url

    url = os.getenv("DATABASE_URL", "")
    if url:
        return url

    try:
        from app.config import settings

        return settings.DATABASE_URL
    except ImportError:
        return "postgresql+asyncpg://app:change_me@localhost:5432/baby_album"


_db_url = _resolve_database_url()

# 确保 app.database 导入时能正常创建 async engine：
# 如果 URL 是同步格式，还原为 async 格式供 app 模块使用
_app_url = _db_url if "+asyncpg" in _db_url else _db_url.replace("+psycopg2", "+asyncpg")
os.environ["DATABASE_URL"] = _app_url

# Alembic 使用的同步 URL
_sync_url = _db_url.replace("+asyncpg", "+psycopg2")
# ConfigParser 将 % 视为插值标记，密码中的 %XX 需转义为 %%XX
_sync_url_escaped = _sync_url.replace("%", "%%")
config.set_main_option("sqlalchemy.url", _sync_url_escaped)

# ── 模型元数据 ───────────────────────────────────────────
# 导入所有模型，使 Base.metadata 包含所有表定义
# 这样 autogenerate 才能检测模型变更
from app.database import Base  # noqa: E402
from app.models import (  # noqa: E402, F401 — 确保 ORM 模型被注册到 Base.metadata
    User,
    Baby,
    Media,
    ShareInvitation,
    ShareRelation,
    SyncLog,
    Achievement,
)

target_metadata = Base.metadata


# ── 迁移执行 ─────────────────────────────────────────────


def run_migrations_offline() -> None:
    """离线模式：只生成 SQL 不执行（适用于生成 SQL 脚本）"""
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """在线模式：连接数据库执行迁移"""
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
