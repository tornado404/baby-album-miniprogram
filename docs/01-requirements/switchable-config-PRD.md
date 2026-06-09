# 可切换 API 服务器配置 PRD

> **版本**: v1.0 | **最后更新**: 2026-06-08
> **状态**: 📝 设计阶段
> **配套**: `docs/01-requirements/integration-PRD.md`（前后端联调需求）、`miniprogram/config/api.ts`（当前配置实现）、`miniprogram/services/request.ts`（请求封装层）

---

## 1. 概述

### 1.1 背景

当前小程序前端通过 `miniprogram/config/api.ts` 维护了三种环境配置（development/testing/production），但环境切换方式为 **修改源码中的 `CURRENT_ENV` 常量并重新编译 TypeScript**。这一方案在以下场景中存在明显痛点：

| 场景 | 问题 |
|------|------|
| 本地开发调试 | 需改代码切到 `localhost`，调试完再改回 `testing` |
| 多人协作测试 | 各自的本地环境 IP 不同，每次拉取代码需改配置 |
| CI/CD 构建 | 无法通过环境变量或参数注入目标服务器地址 |
| 代码审查 | 配置变更混入功能提交，PR diff 不干净 |
| 应急切换 | 线上问题需快速回切到备用服务器，无法热切换 |

### 1.2 目标

建立一套 **灵活、可切换、无需改代码** 的多环境 API 配置机制，满足以下要求：

1. **免改代码切换**：开发者可在不修改 TypeScript 源码的前提下切换 API 目标
2. **支持三个环境**：本地开发（localhost）、测试服务器（云服务器）、生产环境（正式域名）
3. **编译时注入**：支持 CI/CD 构建时指定目标环境
4. **运行时切换**：支持在微信开发者工具中通过可视化方式切换（调试用）
5. **统一配置入口**：所有模块（app.ts、request.ts、各 API service）统一读取同一配置源
6. **向后兼容**：已有功能不因配置改造而受影响

---

## 2. 当前架构分析

### 2.1 配置现状

```
miniprogram/config/api.ts
├── CONFIGS = {                    ← 三个环境配置
│     development: { baseURL: 'http://localhost:8000/api/v1' },
│     testing:     { baseURL: 'http://101.126.41.146:8000/api/v1' },
│     production:  { baseURL: 'https://api.baby-album.com/api/v1' },
│   }
├── CURRENT_ENV = 'testing'        ← 手工改源码切换
└── API_CONFIG = CONFIGS[CURRENT_ENV]  ← 导出给 request.ts 使用
```

### 2.2 配置消费方

| 文件 | 当前使用方式 | 是否有硬编码 |
|------|-------------|-------------|
| `services/request.ts` | `import { API_CONFIG } from '../config/api'` | ✅ 优雅使用 |
| `app.ts` | `const API_BASE = 'http://101.126.41.146:8000/api/v1'` | ❌ 硬编码地址 |
| `config/api.ts` 自身 | 定义了 CONFIGS 和 CURRENT_ENV | ✅ 尚可，但切换不便 |
| 各 API service 文件 | 通过 request 调用相对路径 | ✅ 无硬编码 |

### 2.3 服务端配置现状

| 文件 | 机制 | 是否支持切换 |
|------|------|-------------|
| `server/app/config.py` | Pydantic Settings + `.env` 文件 + 环境变量覆盖 | ✅ 灵活 |
| `server/.env.example` | 模板，需复制为 `.env` 使用 | ✅ |
| `server/docker-compose.yml` | `env_file: .env` 加载环境变量 | ✅ |

服务端已支持通过 `.env` 和环境变量切换配置，**本次重点在小程序前端**。

---

## 3. 需求详述

### 3.1 功能需求

#### FR-01: 多环境配置定义

在 `config/api.ts` 中定义三套完整的环境配置：

```typescript
interface ApiConfig {
  baseURL: string;      // API 基础地址
  timeout: number;      // 请求超时时间
  name: string;         // 环境名称（显示用）
  desc: string;         // 环境描述（显示用）
}
```

| 环境 | baseURL | 用途 |
|------|---------|------|
| `development` | `http://localhost:8000/api/v1` | 本地 Docker 开发环境 |
| `testing` | `http://101.126.41.146:8000/api/v1` | 云服务器测试环境 |
| `production` | `https://api.baby-album.com/api/v1` | 正式生产环境 |

#### FR-02: 编译时环境注入

通过微信小程序 `project.config.json` 的 `define` 字段或构建脚本传递 `ENV` 参数：

```bash
# 构建时指定环境
npm run build --env=testing
npm run build:production
npm run build:development
```

