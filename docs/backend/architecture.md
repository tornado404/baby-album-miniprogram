# 后端架构设计文档

> 版本：v1.0 | 最后更新：2026-06-04
> 状态：待评审 | 基于 PRD v1.2 / Spec v1.0
> 架构方案：**自建服务器**

---

## 1. 现状分析

### 1.1 当前数据层（全部本地 + Mock）

| 层级 | 实现方式 | 说明 |
|------|----------|------|
| **数据存储** | `wx.getStorageSync` / `wx.setStorageSync` | 微信本地缓存，上限约 10MB |
| **文件存储** | `mock_cloud_service.ts` | Mock 云存储，仅返回模拟 URL |
| **用户认证** | `wx.login` → mock 成功 | 无真实 token 交换 |
| **数据模型** | TypeScript interface（typings/models/） | 前端定义，无后端对应 |
| **存储键** | `baby_diary_*`, `album_*` | 字符串键名分散在各页面 |

### 1.2 局限性

- 本地存储 10MB 上限，照片/视频无法真正持久化
- 数据仅存在于单设备，无法跨设备同步
- 无用户账号体系，换设备后数据全部丢失
- 无数据备份/恢复能力
- 无权限控制（家人共享无法实现）

---

## 2. 后端需求来源

### 2.1 从 PRD 提取的需求

| PRD 条目 | 功能 | 后端需求 | 优先级 |
|----------|------|----------|--------|
| 2.1 | 多宝宝照片/视频展示 | 按宝宝 ID 筛选媒体列表 | P0 |
| 2.2 | 上传照片/视频 | 文件上传 + 缩略图生成 | P0 |
| 2.3 | 宝宝档案 CRUD | 宝宝数据持久化 | P0 |
| 2.9 | currentBabyId 跨设备同步 | 用户状态云端同步 | P0 |
| 1.2 | 家人共享查看 | 共享权限 + 多端同步 | P1 |
| 2.6 | 数据统计 | 媒体数量/存储用量统计 | P1 |
| 2.6 | 存储管理 | 云存储用量/清理 | P2 |
| 共享场景 | 祖父母/家庭成员访问 | 多端数据同步 | P1 |

### 2.2 从 Spec 提取的需求

| Spec ID | 功能 | 后端需求 | 优先级 |
|---------|------|----------|--------|
| FEAT-01 | 云存储对接 | 文件上传/下载/删除 API | P1 |
| FEAT-02 | 真实数据展示 | 从云端拉取真实数据 | P1 |
| FEAT-08 | 头像上传 | 头像文件云存储 | P1 |
| OPT-02 | 家人共享 | 共享成员 + 权限体系 | P2 |
| OPT-03 | 存储管理 | 存储用量查询 | P2 |

---

## 3. 技术方案：自建服务器

### 3.1 技术栈

| 层级 | 技术 | 版本 | 说明 |
|------|------|------|------|
| **运行环境** | Node.js | >= 18 LTS | 服务端运行时 |
| **框架** | Express.js | 4.x | Web 框架 |
| **语言** | TypeScript | 5.x | 编译到 JS 运行 |
| **数据库** | PostgreSQL | 15+ | 关系型数据库 |
| **ORM** | Prisma | 5.x | 类型安全的 ORM |
| **文件存储** | MinIO (自建) | 最新版 | S3 兼容的对象存储 |
| **认证** | JWT | — | 微信 code → JWT |
| **API 风格** | RESTful | — | 标准 REST API |
| **部署** | Docker + Docker Compose | — | 容器化部署 |
| **反向代理** | Nginx | — | TLS 终止 + 静态资源 |

### 3.2 方案优势

| 维度 | 说明 |
|------|------|
| **数据自主** | 数据存储在自己的服务器，不依赖第三方云平台 |
| **可移植性** | 标准 PostgreSQL + S3 API，可任意迁移 |
| **扩展性** | 可按需水平扩展（加实例 + 读写分离） |
| **成本可控** | 初期单台服务器即可，按需升级 |
| **技术栈统一** | 前后端均 TypeScript，降低上下文切换成本 |

