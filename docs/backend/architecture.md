# 后端架构深度设计

> 版本：v2.0 | 最后更新：2026-06-04 | 配套：README.md（总览）
> 本文档涵盖数据库 DDL、Docker 部署、工程项目结构等基础设施设计

---

## 1. 工程项目结构

```
server/
├── package.json
├── tsconfig.json                    # 编译目标 ES2020
├── .env.example                     # 环境变量模板
├── docker-compose.yml               # PostgreSQL + MinIO + Redis + API
├── Dockerfile                       # 多阶段构建
├── nginx/
│   └── default.conf                 # TLS 反向代理配置
├── prisma/
│   ├── schema.prisma                # 数据模型（Prisma Schema）
│   └── migrations/                  # 数据库迁移历史
├── src/
│   ├── index.ts                     # 启动入口
│   ├── app.ts                       # Express 应用配置
│   ├── config/
│   │   ├── index.ts                 # 配置聚合
│   │   └── wechat.ts                # 微信小程序配置
│   ├── middleware/
│   │   ├── authGuard.ts             # JWT 鉴权
│   │   ├── validator.ts             # Zod 请求校验
│   │   ├── rateLimiter.ts           # 限流
│   │   └── errorHandler.ts          # 全局错误处理
│   ├── routes/
│   │   ├── auth.router.ts           # 认证路由
│   │   ├── baby.router.ts           # 宝宝路由
│   │   ├── media.router.ts          # 媒体路由
│   │   ├── upload.router.ts         # 上传路由
│   │   ├── sync.router.ts           # 同步路由
│   │   ├── share.router.ts          # 共享路由
│   │   ├── analytics.router.ts      # 统计路由
│   │   └── export.router.ts         # 导出路由
│   ├── controllers/                 # 控制器（请求处理）
│   │   ├── auth.controller.ts
│   │   ├── baby.controller.ts
│   │   ├── media.controller.ts
│   │   ├── upload.controller.ts
│   │   ├── sync.controller.ts
│   │   ├── share.controller.ts
│   │   └── analytics.controller.ts
│   ├── services/                    # 业务逻辑层
│   │   ├── auth.service.ts          # JWT 签发 + 微信 code2Session
│   │   ├── baby.service.ts
│   │   ├── media.service.ts
│   │   ├── file.service.ts          # COS/OSS 操作封装
│   │   ├── thumbnail.service.ts     # Sharp 缩略图生成
│   │   ├── sync.service.ts          # 同步逻辑编排
│   │   ├── achievement.service.ts   # 成就检测引擎
│   │   └── export.service.ts        # 导出任务
│   ├── utils/
│   │   ├── age.ts                   # 年龄计算
│   │   ├── date.ts                  # 日期工具
│   │   ├── response.ts             # 统一响应格式
│   │   └── cos.ts                   # COS/OSS SDK 封装
│   └── types/
│       ├── express.d.ts             # Express 类型扩展
│       └── api.types.ts             # API 请求/响应类型
├── tests/
│   ├── unit/
│   └── integration/
└── scripts/
    ├── seed.ts                      # 测试数据填充
    └── sync-full-migration.ts       # 本地→云端数据迁移工具
```

---

## 2. 数据库设计

### 2.1 Prisma Schema

