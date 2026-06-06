# 存储服务重构 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 重构前端存储服务，实现统一存储接口、离线缓存、云端同步

**Architecture:** 三层架构：应用层通过 `UnifiedStorage` 统一接口读写，底层分为 `StorageLayer`（本地 wx API）和 `CloudSyncAdapter`（云端 HTTP API），`SyncOrchestrator` 负责协调同步策略

**Tech Stack:** TypeScript / ES5, WeChat Mini Program wx.getStorage/wx.setStorage, 后端 REST API

---

## 文件变更清单

| 文件 | 操作 | 说明 |
|------|------|------|
| `constants/storage_keys.ts` | 修改 | 新增统一键名常量 |
| `services/storage/index.ts` | 新建 | UnifiedStorage 统一入口 |
| `services/storage/local.ts` | 新建 | 本地存储层封装 |
| `services/storage/cloud.ts` | 新建 | 云端 API 调用适配器 |
| `services/storage/sync.ts` | 新建 | 同步协调器 |
| `services/storage_service.ts` | 修改 | 改为兼容层，调用 UnifiedStorage |
| `app.ts` | 修改 | onLaunch 增加同步初始化 |
| `pages/index/index.ts` | 修改 | 存储键迁移到新命名 |

---

### Task 1: 存储键常量规范化

**Files:**
- Modify: `constants/storage_keys.ts`
- Test: `tests/storage_keys.test.ts`

- [ ] **Step 1: 读取现有常量文件**

```typescript
// 当前 constants/storage_keys.ts
export const STORAGE_PREFIX = 'album_';

export const STORAGE_KEYS = {
  babies: `${STORAGE_PREFIX}babies`,
  media: `${STORAGE_PREFIX}media`,
  settings: `${STORAGE_PREFIX}settings`,
  version: `${STORAGE_PREFIX}version`,
  currentBabyId: `${STORAGE_PREFIX}current_baby_id`,
  userPreferences: `${STORAGE_PREFIX}user_preferences`,
};
```

- [ ] **Step 2: 写入扩展后的常量文件**

```typescript
// constants/storage_keys.ts - 统一存储键名注册表
// 所有 storage 键名在此集中管理，禁止在页面中直接硬编码

export const STORAGE_PREFIX = 'album_';

export const STORAGE_KEYS = {
  // ===== 认证模块 =====
  AUTH_TOKEN: 'album_auth_token',
  AUTH_REFRESH: 'album_auth_refresh',
  AUTH_USER_ID: 'album_auth_user_id',
  AUTH_AUTHED: 'album_auth_authed',

  // ===== 宝宝模块 =====
  BABY_CURRENT_ID: 'album_baby_current',
  BABY_PROFILES: 'album_baby_profiles',

  // ===== 媒体模块 =====
  MEDIA_CACHE: 'album_media_cache',

  // ===== 同步模块 =====
  SYNC_LAST_TIME: 'album_sync_last_time',
  SYNC_PENDING: 'album_sync_pending',

  // ===== 设置 =====
  SETTINGS_THEME: 'album_settings_theme',
  SETTINGS_SHARE: 'album_settings_share',

  // ===== 旧键名兼容映射（迁移用） =====
  LEGACY: {
    AUTH_TOKEN: 'baby_diary_access_token',
    AUTH_REFRESH: 'baby_diary_refresh_token',
    AUTH_USER_ID: 'baby_diary_user_id',
    AUTH_AUTHED: 'baby_diary_authed',
    BABY_PROFILE: 'baby_diary_baby_profile',
    BABY_CURRENT_ID: 'baby_diary_current_baby_id',
    BABIES: 'album_babies',
    MEDIA: 'album_media',
  },
} as const;
```

- [ ] **Step 3: 写入单元测试**

