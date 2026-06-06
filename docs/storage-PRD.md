# 相册数据存储服务设计文档

> 版本：v1.0 | 最后更新：2026-06-06 | 状态：📝 设计阶段
> 配套：`docs/backend/architecture.md`（后端架构）、`docs/integration-PRD.md`（联调方案）

---

## 1. 当前存储现状分析

### 1.1 现有存储键值一览

| 存储键 | 类型 | 用途 | 所属页面 | 当前问题 |
|--------|------|------|----------|----------|
| `baby_diary_authed` | boolean | 登录标记 | index | 无云端同步 |
| `baby_diary_access_token` | string | JWT token | index | 分散管理 |
| `baby_diary_refresh_token` | string | 刷新 token | index | 分散管理 |
| `baby_diary_user_id` | string | 用户 ID | index | 可能为空 |
| `baby_diary_baby_profile` | object | 当前宝宝信息 | baby_onboarding | 仅存一个宝宝 |
| `baby_diary_current_baby_id` | string | 当前宝宝 ID | album_home | 与云端可能冲突 |
| `album_babies` | array | 宝宝列表 | album_home/baby_list | 与云端重复维护 |
| `album_media` | array | 媒体列表 | album_home | 本地 Mock 数据 |

### 1.2 现有问题

| 问题 | 影响 | 严重度 |
|------|------|--------|
| 本地存储键名格式不统一（`baby_diary_*` vs `album_*`） | 维护困难, 容易遗漏 | 🔴 |
| 无统一数据访问层 | 每个页面直接读写 storage | 🔴 |
| 本地数据与云端数据双向不同步 | 换设备数据丢失 | 🔴 |
| 离线/在线无切换策略 | 网络波动时崩溃 | 🟡 |
| Mock 数据与真实数据结构不一致 | 联调时字段不匹配 | 🟡 |
| 无缓存失效策略 | 数据可能过期 | 🟡 |

---

## 2. 存储架构设计

### 2.1 三层存储模型

```
┌─────────────────────────────────────────────────┐
│                   应用层 (Page/Component)         │
│    通过 unifiedStorage 接口读写，无需关心底层     │
└──────────────────────┬──────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────┐
│             统一存储服务 (UnifiedStorage)         │
│                                                   │
│  ┌────────────────┐  ┌────────────────────────┐  │
│  │  StorageLayer   │  │  CloudSyncAdapter      │  │
│  │  (本地 wx API)  │  │  (云端 HTTP API)       │  │
│  └───────┬────────┘  └───────────┬────────────┘  │
│          │                       │               │
│  ┌───────▼───────────────────────▼────────────┐  │
│  │         SyncOrchestrator                   │  │
│  │  读策略: 云端优先 → 本地降级 → Mock        │  │
│  │  写策略: 云端 + 本地双写 → 离线 pending     │  │
│  └────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────┘
```

### 2.2 存储键命名规范

统一前缀 `album_` + 模块名 + 作用域：

```
album_<module>_<key>
```

| 新键名 | 旧键名映射 | 迁移策略 |
|--------|-----------|----------|
| `album_auth_token` | `baby_diary_access_token` | 读取旧键，写入新键 |
| `album_auth_refresh` | `baby_diary_refresh_token` | 同上 |
| `album_auth_user_id` | `baby_diary_user_id` | 同上 |
| `album_baby_current` | `baby_diary_current_baby_id` | 保持不变 |
| `album_baby_profiles` | `baby_diary_baby_profile` | 改为数组 |
| `album_media_cache` | `album_media` | 保持不变 |
| `album_sync_status` | 新增 | 同步状态记录 |
| `album_sync_pending` | 新增 | 离线操作队列 |

---

## 3. UnifiedStorage 服务设计

### 3.1 接口定义

```typescript
// services/unified_storage.ts

interface IStorageOptions {
  /** 是否强制从云端刷新 */
  forceRefresh?: boolean;
  /** 缓存有效期（秒），0 表示永不过期 */
  ttl?: number;
  /** 离线时是否允许读取缓存 */
  allowOffline?: boolean;
}

class UnifiedStorage {
  /**
   * 读数据：云端优先 → 本地缓存 → Mock
   */
  async get<T>(key: string, fallback?: T, opts?: IStorageOptions): Promise<T>;

  /**
   * 写数据：同时写入云端和本地
   */
  async set<T>(key: string, value: T, opts?: IStorageOptions): Promise<void>;

  /**
   * 删除：云端 + 本地
   */
  async remove(key: string): Promise<void>;

  /**
   * 清空所有缓存
   */
  async clear(): Promise<void>;

  /**
   * 检查网络状态
   */
  isOnline(): boolean;

  /**
   * 获取存储使用情况
   */
  getStorageInfo(): Promise<{ used: number; limit: number }>;
}
```

### 3.2 存储键注册表

所有的存储键在 `constants/storage_keys.ts` 集中管理，统一注册：

