# 后端架构设计文档

> 版本：v1.0 | 最后更新：2026-06-04
> 状态：待评审 | 基于 PRD v1.2 / Spec v1.0 / Tech v1.0

---

## 1. 现状分析

### 1.1 当前数据层（全部本地 + Mock）

| 层级 | 实现方式 | 说明 |
|------|----------|------|
| **数据存储** | `wx.getStorageSync` / `wx.setStorageSync` | 微信本地缓存，上限约 10MB |
| **文件存储** | `mock_cloud_service.ts` | Mock 云存储，仅返回模拟 URL |
| **用户认证** | `wx.login` → mock 成功 | 无真实 token 交换 |
| **数据模型** | TypeScript interface（typings/models/） | 前端定义，无后端对应 |
| **存储键** | `baby_diary_baby_profile`, `album_media`, `album_babies` 等 | 字符串键名分散在各页面 |

### 1.2 局限性

- 本地存储 10MB 上限，照片/视频无法真正持久化
- 数据仅存在于单设备，无法跨设备同步
- 无用户账号体系，换设备后数据丢失
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
| 2.6 (设置) | 数据统计 | 媒体数量/存储用量统计 | P1 |
| 2.6 (设置) | 存储管理 | 云存储用量/清理 | P2 |

### 2.2 从 Spec 提取的需求

| Spec ID | 功能 | 后端需求 | 优先级 |
|---------|------|----------|--------|
| FEAT-01 | 云存储对接 | 文件上传/下载/删除 API | P1 |
| FEAT-02 | 真实数据展示 | 从云端拉取真实数据 | P1 |
| FEAT-08 | 头像上传 | 头像文件云存储 | P1 |
| OPT-02 | 家人共享 | 共享成员 + 权限体系 | P2 |
| OPT-03 | 存储管理 | 存储用量查询 | P2 |

---

## 3. 技术方案选型

### 3.1 方案对比

| 维度 | 方案 A：微信云开发 | 方案 B：自建后端 | 方案 C：微信云 + 自建混合 |
|------|-------------------|------------------|------------------------|
| **后端语言** | Node.js (云函数) | Node.js / Go / Python | 云函数 + 自建混合 |
| **数据库** | 微信云数据库（MongoDB） | PostgreSQL / MySQL | 云数据库 + 自建 Redis |
| **文件存储** | 微信云存储（COS） | 自建 COS / OSS / S3 | 云存储 |
| **认证** | 微信自带 openId | 自建 JWT / OAuth | 微信认证 + 自建 |
| **部署** | 腾讯云（自动扩缩） | 自行运维 | 混合部署 |
| **成本** | 按量付费（免费额度够 MVP） | 服务器月租 | 较高 |
| **开发速度** | 快（原生集成） | 慢（需搭全套） | 中 |
| **可移植性** | 低（绑定腾讯云） | 高 | 中 |

### 3.2 推荐方案：微信云开发（方案 A）

**理由：**
- MVP 阶段免费额度足够（存储 5GB、CDN 5GB/月、云函数 1000 次/天）
- 与微信小程序原生集成，无需额外配置
- 云数据库直接支持微信 openId 鉴权
- 开发效率最高，当前团队规模下最适合

**当项目扩展到需要：**
- 自定义业务逻辑复杂（非简单 CRUD）
- 需要对接非微信生态
- 需要独立部署和多云容灾
→ 再迁移到方案 C

---

## 4. 系统架构

### 4.1 整体架构图

```
┌─────────────────────────────────────────────────┐
│                  微信小程序端                      │
│  ┌─────────┐ ┌──────────┐ ┌──────────────────┐  │
│  │ UI 页面  │ │ Service   │ │ MockCloudService  │  │
│  │ 10 页面  │ │ Layer     │ │ (一期→替换为真实)  │  │
│  └────┬────┘ └────┬─────┘ └────────┬─────────┘  │
│       │           │                │             │
└───────┼───────────┼────────────────┼─────────────┘
        │           │                │
        ▼           ▼                ▼
┌─────────────────────────────────────────────────┐
│              微信云开发 (wx.cloud)                │
│                                                   │
│  ┌──────────────┐  ┌──────────────┐              │
│  │  云数据库     │  │  云存储(COS)  │              │
│  │  (MongoDB)   │  │  (文件存储)   │              │
│  └──────┬───────┘  └──────┬───────┘              │
│         │                 │                       │
│  ┌──────┴───────┐  ┌──────┴───────┐              │
│  │  云函数       │  │  CDN 加速    │              │
│  │  (Node.js)   │  │  (图片加载)   │              │
│  └──────────────┘  └──────────────┘              │
└─────────────────────────────────────────────────┘
```

