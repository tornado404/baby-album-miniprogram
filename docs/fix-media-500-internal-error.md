# 修复方案：POST /api/v1/media/ 返回 500 Internal Server Error

## 问题概述

调用 `POST /api/v1/media/` 创建媒体记录时，服务端返回 500 错误。创建媒体本身成功，但随后写入同步日志时因数据库类型不匹配导致事务回滚。

## 根因分析

### 错误现象

PostgreSQL 抛出 `DatatypeMismatchError`，错误信息类似于：

```
column "id" is of type bigint but expression is of type character varying
```

### 不一致来源

**Alembic 初始迁移** (`2be51f0079a5_init.py` 第 185 行) 中 `sync_logs.id` 定义为 `BigInteger + autoincrement`：

```python
# migrations/versions/2be51f0079a5_init.py — 第 185 行
sa.Column("id", sa.BigInteger(), autoincrement=True, primary_key=True),
```

**SQLAlchemy ORM 模型** (`app/models/sync_log.py` 第 21-23 行) 中 `SyncLog.id` 定义为 `String(36)` + UUID 默认值：

```python
# app/models/sync_log.py — 第 21-23 行
id: Mapped[str] = mapped_column(
    String(36), primary_key=True, default=lambda: str(uuid.uuid4())
)
```

初始迁移脚本在创建 `sync_logs` 表时没有与 ORM 模型对齐，导致数据库列类型为 `bigint`，而应用层写入 `VARCHAR(36)` 的 UUID 字符串。

### 错误链路

```
media.py:114  →  MediaService.create_media(user_id, create_data)
media_service.py:34-37:
    m = Media(user_id=user_id, cos_url=cos_url, **data)
    self.db.add(m)
    await self.db.flush()                    # Media 记录写入成功
    await record_sync_log(...)               # SyncLog 写入 — id 为 UUID 字符串
    await self.db.commit()                   # 提交时 PostgreSQL 报类型不匹配
```

`record_sync_log` 创建 `SyncLog` 对象时未显式传入 `id`，由模型默认值生成 `str(uuid.uuid4())`，该 VARCHAR 值无法写入 `bigint` 列，触发 `DatatypeMismatchError`，整个事务回滚，Media 记录也随之丢失。

### 影响范围

- 所有写入 `sync_logs` 表的操作均受影响，包括：
  - 创建媒体 (`MediaService.create_media`)
  - 软删除媒体 (`MediaService.soft_delete`)
  - 全量同步 (`SyncService.full_sync`)
- 当前 `sync_logs` 表为空，无数据丢失风险

## 修复步骤

### 步骤 1：创建 Alembic 迁移脚本

在 `server/migrations/versions/` 下创建新迁移文件，将 `sync_logs.id` 列从 `bigint` 改为 `VARCHAR(36)`。

由于 `sync_logs` 表当前无数据，采用 DROP + 重建的方案，确保列类型、默认值、索引与 ORM 模型完全一致。

文件路径：`server/migrations/versions/a1b2c3d4e5f6_fix_sync_logs_id_type.py`

```python
"""fix sync_logs id type — 将 id 从 bigint 改为 VARCHAR(36) 以匹配 ORM 模型

Revision ID: a1b2c3d4e5f6
Revises: 2be51f0079a5
Create Date: 2026-06-16

问题：初始迁移 2be51f0079a5 将 sync_logs.id 创建为 BigInteger + autoincrement，
但 ORM 模型 (app/models/sync_log.py) 定义 id 为 String(36) + UUID 默认值。
导致写入 SyncLog 时 PostgreSQL 报 DatatypeMismatchError。

修复：删除 sync_logs 表并按 ORM 模型重建，id 列改为 VARCHAR(36) PRIMARY KEY。
sync_logs 当前为空表，无需数据迁移。
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "a1b2c3d4e5f6"
down_revision: Union[str, Sequence[str], None] = "2be51f0079a5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """删除旧 sync_logs 表并按 ORM 模型重建"""

    # 1. 删除依赖 sync_logs 的索引和表
    op.drop_index("idx_sync_user_time", table_name="sync_logs")
    op.drop_index("ix_sync_logs_user_id", table_name="sync_logs")
    op.drop_table("sync_logs")

    # 2. 按 ORM 模型重建 sync_logs 表
    op.create_table(
        "sync_logs",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "user_id",
            sa.String(36),
            sa.ForeignKey("users.id"),
            nullable=False,
            index=True,
        ),
        sa.Column("entity_type", sa.String(20), nullable=False),
        sa.Column("entity_id", sa.String(36), nullable=False),
        sa.Column("action", sa.String(10), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_sync_logs_user_id", "sync_logs", ["user_id"])
    op.create_index("idx_sync_user_time", "sync_logs", ["user_id", "created_at"])


def downgrade() -> None:
    """回滚：将 sync_logs 表恢复为 BigInteger id"""

    op.drop_index("idx_sync_user_time", table_name="sync_logs")
    op.drop_index("ix_sync_logs_user_id", table_name="sync_logs")
    op.drop_table("sync_logs")

    op.create_table(
        "sync_logs",
        sa.Column("id", sa.BigInteger(), autoincrement=True, primary_key=True),
        sa.Column(
            "user_id",
            sa.String(36),
            sa.ForeignKey("users.id"),
            nullable=False,
            index=True,
        ),
        sa.Column("entity_type", sa.String(20), nullable=False),
        sa.Column("entity_id", sa.String(36), nullable=False),
        sa.Column("action", sa.String(10), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_sync_logs_user_id", "sync_logs", ["user_id"])
    op.create_index("idx_sync_user_time", "sync_logs", ["user_id", "created_at"])
```

