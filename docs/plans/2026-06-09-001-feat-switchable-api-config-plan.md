# 可切换 API 服务器配置 — 实现计划

> **版本**: v1.1 | **最后更新**: 2026-06-09 | **更新**: U3 构建方案修正
> **状态**: ✅ 计划就绪
> **来源**: `docs/01-requirements/switchable-config-PRD.md`（需求文档）
> **目标仓库**: `baby-album-miniprogram`（根路径与此文档同）

---

## 问题陈述

小程序前端目前通过 `miniprogram/config/api.ts` 维护了三套环境配置（development/testing/production），配置中心 `api.ts` 和请求封装层 `request.ts` 已按混合方案（编译常量 + 运行时切换）改造完成，但以下模块尚未落地：

1. **运行时切换服务** — `config_service.ts` 未创建，缺乏切换环境的编程接口
2. **设置页硬编码** — `settings.ts` 仍使用硬编码 `API_BASE`，未接入统一配置
3. **开发者面板** — 设置页缺少环境切换 UI
4. **构建脚本** — 无 `scripts/build.js`，无法在 CI/CD 中注入编译常量
5. **服务端 MinIO 端点** — 硬编码为云服务器 IP，本地开发需手动修改

---

## 需求追踪

| 需求 ID | 描述 | 关联单元 |
|---------|------|---------|
| FR-01 | 多环境配置定义 | 已完成 |
| FR-02 | 编译时环境注入 | U3, U4 |
| FR-03 | 运行时配置切换（开发者模式） | U1, U2 |
| FR-04 | app.ts 配置统一化 | 已完成 |
| FR-05 | 配置缓存与持久化 | U1 |
| FR-06 | 服务端 MinIO 端点可配置 | U5 |
| NFR-01 | 零侵入（不改各 API service） | U1, U2 |
| NFR-02 | 向后兼容 | U1-U5 |
| NFR-03 | 生产构建禁用运行时切换 | U1, U3 |
| NFR-04 | 切换日志可追溯 | U1, U2 |

---

## 实施单元

### U1. 运行时配置切换服务

**目标**：创建 `services/config_service.ts`，提供切换/查询/重置环境的编程接口，支持 `wx.setStorageSync` 持久化。

**依赖**：无（基于已完成的 `config/api.ts`）

**文件**：
- ✨ 新增 `miniprogram/services/config_service.ts`
- ✨ 新增 `tests/config_service.test.ts`

**方案**：
- 遵循 PRD §4.3.2 的设计，实现以下 API：
  - `getAvailableEnvs(): EnvOption[]` — 返回所有环境列表供 UI 渲染
  - `getCurrentEnv(): string` — 返回当前环境名
  - `switchTo(env): boolean` — 持久化环境选择（仅在 `isEnvSwitchable()` 为 true 时生效）
  - `resetToDefault(): boolean` — 清除本地配置，回退到编译时默认
  - `getSwitchTip(): string` — 返回切换后提示文字
- 存储 key 使用 `api.ts` 导出的 `ENV_STORAGE_KEY`（`baby_diary_env_config`）
- 切换时记录 `console.log` 日志（满足 NFR-04）
- **重要**：切换后不会立即生效，需提示用户重启小程序（`wx.exitMiniProgram` 或用户手动重启）

**模式参考**：遵循 `services/` 下已有 service 的模式（如 `storage_service.ts`），使用 TypeScript 命名空间导出，ES5 兼容语法。

**测试场景**：

| # | 场景 | 输入/动作 | 预期结果 |
|---|------|-----------|---------|
| 1 | 获取可用环境列表 | 调用 `getAvailableEnvs()` | 返回 3 个环境，每个含 key/name/desc |
| 2 | 获取当前环境 | 当前为 `testing` | 返回 `'testing'` |
| 3 | 切换到合法环境 | `switchTo('development')` | 返回 true，storage 写入正确值 |
| 4 | 切换到非法环境 | `switchTo('invalid')` | 返回 false，storage 不变 |
| 5 | 生产构建下禁止切换 | `isEnvSwitchable()` 为 false | `switchTo()` 返回 false |
| 6 | 重置到默认 | 有 storage 配置时 `resetToDefault()` | storage 中被移除，返回 true |
| 7 | 切换提示文字 | 调用 `getSwitchTip()` | 返回非空字符串 |

**验证**：单测全部通过 `npm test -- --testPathPattern=config_service`；手动调用各 API 返回预期值。

---

### U2. 设置页集成开发者面板

**目标**：消除 `settings.ts` 中的硬编码 `API_BASE`，在设置页底部新增"开发者设置"区块，提供可视化环境切换能力。

