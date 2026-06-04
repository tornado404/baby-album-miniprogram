-- 数据库初始化脚本（docker-entrypoint-initdb.d 自动执行）
-- PostgreSQL 15

-- 创建扩展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- 默认数据会在应用首次启动时通过 SQLAlchemy 自动创建
-- 生产环境应使用 Alembic 迁移管理