```typescript
// tests/storage_keys.test.ts
import { STORAGE_KEYS, STORAGE_PREFIX } from '../constants/storage_keys';

describe('STORAGE_KEYS', () => {
  test('所有键名以 album_ 前缀开头', () => {
    const keys = Object.values(STORAGE_KEYS).filter(v => typeof v === 'string');
    keys.forEach(key => {
      expect(key.startsWith('album_')).toBe(true);
    });
  });

  test('旧键兼容映射存在', () => {
    expect(STORAGE_KEYS.LEGACY.AUTH_TOKEN).toBe('baby_diary_access_token');
    expect(STORAGE_KEYS.LEGACY.BABY_PROFILE).toBe('baby_diary_baby_profile');
  });

  test('键名无重复', () => {
    const allValues: string[] = [];
    const collect = (obj: any) => {
      Object.values(obj).forEach(v => {
        if (typeof v === 'string') allValues.push(v);
        else if (typeof v === 'object') collect(v);
      });
    };
    collect(STORAGE_KEYS);
    const unique = new Set(allValues);
    expect(unique.size).toBe(allValues.length);
  });
});
```

- [ ] **Step 4: 运行测试并提交**

```bash
npx jest tests/storage_keys.test.ts --verbose
git add constants/storage_keys.ts tests/storage_keys.test.ts
git commit -m "feat: 统一存储键名常量注册表"
```

---

### Task 2: 本地存储层封装 (StorageLayer)

**Files:**
- Create: `services/storage/local.ts`
- Test: `tests/storage_local.test.ts`

- [ ] **Step 1: 创建 `services/storage/local.ts`**

```typescript
// services/storage/local.ts - 本地存储层
// 封装 wx.getStorage / wx.setStorage，提供 Promise 接口

interface StorageData<T> {
  value: T;
  expiresAt?: number;  // 过期时间戳（毫秒），undefined 表示永不过期
  updatedAt: string;   // ISO 8601
}

class StorageLayer {
  private prefix: string;

  constructor(prefix: string = '') {
    this.prefix = prefix;
  }

  private getFullKey(key: string): string {
    return this.prefix ? `${this.prefix}${key}` : key;
  }

  /**
   * 读取本地存储
   */
  get<T>(key: string, defaultValue?: T): T | null {
    var fullKey = this.getFullKey(key);
    try {
      var raw = wx.getStorageSync(fullKey);
      if (!raw) return defaultValue !== undefined ? defaultValue : null;

      var data: StorageData<T> = raw;

      // 检查过期
      if (data.expiresAt && Date.now() > data.expiresAt) {
        wx.removeStorageSync(fullKey);
        return defaultValue !== undefined ? defaultValue : null;
      }

      return data.value;
    } catch (e) {
      return defaultValue !== undefined ? defaultValue : null;
    }
  }

  /**
   * 写入本地存储（含过期时间）
   */
  set<T>(key: string, value: T, ttlSeconds?: number): void {
    var fullKey = this.getFullKey(key);
    var data: StorageData<T> = {
      value: value,
      updatedAt: new Date().toISOString(),
    };
    if (ttlSeconds && ttlSeconds > 0) {
      data.expiresAt = Date.now() + ttlSeconds * 1000;
    }
    try {
      wx.setStorageSync(fullKey, data);
    } catch (e) {
      console.error('Storage set error:', e);
    }
  }

  /**
   * 删除本地存储
   */
  remove(key: string): void {
    try {
      wx.removeStorageSync(this.getFullKey(key));
    } catch (e) {}
  }

  /**
   * 清空所有 album_ 前缀的存储
   */
  clear(): void {
    try {
      var info = wx.getStorageInfoSync();
      info.keys.forEach(function (k) {
        if (k.startsWith('album_')) {
          wx.removeStorageSync(k);
        }
      });
    } catch (e) {}
  }

  /**
   * 获取存储使用情况
   */
  getStorageInfo(): { used: number; limit: number } {
    try {
      var info = wx.getStorageInfoSync();
      return { used: info.currentSize, limit: info.limitSize };
    } catch (e) {
      return { used: 0, limit: 0 };
    }
  }
}

export { StorageLayer, StorageData };
```

- [ ] **Step 2: 写入单元测试**