```typescript
// constants/storage_keys.ts
export const STORAGE_KEYS = {
  // ===== 认证模块 =====
  AUTH_TOKEN:         'album_auth_token',
  AUTH_REFRESH:       'album_auth_refresh',
  AUTH_USER_ID:       'album_auth_user_id',

  // ===== 宝宝模块 =====
  BABY_CURRENT_ID:    'album_baby_current',
  BABY_PROFILES:      'album_baby_profiles',

  // ===== 媒体模块 =====
  MEDIA_CACHE:        'album_media_cache',
  MEDIA_PREFIX:       'album_media_',     // album_media_{babyId}

  // ===== 同步模块 =====
  SYNC_LAST_TIME:     'album_sync_last_time',
  SYNC_PENDING:       'album_sync_pending',

  // ===== 设置 =====
  SETTINGS_THEME:     'album_settings_theme',
  SETTINGS_SHARE:     'album_settings_share',
} as const;
```

### 3.3 数据流策略

```
读操作 get():
  ┌─── 在线 ─── 云端 GET API ─── 成功 ──→ 更新本地缓存 ──→ 返回
  │                     │
  │                  失败/超时
  │                     │
  └─── 离线 ──── 本地缓存存在 ──→ 返回缓存
                        │
                     缓存不存在
                        │
                       Mock 数据 ──→ 返回 Mock
```

```
写操作 set():
  ┌─── 在线 ─── 云端 POST/PUT API ─── 成功 ──→ 更新本地缓存 ──→ 返回
  │                     │
  │                  失败/超时
  │                     │
  └─── 离线 ──── 写入本地缓存
                        │
                  标记 pendingSync ──→ 写入 sync_queue ──→ 联网后重试
```

---

## 4. 同步策略 (SyncOrchestrator)

### 4.1 同步状态机

```
IDLE ──→ PENDING ──→ SYNCING ──→ COMPLETE
  ↑                        │
  └────────────────── ERROR
```

### 4.2 同步流程

```
app.ts onLaunch / 网络恢复:
  1. 检查 album_sync_pending 队列
  2. 有 pending → 逐个重放 POST/PUT/DELETE
  3. 成功后移除 pending 标记
  4. 更新 album_sync_last_time

  5. 增量同步: GET /sync/delta?since=lastSyncTime
  6. 合并差异到本地缓存
```

### 4.3 离线队列

```typescript
interface PendingOperation {
  id: string;           // 操作唯一 ID
  type: 'create' | 'update' | 'delete';
  entity: 'baby' | 'media';
  data: any;            // 请求体
  localKey: string;     // 关联的本地 key
  createdAt: number;    // 时间戳
  retryCount: number;   // 重试次数
}
```

离线队列存储位置：`album_sync_pending`（JSON 序列化数组）

---

## 5. 缓存策略

### 5.1 TTL 定义

| 数据类型 | 缓存时间 | 说明 |
|----------|----------|------|
| JWT token | 2h | 与 accessToken 有效期对齐 |
| 宝宝列表 | 5min | 变化频率低 |
| 宝宝详情 | 10min | 几乎不变的档案信息 |
| 媒体列表 | 2min | 可能新增上传 |
| 成就数据 | 30min | 变化极低 |
| 统计数据 | 10min | 日常使用变化少 |

### 5.2 缓存失效

```
主动失效: 用户执行写操作后立即失效相关缓存
  - 创建宝宝 → 宝宝列表缓存失效
  - 上传媒体 → 媒体列表缓存失效

被动失效: TTL 过期后下次读取重新拉取
```

---

## 6. 现有 StorageService 改造方案

### 6.1 当前代码问题

当前 `services/storage_service.ts` 存在的问题：
1. `wx.getStorage` / `wx.setStorage` 异步回调嵌套，使用 Promise 包装但未统一
2. 缓存逻辑（`this.cache`）在类实例中，页面刷新后丢失
3. 无云端同步能力
4. Media 月龄分组逻辑（`getMediaGroupedByMonthAge`）混杂在存储层

### 6.2 重构后的目录结构

```
services/
├── storage/
│   ├── index.ts              # UnifiedStorage 统一入口
│   ├── local.ts              # 本地存储层 (wx API 封装)
│   ├── cloud.ts              # 云端 API 调用封装
│   └── sync.ts               # 同步协调器
├── storage_service.ts        # [保留] 现有代码兼容层（调用 UnifiedStorage）
├── request.ts                # [已有] HTTP 请求封装
├── auth_api.ts               # [已有] 认证 API
├── baby_api.ts               # [已有] 宝宝 API
└── media_api.ts              # [已有] 媒体 API
```

### 6.3 兼容层设计

为确保不改动现有页面代码，`storage_service.ts` 改造为兼容层：

```typescript
// services/storage_service.ts - 兼容层
// 内部调用 UnifiedStorage，对外暴露与旧版本一致的接口

class StorageService {
  async getBabies(): Promise<Baby[]> {
    return unifiedStorage.get('album_baby_profiles', []);
  }

  async createBaby(input: CreateBabyInput): Promise<Baby> {
    const baby = { ...input, id: generateUUID(), createdAt: new Date() };
    // 写入本地 + 同步云端
    await unifiedStorage.set('album_baby_profiles', [...existing, baby]);
    // 触发云端创建
    babyApi.create(input).catch(() => markPending('create', 'baby', baby));
    return baby;
  }
  // ... 其他方法类似
}
```