### 3.3 部署架构

```
┌─────────┐     ┌──────────────┐     ┌──────────────┐
│ 微信小程序 │────▶│   Nginx      │────▶│  API Server   │
│ (客户端)   │     │  (反向代理)   │     │  (Express.js) │
└─────────┘     │  TLS 终止    │     └──────┬───────┘
                └──────────────┘            │
                                           │
                ┌──────────────┐     ┌──────┴───────┐
                │   MinIO      │     │  PostgreSQL   │
                │ (对象存储)   │     │  (数据库)     │
                └──────────────┘     └──────────────┘
```

---

## 4. 数据库设计

### 4.1 ER 图

```
┌──────────┐       ┌──────────┐       ┌──────────┐
│   User   │       │   Baby   │       │   Media  │
├──────────┤       ├──────────┤       ├──────────┤
│ id (PK)  │◄──────│ userId   │       │ babyId   │──────► Baby
│ openId   │ 1:N   │ id (PK)  │◄──────│ id (PK)  │
│ nickname │       │ name     │ 1:N   │ type     │
│ avatar   │       │ gender   │       │ filePath │
│ createdAt│       │ birthDate│       │ title    │
└──────────┘       │ dueDate  │       │ tags[]   │
                   │ weight   │       │ createdAt│
┌──────────┐       │ height   │       └──────────┘
│  Share   │       │ avatar   │
├──────────┤       │ order    │       ┌──────────────┐
│ id (PK)  │       │ createdAt│       │  Achievement │
│ babyId   │       └──────────┘       ├──────────────┤
│ ownerId  │                          │ id (PK)      │
│ userId   │                          │ userId       │
│ role     │                          │ babyId?      │
│ createdAt│                          │ type         │
└──────────┘                          │ unlockedAt   │
                                      └──────────────┘
```

### 4.2 表结构

#### `User` — 用户表
```sql
CREATE TABLE "User" (
  "id"          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "openId"      VARCHAR(64) NOT NULL UNIQUE,   -- 微信 openId
  "unionId"     VARCHAR(64),                    -- 微信 unionId（可选）
  "nickname"    VARCHAR(50) NOT NULL DEFAULT '', -- 微信昵称
  "avatarUrl"   VARCHAR(255),                   -- 微信头像 URL
  "createdAt"   TIMESTAMP NOT NULL DEFAULT NOW(),
  "lastLoginAt" TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_user_open_id ON "User"("openId");
```

#### `Baby` — 宝宝表
```sql
CREATE TABLE "Baby" (
  "id"        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId"    UUID NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  "name"      VARCHAR(50) NOT NULL,
  "gender"    VARCHAR(10) CHECK (gender IN ('male', 'female')),
  "birthDate" DATE,
  "dueDate"   DATE,
  "weight"    DECIMAL(5,2),
  "height"    DECIMAL(5,2),
  "avatar"    VARCHAR(500),                      -- 头像 URL 或 emoji
  "order"     INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_baby_user_id ON "Baby"("userId");
CREATE INDEX idx_baby_order  ON "Baby"("userId", "order");
```

