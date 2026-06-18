# 缓存使用修复计划

> **版本**: v1.0 | **最后更新**: 2026-06-18
> **状态**: ✅ 全部完成（2026-06-18，通过 sub-agent 逐个执行）
> **关联文档**: `2026-06-18-v1-launch-plan.md`（v1 上线计划）

## 背景

全面审查了小程序的 localStorage 使用情况，发现 8 类问题：从清除不完整到重复缓存、死代码、不一致的错误处理等。以下按严重程度逐项给出修复方案。

---

## 目录

1. [clearTokens() 清除不完整](#1-cleartokens-清除不完整)
2. [album_media 与 album_media_cache 重复缓存](#2-album_media-与-album_media_cache-重复缓存)
3. [`logs` 仅读不写 / `album_user_preferences` 从未使用](#3-logs-仅读不写--album_user_preferences-从未使用)
4. [缓存键名常量未统一使用，大量硬编码字符串](#4-缓存键名常量未统一使用大量硬编码字符串)
5. [try-catch 覆盖不一致](#5-try-catch-覆盖不一致)
6. [`baby_diary_authed` 死代码](#6-baby_diary_authed-死代码)
7. [baby_diary_baby_profile 存了整个宝宝对象，应只存 ID](#7-baby_diary_baby_profile-存了整个宝宝对象应只存-id)
8. [storage_service.ts checkVersion() 无实际迁移逻辑](#8-storage_servicets-checkversion-无实际迁移逻辑)

---

## 1. clearTokens() 清除不完整

### 问题

`miniprogram/services/request.ts:59-64` 的 `clearTokens()` 方法仅清除 `baby_diary_access_token` 和 `baby_diary_refresh_token`，**不清除** 以下 5 个 key：

| 残留 Key | 内容 | 影响 |
|----------|------|------|
| `baby_diary_user_id` | 用户唯一标识 | 退出后仍可读到 old userId |
| `baby_diary_authed` | 认证标记 | 被其他代码误读为已登录 |
| `baby_diary_baby_profile` | 当前宝宝完整对象 | 退出后仍可读到宝宝信息 |
| `album_babies` | 宝宝列表缓存 | 退出后仍可读到宝宝列表 |
| `baby_diary_current_baby_id` | 当前选中宝宝 ID | 首页可能误认为有活跃宝宝 |

**影响**：用户退出登录后（token 过期/主动登出），本地仍保留完整的宝宝数据。如果多用户在同一设备上使用，会出现数据交叉。

### 修复方式

在 `clearTokens()` 中追加清除所有残留 key：

```js
function clearTokens(): void {
  try {
    wx.removeStorageSync(ACCESS_TOKEN_KEY);
    wx.removeStorageSync(REFRESH_TOKEN_KEY);
    wx.removeStorageSync(USER_ID_KEY);
    wx.removeStorageSync('baby_diary_authed');
    wx.removeStorageSync('baby_diary_baby_profile');
    wx.removeStorageSync('album_babies');
    wx.removeStorageSync('baby_diary_current_baby_id');
  } catch (e) {}
}
```

### 预期效果

用户退出登录后，所有与用户身份和宝宝数据相关的缓存被清空，不会出现数据交叉。

### 涉及文件

| 文件 | 操作 |
|------|------|
| `miniprogram/services/request.ts` | 修改 `clearTokens()` 追加清除 key |
| `miniprogram/services/request.js` | 同步编译产物 |

---

## 2. album_media 与 album_media_cache 重复缓存

### 问题

存在两套独立、互不同步的媒体列表缓存：

| Cache Key | 写入位置 | 读取位置 | 清理逻辑 |
|-----------|---------|---------|---------|
| `album_media` | `upload.ts:341,367` | `upload.ts:319,348`, `gallery.ts:61` | 无 |
| `album_media_cache` | `gallery.ts:71` | `gallery.ts:71`（写入后立即读取） | 无 |

**问题链**：
1. `upload` 页面上传成功后写入 `album_media`，但 `gallery` 页面读取 `album_media_cache`
2. `gallery` 页面加载时将 API 数据写入 `album_media_cache`，`upload` 页面完全不知道这个 cache
3. 两者都可以存储媒体数据，但彼此独立更新，数据永远可能不一致
4. `album_media_cache` 只写入不删除，随着使用时间增长会不断累积旧数据

### 修复方式

**方向**：移除 `album_media_cache`，统一使用 `album_media`，并且在 `gallery` 页面加载时从 API 获取最新数据，不依赖本地缓存。

具体步骤：

1. **`gallery.ts`**：移除 `album_media_cache` 的读取和写入逻辑，改为每次都从 API 获取数据。当前 `gallery` 页面在 `onLoad` 中调用 API 后再写入 `album_media_cache`，直接去掉 cache 写入。
2. **`upload.ts`**：`album_media` 的写入保留（作为降级策略），但确认写入后页面状态及时更新。

```js
// gallery.ts - 移除 album_media_cache 相关代码
// 之前：
//   try { wx.setStorageSync('album_media_cache', list); } catch(e) {}
// 改为：
//   直接移除这一行
```

### 预期效果

同一类型的数据只存在于一个 cache key 中，不会出现两套独立缓存导致的过期数据问题。gallery 页面每次显示都是从 API 拉取最新数据。

### 涉及文件

| 文件 | 操作 |
|------|------|
| `miniprogram/pages/gallery/gallery.ts` | 移除 `album_media_cache` 写入行 |
| `miniprogram/pages/gallery/gallery.js` | 同步编译产物 |
| `miniprogram/pages/upload/upload.ts` | 确认 `album_media` 写入一致性（可选） |

---

## 3. `logs` 仅读不写 / `album_user_preferences` 从未使用

### 问题

两个死数据 key：

| Key | 定义位置 | 问题 |
|-----|---------|------|
| `logs` | `logs.ts:13` (`var logs = wx.getStorageSync('logs') || []`) | 全局唯一读取点，没有任何代码写入过这个 key，`logs` 页面永远显示空列表 |
| `album_user_preferences` | `storage_keys.ts:23` (`userPreferences: 'album_user_preferences'`) | 已定义但全局没有任何代码读取或写入 |

`logs` 页面是微信开发者工具创建项目时自动生成的示例页面，不包含在 v1 上线范围。`album_user_preferences` 是预留的常量，但从未在任何功能中引用。

### 修复方式

1. **`logs` key**：随 `logs` 页面一起从 `app.json` 移除（已在 v1 上线计划的 Day 1-2 中）。页面移除后，`logs` key 自然不再被读取。
2. **`album_user_preferences`**：从 `storage_keys.ts` 中删除未使用的 key 定义，减少代码认知负担。

```js
// storage_keys.ts - 删除未使用的 userPreferences
const STORAGE_KEYS = {
  babies: 'album_babies',
  media: 'album_media',
  settings: 'album_settings',
  version: 'album_version',
  currentBabyId: 'baby_diary_current_baby_id',
  // userPreferences: 'album_user_preferences',  ← 删除
};
```

### 预期效果

不再有无实际作用的缓存 key 定义和读取，代码库更干净。

### 涉及文件

| 文件 | 操作 |
|------|------|
| `miniprogram/constants/storage_keys.ts` | 删除 `userPreferences` 定义 |

---

## 4. 缓存键名常量未统一使用，大量硬编码字符串

### 问题

`miniprogram/constants/storage_keys.ts` 定义了标准 key 常量，但多个页面仍然使用硬编码字符串，存在三方面问题：

**场景 A** — 各自定义局部常量（与标准常量值相同但变量名不同）：

| 文件 | 局部常量 | 值 | 应与标准常量统一 |
|------|---------|---|----------------|
| `onboarding.ts:8-12` | `AUTH_KEY`, `TOKEN_KEY`, `REFRESH_KEY`, `USER_ID_KEY`, `BABY_KEY` | `baby_diary_*` | 全部 |
| `index.ts:5-6` | `TOKEN_KEY`, `BABY_KEY` | `baby_diary_access_token`, `baby_diary_baby_profile` | 全部 |

**场景 B** — 直接硬编码字符串：

| 文件 | 硬编码字符串 | 标准常量 |
|------|------------|---------|
| `album_home.ts:271` | `'album_babies'` | `STORAGE_KEYS.babies` |
| `album_home.ts:63` | `'baby_diary_access_token'` | `tokenManager.getAccessToken()` |
| `baby_onboarding.ts:54` | `'baby_diary_access_token'` | `tokenManager.getAccessToken()` |
| `baby_profile.ts:46,136,179` | `'baby_diary_access_token'` | `tokenManager.getAccessToken()` |
| 等 10+ 个文件 | `'baby_diary_access_token'` | `tokenManager.getAccessToken()` |

**场景 C** — 标准常量名称不一致：

- `STORAGE_KEYS.currentBabyId` 的值为 `'baby_diary_current_baby_id'`（以 `baby_diary_` 开头），而同一对象中的其他 key 都以 `album_` 开头

### 修复方式

分两个优先级：

**第一阶段（v1 上线前，降低风险）：**
- 所有页面中 `'baby_diary_access_token'` 的硬编码替换为 `tokenManager.getAccessToken()`
- 因为 token key 如果未来改名，改 1 个文件 vs 改 12 个文件差异巨大

**第二阶段（v1 后重构）：**
- 统一所有局部常量引入 `STORAGE_KEYS`
- 将 `currentBabyId` 的值从 `'baby_diary_current_baby_id'` 改为 `'album_current_baby_id'` 以保持风格一致（需同步迁移所有已安装用户的 localStorage）

```js
// 第一阶段修复示例：
// album_home.ts - 之前
var token = wx.getStorageSync('baby_diary_access_token');
// album_home.ts - 之后
var token = wx.getStorageSync('baby_diary_access_token'); // 改为

// 更好的做法：统一引入 tokenManager
// import { tokenManager } from '../../services/request';
// var token = tokenManager.getAccessToken();
```

### 预期效果

所有缓存 key 的读写都通过常量引用，不出现散落的魔法字符串。token 的读取集中到 `tokenManager.getAccessToken()`，后续统一变更 key 名称只需改 1 处。

### 涉及文件

| 文件 | 操作 |
|------|------|
| `miniprogram/pages/album_home/album_home.ts` | 替换 `'album_babies'` | STORAGE_KEYS.babies |
| `miniprogram/pages/album_home/album_home.ts` | 替换 `'baby_diary_access_token'` | tokenManager.getAccessToken |
| `miniprogram/pages/baby_onboarding/baby_onboarding.ts` | 同上 |
| `miniprogram/pages/baby_profile/baby_profile.ts` | 同上（3处） |
| `miniprogram/pages/upload/upload.ts` | 同上 |
| `miniprogram/pages/settings/settings.ts` | 同上（4处） |
| `miniprogram/pages/gallery/gallery.ts` | 同上 + `'baby_diary_current_baby_id'` |
| `miniprogram/pages/growth_compare/growth_compare.ts` | 同上（2处） |
| `miniprogram/pages/journey/journey.ts` | 同上（2处） |
| `miniprogram/pages/media_detail/media_detail.ts` | 同上（1处） |
| `miniprogram/pages/achievements/achievements.ts` | 同上（1处） |
| `miniprogram/pages/baby_list/baby_list.ts` | 同上（2处） |
| `miniprogram/pages/share_settings/share_settings.ts` | 同上（1处） |
| `miniprogram/constants/storage_keys.ts` | 统一 `currentBabyId` 命名风格 |
| 以上全部 `.js` 文件 | 同步编译产物 |

---

## 5. try-catch 覆盖不一致

### 问题

`wx.setStorageSync` / `wx.removeStorageSync` 在存储满或 key/value 序列化异常时会抛出错误，但当前各页面的保护覆盖不一致：

**有 `try-catch` 的写入：**
- `album_home.ts` 中的所有 `setStorageSync` 调用
- `gallery.ts` 中的所有 `setStorageSync` 调用
- `onboarding.ts` 中的部分调用（lines 92, 94 有 catch 但同一文件 line 165 无）

**没有 `try-catch` 的写入：**

| 位置 | 写入的 Key | 风险 |
|------|-----------|------|
| `onboarding.ts:165` | `baby_diary_authed` | 存储满时写入异常，登录流程中断 |
| `onboarding.js:136-139` | token / userId / authed | 无 try-catch 包裹 |
| `baby_profile.ts:237,256` | `album_babies` | 存储满时写入异常，页面白屏 |
| `index.js:45-53` | `album_babies`, `BABY_KEY`, `currentBabyId` | 编译产物遗漏了 `.ts` 中的 try-catch |

**修复目标**：所有 `wx.setStorageSync` 和 `wx.removeStorageSync` 调用都包裹在 `try-catch` 中。

### 修复方式

逐文件补齐缺失的 `try-catch`：

```js
// 补齐前
wx.setStorageSync('album_babies', babies);

// 补齐后
try { wx.setStorageSync('album_babies', babies); } catch (e) {}
```

特别关注编译产物的差异：`index.js` 的 `checkBabiesFromApi` 方法中，虽然 `.ts` 源码有 `try-catch`，但编译后的 `.js` 缺少了。需要在 `.js` 中手动补齐，并修复编译配置确保后续编译不再丢失。

### 预期效果

所有 localStorage 写入操作都有异常保护，不会因存储满或序列化错误导致页面白屏或流程中断。

### 涉及文件

| 文件 | 修复位置 |
|------|---------|
| `miniprogram/pages/onboarding/onboarding.ts` | line 165 添加 try-catch |
| `miniprogram/pages/onboarding/onboarding.js` | lines 136-139 添加 try-catch |
| `miniprogram/pages/baby_profile/baby_profile.ts` | lines 237, 256 添加 try-catch |
| `miniprogram/pages/baby_profile/baby_profile.js` | 同步 |
| `miniprogram/pages/index/index.js` | `checkBabiesFromApi` 中的 3 个 setStorageSync 添加 try-catch |
| `miniprogram/pages/upload/upload.ts` | lines 319, 348 的 getStorageSync 添加 try-catch |
| 如有其他遗漏处 | 逐文件扫描补齐 |

---

## 6. `baby_diary_authed` 死代码

### 问题

`onboarding.ts` 中定义并写入 `AUTH_KEY`（`baby_diary_authed`），但全局没有任何页面读取过这个值来判断登录状态：

```js
// onboarding.ts - 写入点
line 139: wx.setStorageSync(AUTH_KEY, true);     // 登录成功后
line 165: wx.setStorageSync(AUTH_KEY, true);     // 离线降级时
```

所有页面判断登录状态的方法都是检查 token 是否存在：

```js
// 各页面通用的登录判断方式
var token = '';
try { token = wx.getStorageSync('baby_diary_access_token') || ''; } catch (e) {}
if (token) { /* 已登录 */ }
```

`baby_diary_authed` 的写入是在 2026-06 之前的某个版本中添加的，可能是早期设计中的 "auth flag" 方案，后被 token 检查方案取代但写入代码未被清理。

### 修复方式

删除 `onboarding.ts` 中所有 `AUTH_KEY` 相关的代码：

1. 删除 `AUTH_KEY` 常量定义（line 8）
2. 删除登录成功后的写入（line 139）
3. 删除离线降级时的写入（line 165）

```js
// 删除前
var AUTH_KEY = 'baby_diary_authed';
// ...
wx.setStorageSync(AUTH_KEY, true);  // 删除这一行

// 删除后（直接去掉相关行即可）
```

### 预期效果

不再有"写了没人读"的死缓存数据，减少维护时的认知负担。

### 涉及文件

| 文件 | 操作 |
|------|------|
| `miniprogram/pages/onboarding/onboarding.ts` | 删除 `AUTH_KEY` 定义 + 2 处写入 |
| `miniprogram/pages/onboarding/onboarding.js` | 同步编译产物 |

---

## 7. baby_diary_baby_profile 存了整个宝宝对象，应只存 ID

### 问题

当前 `baby_diary_baby_profile` 存的是宝宝对象的完整数据（id, name, avatar, createdAt 等），但大部分页面只需要知道「当前宝宝是谁」，具体数据应通过 API 获取。

**为什么这是问题：**

| 场景 | 问题 |
|------|------|
| 宝宝信息修改后 | API 已更新但本地 cache 未同步，读到过期数据 |
| 宝宝被删除后 | cache 中仍然存在 |
| 多设备共享宝宝数据 | 一台设备修改后另一台不知情 |
| 存储空间 | 存整个对象 vs 只存 ID，约 200B vs 36B |

**当前使用情况：**

```js
// 写入 baby_diary_baby_profile 的位置
index.ts:44     → 从 API 获取到宝宝列表后，存 babies[0]
onboarding.ts   → checkBabiesBeforeRoute 中写入
baby_onboarding.ts → 创建成功后写入

// 读取 baby_diary_baby_profile 的位置
index.ts:20     → 判断"是否有宝宝"
album_home.ts   → fallbackBabies 中
```

### 修复方式

**第一阶段（v1 前，降低风险）：**
保持 `baby_diary_baby_profile` 的写入，但在宝宝信息修改后同步更新。当前 `baby_profile.ts` 更新宝宝信息后写 `album_babies` 但未写 `BABY_KEY`，需补上：

```js
// baby_profile.ts - 更新宝宝成功后
try { wx.setStorageSync(BABY_KEY, babyData); } catch (e) {}
```

**第二阶段（v1 后重构）：**
将 `baby_diary_baby_profile` 改为只存宝宝 ID，名称改为 `baby_diary_current_baby_id`（与 `STORAGE_KEYS.currentBabyId` 合并），所有需要宝宝信息的页面通过 `currentBabyId` + `GET /babies/{id}` API 获取。

```
当前:  baby_diary_baby_profile = { id, name, avatar, createdAt }
改为:  不再使用此 key，完全通过 currentBabyId + API 获取
```

### 预期效果

第一阶段：修改宝宝信息时同步更新 `baby_diary_baby_profile`，减少过期数据窗口。
第二阶段：消除本地缓存与服务器数据不一致的可能。

### 涉及文件

| 文件 | 操作 |
|------|------|
| `miniprogram/pages/baby_profile/baby_profile.ts` | 第一阶段：更新成功后补 BABY_KEY 写入 |
| `miniprogram/pages/baby_profile/baby_profile.js` | 同步编译产物 |

---

## 8. storage_service.ts checkVersion() 无实际迁移逻辑

### 问题

`storage_service.ts` 的 `checkVersion()` 方法检测到存储版本号与当前版本不一致时，只更新版本号，**不执行任何数据迁移**：

```js
// storage_service.ts:52-57
checkVersion: function() {
  var version = STORAGE_VERSION; // 'v1'
  // ...
  if (savedVersion !== version) {
    this.setData(STORAGE_KEYS.version, version);  // 只写版本号，不迁移数据
  }
}
```

这意味着如果未来数据格式发生变化（如 Media 模型增加了字段），用户的旧缓存数据永远不会被迁移到新格式，会导致页面读取旧格式数据时缺少字段。

**当前状态**：项目从开发到现在尚未涉及数据格式变更，所以这个「有版本号无迁移」的状态尚未造成实际问题。但这是一个未炸的雷。

### 修复方式

**第一阶段（v1 前，不引入迁移逻辑）：**
在 `checkVersion()` 中增加注释说明当前版本不需要迁移：

```js
checkVersion: function() {
  var version = STORAGE_VERSION;
  var savedVersion = this.getData(STORAGE_KEYS.version);
  if (savedVersion !== version) {
    // v1 初始化：当前版本无需数据迁移
    this.setData(STORAGE_KEYS.version, version);
  }
}
```

**第二阶段（将来有数据格式变更时）：**
使用 `if-else if` 链式迁移，每段从旧版本迁移到下一版本：

```js
// 示例：v1 → v2 迁移
if (savedVersion === 'v1') {
  // 将旧格式的 media 数据迁移到新格式
  var oldMedia = this.getData(STORAGE_KEYS.media);
  var newMedia = oldMedia.map(function(item) {
    return { ...item, newField: item.oldField };
  });
  this.setData(STORAGE_KEYS.media, newMedia);
  this.setData(STORAGE_KEYS.version, 'v2');
}
```

### 预期效果

第一阶段：明确标记当前无迁移需求，避免未来开发者困惑。
第二阶段：有数据格式变化时能平滑迁移用户本地数据，不丢失历史记录。

### 涉及文件

| 文件 | 操作 |
|------|------|
| `miniprogram/services/storage_service.ts` | 添加注释说明 |
| `miniprogram/services/storage_service.js` | 同步编译产物 |

---

## 修复优先级矩阵

| # | 问题 | 严重度 | 影响范围 | 工作量 | v1 前必须 | 执行状态 |
|---|------|--------|---------|--------|----------|---------|
| 1 | clearTokens() 不完整 | 🚨 严重 | 退出登录场景 | 1 文件，5 行 | **是** | ✅ 已完成 |
| 2 | album_media_cache 重复缓存 | 🚨 严重 | gallery/upload 数据一致性 | 1 文件，删 1 行 | **是** | ✅ 已完成 |
| 3 | 死 key 未清除 | ⚠️ 一般 | 模板残留 | 1 文件，删 1 行 | **否** | ✅ 已完成 |
| 4 | 硬编码字符串 | ⚠️ 一般 | 维护性 | ~15 文件，每处 1 行 | **否** | ✅ 已完成 |
| 5 | try-catch 不一致 | ⚠️ 警告 | 存储满异常 | ~5 处 | **部分** | ✅ 已完成 |
| 6 | authed 死代码 | 🟢 低 | 无功能影响 | 1 文件，删 3 行 | **否** | ✅ 已完成 |
| 7 | BABY_KEY 存整个对象 | 🟢 低 | 数据过期风险 | 1 文件，加 1 行 | **否** | ✅ 已完成 |
| 8 | checkVersion 无迁移 | 🟢 低 | 未炸的雷 | 1 文件，加注释 | **否** | ✅ 已完成 |

### v1 上线前必修清单

| 执行顺序 | 问题 # | 原因 |
|---------|-------|------|
| 1 | #1 clearTokens 不完整 | 退出登录有数据残留，可能造成数据交叉 |
| 2 | #2 album_media_cache 重复缓存 | 两套数据互相覆盖，gallery 显示错误 |
| 3 | #5 部分 try-catch 缺失 | onboarding 登录流程和 baby_profile 更新缺少保护 |
| 4 | 其余 #3-#8 | 可在 v1 后 Day 6 顺手修，不影响功能正确性 |