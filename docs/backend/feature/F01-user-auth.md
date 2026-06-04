# F01 - 用户认证与账户系统

> Feature ID: F01 | 优先级: P0 | 版本: v2.0 | 状态: 📝 设计阶段

---

## 1. Feature 概述

### 1.1 核心目标

为小程序提供完整的用户认证与账户管理能力，实现微信一键登录、用户注册、JWT Token 管理。

### 1.2 业务价值

- 用户登录后数据可在多设备间同步
- 为家人共享、云存储等功能提供身份基础
- 实现用户数据隔离与隐私保护

### 1.3 前置依赖

- 微信 AppID + AppSecret 已配置
- 服务器已部署 API 服务 + Nginx HTTPS

### 1.4 后续依赖本 Feature 的模块

- F02 云存储（需用户认证）
- F03 数据同步（需用户身份）
- F04 家人共享（需用户身份 + 关系链）

---

## 2. 技术设计

### 2.1 认证流程

```
小程序端                         API 服务                      PostgreSQL
   │                              │                                │
   │── wx.login() 获取 code ─────►│                                │
   │                              │── POST /api/v1/auth/login      │
   │                              │── code2Session 换取 openId     │
   │                              │                                │
   │                              │── 查 User 表 (Prisma)          │
   │                              │   ├─ 存在: 返回 userId        │
   │                              │   └─ 不存在: INSERT 新记录     │
   │                              │                                │
   │◄── 返回 JWT token + userId ─│                                │
   │                              │                                │
   │── 保存 token 到本地 ────────│                                │
   │     wx.setStorageSync       │                                │
```

### 2.2 数据模型

**User 表（Prisma Schema）**

```prisma
model User {
  id            String   @id @default(uuid())
  openId        String   @unique
  unionId       String?
  nickName      String   @default("")
  avatarUrl     String?
  recordDays    Int      @default(0)
  totalPhotos   Int      @default(0)
  totalVideos   Int      @default(0)
  total3DModels Int      @default(0)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
}
```

### 2.3 API 端点

| 方法 | 路径 | 说明 | 鉴权 |
|------|------|------|------|
| POST | `/api/v1/auth/login` | 微信登录，返回 JWT | 否 |
| POST | `/api/v1/auth/refresh` | 刷新 token | JWT |
| GET | `/api/v1/users/me` | 获取当前用户信息 | JWT |
| PUT | `/api/v1/users/me` | 更新昵称、头像 | JWT |

### 2.4 JWT 设计

- 签发: 服务端用 openId + userId 生成 JWT（HS256）
- 存储: `wx.getStorageSync('babydiary_token')- 有效期: Access Token 2h，Refresh Token 30d
- 校验: Express 中间件解析 Authorization: Bearer <token>
- 黑名单: Redis 记录已登出的 token（防止泄露后滥用）

---

## 3. 接口设计

### 3.1 登录

`POST /api/v1/auth/login`

**请求体**:
```json
{ "code": "wx.login() 返回的 code" }
```

**响应**:
```json
{
  "code": 0,
  "data": {
    "userId": 1,
    "accessToken": "eyJhbGciOi...",
    "refreshToken": "dGhpcyBpcyByZWZyZXNo...",
    "expiresIn": 7200,
    "isNewUser": true
  }
}
```

### 3.2 获取当前用户信息

`GET /api/v1/users/me`

**请求头**: `Authorization: Bearer <accessToken>`

**响应**:
```json
{
  "code": 0,
  "data": {
    "userId": 1,
    "nickName": "宝宝妈妈",
    "avatarUrl": "https://...",
    "recordDays": 30,
    "totalPhotos": 120,
    "totalVideos": 5,
    "total3DModels": 2
  }
}
```

---

## 4. 前端对接要点

### 4.1 首次登录流程

```
app.ts onLaunch:
  1. 调用 wx.login() 获取 code
  2. POST /api/v1/auth/login { code }
  3. 存储 accessToken + refreshToken + userId 到本地
  4. 根据 isNewUser 跳转首次引导页或首页
```

### 4.2 API 请求封装

```
services/api.ts:
  - 统一添加 Authorization header
  - 401 时自动调用 /auth/refresh 刷新 token
  - 刷新失败跳转登录
```

### 4.3 当前本地存储迁移

| 当前 Key | 说明 | v1.1 迁移 |
|----------|------|-----------|
| `baby_diary_user_id` | 本地 userId | 替换为云端 userId（UUID） |
| `baby_diary_current_baby_id` | 当前宝宝 | 保持不变（关联云端 baby） |
| `babydiary_token` | 新增 | 存储 JWT accessToken |
| `babydiary_refresh_token` | 新增 | 存储 JWT refreshToken |

---

## 5. 验收标准

| ID | 验收条件 |
|----|----------|
| AC-F01-01 | 首次打开小程序自动完成静默登录 |
| AC-F01-02 | 登录后获得有效的 JWT token 和 userId |
| AC-F01-03 | 用户A无法通过修改参数访问用户B的数据 |
| AC-F01-04 | Token 过期后前端自动刷新，用户无感知 |
| AC-F01-05 | 同一微信账号重复登录，返回相同 userId |

---

## 6. 风险与注意事项

| 风险 | 缓解措施 |
|------|----------|
| 微信 code2Session 调用频率限制 | 前端缓存 token，避免频繁 login |
| JWT 泄露 | 短有效期 accessToken + 黑名单机制 |
| AppSecret 泄露 | 仅服务端持有，不写入前端代码 |

---

*详细用户故事和技术故事拆解见 `story/S01-auth-stories.md`*