**依赖**：U1（config_service.ts 完成）

**文件**：
- 🔧 修改 `miniprogram/pages/settings/settings.ts` — 替换硬编码 URL，新增开发者面板逻辑
- 🔧 修改 `miniprogram/pages/settings/settings.wxml` — 添加开发者面板 UI
- 🔧 修改 `miniprogram/pages/settings/settings.wxss` — 开发者面板 Claymorphism 样式
- 🔧 修改 `miniprogram/pages/settings/settings.json` — 无需改动（TDesign 组件已全局注册）

**方案**：

**settings.ts 改造**：
1. 移除第 4 行 `const API_BASE = 'http://101.126.41.146:8000/api/v1'`
2. 导入 `import { API_CONFIG } from '../../config/api'` 和 `import { configService } from '../../services/config_service'`
3. `loadStats()` 中的 `wx.request` 使用 `API_CONFIG.baseURL` 替换硬编码
4. 新增 `data` 字段：`envName`, `envDesc`, `environments: []`, `showEnvPicker: false`
5. 新增 `onShow()` 生命周期读取当前环境信息
6. 新增事件处理：
   - `onEnvSwitch()` — 打开环境选择器 Popup
   - `onEnvSelect(e)` — 选择新环境，调用 `configService.switchTo(env)`，显示 Toast 提示"切换成功，请重启小程序"
   - `onConfirmRestart()` — 点击确认后调用 `wx.exitMiniProgram()`

**wxml 改造**：
在 `</scroll-view>` 前（"关于"菜单之后）追加开发者设置区块：

```
<!-- 分割线 -->
<!-- 开发者设置区块 -->
  - 标题行：🛠 开发者设置（右侧显示当前环境名）
  - 环境选择行：点击触发 onEnvSwitch，显示当前环境
  - 使用 TDesign t-popup 从底部弹出 picker
  - 弹窗中显示环境列表（Radio Group 样式），选中态高亮
  - 底部"确认切换"按钮，点击触发 onEnvSelect
  - 切换后显示提示弹窗"环境已切换至 XXX，是否立即重启？"
    - 确认按钮 → 重启
    - 取消按钮 → 稍后手动重启
```

**wxss**：
遵循 Claymorphism 风格，使用 `--clay-card-white`, `--clay-shadow-card`, `--clay-primary` 等 CSS 变量。开发者设置区块配色略深于普通菜单项以作区分。

**测试场景**：

| # | 场景 | 动作 | 预期 |
|---|------|------|------|
| 1 | 页面加载显示当前环境 | 进入设置页 | 开发者设置行显示当前环境名 |
| 2 | 点开发者设置打开选择器 | 点击"开发者设置"行 | 底部弹出环境列表 Popup |
| 3 | 切换环境 | 选择"本地开发"→点确认 | Toast 提示"切换成功，请重启小程序" |
| 4 | 确认重启 | 点"立即重启"按钮 | 小程序退出（wx.exitMiniProgram） |
| 5 | 取消重启 | 点"稍后重启" | 弹窗关闭，无操作 |
| 6 | 生产构建隐藏开发者面板 | DEFAULT_ENV=production | 开发者设置区块不可见 |

**验证**：在微信开发者工具中手动操作全流程；`settings.ts` 中无硬编码 API 地址残留；编译通过无语法错误。

---

### U3. 构建脚本与 NPM Scripts

**目标**：创建 `scripts/build.js`，通过标准 `project.config.json setting.define` 机制注入 `DEFAULT_ENV` 编译常量。更新 `package.json` 脚本。

**依赖**：无

**文件**：
- ✨ 新增 `scripts/build.js`
- 🔧 修改 `package.json` — 新增 `build:dev` / `build:test` / `build:prod` 脚本
- 🔧 修改 `project.config.json` — 构建时临时注入 `setting.define.DEFAULT_ENV`（脚本自动处理）

**方案**：

利用微信小程序官方提供的 `project.config.json` 的 `setting.define` 字段注入编译常量。`define` 中的键值会在 `miniprogram-ci` 打包时进行全局替换，对最终构建产物完全生效。

**scripts/build.js** 设计：
- `node scripts/build.js <env>` 格式调用
- 流程：
  1. 读取 `project.config.json`
  2. 在校验 env 合法后，在 `setting` 下注入 `define: { DEFAULT_ENV: "\"testing\"" }`
     - 注意 define 值是**双重转义**的 JSON 字符串：外层的 `""` 是 JSON 语法，内层的 `\"\"` 确保替换后的 JS 值为字符串字面量
  3. （可选）调用 `miniprogram-ci` 进行构建
  4. 构建完成后，将 `project.config.json` 恢复原状
