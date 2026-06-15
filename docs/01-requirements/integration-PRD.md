# 前后端联调需求文档 (Integration PRD)

> **版本**: v1.0 | **最后更新**: 2026-06-05
> **状态**: 📝 待评审
> **配套**: `docs/archive/PRD.md`（产品需求）、`docs/03-architecture/backend/`（后端设计）

---

## 1. 概述

### 1.1 背景

当前前端 MVP 基于本地存储（`wx.getStorageSync`）和 Mock 数据运行。
后端 API 服务已部署在 `http://101.126.41.146:8000`，提供 19 条 RESTful API。
本 PRD 定义前后端联调的范围、优先级、实施方案和验收标准。

### 1.2 联调目标

| 目标 | 说明 |
|------|------|
| **替换 Mock** | 前端所有 Mock 数据和服务替换为真实 API 调用 |
| **登录闭环** | 微信一键登录 → 后端认证 → 自动创建用户 → JWT 管理 |
| **数据上云** | 宝宝档案、媒体数据从本地存储迁移到云端 |
| **离线降级** | 网络不可用时自动降级到本地缓存 |
| **可测试** | 自动化测试覆盖核心联调链路 |

### 1.3 当前数据流 vs 目标数据流

```
当前（全部本地）                    目标（云端优先）
┌──────────────┐                  ┌──────────────┐
│  wx.login()  │                  │  wx.login()  │
│  → mock userId│                  │  → POST /auth│
└──────┬───────┘                  │  → JWT token │
       │                          └──────┬───────┘
┌──────▼───────┐                         │
│ wx.getStorage│                  ┌──────▼───────┐
│ → 本地数据   │                  │  wx.request  │
└──────────────┘                  │  + Bearer JWT│
                                  │  → 云端数据  │
                                  └──────┬───────┘
                                         │
                                  ┌──────▼───────┐
                                  │  本地缓存     │
                                  │  (离线降级)   │
                                  └──────────────┘
```

---

## 2. API 映射总览

### 2.1 认证模块

| 前端当前行为 | 后端 API | 替换方式 |
|-------------|----------|----------|
| `wx.login()` → mock 成功 | `POST /api/v1/auth/login` | wx.login 获取 code → 调用后端 |
| 无 token 管理 | 返回 `{ accessToken, refreshToken }` | 新增 `services/api.ts` 封装 |
| `baby_diary_authed` 本地标记 | JWT 有效期 2h + refresh | token 自动续期机制 |

### 2.2 宝宝模块

| 前端当前行为 | 后端 API | 替换方式 |
|-------------|----------|----------|
| `baby_diary_baby_profile` 本地读写 | `GET/POST/PUT/DELETE /api/v1/babies/` | Service 层改为 API 调用 |
| `album_baby_list` 本地读取 | `GET /api/v1/babies/` | 列表替换 |
| 静态 babyInfo | `GET /api/v1/babies/:id` | 动态加载 |

### 2.3 媒体模块

| 前端当前行为 | 后端 API | 替换方式 |
|-------------|----------|----------|
| `album_media` 本地 Mock 数据 | `GET /api/v1/media/?babyId=` | 分页列表替换 |
| Mock 上传 (mock_cloud_service) | `POST /api/v1/upload/sign` → 直传 COS | STS 签名直传 |
| 无缩略图 | `thumbnail_url` 字段 | 列表使用缩略图加速 |

### 2.4 同步模块

| 前端当前行为 | 后端 API | 替换方式 |
|-------------|----------|----------|
| 无同步概念 | `POST /api/v1/sync/full` | 首次登录全量同步 |
| 无增量更新 | `GET /api/v1/sync/delta` | 启动时增量拉取 |

### 2.5 统计与成就

| 前端当前行为 | 后端 API | 替换方式 |
|-------------|----------|----------|
| 设置页统计为静态数据 | `GET /api/v1/analytics/stats` | 动态统计 |
| 成就列表占位 | `GET /api/v1/analytics/achievements` | 真实数据 |

---

## 3. 实施计划（按优先级）

### Phase 1: API 请求基础设施（P0，~1 天）