#### `Media` — 媒体表
```sql
CREATE TABLE "Media" (
  "id"            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "babyId"        UUID NOT NULL REFERENCES "Baby"(id) ON DELETE CASCADE,
  "userId"        UUID NOT NULL REFERENCES "User"(id),
  "type"          VARCHAR(10) NOT NULL CHECK (type IN ('image', 'video')),
  "title"         VARCHAR(200) DEFAULT '',
  "filePath"      VARCHAR(500) NOT NULL,          -- MinIO 对象路径
  "thumbnailPath" VARCHAR(500),                   -- 缩略图路径
  "width"         INTEGER,
  "height"        INTEGER,
  "size"          BIGINT NOT NULL DEFAULT 0,      -- 字节数
  "mimeType"      VARCHAR(50),
  "captureDate"   DATE NOT NULL,
  "tags"          TEXT[] DEFAULT '{}',            -- PostgreSQL 数组
  "isDeleted"     BOOLEAN NOT NULL DEFAULT FALSE, -- 软删除
  "createdAt"     TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt"     TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_media_baby     ON "Media"("babyId", "captureDate" DESC);
CREATE INDEX idx_media_user     ON "Media"("userId");
CREATE INDEX idx_media_active   ON "Media"("babyId") WHERE "isDeleted" = FALSE;
```

#### `Share` — 共享关系表
```sql
CREATE TABLE "Share" (
  "id"        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "babyId"    UUID NOT NULL REFERENCES "Baby"(id) ON DELETE CASCADE,
  "ownerId"   UUID NOT NULL REFERENCES "User"(id),
  "userId"    UUID NOT NULL REFERENCES "User"(id), -- 被分享者
  "role"      VARCHAR(10) NOT NULL CHECK (role IN ('viewer', 'editor')),
  "status"    VARCHAR(10) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'revoked')),
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE("babyId", "userId")
);
CREATE INDEX idx_share_user ON "Share"("userId");
CREATE INDEX idx_share_baby ON "Share"("babyId");
```

#### `Achievement` — 成就表（二期）
```sql
CREATE TABLE "Achievement" (
  "id"         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId"     UUID NOT NULL REFERENCES "User"(id),
  "babyId"     UUID REFERENCES "Baby"(id),
  "type"       VARCHAR(30) NOT NULL,             -- 成就类型
  "unlockedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE("userId", "type")
);
```

### 4.3 与现有前端模型的映射

| 前端模型字段 | 数据库字段 | 说明 |
|-------------|-----------|------|
| Baby.id | UUID | 前端可用 UUID 或由服务端返回 |
| Baby.birthDate | DATE | 前端 string → 后端 DATE 互转 |
| Media.tags | TEXT[] | PostgreSQL 数组，前端传 JSON array |
| Media.captureDate | DATE | 前端 string YYYY-MM-DD |
| Media.isDeleted | 无（前端不感知） | 后端软删除，前端只查 `isDeleted=FALSE` |

---

## 5. API 设计

### 5.1 基础约定

- **Base URL**: `https://api.baby-album.example.com/v1`
- **Content-Type**: `application/json`
- **认证方式**: JWT in `Authorization: Bearer <token>`
- **分页**: 统一使用 `?page=1&pageSize=20`，响应含 `total` 字段
- **时间格式**: ISO 8601 (`2026-06-04T12:00:00Z`)
- **日期格式**: `YYYY-MM-DD`

### 5.2 认证 API

```
POST /v1/auth/login
  描述: 微信登录，用 code 换取 JWT
  请求: { "code": "微信临时登录凭证" }
  响应: {
    "token": "jwt_string",
    "expiresIn": 7200,
    "user": { "id", "nickname", "avatarUrl" }
  }
  错误: 401 — code 无效或已过期

POST /v1/auth/refresh
  描述: 刷新 token
  请求: { "refreshToken": "..." }
  响应: { "token": "...", "expiresIn": 7200 }

GET /v1/auth/profile
  描述: 获取当前用户信息
  响应: { "id", "openId", "nickname", "avatarUrl", "createdAt" }
```

### 5.3 宝宝 API

