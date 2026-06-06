# F04 - 家人共享系统

> Feature ID: F04 | 优先级: P1 | 版本: v3.0 | 状态: 📝 设计阶段 | 目标迭代: v2.0

---

## 1. Feature 概述

### 1.1 核心目标

允许用户邀请家庭成员（祖父母、亲戚等）共同查看宝宝的成长相册，支持权限控制。

### 1.2 业务价值

- 满足父母分享宝宝成长动态的核心诉求
- 增加产品社交属性，提升用户粘性
- 为未来家庭协作功能奠定基础

### 1.3 依赖

- F01 用户认证（邀请方和被邀请方均需用户身份）
- F03 数据同步（被邀请方需读取邀请方的数据）

---

## 2. 技术设计

### 2.1 分享流程

```
邀请方                         API 服务                       被邀请方
  │                              │                               │
  │── POST /api/v1/share/       │                               │
  │    invitations ────────────►│                               │
  │     { babyId, permission }  │── INSERT share_invitations    │
  │◄── 返回 shareToken ────────│    生成 shareToken (UUID)    │
  │                              │                               │
  │── wx.shareAppMessage() ────│                               │
  │    path: ?shareToken=xxx    │                  ◄── 打开卡片  │
  │                              │                               │
  │                              │    ◄── POST /api/v1/share/   │
  │                              │         accept               │
  │                              │    ── 验证 token + 未过期     │
  │                              │    ── UPDATE status=accepted  │
  │                              │    ── INSERT share_relations  │
  │◄── 通知已接受 ──────────────│                               │
```

### 2.2 数据模型

**share_invitations 表**

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | UUID PK | 邀请ID |
| `from_user_id` | UUID FK | 邀请方 |
| `baby_id` | UUID FK | 共享的宝宝 |
| `token` | VARCHAR(64) UNIQUE | 分享 token（UUID） |
| `permission` | ENUM('view','edit') | 权限级别 |
| `status` | ENUM('pending','accepted','rejected','expired') | 状态 |
| `created_at` | DATETIME | 创建时间 |
| `expires_at` | DATETIME | 过期时间（24h） |

**share_relations 表**

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | UUID PK | 关系ID |
| `owner_user_id` | UUID FK | 数据所有者 |
| `viewer_user_id` | UUID FK | 查看者 |
| `baby_id` | UUID FK | 共享宝宝 |
| `permission` | ENUM('view','edit') | 权限级别 |
| `created_at` | DATETIME | 建立时间 |

### 2.3 权限模型

| 操作 | Owner（所有者） | Viewer（查看者） | Editor（编辑者） |
|------|:---:|:---:|:---:|
| 查看照片/视频 | ✅ | ✅ | ✅ |
| 上传新照片 | ✅ | ❌ | ✅ |
| 编辑照片描述 | ✅ | ❌ | ✅ |
| 删除照片 | ✅ | ❌ | ❌ |
| 编辑宝宝档案 | ✅ | ❌ | ❌ |
| 邀请其他人 | ✅ | ❌ | ❌ |
| 取消共享 | ✅ | ❌ | ❌ |

### 2.4 API 端点

| 方法 | 路径 | 说明 | 鉴权 |
|------|------|------|------|
| POST | `/api/v1/share/invitations` | 创建分享邀请 | JWT |
| POST | `/api/v1/share/accept` | 接受分享邀请 | JWT |
| GET | `/api/v1/share/babies` | 获取共享给我的宝宝列表 | JWT |
| GET | `/api/v1/share/babies/:id/media` | 获取共享宝宝的媒体 | JWT |
| DELETE | `/api/v1/share/relations/:id` | 取消共享 | JWT |

---

## 3. 前端对接要点

- 首页宝宝列表需区分「我的宝宝」和「共享给我的宝宝」
- 共享内容在 UI 中标注「由 xxx 分享」
- 权限不足操作时显示友好提示
- 通过微信 `wx.shareAppMessage` 发送分享卡片

---

## 4. 验收标准

| ID | 验收条件 |
|----|----------|
| AC-F04-01 | 邀请方成功创建分享并发送微信卡片 |
| AC-F04-02 | 被邀请方通过卡片接受邀请 |
| AC-F04-03 | 被邀请方可查看共享宝宝的照片（不能编辑） |
| AC-F04-04 | 分享 token 24h 过期后无法接受 |
| AC-F04-05 | 邀请方可随时取消共享 |

---

*详细用户故事和技术故事拆解见 `story/S04-sharing-stories.md`*