**目标**：建立前端统一的 API 请求层，替换当前散落的 `wx.getStorageSync` 调用。

**任务清单**：

#### 3.1.1 创建 `services/request.ts` — HTTP 请求封装

```typescript
// 核心能力
// - 统一 BASE_URL 配置（开发/生产环境切换）
// - 自动附加 Authorization: Bearer <token>
// - 401 自动调 /auth/refresh 续期 token
// - 统一错误处理（toast 提示）
// - 请求/响应拦截器

const BASE_URL = 'http://101.126.41.146:8000/api/v1';

const request = {
  get:    (url, params?) => apiCall('GET', url, { params }),
  post:   (url, data?)   => apiCall('POST', url, { data }),
  put:    (url, data?)   => apiCall('PUT', url, { data }),
  delete: (url)          => apiCall('DELETE', url),
};
```

#### 3.1.2 Token 管理

| 键名 | 类型 | 说明 |
|------|------|------|
| `baby_diary_access_token` | string | JWT accessToken，有效期 2h |
| `baby_diary_refresh_token` | string | refreshToken，有效期 30d |
| `baby_diary_user_id` | string | 用户 ID，首次登录后返回 |

```typescript
// Token 刷新逻辑
async function apiCall(method, url, opts) {
  const token = wx.getStorageSync('baby_diary_access_token');
  try {
    return await wx.request({ url, method, header: { Authorization: 'Bearer ' + token }, ...opts });
  } catch (e) {
    if (e.status === 401) {
      const newToken = await refreshToken();
      return wx.request({ url, method, header: { Authorization: 'Bearer ' + newToken }, ...opts });
    }
    throw e;
  }
}
```

#### 3.1.3 环境配置

```typescript
// config/api.ts
const API_CONFIG = {
  development: {
    baseURL: 'http://localhost:8000/api/v1',
  },
  production: {
    baseURL: 'https://101.126.41.146:8000/api/v1',
    // 后续替换为正式域名
  },
};
```

---

### Phase 2: 一键登录联调（P0，~1 天）

**目标**：完整的微信登录 → 后端创建用户 → JWT 管理链路。

#### 3.2.1 登录流程改造

```
app.ts onLaunch:
  1. 检查本地是否有 accessToken
  2. 有 token → 调 GET /auth/me 验证有效性
     ├─ 有效 → 进入首页
     └─ 无效 → 调 /auth/refresh 续期
          ├─ 成功 → 进入首页
          └─ 失败 → 跳转登录引导页

index.ts（登录页）:
  1. wx.login() 获取 code
  2. POST /auth/login { code }
  3. 存储 accessToken + refreshToken + userId
  4. 根据 isNewUser → baby_onboarding（新用户）或 album_home（老用户）
```

#### 3.2.2 前端改动清单

| 文件 | 改动 |
|------|------|
| `app.ts` | onLaunch 中增加 token 检测 + 自动刷新逻辑 |
| `pages/index/index.ts` | `onLoginTap` 调 `/auth/login`，替换 mock |
| `pages/index/index.ts` | `handleAuthSuccess` 存储 token，根据 `isNewUser` 路由 |
| `services/` | 新建 `request.ts` + `auth_service_api.ts` |

#### 3.2.3 登录状态页面对应

| 登录状态 | 展示页面 | 说明 |
|----------|----------|------|
| 未登录 | Onboarding（index） | 微信一键登录按钮 |
| 已登录 + 无宝宝 | baby_onboarding | 创建第一个宝宝 |
| 已登录 + 有宝宝 | album_home | 正常首页 |

---

### Phase 3: 宝宝 + 媒体数据联调（P0，~2 天）

**目标**：宝宝档案和媒体数据从本地存储迁移到云端 API。

#### 3.3.1 宝宝模块迁移

| 前端页面 | 本地存储 Key | 替换为 API |
|----------|-------------|-----------|
| baby_onboarding | `baby_diary_baby_profile` | `POST /api/v1/babies/` + 保存 userId |
| baby_list | `album_babies` | `GET /api/v1/babies/` |
| baby_profile | `album_babies` 查单个 | `GET /api/v1/babies/:id` + `PUT /api/v1/babies/:id` |
| album_home Header | `currentBaby` 本地 | `GET /api/v1/babies/:id` + `currentBabyId` storage |