```
GET /v1/babies
  描述: 获取当前用户的所有宝宝（含被共享的）
  查询: ?includeShared=true
  响应: {
    "babies": [{ "id", "name", "gender", "birthDate", "age", "avatar", "order" }]
  }

POST /v1/babies
  描述: 创建宝宝
  请求: { "name", "gender?", "birthDate?", "avatar?" }
  响应: { "id", "name", "gender", "birthDate", "avatar", "order", "createdAt" }
  验证: name 必填，1-50 字符

GET /v1/babies/:id
  描述: 获取单个宝宝详情
  响应: { "id", "name", "gender", "birthDate", "dueDate", "weight", "height", "avatar", "stats" }
  stats: { "photoCount", "videoCount", "recordDays", "firstRecordDate", "achievements" }

PUT /v1/babies/:id
  描述: 更新宝宝信息
  请求: { "name"?, "gender"?, "birthDate"?, "dueDate"?, "weight"?, "height"?, "avatar"? }

DELETE /v1/babies/:id
  描述: 删除宝宝（级联删除所有媒体）
  响应: 204 No Content
```

### 5.4 媒体 API

```
GET /v1/media
  描述: 获取媒体列表（分页）
  查询: babyId (必填), page, pageSize, type?, startDate?, endDate?, sort?
  响应: {
    "items": [{ "id", "type", "title", "thumbnailUrl", "captureDate", "babyAge" }],
    "total": 100,
    "page": 1,
    "pageSize": 20
  }

POST /v1/media/upload
  描述: 上传媒体文件（multipart/form-data）
  请求: FormData: { file, babyId, title?, captureDate?, tags? }
  响应: {
    "id", "type", "filePath", "thumbnailUrl",
    "width", "height", "size", "captureDate"
  }
  限制: 单文件最大 20MB，单次最多 9 张

GET /v1/media/:id
  描述: 获取媒体详情
  响应: { "id", "type", "title", "url", "thumbnailUrl", "captureDate",
           "width", "height", "size", "babyId", "babyAge", "tags", "createdAt" }

PUT /v1/media/:id
  描述: 更新媒体信息
  请求: { "title"?, "tags"?, "captureDate"? }

DELETE /v1/media/:id
  描述: 软删除媒体
  响应: 204 No Content

POST /v1/media/batch-delete
  描述: 批量软删除
  请求: { "ids": ["id1", "id2"] }
```

### 5.5 统计 API

```
GET /v1/stats
  描述: 用户全局统计
  查询: ?babyId= (可选，指定宝宝的统计)
  响应: {
    "photoCount": 128,
    "videoCount": 32,
    "fileStorageUsed": 524288000,
    "recordDays": 180,
    "currentStreak": 7,
    "babyCount": 2,
    "achievements": [{ "type", "unlockedAt" }]
  }
```

### 5.6 共享 API（二期）

```
POST /v1/shares/invite
  描述: 邀请家人
  请求: { "babyId", "inviteeOpenId", "role": "viewer|editor" }

DELETE /v1/shares/:id
  描述: 撤销共享

GET /v1/shares?babyId=
  描述: 查看宝宝的所有共享关系
```

### 5.7 通用响应格式

```json
// 成功
{
  "data": { ... },
  "meta": { "page": 1, "pageSize": 20, "total": 100 }
}

// 错误
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "宝宝名称不能为空",
    "details": [{ "field": "name", "message": "必填字段" }]
  }
}
```

### 5.8 HTTP 状态码

| 状态码 | 含义 | 使用场景 |
|--------|------|----------|
| 200 | OK | GET/PUT 成功 |
| 201 | Created | POST 创建成功 |
| 204 | No Content | DELETE 成功 |
| 400 | Bad Request | 参数校验失败 |
| 401 | Unauthorized | token 缺失或过期 |
| 403 | Forbidden | 无权限访问资源 |
| 404 | Not Found | 资源不存在 |
| 409 | Conflict | 数据冲突（如重复创建） |
| 413 | Payload Too Large | 上传文件超限 |
| 429 | Too Many Requests | 接口限流 |
| 500 | Internal Server Error | 服务器内部错误 |

---

## 6. 工程项目结构