```prisma
// prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

/// 用户表
model User {
  id            String    @id @default(uuid())
  openId        String    @unique
  unionId       String?
  nickName      String    @default("")
  avatarUrl     String?
  recordDays    Int       @default(0)
  totalPhotos   Int       @default(0)
  totalVideos   Int       @default(0)
  total3DModels Int       @default(0)
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  babies         Baby[]
  media          Media[]
  achievements   Achievement[]
  ownedShares    ShareRelation[]  @relation("ShareOwner")
  viewedShares   ShareRelation[]  @relation("ShareViewer")
  syncLogs       SyncLog[]
}

/// 宝宝表
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

  user            User   @relation(fields: [userId], references: [id])
  media           Media[]
  shareInvitations ShareInvitation[]
  shareRelations  ShareRelation[]

  @@index([userId, order])
  @@index([userId, createdAt(sort: Desc)])
}

enum Gender {
  male
  female
}

/// 媒体表
model Media {
  id            String   @id @default(uuid())
  userId        String
  babyId        String
  type          MediaType
  title         String   @default("")
  cosKey        String
  cosUrl        String?
  thumbnailKey  String?
  thumbnailUrl  String?
  width         Int?
  height        Int?
  fileSize      BigInt   @default(0)
  mimeType      String?
  captureDate   DateTime
  babyAgeYrs    Int?
  babyAgeMos    Int?
  babyAgeDays   Int?
  tags          String[] @default([])
  isDeleted     Boolean  @default(false)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  user User @relation(fields: [userId], references: [id])
  baby Baby @relation(fields: [babyId], references: [id])

  @@index([babyId, captureDate(sort: Desc)])
  @@index([userId])
  @@index([babyId, isDeleted])
}

enum MediaType {
  image
  video
  threedmodel  // 3D模型 (enum 不允许数字开头)
}

/// 分享邀请表
model ShareInvitation {
  id          String                  @id @default(uuid())
  fromUserId  String
  babyId      String
  token       String                  @unique
  permission  SharePermission         @default(viewer)
  status      InvitationStatus        @default(pending)
  createdAt   DateTime                @default(now())
  expiresAt   DateTime

  baby Baby @relation(fields: [babyId], references: [id])

  @@index([token])
  @@index([fromUserId])
}

enum SharePermission {
  viewer
  editor
}

enum InvitationStatus {
  pending
  accepted
  rejected
  expired
}

/// 共享关系表
model ShareRelation {
  id            String           @id @default(uuid())
  ownerUserId   String
  viewerUserId  String
  babyId        String
  permission    SharePermission  @default(viewer)
  createdAt     DateTime         @default(now())

  owner User @relation("ShareOwner", fields: [ownerUserId], references: [id])
  viewer User @relation("ShareViewer", fields: [viewerUserId], references: [id])
  baby   Baby @relation(fields: [babyId], references: [id])

  @@unique([babyId, viewerUserId])
  @@index([viewerUserId])
}

/// 成就表
model Achievement {
  id        String   @id @default(uuid())
  userId    String
  badgeKey  String
  awardedAt DateTime @default(now())

  user User @relation(fields: [userId], references: [id])

  @@unique([userId, badgeKey])
}

/// 同步日志表（用于增量同步）
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

### 2.2 ER 图（文本）

```
User (1) ─────< Baby (N) ─────< Media (N)
  │               │
  │               └────< ShareInvitation (N)
  │               └────< ShareRelation (N)
  │                              (ownerUserId/viewerUserId)
  └────< Achievement (N)
  └────< SyncLog (N)
```

### 2.3 与前端数据模型的映射

| 前端模型字段 → 后端 | 说明 |
|---------------------|------|
| Baby.id → UUID | 前端可使用客户端 UUID 或由服务端返回 |
| Baby.birthDate → DATE | 前端 string YYYY-MM-DD 互转 |
| Media.tags → TEXT[] | PostgreSQL 数组，前端传 JSON array |
| Media.captureDate → DATE | 前端 string → 后端 Date |

---

## 3. Docker 部署

### 3.1 docker-compose.yml

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
      interval: 10s
      timeout: 5s
      retries: 5
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
      NODE_ENV: production
      DATABASE_URL: postgresql://app:${DB_PASSWORD}@postgres:5432/baby_album
      REDIS_URL: redis://redis:6379
      JWT_SECRET: ${JWT_SECRET}
      JWT_REFRESH_SECRET: ${JWT_REFRESH_SECRET}
      WECHAT_APP_ID: ${WECHAT_APP_ID}
      WECHAT_APP_SECRET: ${WECHAT_APP_SECRET}
      COS_SECRET_ID: ${COS_SECRET_ID}
      COS_SECRET_KEY: ${COS_SECRET_KEY}
      COS_BUCKET: ${COS_BUCKET}
      COS_REGION: ${COS_REGION}
    ports:
      - "3000:3000"
    restart: always

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

### 3.2 环境变量模板 (.env.example)

```bash
# 应用
NODE_ENV=development
PORT=3000

# 数据库
DATABASE_URL=postgresql://app:password@localhost:5432/baby_album

# Redis
REDIS_URL=redis://localhost:6379

# JWT
JWT_SECRET=your-256-bit-secret-min-length-32-chars
JWT_REFRESH_SECRET=your-256-bit-refresh-secret

