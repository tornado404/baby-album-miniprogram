# F03 - 数据同步服务

> **Feature ID**: F03 | **优先级**: P0 | **版本**: v3.0 | **最后更新**: 2026-06-15
> **状态**: 📝 设计阶段
> **配套**: `docs/03-architecture/backend/README.md`（后端总览）、`docs/03-architecture/backend/story/S03-sync-stories.md`（用户故事）

---

## 1. Feature 概述

### 1.1 核心目标

实现宝宝档案和媒体元数据的云端同步，支持首次全量迁移 + 后续增量同步 + 本地缓存。

### 1.2 业务价值

- 打通本地存储 → 云端的核心数据通道
- 用户换手机后数据不丢失
- 为多设备使用提供基础

### 1.3 依赖

- F01 用户认证
- F02 云存储

---

## 2. 技术设计

### 2.1 同步架构

```
本地 Storage              API 服务                  PostgreSQL
     │                       │                        │
     │── 首次登录 ──────────►│                        │
     │   POST /sync/full     │                        │
     │   全量上传本地数据     │── INSERT babies/media  │
     │◄── 返回云端 ID 映射 ──│                        │
     │                       │                        │
     │── 日常操作 ──────────►│                        │
     │   POST/PUT/DELETE     │── 写入 + sync_log      │
     │◄── 确认 ──────────────│                        │
     │                       │                        │
     │── 启动时检查 ────────►│                        │
     │   GET /sync/delta     │                        │
     │   拉取增量更新        │── 查 sync_log (>
     │◄── 差异数据 ──────────│    lastSyncTime)       │
```

### 2.2 数据模型

**Baby 表（SQLAlchemy 2.0）**

```prisma
model Baby {
  id        String   @id @default(uuid())
  userId    String
  name      String
  gender    Gender?  @default(female)
  birthDate DateTime?
  dueDate   DateTime?
  weight    Decimal? @db.Decimal(5, 2)
  height    Decimal? @db.Decimal(5, 1)
  avatar    String?
  order     Int      @default(0)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  isDeleted Boolean  @default(false)

  user  User   @relation(fields: [userId], references: [id])
  media Media[]

  @@index([userId, order])
}
```

**SyncLog 表（SQLAlchemy 2.0）**

```prisma
model SyncLog {
  id         BigInt     @id @default(autoincrement())
  userId     String
  entityType EntityType
  entityId   String
  action     SyncAction
  createdAt  DateTime   @default(now())

  @@index([userId, createdAt(sort: Desc)])
}

enum EntityType {
  baby
  media
}

enum SyncAction {
  create
  update
  delete
}
```

### 2.3 API 端点

| 方法 | 路径 | 说明 | 鉴权 |
|------|------|------|------|
| POST | `/api/v1/sync/full` | 首次全量同步（上传本地数据） | JWT |
| GET | `/api/v1/sync/delta` | 增量拉取（?since=timestamp） | JWT |
| GET | `/api/v1/sync/status` | 获取同步状态 | JWT |
| GET | `/api/v1/babies` | 获取宝宝列表 | JWT |
| POST | `/api/v1/babies` | 创建宝宝档案 | JWT |
| PUT | `/api/v1/babies/:id` | 更新宝宝档案 | JWT |
| DELETE | `/api/v1/babies/:id` | 软删除宝宝 | JWT |

### 2.4 同步策略

| 场景 | 策略 |
|------|------|
| **首次登录** | 读取本地数据 → POST /sync/full 批量上传 → 返回云端ID映射 |
| **日常新增** | 本地创建 → POST 对应 API → 取回云端ID更新本地 |
| **日常编辑** | 本地更新 → PUT 对应 API → 以云端 updated_at 为准 |
| **启动检查** | GET /sync/delta?since=lastSyncTime → 合并到本地 |
| **冲突处理** | Last-Write-Wins（以 updated_at 较新的为准） |
| **离线操作** | 本地操作标记 pendingSync=true → 网络恢复后批量 POST |

---

## 3. 前端对接要点

### 3.1 数据层改造

当前 `services/` 目录需重构为两层：

```
services/
├── api.ts           # 新增，wx.request 封装
├── localStorage.ts  # 保留，作为缓存层
└── syncService.ts   # 新增，同步策略编排
```

### 3.2 本地 Key 与云端映射

| 当前本地 Key | 云端表 | 迁移方式 |
|--------------|--------|----------|
| `album_baby_list` | babies | 首次 POST /sync/full |
| `album_media_list` | media | 首次 POST /sync/full |
| `baby_diary_current_baby_id` | 本地保留 | 值替换为云端 id |

---

## 4. 验收标准

| ID | 验收条件 |
|----|----------|
| AC-F03-01 | 首次登录后本地数据成功迁移到 PostgreSQL |
| AC-F03-02 | 新增/编辑宝宝档案后云端实时更新 |
| AC-F03-03 | 新增媒体后云端实时记录元数据 |
| AC-F03-04 | 启动时增量同步延迟 < 2s |
| AC-F03-05 | 离线操作标记 pendingSync，联网后自动同步 |

---

*详细用户故事和技术故事拆解见 `story/S03-sync-stories.md`*
