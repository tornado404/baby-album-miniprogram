# 宝宝成长相册 - 后端设计文档总览

> 版本：v2.0 | 最后更新：2026-06-04 | 状态：📝 设计阶段
> 技术方案：自建服务器（Node.js + PostgreSQL + MinIO）

---

## 1. 概述

### 1.1 文档目的

定义「宝宝成长相册」微信小程序后端架构。当前前端 MVP v1.0 基于本地存储运行，
**后端为 v1.1+ 的云端化、社交化提供基础支撑**。

### 1.2 文档结构

```
docs/backend/
├── README.md                        # 本文件 — 后端总览
├── architecture.md                  # 架构深度设计（数据库/部署/工程结构）
├── feature/                         # Feature 级别设计
│   ├── F01-user-auth.md             # 用户认证与账户系统
│   ├── F02-cloud-storage.md         # 云存储与媒体管理
│   ├── F03-data-sync.md             # 数据同步服务
│   ├── F04-family-sharing.md        # 家人共享系统
│   └── F05-analytics-export.md      # 数据分析与导出
└── story/                           # Story 级别拆解
    ├── S01-auth-stories.md
    ├── S02-upload-stories.md
    ├── S03-sync-stories.md
    ├── S04-sharing-stories.md
    └── S05-analytics-stories.md
```

### 1.3 术语

| 层级 | 说明 | 对应文档 |
|------|------|----------|
| Feature | 一组后端能力的集合，对应完整业务域 | `feature/F0X-*.md` |
| Story | Feature 下的可交付单元，含用户故事(US) + 技术故事(TS) | `story/S0X-*.md` |

---

## 2. 技术选型

| 维度 | 选型 | 版本 | 理由 |
|------|------|------|------|
| **API 框架** | Node.js + Express | 4.x | 与前端 TypeScript 栈一致，降低上下文切换 |
| **语言** | TypeScript | 5.x | 类型安全，编译到 ES2020 |
| **数据库** | PostgreSQL | 15+ | 强事务支持，数组/jsonb 类型适配 tags 字段 |
| **ORM** | Prisma | 5.x | 类型安全的 TS ORM，自动 migration |
| **缓存** | Redis | 7.x | Token 黑名单、热点缓存、任务状态 |
| **对象存储** | 腾讯云 COS / 阿里云 OSS | — | 成熟稳定，自带 CDN，STS 临时密钥支持前端直传 |
| **鉴权** | JWT (HS256) | — | 无状态，适合小程序场景 |
| **部署** | Docker Compose | — | 开发/测试/生产环境一致 |
| **反向代理** | Nginx | — | TLS 终止 + 静态资源 |

### 2.1 不选微信云开发的原因

- 已有自建服务器资源，无需额外付费
- 云函数 60s 执行限制不适用于大文件处理（视频转码等）
- 自建方案数据库灵活性更高（复杂查询、事务支持）
- 便于后续扩展为多端共用后端（H5 / App）

---

## 3. Feature 清单

| ID | Feature | 描述 | 优先级 | 依赖 | 版本 |
|----|---------|------|--------|------|------|
| F01 | 用户认证与账户 | 微信登录、JWT 鉴权、用户管理 | **P0** | — | v1.1 |
| F02 | 云存储与媒体管理 | 文件上传(COS/OSS直传)、缩略图生成 | **P0** | F01 | v1.1 |
| F03 | 数据同步服务 | 首次全量同步 + 增量同步 + 本地缓存 | **P0** | F01,F02 | v1.1 |
| F04 | 家人共享系统 | 邀请、权限控制、共享相册 | P1 | F01,F03 | v2.0 |
| F05 | 数据分析与导出 | 成就徽章、成长报告、数据导出 | P1 | F03 | v2.0 |

### 3.1 迭代对照

| 版本 | 后端范围 | 前端对应 |
|------|----------|----------|
| **v1.1** | F01 + F02 + F03（核心链路云端化） | FEAT-01 云存储, FEAT-02 真实数据 |
| **v1.2** | F01-F03 优化（多设备/离线/性能） | 多宝宝管理完善 |
| **v2.0** | F04 + F05（社交化 + 数据价值） | 家人共享、AI 年龄标注 |

---

## 4. 架构总览

### 4.1 系统分层

```
┌───────────────────────────────────────────────┐
│           微信小程序端 (MiniProgram)            │
│     wx.request / wx.uploadFile / wx.login      │
└──────────────────────┬────────────────────────┘
                       │ HTTPS
┌──────────────────────▼────────────────────────┐
│              Nginx (反向代理 + TLS)             │
│        api.baby-album.example.com              │
└──────────────────────┬────────────────────────┘
                       │
┌──────────────────────▼────────────────────────┐
│            API 服务 (Node.js + Express)         │
│                                                │
│  ┌──────────┐ ┌──────────┐ ┌────────────────┐ │
│  │ Auth     │ │ Media    │ │ Sync           │ │
│  │ /auth/*  │ │ /media/* │ │ /sync/*        │ │
│  ├──────────┤ ├──────────┤ ├────────────────┤ │
│  │ Baby     │ │ Upload   │ │ Analytics      │ │
│  │ /babies/*│ │ /upload/*│ │ /analytics/*   │ │
│  ├──────────┤ ├──────────┤ ├────────────────┤ │
│  │ Share    │ │ Export   │ │ Webhook        │ │
│  │ /share/* │ │ /export/*│ │ (缩略图回调)    │ │
│  └──────────┘ └──────────┘ └────────────────┘ │
│                                                │
│  全局中间件: AuthGuard │ CORS │ RateLimit │ Log │
└──────┬─────────────────────┬──────────────────-┘
       │                     │
┌──────▼────────┐   ┌───────▼──────────────────┐
│  PostgreSQL   │   │  COS/OSS (对象存储)       │
│  ├─ users     │   │  ├─ photos/{userId}/.jpg │
│  ├─ babies    │   │  ├─ videos/{userId}/.mp4 │
│  ├─ media     │   │  ├─ thumbnails/          │
│  ├─ share_*   │   │  └─ avatars/             │
│  └─ sync_log  │   └─────────────────────────-┘
│               │
│  Redis        │
│  ├─ token 黑名单│
│  ├─ 缓存      │
│  └─ 任务状态  │
└──────────────-┘
```