- 使用 `path.resolve` 处理跨平台路径
- 环境校验：仅接受 `development`/`testing`/`production` 三者之一
- 错误处理：无效参数打印帮助信息并 exit(1)

**为什么此方案可靠**：

> 计划 v1.0 曾提出生成 `.env-build.json` 文件由运行时读取，该方案存在**严重缺陷**——微信小程序生产包无项目文件系统可读，运行时文件 I/O 在打包后不工作。
>
> 修正方案使用标准 `setting.define` 机制，它在 `miniprogram-ci` 打包流程中生效，是微信小程序编译常量的官方推荐做法。
>
> `define` 对 DevTools 的 TypeScript 实时编译不生效，但这不影响使用——开发人员在 DevTools 中通过 U2 面板的运行时切换来选环境。

**关键约束**：`define` 的值必须是 JS 字符串字面量，即 JSON 嵌套转义：
```
"DEFAULT_ENV": "\"testing\""
```
——外层双引号是 JSON 语法，内层 `\"testing\"` 展开为 JS 字符串 `"testing"`。

**api.ts 不改动**：现有 `declare var DEFAULT_ENV` 声明已设计为与 `define` 配合使用，无需修改。

**NPM Scripts**：

```json
"build:dev": "node scripts/build.js development",
"build:test": "node scripts/build.js testing",
"build:prod": "node scripts/build.js production",
```

**测试场景**：

| # | 场景 | 命令 | 预期 |
|---|------|------|------|
| 1 | 开发构建 | `npm run build:dev` | project.config.json 写入 `define.DEFAULT_ENV="development"`，构建后恢复 |
| 2 | 测试构建 | `npm run build:test` | project.config.json 写入 `define.DEFAULT_ENV="testing"`，构建后恢复 |
| 3 | 生产构建 | `npm run build:prod` | project.config.json 写入 `define.DEFAULT_ENV="production"`，构建后恢复 |
| 4 | 无效参数 | `node scripts/build.js`（无参数） | 打印可用环境列表及使用说明，exit code 1 |
| 5 | 非法环境 | `node scripts/build.js invalid` | 打印错误信息 + 可用环境列表，exit code 1 |
| 6 | 构建后恢复 | 运行任意 build 命令 | project.config.json 前后 diff 为空（define 字段被移除） |

**验证**：运行 `npm run build:test` 后，用 `miniprogram-ci` 打包并检查产物中 API 地址是否正确指向云服务器。

---

### U4. CI/CD 环境构建配置

**目标**：更新 GitHub Actions 工作流，支持在 CI 中构建指定环境的产物。统一 AppID 为 `wx3db22b5d6da5d38a`。

**依赖**：U3（build.js 完成）

**文件**：
- ✨ 新增 `.github/workflows/miniprogram-ci.yml`
- 🔧 修改 `scripts/ci.js` — 将 AppID 从 `wx5d0e66dc0e6fb16d` 统一为 `wx3db22b5d6da5d38a`

**方案**：
- 新增独立 workflow `.github/workflows/miniprogram-ci.yml`（与 `backend-ci.yml` 分离）
- 触发条件：push/PR 涉及 `miniprogram/**` 路径
- Job 内容：
  1. `checkout` 代码
  2. `setup-node` + `npm ci`
  3. 根据分支/事件类型决定构建环境：
     - push 到 `master` 且非 PR → `production`
     - 其他分支 push → `testing`
     - PR → `testing`（预览构建）
  4. 运行 `npm run build:test` 或 `npm run build:prod`
  5. （可选）使用 `miniprogram-ci` 进行预览/上传

**说明**：当前 `miniprogram-ci` 需要微信小程序上传密钥，仅在明确配置后启用预览/上传步骤。第一个版本仅做构建验证，不自动上传。

**测试场景**：

| # | 场景 | 触发方式 | 预期 |
|---|------|---------|------|
| 1 | miniprogram PR 触发 | 提交涉及 `miniprogram/**` 的 PR | 构建运行成功 |
| 2 | 非 miniprogram 变更 | 仅修改 `server/**` | 不触发此 workflow |
| 3 | 构建验证 | 运行 `npm ci && npm run build:test` | 无报错 |

**验证**：GitHub Actions 上 workflow 正常运行，构建步骤通过。

---

### U5. 服务端 MinIO 端点可配置化

**目标**：确保服务端 MinIO 配置在不同环境下可通过 `.env` 文件切换，无需改代码。