---

## 7. 数据模型对齐

### 7.1 前端统一模型

```typescript
// typings/models/storage.ts

interface StoredBaby {
  id: string;
  name: string;
  gender?: 'male' | 'female';
  birthDate?: string;        // YYYY-MM-DD
  dueDate?: string;
  weight?: string;
  height?: string;
  avatar?: string;            // emoji 或图片 URL
  order: number;
  createdAt: string;          // ISO 8601
  updatedAt?: string;
  synced: boolean;            // 是否已同步到云端
}

interface StoredMedia {
  id: string;
  babyId: string;
  type: 'image' | 'video' | 'threedmodel';
  title: string;
  url?: string;               // 本地临时路径
  cosKey?: string;            // 云端对象 Key
  thumbnailUrl?: string;
  captureDate: string;
  width?: number;
  height?: number;
  fileSize?: number;
  tags?: string[];
  createdAt: string;
  synced: boolean;
}
```

### 7.2 模型差异对齐

| 前端字段 | 本地存储 | 云端 API | 说明 |
|----------|----------|----------|------|
| Baby.id | UUID string | UUID string | 一致 |
| Baby.name | 直接存储 | POST /babies/ | 一致 |
| Baby.gender | `male`/`female` | `male`/`female` | 一致 |
| Baby.birthDate | `2026-01-01` | `2026-01-01` | 一致 |
| Media.type | `image`/`video` | `image`/`video` | 一致 |
| Media.cosKey | string | 从 /upload/sign 获取 | 上传流程对齐 |
| Media.synced | boolean | 无此字段 | 仅本地使用 |

---

## 8. 迁移计划

### 阶段一：存储键规范化（~0.5 天）

| 步骤 | 内容 |
|------|------|
| 1 | 更新 `constants/storage_keys.ts`，新增统一键名 |
| 2 | 创建 `services/storage/unified.ts` 实现 UnifiedStorage 类 |
| 3 | 所有页面中的 `wx.getStorageSync` / `wx.setStorageSync` 替换为 `unifiedStorage.get` / `unifiedStorage.set` |
| 4 | 旧键读取兼容（先读新键，不存在则读旧键并迁移） |

### 阶段二：缓存 + 离线策略（~1 天）

| 步骤 | 内容 |
|------|------|
| 1 | 实现 `services/storage/sync.ts` — 同步协调器 |
| 2 | 实现离线 pending 队列 |
| 3 | 网络状态监听（`wx.onNetworkStatusChange`） |
| 4 | 写操作先写本地 → 后写云端（异步） |

### 阶段三：StorageService 重构（~1 天）

| 步骤 | 内容 |
|------|------|
| 1 | 现有 `storage_service.ts` 改为兼容层 |
| 2 | `getMediaGroupedByMonthAge` 迁移到服务层 |
| 3 | 移除 Mock 数据，全部走 UnifiedStorage |
| 4 | 测试覆盖所有页面数据流 |

### 阶段四：全量同步落地（~1 天）

| 步骤 | 内容 |
|------|------|
| 1 | 实现 `POST /sync/full` 全量上传 |
| 2 | 实现 `GET /sync/delta` 增量拉取 |
| 3 | `app.ts onLaunch` 增加启动同步 |
| 4 | 设置页增加「手动同步」按钮 + 同步状态展示 |

---

## 9. 验收标准

| ID | 验收条件 | 阶段 |
|----|----------|------|
| AC-S-01 | 所有存储键使用统一前缀 `album_` | 一 |
| AC-S-02 | 统一存储接口 `UnifiedStorage` 覆盖所有读写操作 | 一 |
| AC-S-03 | 旧存储键数据自动迁移到新键 | 一 |
| AC-S-04 | 在线时读请求走云端 API | 二 |
| AC-S-05 | 离线时读请求走本地缓存，不崩溃 | 二 |
| AC-S-06 | 离线写操作进入 pending 队列，联网后自动重放 | 二 |
| AC-S-07 | 写操作 TTL 过期后自动刷新缓存 | 二 |
| AC-S-08 | `storage_service.ts` 兼容层正确代理到 UnifiedStorage | 三 |
| AC-S-09 | app.ts 启动时触发增量同步 | 四 |
| AC-S-10 | 首次全量同步后本地数据完整迁移 | 四 |

---

## 10. 工作量估算

| 阶段 | 内容 | 工时 | 前置 |
|------|------|------|------|
| 一 | 存储键规范化 + UnifiedStorage | 0.5d | — |
| 二 | 缓存 + 离线策略 | 1d | 一 |
| 三 | StorageService 重构 | 1d | 二 |
| 四 | 同步落地 | 1d | 三 |
| **合计** | | **~3.5d** | — |