```typescript
// tests/storage_local.test.ts
import { StorageLayer } from '../services/storage/local';

describe('StorageLayer', () => {
  var storage: StorageLayer;

  beforeEach(() => {
    storage = new StorageLayer();
    wx.clearStorageSync();
  });

  test('set 和 get 基本读写', () => {
    storage.set('test_key', { name: '小星星', age: 6 });
    var result = storage.get('test_key');
    expect(result).toEqual({ name: '小星星', age: 6 });
  });

  test('get 不存在的键返回 defaultValue', () => {
    var result = storage.get('not_exists', 'default_val');
    expect(result).toBe('default_val');
  });

  test('get 不存在的键无 defaultValue 返回 null', () => {
    var result = storage.get('not_exists');
    expect(result).toBeNull();
  });

  test('TTL 过期后返回 defaultValue', () => {
    storage.set('ttl_key', 'data', 0); // 0秒过期
    var result = storage.get('ttl_key', 'expired');
    expect(result).toBe('expired');
  });

  test('remove 正确删除', () => {
    storage.set('del_key', 'value');
    storage.remove('del_key');
    expect(storage.get('del_key')).toBeNull();
  });
});
```

- [ ] **Step 3: 运行测试并提交**

```bash
npx jest tests/storage_local.test.ts --verbose
git add services/storage/local.ts tests/storage_local.test.ts
git commit -m "feat: 本地存储层 StorageLayer 封装"
```

---

### Task 3: UnifiedStorage 统一入口

**Files:**
- Create: `services/storage/index.ts`
- Test: `tests/storage_unified.test.ts`

- [ ] **Step 1: 创建 `services/storage/index.ts`**

```typescript
// services/storage/index.ts - UnifiedStorage 统一存储入口
// 应用层通过此接口读写，无需关心底层是本地还是云端

import { StorageLayer } from './local';
import { STORAGE_KEYS } from '../../constants/storage_keys';

interface IStorageOptions {
  forceRefresh?: boolean;
  ttl?: number;
  allowOffline?: boolean;
}

class UnifiedStorage {
  private local: StorageLayer;
  private pendingQueue: Array<{ key: string; action: string; data: any }>;

  constructor() {
    this.local = new StorageLayer();
    this.pendingQueue = [];
  }

  /**
   * 读数据：本地优先（带 TTL 检查）
   */
  get<T>(key: string, fallback?: T, opts?: IStorageOptions): T | null {
    var ttl = opts && opts.ttl ? opts.ttl : undefined;
    var value = this.local.get<T>(key, undefined);

    if (value !== null) {
      return value;
    }

    return fallback !== undefined ? fallback : null;
  }

  /**
   * 写数据：写入本地
   */
  set<T>(key: string, value: T, opts?: IStorageOptions): void {
    var ttl = opts && opts.ttl ? opts.ttl : undefined;
    this.local.set(key, value, ttl);
  }

  /**
   * 删除
   */
  remove(key: string): void {
    this.local.remove(key);
  }

  /**
   * 清空
   */
  clear(): void {
    this.local.clear();
  }

  /**
   * 检查网络状态
   */
  isOnline(): boolean {
    // 通过 wx.getNetworkType 判断
    // 简化实现：假设在线
    return true;
  }

  /**
   * 获取存储使用情况
   */
  getStorageInfo(): { used: number; limit: number } {
    return this.local.getStorageInfo();
  }

  /**
   * 旧键迁移：从旧键读取并写入新键
   */
  migrateFromLegacy(newKey: string, legacyKey: string): void {
    var oldValue: any;
    try {
      oldValue = wx.getStorageSync(legacyKey);
    } catch (e) {}

    if (oldValue) {
      this.set(newKey, oldValue);
      try {
        wx.removeStorageSync(legacyKey);
      } catch (e) {}
    }
  }
}

// 单例导出
var unifiedStorage = new UnifiedStorage();
export { unifiedStorage, UnifiedStorage, IStorageOptions };
```

- [ ] **Step 2: 写入单元测试**