### 4.2 模块划分

```
backend/
├── cloudfunctions/          # 微信云函数
│   ├── login/               # 登录鉴权
│   ├── baby/                # 宝宝 CRUD
│   │   ├── create
│   │   ├── get
│   │   ├── update
│   │   └── delete
│   ├── media/               # 媒体 CRUD
│   │   ├── upload
│   │   ├── list
│   │   ├── get
│   │   └── delete
│   ├── stats/               # 统计
│   │   └── getStats
│   └── share/               # 共享（二期）
│       ├── invite
│       └── revoke
├── database/                # 数据库 schema
│   ├── schema.md
│   └── indexes.md
└── api/                     # API 定义
    ├── rest.md
    └── errors.md
```

---

## 5. 数据库设计

### 5.1 集合/表结构

#### `users` — 用户表
```
{
  _id: string,              // 自动生成
  openId: string,           // 微信 openId (unique)
  nickName: string,         // 微信昵称
  avatarUrl: string,        // 微信头像
  createdAt: Date,
  lastLoginAt: Date
}
```

#### `babies` — 宝宝表
```
{
  _id: string,
  userId: string,           // 关联用户 openId
  name: string,             // 宝宝昵称
  gender: 'male'|'female',  // 性别
  birthDate: string,        // 出生日期 YYYY-MM-DD
  dueDate?: string,         // 预产期
  weight?: string,          // 体重 kg
  height?: string,          // 身高 cm
  avatarFileId?: string,    // 头像云存储 fileID
  avatarUrl?: string,       // 头像 URL
  order: number,            // 显示排序
  createdAt: Date,
  updatedAt: Date
}
// 索引: { userId: 1, order: 1 }
// 索引: { userId: 1, createdAt: -1 }
```

#### `media` — 媒体表
```
{
  _id: string,
  babyId: string,           // 关联宝宝
  userId: string,           // 上传者 openId
  type: 'image'|'video',    // 媒体类型
  title: string,            // 标题/描述
  fileId: string,           // 云存储 fileID
  thumbnailFileId?: string, // 缩略图 fileID
  width?: number,
  height?: number,
  size: number,             // 文件大小 bytes
  captureDate: string,      // 拍摄日期 YYYY-MM-DD
  tags: string[],           // 标签
  isDeleted: boolean,       // 软删除标记
  createdAt: Date,
  updatedAt: Date
}
// 索引: { babyId: 1, captureDate: -1 }
// 索引: { userId: 1, createdAt: -1 }
// 索引: { babyId: 1, isDeleted: 1, captureDate: -1 }
```

#### `shares` — 共享关系表（二期）
```
{
  _id: string,
  babyId: string,
  ownerUserId: string,      // 所有者
  sharedWithUserId: string,  // 共享给
  permission: 'view'|'edit', // 权限
  createdAt: Date,
  updatedAt: Date
}
// 索引: { babyId: 1 }
// 索引: { sharedWithUserId: 1 }
```

### 5.2 与现有前端模型的差异

| 字段 | 当前前端模型 | 后端模型 | 说明 |
|------|-------------|----------|------|
| Baby.id | 客户端 UUID | _id (MongoDB) | 兼容处理，可使用客户端ID或服务端ID |
| Baby.createdAt | string ISO | Date | 前端兼容两种格式 |
| Media.babyId | string | string | 一致 |
| Media.title | string | string | 当前前端用 title，兼容 |

---

## 6. API 设计

### 6.1 RESTful API