# 微信小程序
WECHAT_APP_ID=wx3db22b5d6da5d38a
WECHAT_APP_SECRET=your-app-secret

# 腾讯云 COS
COS_SECRET_ID=your-cos-secret-id
COS_SECRET_KEY=your-cos-secret-key
COS_BUCKET=baby-album-1250000000
COS_REGION=ap-guangzhou

# COS 存储桶目录前缀
COS_PHOTO_DIR=photos
COS_THUMB_DIR=thumbnails
COS_AVATAR_DIR=avatars

# 上传限制
UPLOAD_MAX_SIZE=20971520  # 20MB
UPLOAD_ALLOWED_TYPES=image/jpeg,image/png,image/webp,video/mp4

# Thumbnail
THUMBNAIL_WIDTH=300
THUMBNAIL_HEIGHT=300
THUMBNAIL_QUALITY=80

# Rate Limit
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX=100
```

### 3.3 服务器推荐配置

| 阶段 | 配置 | 预估月费 | 承载 |
|------|------|----------|------|
| MVP | 2核4G + 80GB SSD + 5M带宽 | ~100元 | < 3000 用户 |
| 增长期 | 4核8G + 200GB SSD | ~300元 | < 30000 用户 |
| 规模化 | 8核16G + 读写分离 + CDN | ~1000元 | > 30000 用户 |

---

## 4. 通用响应格式

### 4.1 成功

```json
{
  "code": 0,
  "data": { ... },
  "meta": {
    "page": 1,
    "pageSize": 20,
    "total": 100
  }
}
```

### 4.2 错误

```json
{
  "code": 40001,
  "message": "宝宝名称不能为空",
  "details": [
    { "field": "name", "message": "必填字段，1-50 字符" }
  ]
}
```

### 4.3 错误码规范

| 错误码 | HTTP | 含义 |
|--------|------|------|
| 0 | 200 | 成功 |
| 40001 | 400 | 参数校验失败 |
| 40002 | 400 | 文件类型不允许 |
| 40003 | 400 | 文件大小超限 |
| 40101 | 401 | Token 缺失 |
| 40102 | 401 | Token 过期 |
| 40103 | 401 | Token 无效/已加入黑名单 |
| 40301 | 403 | 无权限（非 owner/非共享成员） |
| 40401 | 404 | 资源不存在 |
| 40901 | 409 | 数据冲突（如重复分享） |
| 42901 | 429 | 请求频率超限 |
| 50001 | 500 | 服务器内部错误 |
| 50002 | 502 | 外部服务不可用（微信/OSS） |

---

## 5. 后端 Middleware 管线

```
请求进入
  │
  ├── 1. Rate Limiter (express-rate-limit)
  ├── 2. CORS
  ├── 3. Request Logger (morgan)
  ├── 4. JWT Auth Guard (除非路由标记 public)
  │     ├── 解析 Authorization header
  │     ├── 验证 JWT 签名 + 有效期
  │     ├── 检查 Redis 黑名单
  │     └── 注入 req.userId
  ├── 5. Zod Validator (按路由配置)
  │     ├── body schema 校验
  │     └── query/params schema 校验
  ├── 6. Controller
  ├── 7. Response Formatter
  └── 8. Error Handler (全局捕获)
```

---

## 6. 安全清单

| 检查项 | 状态 | 实现 |
|--------|------|------|
| HTTPS 强制跳转 | ✅ | Nginx 301 http→https |
| JWT 短有效期 | ✅ | 2h accessToken |
| Refresh Token 轮换 | ✅ | 每次刷新签发新 refreshToken |
| Token 黑名单 | ✅ | Redis SET with TTL |
| 请求限流 | ✅ | 100 req/min per IP |
| CORS 白名单 | ✅ | 仅允许小程序合法域名 |
| 输入校验 | ✅ | Zod schema 校验所有输入 |
| SQL 注入防护 | ✅ | Prisma 参数化查询 |
| XSS 防护 | ✅ | helmet + 输出编码 |
| 文件上传校验 | ✅ | MIME + magic bytes + 大小限制 |
| openId 不暴露 | ✅ | 前端仅使用 userId |
| COS STS 临时密钥 | ✅ | 30min 有效期 |
| 数据库备份 | ⏳ | pg_dump 定时任务 |
| 审计日志 | ⏳ | 所有写操作记录 |