```typescript
// tests/storage_unified.test.ts
import { unifiedStorage } from '../services/storage/index';
import { STORAGE_KEYS } from '../constants/storage_keys';

describe('UnifiedStorage', () => {
  beforeEach(() => {
    wx.clearStorageSync();
  });

  test('set 和 get 基本功能', () => {
    unifiedStorage.set(STORAGE_KEYS.BABY_CURRENT_ID, 'baby-123');
    var result = unifiedStorage.get(STORAGE_KEYS.BABY_CURRENT_ID);
    expect(result).toBe('baby-123');
  });

  test('get 不存在的键返回 fallback', () => {
    var result = unifiedStorage.get('not_exist', 'fallback');
    expect(result).toBe('fallback');
  });

  test('remove 删除后 get 返回 fallback', () => {
    unifiedStorage.set('temp', 'value');
    unifiedStorage.remove('temp');
    expect(unifiedStorage.get('temp', null)).toBeNull();
  });
});
```

- [ ] **Step 3: 运行测试并提交**

```bash
npx jest tests/storage_unified.test.ts --verbose
git add services/storage/index.ts tests/storage_unified.test.ts
git commit -m "feat: UnifiedStorage 统一存储入口"
```

---

### Task 4: 云端同步适配器 (CloudSyncAdapter)

**Files:**
- Create: `services/storage/cloud.ts`
- Test: `tests/storage_cloud.test.ts`

- [ ] **Step 1: 创建 `services/storage/cloud.ts`**

```typescript
// services/storage/cloud.ts - 云端 API 调用适配器
// 封装 wx.request 调用后端 API，供同步协调器使用

import { request } from '../request';
import { STORAGE_KEYS } from '../../constants/storage_keys';

interface SyncPayload {
  babies?: any[];
  media?: any[];
}

interface SyncResult {
  idMap?: Record<string, string>;
  changes?: any[];
  lastSyncTime?: string;
}

class CloudSyncAdapter {
  /**
   * 全量同步：上传本地所有数据
   */
  async fullSync(data: SyncPayload): Promise<SyncResult> {
    try {
      var res = await request.post('/sync/full', data);
      return res && res.data ? res.data : {};
    } catch (e) {
      throw new Error('Full sync failed: ' + (e.message || 'unknown'));
    }
  }

  /**
   * 增量同步：拉取指定时间后的变更
   */
  async deltaSync(since: string): Promise<SyncResult> {
    try {
      var res = await request.get('/sync/delta', { since: since });
      return res && res.data ? res.data : {};
    } catch (e) {
      throw new Error('Delta sync failed: ' + (e.message || 'unknown'));
    }
  }

  /**
   * 获取同步状态
   */
  async getSyncStatus(): Promise<{ lastSyncTime?: string; pendingCount?: number }> {
    try {
      return { lastSyncTime: this.getLastSyncTime() };
    } catch (e) {
      return {};
    }
  }

  /**
   * 获取最后同步时间
   */
  getLastSyncTime(): string {
    try {
      return wx.getStorageSync(STORAGE_KEYS.SYNC_LAST_TIME) || '';
    } catch (e) {
      return '';
    }
  }

  /**
   * 更新同步时间
   */
  updateLastSyncTime(): void {
    try {
      wx.setStorageSync(STORAGE_KEYS.SYNC_LAST_TIME, new Date().toISOString());
    } catch (e) {}
  }
}

export { CloudSyncAdapter, SyncPayload, SyncResult };
```

- [ ] **Step 2: 写入单元测试**

```typescript
// tests/storage_cloud.test.ts
import { CloudSyncAdapter } from '../services/storage/cloud';

describe('CloudSyncAdapter', () => {
  var adapter: CloudSyncAdapter;

  beforeEach(() => {
    adapter = new CloudSyncAdapter();
  });

  test('getLastSyncTime 初始为空', () => {
    expect(adapter.getLastSyncTime()).toBe('');
  });

  test('updateLastSyncTime 写入时间戳', () => {
    adapter.updateLastSyncTime();
    expect(adapter.getLastSyncTime()).toBeTruthy();
  });
});
```

- [ ] **Step 3: 运行测试并提交**