编译时注入方式（二选一）：
- **方案 A**：`project.config.json` 中 `setting.define` 字段定义编译常量
- **方案 B**：通过 `scripts/build.js` 构建脚本在编译前写入环境标识

#### FR-03: 运行时配置切换（开发者模式）

在微信开发者工具调试时，可通过以下方式之一切换环境：

- **方式一（推荐）**：利用微信开发者工具的自定义编译模式，在"编译配置"中传入 `env` 参数
- **方式二**：在 `项目根目录/env.config.json` 中指定当前环境，该文件列入 `.gitignore`
- **方式三**：在 app 内提供一个"开发者面板"（调试用，仅在 `DEBUG` 模式下显示），通过下拉选择切换环境

**注意**：运行时切换仅在 `development` 编译模式下可用，`testing`/`production` 编译模式下禁用切换能力。

#### FR-04: app.ts 配置统一化

`app.ts` 中的硬编码 `API_BASE` 替换为从 `config/api.ts` 读取：

```typescript
// 当前（硬编码）
const API_BASE = 'http://101.126.41.146:8000/api/v1';

// 目标（统一配置）
import { API_CONFIG } from './config/api';
// 使用 API_CONFIG.baseURL
```

#### FR-05: 配置缓存与持久化

运行时切换的环境选择应持久化到 `wx.setStorageSync`，下次启动自动加载：

| 存储 Key | 类型 | 说明 |
|----------|------|------|
| `baby_diary_env_config` | `{ env: string, timestamp: number }` | 当前选中的环境 + 切换时间戳 |

#### FR-06: 服务端 MinIO 端点可配置

服务端 `config.py` 中 MinIO 端点目前硬编码为云服务器 IP。需支持通过环境变量切换：

| 环境 | MinIO Endpoint | .env 配置 |
|------|----------------|-----------|
| 本地开发 | `localhost:9000` | `MINIO_ENDPOINT=localhost:9000` |
| 测试/生产 | `101.126.41.146:9000` | `MINIO_ENDPOINT=101.126.41.146:9000` |

当前 `config.py` 已通过 `pydantic-settings` 支持 `.env` 加载，只需确保 `.env` 在不同环境中有正确的值。

### 3.2 非功能需求

| ID | 需求 | 说明 |
|----|------|------|
| NFR-01 | **零侵入** | 不改动各 API service 文件中的相对路径调用 |
| NFR-02 | **向后兼容** | 现有代码不做大范围重构，仅改动配置中心 |
| NFR-03 | **安全** | 生产构建中禁用运行时切换能力 |
| NFR-04 | **可追溯** | 每次切环境在 console 输出日志 |

---

## 4. 方案设计

### 4.1 架构方案对比

| 方案 | 描述 | 优点 | 缺点 | 推荐度 |
|------|------|------|------|--------|
| **A. 编译常量注入** | 使用 WeChat `define` 编译时替换 | ✅ 零运行时开销<br>✅ 生产安全 | ❌ 切换需重新编译<br>❌ 配置流程较复杂 | ⭐⭐⭐ |
| **B. 运行时 + 存储持久化** | 从 wx storage 读取 env 配置，提供切换 UI | ✅ 热切换<br>✅ 开发者友好 | ❌ 额外运行时判断<br>❌ DEBUG/生产需区分 | ⭐⭐⭐⭐⭐ |
| **C. 环境文件 + gitignore** | 读取项目根目录 `env.config.json`（列入 .gitignore） | ✅ 本地化配置<br>✅ 不污染代码 | ❌ 不适合 CI/CD<br>❌ 多人共享需额外协调 | ⭐⭐ |
| **D. 混合方案** | 编译时默认 + 运行时覆盖开发环境 | ✅ 兼具两者优点 | ✅ 实现稍复杂 | ⭐⭐⭐⭐⭐ |

**推荐方案 D（混合方案）**：
- **构建/CI 时**：通过编译常量注入默认环境
- **开发调试时**：通过持久化存储覆盖运行时环境
- **生产构建**：禁用运行时切换，固定为生产配置

### 4.2 配置解析优先级

```
编译常量 DEFAULT_ENV (若存在)
    ↓ 未设置
wx.getStorageSync('baby_diary_env_config') (运行时切换)
    ↓ 未设置或不合法
config/api.ts 中的 compileTimeDefault
    ↓ 未设置
硬编码默认值 'testing'
```

### 4.3 核心模块设计

#### 4.3.1 `config/api.ts` — 配置中心