**依赖**：无

**文件**：
- 🔧 修改 `server/.env.example` — 补充 MinIO 多环境注释
- 🔧 检查 `server/app/config.py` — 确保 MinIO 配置已从 env 读取

**方案**：
- `server/app/config.py` 已使用 Pydantic Settings，`MINIO_ENDPOINT` 等字段默认从环境变量读取（`model_config = {"env_file": ".env"}`），无需代码改动
- 只需在 `.env.example` 中补充 MinIO 的环境切换注释，标明本地开发和云服务器两种场景的配置示例
- 当前 `MINIO_ENDPOINT = "101.126.41.146:9000"` 是硬编码默认值，但通过 `.env` 可覆盖
- 检查 `docker-compose.yml` 中是否传递了 `MINIO_ENDPOINT` 环境变量

**测试场景**：

| # | 场景 | 动作 | 预期 |
|---|------|------|------|
| 1 | 本地开发 MinIO | `.env` 中设置 `MINIO_ENDPOINT=localhost:9000` | 应用启动后使用 localhost 端点 |
| 2 | 云服务器 MinIO | `.env` 中设置 `MINIO_ENDPOINT=101.126.41.146:9000` | 应用启动后使用云服务器端点 |
| 3 | 无 `.env` | 删除 `.env` | 使用 `config.py` 中的默认值 |

**验证**：通过修改 `.env` 中 MinIO 配置，重启后端服务后生效。

---

## 边界范围

### 范围内
- `config/api.ts` 已完成的改造（验证，不修改）
- `app.ts` 已完成的改造（验证，不修改）
- `services/config_service.ts` 创建
- `settings.ts/wxml/wxss` 改造添加开发者面板
- `scripts/build.js` 创建
- `package.json` 添加构建脚本
- `.github/workflows/miniprogram-ci.yml` 创建
- `scripts/ci.js` 统一 AppID 为 `wx3db22b5d6da5d38a`
- `server/.env.example` 注释补充

### 范围外（当前不做）
- 不修改各 API service 文件中的业务逻辑（NFR-01）
- 不在首页/相册页添加环境切换入口
- 不实现 CI 自动上传到微信平台（无上传密钥）
- 不实现 OTA/远程配置下发
- 服务端 `docker-compose.yml` 不改动（已验证正确）

---

## 关键技术决策

| 决策 | 选择 | 备选 | 理由 |
|------|------|------|------|
| 编译常量注入方式 | `project.config.json` 的 `setting.define` | 生成 `.env-build.json` 运行时读取 ❌ | `define` 是微信官方编译常量注入机制，对 `miniprogram-ci` 打包生效；`.env-build.json` 在生产包中无法读取 |
| 切换生效时机 | 重启小程序 | 动态刷新所有 API 配置 | 当前架构模块级 `import` 在初始化时绑定配置，动态刷新需全量替换，风险高 |
| 开发者面板可见性 | 生产构建隐藏 | 统一显示 | 满足 NFR-03 安全要求 |
| 构建脚本语言 | Node.js（JavaScript） | TypeScript | 对齐已有 `scripts/ci.js`、`scripts/build-npm.js` 模式 |

---

## 开放问题

- **wx.exitMiniProgram 兼容性**：部分微信版本可能不支持此 API，需准备 fallback 提示"请手动关闭小程序重启"
- **构建脚本恢复原状的安全性**：`build.js` 修改 `project.config.json` 后需确保即使构建失败也能恢复，避免 `define` 字段残留在版本控制中

---

## 风险与依赖

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| `wx.exitMiniProgram` 不支持 | 用户需手动重启 | 显示手动重启引导文字 |
| 构建脚本路径兼容性 | Windows/Linux 路径处理 | 使用 `path.resolve` 处理跨平台路径 |
| 多人协作覆盖本地配置 | 个人环境配置丢失 | 使用 `project.private.config.json` 存储个人配置 |

---

## 系统影响

- **前端**：`settings.ts` 中 `API_BASE` 硬编码被消除，统一使用 `API_CONFIG`
- **后端**：无实际代码修改，仅补充文档注释
- **CI/CD**：新增独立 workflow，不影响现有后端 CI
- **开发者体验**：无需改源码即可切换 API 目标，提高协作效率

---

## 实施顺序

```
U1 (config_service.ts) ──→ U2 (settings 开发者面板)
                                      │
U3 (build.js + scripts) ──────────────┤
                                      │
U4 (CI/CD) ───────────────────────────┤
                                      │
U5 (MinIO 注释) ──────────────────────┘（可独立完成）
```