#### 3.3.2 媒体模块迁移

| 前端页面 | 本地行为 | 替换为 |
|----------|----------|--------|
| album_home 列表 | `initPage` 中 Mock 数据 | `GET /api/v1/media?babyId=&page=` |
| upload 页 | `wx.chooseMedia` → mock 写入 storage | `POST /api/v1/upload/sign` → 直传 COS → `POST /api/v1/media` |
| media_detail | 本地数据 | `GET /api/v1/media/:id` |

#### 3.3.3 上传流程（重要）

```
用户选择照片/视频
    │
    ├── 1. POST /api/v1/upload/sign { fileName, fileType, babyId }
    │     返回: { uploadUrl, cosKey, method }
    │
    ├── 2. wx.uploadFile 直传 COS（使用 uploadUrl + 签名）
    │     返回: COS ETag
    │
    └── 3. POST /api/v1/media { babyId, title, type, cosKey, captureDate }
          返回: { id, thumbnailUrl, ... }
```

---

### Phase 4: 数据同步（P1，~1 天）

**目标**：确保首次使用和日常使用的数据一致性。

#### 3.4.1 首次全量同步

```
baby_onboarding 保存后：
  1. POST /api/v1/babies/ → 创建宝宝到云端
  2. 存储 userId + babyId 到本地
  3. 跳转 album_home
```

#### 3.4.2 启动同步

```
app.ts onLaunch:
  1. POST /api/v1/sync/full（如有本地数据需要迁移）
  2. 或 GET /api/v1/sync/delta?since=lastSyncTime
  3. 合并到本地缓存
```

#### 3.4.3 离线策略

| 场景 | 策略 |
|------|------|
| 有网络 | 读写均走 API，同时更新本地缓存 |
| 无网络 | 读取本地缓存，写操作标记 `pendingSync=true` |
| 网络恢复 | 批量提交 pending 操作 |

---

### Phase 5: 自动化测试（P1，~1.5 天）

**目标**：自动化验证前后端联调的正确性。

#### 3.5.1 E2E 测试（miniprogram-automator）

| 测试用例 | 验证点 | 涉及 API |
|----------|--------|----------|
| **TC-01: 首次完整流程** | 登录 → 创建宝宝 → 首页展示 | `/auth/login`, `/babies/`, `/media/` |
| **TC-02: 登录续期** | wx.login code → JWT → refresh → 新 JWT | `/auth/login`, `/auth/refresh` |
| **TC-03: 多宝宝管理** | 创建 → 列表 → 切换 → 编辑 | `/babies/` CRUD |
| **TC-04: 上传流程** | sign → upload → media create | `/upload/sign`, `/media/` |
| **TC-05: 无权限拒绝** | 无 token 请求返回 401 | 所有 API |
| **TC-06: 成就检测** | 上传后触发成就检查 | `/analytics/achievements/check` |

#### 3.5.2 测试工具链

```
scripts/
├── mock-server.js          # Mock API 服务（测试用）
├── integration-test.js     # E2E 自动化测试脚本
└── test-report.js          # 测试报告生成
```

#### 3.5.3 验收标准

| ID | 验收条件 |
|----|----------|
| AC-E2E-01 | 首次登录流程全部通过，无人工干预 |
| AC-E2E-02 | 401 时自动 refresh token，用户无感知 |
| AC-E2E-03 | 上传 9 张照片后端全部正确记录 |
| AC-E2E-04 | 离线时展示缓存数据，不崩溃 |
| AC-E2E-05 | 测试报告包含每一步的截图 + API 响应 + 断言结果 |

---

## 4. 前端 Service 层改造方案

### 4.1 目录结构