```typescript
// config/api.ts - API 环境配置中心
// 支持编译时注入 + 运行时切换的混合方案

interface ApiConfig {
  baseURL: string;
  timeout: number;
  name: string;
  desc: string;
}

interface EnvConfig {
  env: string;
  timestamp: number;
}

type Env = 'development' | 'testing' | 'production';

const CONFIGS: Record<Env, ApiConfig> = {
  development: {
    baseURL: 'http://localhost:8000/api/v1',
    timeout: 15000,
    name: '本地开发',
    desc: '本地 Docker Compose 环境',
  },
  testing: {
    baseURL: 'http://101.126.41.146:8000/api/v1',
    timeout: 15000,
    name: '测试服务器',
    desc: '云服务器测试环境',
  },
  production: {
    baseURL: 'https://api.baby-album.com/api/v1',
    timeout: 20000,
    name: '生产环境',
    desc: '正式上线环境',
  },
};

/**
 * 编译时默认环境
 * 由构建脚本或 project.config.json 的 define 注入
 * 例如: DEFAULT_ENV = 'testing'
 */
declare var DEFAULT_ENV: Env | undefined;

/**
 * 获取当前生效的环境 key
 */
function getCurrentEnv(): Env {
  // 1. 优先编译常量（CI/CD 构建时注入）
  if (typeof DEFAULT_ENV !== 'undefined' && CONFIGS[DEFAULT_ENV]) {
    return DEFAULT_ENV;
  }

  // 2. 读取运行时持久化配置（开发调试时使用）
  try {
    var saved: EnvConfig = wx.getStorageSync('baby_diary_env_config');
    if (saved && saved.env && CONFIGS[saved.env]) {
      return saved.env;
    }
  } catch (e) {}

  // 3. 回退默认值
  return 'testing';
}

/** 当前环境是否允许运行时切换（仅 development 编译模式或 DEBUG 构建） */
function isEnvSwitchable(): boolean {
  // 生产构建禁用运行时切换
  if (typeof DEFAULT_ENV !== 'undefined' && DEFAULT_ENV === 'production') {
    return false;
  }
  // 或在非 production 环境下始终允许
  return true;
}

const ENV = getCurrentEnv();
export const API_CONFIG = CONFIGS[ENV];
export const CURRENT_ENV = ENV;
export const CONFIGS_MAP = CONFIGS;
export { isEnvSwitchable };
```

#### 4.3.2 `services/config_service.ts` — 配置管理服务（新增）

```typescript
// services/config_service.ts - 运行时配置切换服务
// 仅开发/调试模式可用，生产构建中不包含此文件

import { CONFIGS_MAP, CURRENT_ENV, isEnvSwitchable } from '../config/api';

const ENV_STORAGE_KEY = 'baby_diary_env_config';

type Env = 'development' | 'testing' | 'production';

interface EnvConfig {
  env: string;
  timestamp: number;
}

interface EnvOption {
  key: Env;
  name: string;
  desc: string;
}

const configService = {

  /**
   * 获取所有可用环境列表（供切换 UI 使用）
   */
  getAvailableEnvs: function (): EnvOption[] {
    var envs: EnvOption[] = [];
    var keys = Object.keys(CONFIGS_MAP);
    for (var i = 0; i < keys.length; i++) {
      var key = keys[i] as Env;
      envs.push({ key: key, name: CONFIGS_MAP[key].name, desc: CONFIGS_MAP[key].desc });
    }
    return envs;
  },

  /**
   * 获取当前环境
   */
  getCurrentEnv: function (): string {
    return CURRENT_ENV;
  },

  /**
   * 切换环境（仅开发调试模式可用）
   */
  switchTo: function (env: Env): boolean {
    if (!isEnvSwitchable()) {
      console.warn('[config] 生产环境禁止运行时切换');
      return false;
    }
    if (!CONFIGS_MAP[env]) {
      console.warn('[config] 无效环境:', env);
      return false;
    }
    try {
      wx.setStorageSync(ENV_STORAGE_KEY, { env: env, timestamp: Date.now() });
      console.log('[config] 环境已切换至:', env, CONFIGS_MAP[env].name);
      return true;
    } catch (e) {
      return false;
    }
  },

  /**
   * 清除本地配置并回退到编译时默认
   */
  resetToDefault: function (): boolean {
    try {
      wx.removeStorageSync(ENV_STORAGE_KEY);
      return true;
    } catch (e) {
      return false;
    }
  },

  /**
   * 切换后需要重新启动小程序才能生效
   */
  getSwitchTip: function (): string {
    return '环境切换成功，请重启小程序后生效';
  },
};

export { configService };
export default configService;
```