```
server/
├── package.json
├── tsconfig.json
├── docker-compose.yml          # PostgreSQL + MinIO + API
├── Dockerfile
├── .env.example                # 环境变量模板
├── prisma/
│   ├── schema.prisma           # 数据模型定义
│   └── migrations/             # 数据库迁移
├── src/
│   ├── index.ts                # 启动入口
│   ├── app.ts                  # Express 应用配置
│   ├── config/
│   │   ├── index.ts            # 配置读取
│   │   └── wechat.ts           # 微信配置
│   ├── middleware/
│   │   ├── auth.ts             # JWT 鉴权
│   │   ├── validator.ts        # 请求校验
│   │   ├── upload.ts           # 文件上传 (multer)
│   │   └── errorHandler.ts     # 全局错误处理
│   ├── routes/
│   │   ├── auth.ts             # 认证路由
│   │   ├── babies.ts           # 宝宝路由
│   │   ├── media.ts            # 媒体路由
│   │   └── stats.ts            # 统计路由
│   ├── controllers/
│   │   ├── auth.controller.ts
│   │   ├── baby.controller.ts
│   │   ├── media.controller.ts
│   │   └── stats.controller.ts
│   ├── services/
│   │   ├── auth.service.ts     # JWT 签发 + 微信登录
│   │   ├── baby.service.ts     # 宝宝业务逻辑
│   │   ├── media.service.ts    # 媒体业务逻辑
│   │   ├── file.service.ts     # MinIO 文件操作
│   │   └── thumbnail.service.ts # 缩略图生成
│   ├── utils/
│   │   ├── age.ts              # 年龄计算
│   │   ├── date.ts             # 日期工具
│   │   └── response.ts         # 响应格式化
│   └── types/
│       ├── express.d.ts        # Express 类型扩展
│       └── api.types.ts        # API 请求/响应类型
├── tests/
│   ├── unit/
│   └── integration/
└── scripts/
    ├── seed.ts                 # 测试数据填充
    └── migrate.ts              # 数据库迁移脚本
```

---

## 7. 文件存储（MinIO）

### 7.1 Bucket 结构

```
bucket: baby-album
├── avatars/                    # 用户/宝宝头像
│   └── {userId}/              # 按用户分组
├── photos/                     # 照片
│   └── {babyId}/{date}/       # 按宝宝 + 日期分组
├── videos/                     # 视频
│   └── {babyId}/{date}/
├── thumbnails/                 # 缩略图
│   └── {babyId}/{date}/
└── temp/                       # 临时上传（定时清理）
```

### 7.2 文件命名规则

```
{type}/{babyId}/{YYYY-MM-DD}/{uuid}.{ext}

示例：
avatars/550e8400-e29b-41d4-a716-446655440000/2026-06-04/abc123.jpg
photos/550e8400-e29b-41d4-a716-446655440000/2026-06-04/def456.jpg
```

### 7.3 缩略图策略

| 场景 | 尺寸 | 格式 | 质量 |
|------|------|------|------|
| 列表缩略图 | 320×320 | WebP | 80% |
| 详情大图 | 1080×1080 (max) | WebP | 90% |
| 头像 | 200×200 | WebP | 85% |

---

## 8. 认证与安全

### 8.1 登录流程

```
步骤 1: 小程序 wx.login() → 获取临时 code
步骤 2: 前端 POST /v1/auth/login { code } → 后端
步骤 3: 后端用 code 调微信接口获取 openId
步骤 4: 后端查找/创建用户，签发 JWT
步骤 5: 返回 JWT + 用户信息
步骤 6: 前端存储 JWT，后续请求携带在 Authorization header
```

### 8.2 JWT 结构

```json
{
  "sub": "user-uuid",
  "openId": "wx_openid",
  "iat": 1717488000,
  "exp": 1717495200
}
```

- Token 有效期：**2 小时**
- Refresh Token 有效期：**30 天**
- 算法：RS256（非对称加密）或 HS256