### 步骤 2：提交代码并同步到 ARM 测试服务器

```bash
# 1. 在本地提交迁移脚本
cd /tmp/fix-media-500
git add server/migrations/versions/a1b2c3d4e5f6_fix_sync_logs_id_type.py
git commit -m "fix(sync_logs): 修复 id 列类型不匹配，bigint → VARCHAR(36)"
git push origin master

# 2. 同步代码到 ARM 服务器
ssh linaro@192.168.50.126 "cd /home/linaro/baby-album && git fetch origin master:refs/remotes/origin/master && git checkout origin/master -- server/"
```

### 步骤 3：在 ARM 服务器执行 Alembic 迁移

```bash
# SSH 到 ARM 服务器，在 server 目录下执行迁移
ssh linaro@192.168.50.126 "cd /home/linaro/baby-album/server && docker exec baby-api alembic upgrade head"
```

如果 `docker exec` 方式不可用，可以进入容器交互执行：

```bash
ssh linaro@192.168.50.126
docker exec -it baby-api bash
cd /app && alembic upgrade head
```

### 步骤 4：重启 API 容器

```bash
ssh linaro@192.168.50.126 "docker restart baby-api"

# 等待启动完成（约 6 秒），查看日志确认无报错
ssh linaro@192.168.50.126 "docker logs baby-api --tail=10"
```

## 验证方法

### 1. 确认迁移已执行

```bash
# 检查 alembic_version 表中的 head 是否已更新
ssh linaro@192.168.50.126 "docker exec baby-api alembic current"
# 预期输出：a1b2c3d4e5f6 (head)
```

### 2. 确认数据库列类型

```bash
# 通过 psql 查看 sync_logs 表结构
ssh linaro@192.168.50.126 "docker exec baby-db psql -U app -d baby_album -c '\d sync_logs'"
```

预期输出中 `id` 列类型应为 `character varying(36)`，而非 `bigint`：

```
 Column      | Type                        | Nullable | Default
-------------+-----------------------------+----------+--------
 id          | character varying(36)       | not null |
 user_id     | character varying(36)       | not null |
 entity_type | character varying(20)       | not null |
 entity_id   | character varying(36)       | not null |
 action      | character varying(10)       | not null |
 created_at  | timestamp without time zone | not null |
```

### 3. 测试 POST /api/v1/media/ 接口

```bash
# 发送创建媒体请求（替换 TOKEN 和 BABY_ID 为实际值）
curl -X POST http://192.168.50.126:8000/api/v1/media/ \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "babyId": "BABY_ID",
    "title": "test photo",
    "type": "image",
    "cosKey": "test/key.jpg",
    "captureDate": "2026-06-16"
  }'
```

预期：HTTP 200，返回创建的媒体对象（非 500）。

### 4. 确认 sync_logs 写入成功

```bash
# 查询 sync_logs 表确认记录已写入
ssh linaro@192.168.50.126 "docker exec baby-db psql -U app -d baby_album -c 'SELECT id, user_id, entity_type, entity_id, action FROM sync_logs LIMIT 5;'"
```

预期：能看到刚创建媒体对应的 sync_log 记录，id 字段为 UUID 格式字符串。

## 补充说明

### 为什么用 DROP + 重建而非 ALTER COLUMN

PostgreSQL 不支持直接将 `bigint` 列 `ALTER` 为 `VARCHAR(36)` 并添加默认值。可选方案：

| 方案 | 优点 | 缺点 |
|------|------|------|
| ALTER COLUMN ... USING id::varchar | 保留数据 | 需要额外处理默认值、序列、类型转换；bigint 值转 varchar 语义不对 |
| DROP + 重建 | 干净、与模型完全一致 | 表需为空（当前满足） |

由于 `sync_logs` 当前为空表，DROP + 重建是最简单、最安全的方案。

### 同类问题排查

初始迁移中其他表的 id 列均为 `String(36)`，与模型一致。仅 `sync_logs` 存在不一致。修复后所有表定义与 ORM 模型完全对齐，无其他潜在风险。