#### 4.3.3 `miniprogram/app.ts` — 改造后

```typescript
// app.ts - 应用入口，使用统一配置
// @ts-nocheck

import { API_CONFIG } from './config/api';

App({
  globalData: {
    env: API_CONFIG.name,
  },

  onLaunch() {
    console.log('[app] 当前环境:', API_CONFIG.name, API_CONFIG.baseURL);
    this.checkToken();
  },

  checkToken() {
    var token = '';
    var that = this;
    try { token = wx.getStorageSync('baby_diary_access_token') || ''; } catch (e) {}

    if (!token) return;

    wx.request({
      url: API_CONFIG.baseURL + '/auth/me',
      method: 'GET',
      header: { 'Authorization': 'Bearer ' + token },
      success: function (res) {
        if (res.statusCode === 401) {
          that.refreshToken();
        }
      },
      fail: function () {},
    });
  },

  refreshToken() {
    var refreshToken = '';
    try { refreshToken = wx.getStorageSync('baby_diary_refresh_token') || ''; } catch (e) {}
    if (!refreshToken) return;

    wx.request({
      url: API_CONFIG.baseURL + '/auth/refresh',
      method: 'POST',
      data: { refreshToken: refreshToken },
      success: function (res) {
        if (res.statusCode === 200 && res.data && res.data.accessToken) {
          wx.setStorageSync('baby_diary_access_token', res.data.accessToken);
        }
      },
      fail: function () {},
    });
  },
});
```

### 4.4 开发者工具集成

#### 4.4.1 自定义编译模式

在 `project.config.json` 中配置三种编译模式：

```json
{
  "condition": {
    "plugin": {},
    "game": {},
    "gamePlugin": {},
    "miniprogram": {
      "list": [
        {
          "name": "本地开发 (development)",
          "pathName": "pages/album_home/album_home",
          "query": "",
          "scene": null
        },
        {
          "name": "测试服务器 (testing)",
          "pathName": "pages/album_home/album_home",
          "query": "",
          "scene": null
        },
        {
          "name": "生产构建 (production)",
          "pathName": "pages/album_home/album_home",
          "query": "",
          "scene": null
        }
      ],
      "current": -1
    }
  }
}
```

#### 4.4.2 构建脚本

新增 `NODE_ENV` 参数构建模式：

| NPM Script | 说明 |
|------------|------|
| `npm run build:dev` | 开发构建，默认 localhost |
| `npm run build:test` | 测试构建，指向云服务器 |
| `npm run build:prod` | 生产构建，指向正式域名 |

---

## 5. 实现计划

### Phase 1: 配置中心改造（P0, ~1 天）

**目标**：改造 `config/api.ts` 为支持编译常量和运行时切换的混合方案。

| 任务 | 说明 |
|------|------|
| 1.1 | 重新设计 `api.ts`：新增 `getCurrentEnv()`、`isEnvSwitchable()` 函数，增加环境元信息 |
| 1.2 | 编写单元测试覆盖：正常读取、存储覆盖、缺省回退、非法值处理 |
| 1.3 | 更新 `services/request.ts` 导入路径（不改动逻辑） |
| 1.4 | 验证：所有 API service 文件正常运行 |

### Phase 2: app.ts 统一配置（P0, ~0.5 天）

**目标**：消除 `app.ts` 中的硬编码 `API_BASE`。

| 任务 | 说明 |
|------|------|
| 2.1 | 将 `app.ts` 中的 `API_BASE` 改为从 `config/api.ts` 导入 |
| 2.2 | 验证：token 检测、刷新功能正常 |

### Phase 3: 运行时切换服务（P1, ~0.5 天）

**目标**：实现 `config_service.ts`，提供环境切换能力。

| 任务 | 说明 |
|------|------|
| 3.1 | 创建 `services/config_service.ts`：getAvailableEnvs、switchTo、resetToDefault |
| 3.2 | 配置 storage 持久化：读写 `baby_diary_env_config` |
| 3.3 | 验证：手动调用 switchTo 后，重启取到正确环境 |

### Phase 4: 开发者面板 UI（P1, ~0.5 天）

**目标**：在设置页中添加环境切换面板（调试用）。

| 任务 | 说明 |
|------|------|
| 4.1 | 在 `pages/settings/settings` 中添加"开发者设置"区块 |
| 4.2 | 实现环境选择器（Picker 组件或 TDesign 的 Radio Group） |
| 4.3 | 切换后弹出提示"请重启小程序生效" |

### Phase 5: 构建脚本 + CI/CD（P1, ~0.5 天）