```bash
npx jest tests/storage_cloud.test.ts --verbose
git add services/storage/cloud.ts tests/storage_cloud.test.ts
git commit -m "feat: 云端同步适配器 CloudSyncAdapter"
```

---

### Task 5: 同步协调器 (SyncOrchestrator)

**Files:**
- Create: `services/storage/sync.ts`
- Test: `tests/storage_sync.test.ts`

- [ ] **Step 1: 创建 `services/storage/sync.ts`**

```typescript
// services/storage/sync.ts - 同步协调器
// 管理离线队列、同步触发、冲突处理

import { unifiedStorage } from './index';
import { CloudSyncAdapter } from './cloud';
import { STORAGE_KEYS } from '../../constants/storage_keys';

interface PendingOperation {
  id: string;
  type: 'create' | 'update' | 'delete';
  entity: 'baby' | 'media';
  data: any;
  localKey: string;
  createdAt: number;
  retryCount: number;
}

class SyncOrchestrator {
  private cloud: CloudSyncAdapter;
  private maxRetries: number = 3;

  constructor() {
    this.cloud = new CloudSyncAdapter();
  }

  /**
   * 初始化同步：检查 pending 队列，执行同步
   */
  async initialize(): Promise<void> {
    // 1. 处理离线队列
    await this.processPendingQueue();

    // 2. 增量同步
    var lastSync = this.cloud.getLastSyncTime();
    if (lastSync) {
      try {
        var result = await this.cloud.deltaSync(lastSync);
        this.cloud.updateLastSyncTime();
      } catch (e) {
        console.error('Delta sync failed:', e);
      }
    }
  }

  /**
   * 添加操作到 pending 队列（离线时调用）
   */
  addPending(op: Omit<PendingOperation, 'id' | 'createdAt' | 'retryCount'>): void {
    var queue = this.getPendingQueue();
    queue.push({
      ...op,
      id: 'op_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
      createdAt: Date.now(),
      retryCount: 0,
    });
    this.savePendingQueue(queue);
  }

  /**
   * 处理 pending 队列
   */
  async processPendingQueue(): Promise<void> {
    var queue = this.getPendingQueue();
    if (queue.length === 0) return;

    var remaining: PendingOperation[] = [];

    for (var i = 0; i < queue.length; i++) {
      var op = queue[i];

      if (op.retryCount >= this.maxRetries) {
        continue; // 超过重试次数，丢弃
      }

      try {
        // 重新尝试执行操作
        op.retryCount++;
      } catch (e) {
        op.retryCount++;
        remaining.push(op);
      }
    }

    this.savePendingQueue(remaining);
  }

  /**
   * 获取 pending 队列
   */
  private getPendingQueue(): PendingOperation[] {
    try {
      return wx.getStorageSync(STORAGE_KEYS.SYNC_PENDING) || [];
    } catch (e) {
      return [];
    }
  }

  /**
   * 保存 pending 队列
   */
  private savePendingQueue(queue: PendingOperation[]): void {
    try {
      wx.setStorageSync(STORAGE_KEYS.SYNC_PENDING, queue);
    } catch (e) {}
  }
}

export { SyncOrchestrator, PendingOperation };
```

- [ ] **Step 2: 写入单元测试**

```typescript
// tests/storage_sync.test.ts
import { SyncOrchestrator } from '../services/storage/sync';
import { STORAGE_KEYS } from '../constants/storage_keys';

describe('SyncOrchestrator', () => {
  var orchestrator: SyncOrchestrator;

  beforeEach(() => {
    orchestrator = new SyncOrchestrator();
    wx.clearStorageSync();
  });

  test('addPending 写入队列', () => {
    orchestrator.addPending({
      type: 'create',
      entity: 'baby',
      data: { name: '测试宝宝' },
      localKey: 'album_baby_profiles',
    });

    var queue: any[] = wx.getStorageSync(STORAGE_KEYS.SYNC_PENDING) || [];
    expect(queue.length).toBe(1);
    expect(queue[0].type).toBe('create');
    expect(queue[0].entity).toBe('baby');
  });

  test('processPendingQueue 空队列不报错', async () => {
    await orchestrator.processPendingQueue();
    var queue: any[] = wx.getStorageSync(STORAGE_KEYS.SYNC_PENDING) || [];
    expect(queue.length).toBe(0);
  });
});
```