```diff
 services/
-  ├── storage_service.ts    # 本地存储服务
-  ├── media_service.ts      # 媒体服务
-  ├── mock_cloud_service.ts # Mock 云存储
+  ├── request.ts            # [新增] API 请求封装（含 token 管理）
+  ├── api.ts                # [新增] API 调用统一入口
+  ├── auth_api.ts           # [新增] 认证相关 API
+  ├── baby_api.ts           # [新增] 宝宝相关 API
+  ├── media_api.ts          # [新增] 媒体相关 API
+  ├── sync_api.ts           # [新增] 同步相关 API
+  ├── storage_service.ts    # [保留] 本地缓存（降级用）
+  └── cloud_service.ts      # [改造] 替换 mock_cloud_service
```

### 4.2 API 调用示例

```typescript
// services/baby_api.ts
import { request } from './request';

export const babyApi = {
  list:  ()           => request.get('/babies/'),
  get:   (id: string) => request.get(`/babies/${id}`),
  create:(data: any)  => request.post('/babies/', data),
  update:(id: string, data: any) => request.put(`/babies/${id}`, data),
  delete:(id: string) => request.delete(`/babies/${id}`),
};
```

### 4.3 数据流策略

```
写入时：
  调用 API → 成功 → 更新本地缓存
           → 失败 → 标记 pending → 显示错误提示

读取时：
  优先 API → 成功 → 更新本地缓存 → 返回数据
           → 失败 → 读取本地缓存 → 返回缓存（降级）
```

---

## 5. 环境配置

### 5.1 API 地址配置

| 环境 | API Base URL | 说明 |
|------|-------------|------|
| 开发 | `http://localhost:8000` | 本地 Docker |
| 测试 | `http://101.126.41.146:8000` | 测试服务器 |
| 生产 | `https://api.baby-album.com` | 正式域名（未定） |

### 5.2 Swagger 文档

后端 API 文档可通过以下地址访问（测试环境）：
- Swagger UI: `http://101.126.41.146:8000/docs`
- ReDoc: `http://101.126.41.146:8000/redoc`
- OpenAPI JSON: `http://101.126.41.146:8000/openapi.json`

---

## 6. 风险与对策

| 风险 | 影响 | 对策 |
|------|------|------|
| 服务器网络不稳定 | 前端无法加载数据 | 本地缓存降级 + 重试机制 |
| JWT 过期并发请求 | 部分请求 401 | token 刷新队列 + 请求重放 |
| 微信 code2Session 频率限制 | 登录失败 | 前端缓存 token，避免频繁 wx.login() |
| 大文件上传慢 | 用户体验差 | 分片上传 + 进度条 |
| 前后端字段名不一致 | 数据错误 | 统一使用 camelCase（Pydantic schema） |

---

## 7. 验收标准汇总

| ID | 验收条件 | 关联 Phase |
|----|----------|-----------|
| AC-01 | 首次打开小程序，wx.login → API 登录 → 创建用户 → JWT | Phase 2 |
| AC-02 | 再次打开，token 有效期自动恢复登录态 | Phase 2 |
| AC-03 | Token 过期后自动刷新，用户无感知 | Phase 2 |
| AC-04 | 创建宝宝后数据写入云端，刷新后展示 | Phase 3 |
| AC-05 | 上传照片后媒体记录写入云端，首页可看到 | Phase 3 |
| AC-06 | 无网络时展示本地缓存数据，不崩溃 | Phase 4 |
| AC-07 | 网络恢复后 pending 操作自动提交 | Phase 4 |
| AC-08 | E2E 测试覆盖完整流程，生成测试报告 | Phase 5 |

---

## 8. 工作量估算

| Phase | 内容 | 工时 | 前置 |
|-------|------|------|------|
| **P1** | API 请求基础设施（request.ts + token 管理） | 1 天 | 后端已部署 ✅ |
| **P2** | 一键登录联调（index.ts + app.ts 改造） | 1 天 | P1 |
| **P3** | 宝宝 + 媒体数据联调（4 个页面改造） | 2 天 | P2 |
| **P4** | 数据同步 + 离线降级 | 1 天 | P3 |
| **P5** | 自动化 E2E 测试 | 1.5 天 | P3 |
| **合计** | | **~6.5 天** | — |