#### 认证
```
POST /wx/login
  请求: { code: string }
  响应: { openId: string, token: string }
  说明: 通过 wx.login 获取的 code 换取 openId
```

#### 宝宝管理
```
GET    /api/babies              # 获取我的宝宝列表
POST   /api/babies              # 创建宝宝
  Body: { name, gender, birthDate, dueDate?, weight?, height?, avatarFileId? }
GET    /api/babies/:id          # 获取单个宝宝
PUT    /api/babies/:id          # 更新宝宝信息
DELETE /api/babies/:id          # 删除宝宝
```

#### 媒体管理
```
GET    /api/media?babyId=&page=&pageSize=  # 获取媒体列表（分页）
POST   /api/media/upload        # 上传媒体文件（multipart）
  Body: { file, babyId, title?, captureDate?, tags? }
GET    /api/media/:id           # 获取媒体详情
PUT    /api/media/:id           # 更新媒体信息
DELETE /api/media/:id           # 删除媒体（软删除）
```

#### 统计
```
GET    /api/stats               # 获取统计数据
  响应: { photoCount, videoCount, modelCount, storageUsed, recordDays }
```

### 6.2 错误码规范

| 错误码 | 含义 | 处理方式 |
|--------|------|----------|
| 401 | 未授权/ token 过期 | 重新登录 |
| 403 | 无权限访问 | 提示权限不足 |
| 404 | 资源不存在 | 显示空状态 |
| 409 | 资源冲突 | 提示用户刷新 |
| 429 | 请求太频繁 | 稍后重试 |
| 500 | 服务器错误 | 提示稍后重试 |

---

## 7. 迁移路径

### 阶段一：本地存储（当前状态 ✅）
- 全部使用 `wx.getStorageSync` / `wx.setStorageSync`
- 文件使用 `mock_cloud_service.ts`
- 用户认证使用 mock
- **优点**：开发快速，无需后端
- **缺点**：数据仅限单设备

### 阶段二：云开发接入（FEAT-01，P1）
1. 开通微信云开发环境
2. 初始化 `wx.cloud.init`
3. 创建 `users`、`babies`、`media` 数据库集合
4. 实现 `login` 云函数（获取 openId）
5. 替换 `mock_cloud_service.ts` 为真实 `wx.cloud.uploadFile`
6. Service 层增加云存储/云数据库调用
7. **关键决策**：前端直连云数据库 vs 通过云函数
   - 推荐：**通过云函数**（便于权限控制和业务逻辑）

### 阶段三：数据同步（FEAT-02，P1）
1. 客户端启动时从云端拉取数据
2. 本地缓存作为离线读取
3. 写入时先写云端，成功后更新本地缓存
4. 冲突处理：以服务端时间戳为准

### 阶段四：家人共享（OPT-02，P2）
1. 实现 `shares` 集合
2. 开发邀请流程（通过小程序分享）
3. 权限校验中间件
4. 多端实时同步（WebSocket 或轮询）

---

## 8. 安全考虑

| 风险 | 缓解措施 |
|------|----------|
| openId 泄露 | 云函数中使用，不暴露给客户端直接操作 |
| 越权访问 | 每个云函数校验 openId 归属 |
| 文件盗链 | 云存储使用临时密钥（有效期短） |
| 数据注入 | 云函数中做参数校验和清洗 |
| 存储滥用 | 限制单用户上传频率和总大小 |

---

## 9. 工作量估算

| 阶段 | 内容 | 预估工时 | 依赖 |
|------|------|----------|------|
| 阶段二 | 云开发开通 + login 云函数 | 1 天 | 无 |
| 阶段二 | 宝宝 CRUD 云函数 | 1 天 | login |
| 阶段二 | 媒体上传/列表云函数 | 2 天 | login + 云存储 |
| 阶段二 | 前端 Service 层适配 | 1.5 天 | 上述云函数 |
| 阶段三 | 数据同步 + 缓存策略 | 1 天 | 阶段二 |
| 阶段四 | 家人共享 | 3 天 | 阶段二 + 三 |
| **合计** | **后端全量** | **~9.5 天** | — |