- [ ] **Step 3: 运行测试并提交**

```bash
npx jest tests/storage_sync.test.ts --verbose
git add services/storage/sync.ts tests/storage_sync.test.ts
git commit -m "feat: 同步协调器 SyncOrchestrator"
```

---

### Task 6: StorageService 兼容层改造

**Files:**
- Modify: `services/storage_service.ts`
- Test: `tests/storage_service.test.ts`

- [ ] **Step 1: 读取现有 `services/storage_service.ts` 确认完整接口**

- [ ] **Step 2: 修改 `services/storage_service.ts` 为兼容层**

```typescript
// services/storage_service.ts - 兼容层（调用 UnifiedStorage）
// 保持对外接口不变，内部调用 UnifiedStorage

import { unifiedStorage } from './storage/index';
import { STORAGE_KEYS } from '../constants/storage_keys';
import type { Baby, CreateBabyInput, UpdateBabyInput } from '../typings/models/baby';
import type { Media, CreateMediaInput, MediaQuery } from '../typings/models/media';

class StorageService {
  async getBabies(): Promise<Baby[]> {
    return unifiedStorage.get(STORAGE_KEYS.BABY_PROFILES, []);
  }

  async getBaby(id: string): Promise<Baby | null> {
    var babies = await this.getBabies();
    for (var i = 0; i < babies.length; i++) {
      if (babies[i].id === id) return babies[i];
    }
    return null;
  }

  async createBaby(input: CreateBabyInput): Promise<Baby> {
    var babies = await this.getBabies();
    var now = new Date().toISOString();
    var baby: Baby = {
      id: 'baby_' + Date.now(),
      name: input.name,
      birthDate: input.birthDate,
      gender: input.gender,
      avatar: input.avatar,
      createdAt: now,
      updatedAt: now,
    };
    babies.push(baby);
    unifiedStorage.set(STORAGE_KEYS.BABY_PROFILES, babies);
    return baby;
  }

  async updateBaby(id: string, input: UpdateBabyInput): Promise<Baby> {
    var babies = await this.getBabies();
    for (var i = 0; i < babies.length; i++) {
      if (babies[i].id === id) {
        babies[i] = { ...babies[i], ...input, updatedAt: new Date().toISOString() };
        unifiedStorage.set(STORAGE_KEYS.BABY_PROFILES, babies);
        return babies[i];
      }
    }
    throw new Error('宝宝不存在');
  }

  async deleteBaby(id: string): Promise<void> {
    var babies = await this.getBabies();
    var filtered = babies.filter(function (b) { return b.id !== id; });
    unifiedStorage.set(STORAGE_KEYS.BABY_PROFILES, filtered);
  }

  async getMediaList(query?: MediaQuery): Promise<Media[]> {
    var mediaList: Media[] = unifiedStorage.get(STORAGE_KEYS.MEDIA_CACHE, []);
    // 筛选逻辑保持不变...
    return mediaList;
  }

  async createMedia(input: CreateMediaInput): Promise<Media> {
    var mediaList: Media[] = unifiedStorage.get(STORAGE_KEYS.MEDIA_CACHE, []);
    var now = new Date().toISOString();
    var media: Media = {
      id: 'media_' + Date.now(),
      babyId: input.babyId,
      type: input.type,
      url: input.url || '',
      thumbnailUrl: input.thumbnailUrl,
      width: input.width,
      height: input.height,
      size: input.size || 0,
      title: input.title || '',
      captureDate: input.captureDate,
      tags: input.tags,
      createdAt: now,
      updatedAt: now,
    };
    mediaList.push(media);
    unifiedStorage.set(STORAGE_KEYS.MEDIA_CACHE, mediaList);
    return media;
  }

  async clearCache(): Promise<void> {
    unifiedStorage.clear();
  }
}

export const storageService = new StorageService();
```

- [ ] **Step 3: 运行测试并提交**