### 8.3 权限矩阵

| 操作 | 本人 | 编辑者(共享) | 查看者(共享) | 未登录 |
|------|------|-------------|-------------|--------|
| 查看宝宝列表 | ✅ | ✅ | ✅ | ❌ |
| 创建宝宝 | ✅ | ❌ | ❌ | ❌ |
| 编辑宝宝 | ✅ | ✅ | ❌ | ❌ |
| 删除宝宝 | ✅ | ❌ | ❌ | ❌ |
| 上传媒体 | ✅ | ✅ | ❌ | ❌ |
| 查看媒体 | ✅ | ✅ | ✅ | ❌ |
| 编辑媒体 | ✅ | ✅ | ❌ | ❌ |

### 8.4 安全措施

| 措施 | 实现方式 |
|------|----------|
| **请求限流** | express-rate-limit (100 req/min per IP) |
| **CORS** | 仅允许小程序域名 + 开发环境 localhost |
| **输入校验** | express-validator / zod 验证所有输入 |
| **SQL 注入** | Prisma 参数化查询 |
| **文件上传验证** | 检查 MIME type + magic bytes |
| **XSS** | 输出编码，Content-Security-Policy |
| **HTTPS** | Nginx TLS 终止，仅允许 TLS 1.3 |
| **日志审计** | 所有写操作记录操作日志 |

---

## 9. 部署方案

### 9.1 Docker Compose 配置

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

  minio:
    image: minio/minio
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: ${MINIO_ROOT_USER}
      MINIO_ROOT_PASSWORD: ${MINIO_ROOT_PASSWORD}
    volumes:
      - miniodata:/data

  api:
    build: .
    depends_on:
      postgres: { condition: service_healthy }
      minio: { condition: service_started }
    environment:
      DATABASE_URL: postgresql://app:${DB_PASSWORD}@postgres:5432/baby_album
      MINIO_ENDPOINT: minio:9000
      JWT_SECRET: ${JWT_SECRET}
      WECHAT_APP_ID: ${WECHAT_APP_ID}
      WECHAT_APP_SECRET: ${WECHAT_APP_SECRET}

  nginx:
    image: nginx:alpine
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/nginx/ssl
    ports:
      - "443:443"
      - "80:80"
    depends_on:
      - api

volumes:
  pgdata:
  miniodata:
```

### 9.2 环境变量

```bash
# .env 模板
NODE_ENV=production
PORT=3000
DATABASE_URL=postgresql://app:password@localhost:5432/baby_album
JWT_SECRET=your-256-bit-secret
JWT_REFRESH_SECRET=your-256-bit-refresh-secret
WECHAT_APP_ID=wx3db22b5d6da5d38a
WECHAT_APP_SECRET=your-wechat-app-secret
MINIO_ENDPOINT=localhost:9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_BUCKET=baby-album
UPLOAD_MAX_SIZE=20971520
CORS_ORIGIN=https://小程序域名
```

### 9.3 服务器推荐配置

| 阶段 | 配置 | 预估月费 | 支持用户数 |
|------|------|----------|-----------|
| MVP | 1核2G + 40GB SSD | ~50元 | < 1000 活跃用户 |
| 增长期 | 2核4G + 80GB SSD | ~100元 | < 10000 活跃用户 |
| 规模化 | 4核8G + 200GB SSD + 读写分离 | ~300元 | > 10000 活跃用户 |

---

## 10. 前端适配方案

### 10.1 适配策略

前端需要从"本地存储优先"切换到"云端优先，本地缓存为辅"的模式：

```typescript
// 改造后的 Service 层结构
class BabyService {
  async getBabies(): Promise<Baby[]> {
    // 1. 尝试从云端拉取
    try {
      const res = await request.get('/v1/babies');
      // 2. 写入本地缓存作为离线备份
      wx.setStorageSync('album_babies', res.data.babies);
      return res.data.babies;
    } catch (e) {
      // 3. 云端失败时从本地缓存读取
      return wx.getStorageSync('album_babies') || [];
    }
  }
}
```

### 10.2 改造范围

| 文件 | 改动内容 | 工作量 |
|------|----------|--------|
| `services/storage_service.ts` | 新增云端同步层 | 中 |
| `services/media_service.ts` | 替换 mock 为真实 HTTP 调用 | 中 |
| `services/mock_cloud_service.ts` | 替换为真实上传 | 小 |
| `pages/index/index.ts` | wx.login 后调后端登录 API | 小 |
| `pages/upload/upload.ts` | 上传流程改为 multipart 上传 | 中 |
| `app.ts` | 启动时初始化 token | 小 |

### 10.3 API 请求封装

```typescript
// services/request.ts — HTTP 请求封装
const request = {
  get: (url: string, params?: any) => apiCall('GET', url, { params }),
  post: (url: string, data?: any) => apiCall('POST', url, { data }),
  put:  (url: string, data?: any) => apiCall('PUT', url, { data }),
  delete: (url: string) => apiCall('DELETE', url),
};