**目标**：支持编译时环境注入。

| 任务 | 说明 |
|------|------|
| 5.1 | 新增 `scripts/build.js`：写入编译常量 DEFAULT_ENV |
| 5.2 | 更新 `package.json` scripts：build:dev / build:test / build:prod |
| 5.3 | 更新 CI 配置（`.github/workflows/`）：构建时传递 env 参数 |

### Phase 6: 服务端 MinIO 配置检查（P2, ~0.5 天） 

**目标**：确保服务端 MinIO 端点可随环境切换。

| 任务 | 说明 |
|------|------|
| 6.1 | 检查 `server/app/config.py` 中 MinIO 配置是否已通过环境变量管理 |
| 6.2 | 补充 `.env.example` 中不同环境的 MinIO 端点注释说明 |
| 6.3 | 在 `server/docker-compose.yml` 中添加注释提示 |

---

## 6. 验收标准

### Acceptance Criteria

| ID | 验收条件 | 关联需求 |
|----|----------|----------|
| AC-01 | 不修改任何 `.ts` 源文件，通过 storage 配置即可切换 API 目标 | FR-01, FR-03 |
| AC-02 | 切换环境后重启小程序，所有 API 请求指向新环境 | FR-03, FR-05 |
| AC-03 | `app.ts` 中不再出现硬编码的 API 地址 | FR-04 |
| AC-04 | 生产构建（编译常量 `DEFAULT_ENV=production`）禁用运行时切换 | FR-03, NFR-03 |
| AC-05 | 单元测试覆盖：环境读取优先级、持久化读写、非法值处理 | NFR-02 |
| AC-06 | 设置页中可看到"开发者设置"模块（仅在开发模式下展示） | FR-03 |
| AC-07 | 构建脚本 `npm run build:test` 产出指向测试服务器的包 | FR-02 |

---

## 7. 风险与对策

| 风险 | 影响 | 对策 |
|------|------|------|
| 微信开发者工具 `define` 字段不支持所有场景 | 编译常量注入失败 | 使用构建脚本预处理器作为 fallback |
| 开发人员误操作切换到生产环境并写入数据 | 数据污染 | 生产环境强制禁用切换，且在 UI 中明确标注 |
| 多人协作时各人本地配置被 git checkout 覆盖 | 每次拉代码丢失个人配置 | 使用 `project.private.config.json` + `.gitignore` 级别的 `env.config.json` |
| 切换环境后忘记重启导致部分请求混用配置 | 数据不一致 | 切换时强制提示 + console 日志记录当前环境 |

---

## 8. 工作量估算

| Phase | 内容 | 工时 | 前置 |
|-------|------|------|------|
| P1 | 配置中心改造（api.ts 重构） | 1 天 | — |
| P2 | app.ts 统一配置 | 0.5 天 | P1 |
| P3 | 运行时切换服务（config_service.ts） | 0.5 天 | P1 |
| P4 | 开发者面板 UI | 0.5 天 | P3 |
| P5 | 构建脚本 + CI/CD | 0.5 天 | P1 |
| P6 | 服务端 MinIO 配置检查 | 0.5 天 | — |
| **合计** | | **~3.5 天** | — |

---

## 9. 附录

### 9.1 相关文件清单

| 文件 | 操作 | 说明 |
|------|------|------|
| `miniprogram/config/api.ts` | 🔧 改造 | 新增混合环境切换逻辑 |
| `miniprogram/services/config_service.ts` | ✨ 新增 | 运行时环境切换服务 |
| `miniprogram/services/request.ts` | 🔍 检查 | 无改动预期 |
| `miniprogram/app.ts` | 🔧 改造 | 消除硬编码 API_BASE |
| `miniprogram/pages/settings/settings.ts` | 🔧 改造 | 新增开发者面板 |
| `miniprogram/pages/settings/settings.wxml` | 🔧 改造 | 开发者面板 UI |
| `miniprogram/pages/settings/settings.wxss` | 🔧 改造 | 开发者面板样式 |
| `project.config.json` | 🔧 改造 | 可选：添加自定义编译模式 |
| `package.json` | 🔧 改造 | 新增 build:dev/test/prod 脚本 |
| `scripts/build.js` | ✨ 新增 | 构建时环境注入脚本 |
| `server/.env.example` | 🔧 改造 | 补充 MinIO 环境切换注释 |

### 9.2 相关文档

- [`integration-PRD.md`](./integration-PRD.md) — 前后端联调需求文档
- `server/app/config.py` — 服务端 Pydantic Settings 配置
- `miniprogram/services/request.ts` — 请求封装（含 token 管理）