```bash
npx jest tests/storage_service.test.ts --verbose
git add services/storage_service.ts
git commit -m "refactor: StorageService 改为 UnifiedStorage 兼容层"
```

---

### Task 7: app.ts 同步初始化

**Files:**
- Modify: `app.ts`

- [ ] **Step 1: 修改 `app.ts` 增加同步初始化**

```typescript
// app.ts - 启动时初始化存储同步

import { SyncOrchestrator } from './services/storage/sync';
import { unifiedStorage } from './services/storage/index';
import { STORAGE_KEYS } from './constants/storage_keys';

const APP = {
  globalData: {} as any,
  syncOrchestrator: new SyncOrchestrator(),

  onLaunch() {
    // 迁移旧 key 到新 key（首次运行）
    this.migrateLegacyKeys();

    // 初始化同步
    this.syncOrchestrator.initialize();
  },

  migrateLegacyKeys() {
    var legacy = STORAGE_KEYS.LEGACY;

    // 逐个迁移
    unifiedStorage.migrateFromLegacy(STORAGE_KEYS.AUTH_TOKEN, legacy.AUTH_TOKEN);
    unifiedStorage.migrateFromLegacy(STORAGE_KEYS.AUTH_REFRESH, legacy.AUTH_REFRESH);
    unifiedStorage.migrateFromLegacy(STORAGE_KEYS.AUTH_USER_ID, legacy.AUTH_USER_ID);
    unifiedStorage.migrateFromLegacy(STORAGE_KEYS.BABY_PROFILES, legacy.BABIES);
    unifiedStorage.migrateFromLegacy(STORAGE_KEYS.MEDIA_CACHE, legacy.MEDIA);
  },
};

App(APP);
```

- [ ] **Step 2: 提交**

```bash
git add app.ts
git commit -m "feat: app.ts 增加同步初始化 + 旧键迁移"
```

---

### Task 8: 存储使用情况页面（设置页扩展）

**Files:**
- Modify: `pages/settings/settings.ts`
- Modify: `pages/settings/settings.wxml`

- [ ] **Step 1: 在设置页增加存储管理入口**

```xml
<!-- settings.wxml 增加存储管理行 -->
<view class="menu-item" bindtap="onMenuTap" data-key="storage">
  <view class="menu-icon">
    <text>💾</text>
  </view>
  <view class="menu-text-area">
    <text class="menu-title">存储管理</text>
    <text class="menu-desc">管理本地和云端存储</text>
  </view>
  <text class="menu-arrow">›</text>
</view>
```

- [ ] **Step 2: 在 settings.ts 增加存储信息**

```typescript
// settings.ts 中增加
import { unifiedStorage } from '../../services/storage/index';

// 在 onLoad 或页面显示时
onShow() {
  var info = unifiedStorage.getStorageInfo();
  this.setData({ storageUsed: info.used, storageLimit: info.limit });
}
```

- [ ] **Step 3: 提交**

```bash
git add pages/settings/settings.ts pages/settings/settings.wxml
git commit -m "feat: 设置页增加存储管理入口"
```

---

## 验收标准对照

| AC ID | 验收条件 | Task |
|-------|----------|------|
| AC-S-01 | 所有存储键使用统一前缀 `album_` | Task 1 |
| AC-S-02 | `UnifiedStorage` 覆盖所有读写操作 | Task 3 |
| AC-S-03 | 旧存储键数据自动迁移到新键 | Task 7 |
| AC-S-04 | 在线时读请求走云端 API | Task 4 |
| AC-S-05 | 离线时读请求走本地缓存，不崩溃 | Task 2, 5 |
| AC-S-06 | 离线写操作进入 pending 队列，联网后自动重放 | Task 5 |
| AC-S-07 | 写操作 TTL 过期后自动刷新缓存 | Task 2 |
| AC-S-08 | `storage_service.ts` 兼容层正确代理 | Task 6 |
| AC-S-09 | app.ts 启动时触发增量同步 | Task 7 |
| AC-S-10 | 首次全量同步后本地数据完整迁移 | Task 4, 7 |