### 4.2 核心实体关系

```
User ──── 1:N ──── Baby ──── 1:N ──── Media
  │                    │
  │                    └─── 1:N ──── ShareRelation
  │                                    (ownerId/viewerId)
  └─── 1:N ──── Achievement
```

---

## 5. 核心设计决策

### 5.1 前端直传 COS/OSS（不经过后端中转）

```
小程序                           API 服务                      COS/OSS
  │                                │                             │
  │── 1. POST /upload/sign ──────►│                             │
  │     { fileName, fileType }    │── 生成 STS 临时密钥          │
  │◄── 返回 {credentials,         │    + 上传路径签名             │
  │       uploadUrl, cosKey }     │                             │
  │                                │                             │
  │── 2. wx.uploadFile ────────── │ ──────────────────────────► │
  │     直传 COS (带签名)         │                             │
  │◄── 返回 ETag ─────────────── │ ◄────────────────────────── │
  │                                │                             │
  │── 3. POST /media ───────────► │                             │
  │     { babyId, cosKey, title } │── INSERT INTO media         │
  │◄── 返回 media记录 ────────── │── 异步生成缩略图             │
```

**优点**：大文件不经过后端服务器，减轻压力 + 利用 COS 分片上传能力。

### 5.2 数据同步策略：云端优先

| 场景 | 策略 |
|------|------|
| **首次登录** | 读取本地数据 → `POST /sync/full` 全量上传 → 返回云端 ID 映射 |
| **日常操作** | 调用业务 API → 写入 MySQL + `sync_log` → 更新本地缓存 |
| **启动检查** | `GET /sync/delta?since=lastSyncTime` 拉取增量 |
| **冲突处理** | Last-Write-Wins，以 `updated_at` 较新者为准 |
| **离线操作** | 标记 `pendingSync=true` → 网络恢复后批量同步 |

### 5.3 对象存储目录结构

```
{bucket}/
├── avatars/
│   └── {userId}.jpg
├── photos/
│   └── {userId}/
│       └── {uuid}.jpg
├── thumbnails/
│   └── {userId}/
│       └── {uuid}_300x300.webp
├── videos/
│   └── {userId}/
│       └── {uuid}.mp4
└── 3dmodels/
    └── {userId}/
        └── {uuid}.glb
```

---

## 6. API 总览

| 模块 | 前缀 | 鉴权 | 说明 |
|------|------|------|------|
| Auth | `POST /api/v1/auth/login` | 无需 | 微信 code → JWT |
| Auth | `POST /api/v1/auth/refresh` | JWT | 刷新 accessToken |
| User | `GET /api/v1/users/me` | JWT | 获取用户信息 |
| Baby | `CRUD /api/v1/babies[/:id]` | JWT | 宝宝档案管理 |
| Media | `CRUD /api/v1/media[/:id]` | JWT | 媒体元数据 |
| Upload | `POST /api/v1/upload/sign` | JWT | 获取上传签名 |
| Upload | `POST /api/v1/upload/callback` | 内部 | 缩略图完成回调 |
| Sync | `POST /api/v1/sync/full` | JWT | 首次全量同步 |
| Sync | `GET /api/v1/sync/delta` | JWT | 增量拉取 |
| Share | `POST /api/v1/share/invitations` | JWT | 创建分享邀请 |
| Share | `POST /api/v1/share/accept` | JWT | 接受分享 |
| Analytics | `GET /api/v1/analytics/stats` | JWT | 用户统计 |
| Analytics | `GET /api/v1/analytics/achievements` | JWT | 成就列表 |
| Export | `POST /api/v1/export/data` | JWT | 发起导出任务 |

---

## 7. 非功能需求

| 维度 | 指标 | 实现方式 |
|------|------|----------|
| 性能 | API P95 < 500ms | Redis 缓存热点数据，DB 索引优化 |
| 性能 | 缩略图生成 < 3s | Sharp 流式处理 + 异步队列 |
| 安全 | JWT 2h + refreshToken 30d | 短有效期 + Redis 黑名单 |
| 安全 | openId 不暴露前端 | 服务端 code2Session，前端仅用 userId |
| 可用性 | 离线可浏览已缓存内容 | 本地 storage 作为缓存层 |
| 可用性 | 服务端 PM2/Docker 守护 | 自动重启 + 健康检查 |

---

## 8. 迁移路径

| 阶段 | 内容 | 工时 | 前置 |
|------|------|------|------|
| **基建** | Docker + PostgreSQL + MinIO + Nginx | 3d | 服务器 |
| **F01** | 用户认证（login + JWT + users 表） | 2d | 基建 |
| **F02** | 云存储（上传签名 + 媒体 CRUD + 缩略图） | 3d | F01 |
| **F03** | 数据同步（全量/增量 + 前端适配） | 2d | F01+F02 |
| **F03 前端** | Service 层重写 + 登录流程改造 | 2d | F03 |
| **F04** | 家人共享 + 权限 | 3d | F01+F03 |
| **F05** | 分析/成就/导出 | 2d | F03 |
| **合计** | | **~17d** | — |

---

*详细架构设计（DDL/Docker/工程结构）见 `architecture.md`*
*Feature 设计文档见 `feature/` 目录，Story 拆解见 `story/` 目录*