function apiCall(method: string, url: string, opts: any) {
  const token = wx.getStorageSync('baby_diary_token');
  return new Promise((resolve, reject) => {
    wx.request({
      url: BASE_URL + url,
      method,
      header: {
        'Authorization': token ? 'Bearer ' + token : '',
        'Content-Type': 'application/json',
      },
      ...opts,
      success: (res) => {
        if (res.statusCode === 401) {
          // Token 过期 → 尝试刷新 / 重新登录
          return refreshLogin().then(() => apiCall(method, url, opts));
        }
        if (res.statusCode >= 400) return reject(res.data);
        resolve(res.data);
      },
      fail: reject,
    });
  });
}
```

---

## 11. 迁移路径

### 阶段一：本地存储（当前状态 ✅）
- 全部使用 `wx.getStorageSync` / `wx.setStorageSync`
- 文件使用 `mock_cloud_service.ts`
- 用户认证使用 mock
- **无需服务器**，纯前端开发

### 阶段二：自建服务器基建（新增，~3 天）
1. 初始化 Node.js + Express + TypeScript 项目
2. Docker Compose 配置 PostgreSQL + MinIO
3. Prisma schema 定义 + 数据库迁移
4. 实现 JWT 认证 + `/v1/auth/login`（对接微信 code）
5. 实现文件上传接口（multer → MinIO）
6. 编写测试数据 seed 脚本
7. 部署到测试服务器（Nginx + Docker）

### 阶段三：API 开发（~4 天）
1. 宝宝 CRUD（4 个接口）
2. 媒体上传 + 列表 + 详情 + 删除（4 个接口）
3. 缩略图生成（sharp 库）
4. 统计接口
5. 错误处理 + 请求校验中间件
6. 集成测试

### 阶段四：前端适配（~2 天）
1. `request.ts` 请求封装
2. 登录流程适配（wx.login → 后端 login API）
3. 存储服务适配（本地→云端优先）
4. 上传页适配（mock → 真实 multipart 上传）
5. 错误处理和 token 刷新

### 阶段五：共享 + 优化（二期，~3 天）
1. 共享关系 CRUD
2. 权限中间件
3. 缓存优化
4. 日志和监控

---

## 12. 工作量汇总

| 阶段 | 内容 | 预估工时 | 前置依赖 |
|------|------|----------|----------|
| 阶段二 | 服务器基建 + 部署 | 3 天 | 服务器 + 域名 + SSL |
| 阶段三 | API 开发 | 4 天 | 阶段二 |
| 阶段四 | 前端适配 | 2 天 | 阶段三 |
| 阶段五 | 共享 + 优化 | 3 天 | 阶段四 |
| **合计** | **后端全量** | **~12 天** | — |