# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a WeChat Mini Program (微信小程序) for tracking baby growth and development — the **宝宝成长相册 (Baby Album)**.

### 设计目标
- 记录宝宝成长的照片/视频，带有**年龄里程碑**标注
- **Claymorphism UI** 主题：暖色调（米白底 #fffbf8）、柔和阴影、大圆角
- 设计稿来源：Figma — [宝宝成长日记 - Claymorphism UI](https://www.figma.com/design/KcqY6GUSvdn24Ur1qKkcim/%E5%AE%9D%E5%AE%9D%E6%88%90%E9%95%BF%E6%97%A5%E8%AE%B0---Claymorphism-UI)
- 组件库：TDesign（全局注册）
- 渲染策略：**album_home 使用 Skyline**，其他页面使用默认 WebView

### 当前状态
- 6个页面的 Figma Claymorphism UI 已实现
- App 有空白屏幕 + timeout 问题（需在 DevTools 中重新构建 npm、清除缓存）
- GitHub 仓库：https://github.com/tornado404/baby-album-miniprogram

## Development Environment

- **WeChat DevTools**: Required for running and debugging the miniprogram
- AppID: `wx3db22b5d6da5d38a` (in `project.config.json`，不可移除)
- 微信小程序基础库版本：`3.16.1`

### 后端测试环境
- **ARM 测试服务器**: `ssh linaro@192.168.50.126`（局域网免密开发环境）
- 后端代码（`server/`）和依赖服务（如数据库、MinIO）均部署在该服务器上
- 如果后端代码或依赖服务需要更新，直接进入该服务器操作即可（`git pull` 后重启服务）

### 后端开发环境（ARM 测试服务器）
- **本地免密开发环境**：`ssh linaro@192.168.50.126`
- 如果后端代码或依赖服务（如数据库、MinIO、Redis 等）需要更新，直接 SSH 进入服务器操作即可，无需额外配置

## Common Commands

```bash
# Run all tests
npm test

# Run unit tests only
npm run test:unit

# Run E2E tests only (requires WeChat DevTools already running)
npm run test:e2e

# Run E2E tests with auto-launch DevTools (Windows native, recommended)
npm run test:e2e:auto

# Run first-screen access test (requires DevTools running)
npm run test:first-screen

# Run first-screen access test with auto-launch DevTools (Windows native, recommended)
npm run test:first-screen:auto

# Standalone first-screen access script (no Jest, auto-launch DevTools)
npm run start:first-screen

# Capture screenshots only (requires DevTools already running with visible window)
npm run capture:first-screen

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Compile TypeScript to JavaScript (after editing .ts files)
cd miniprogram && npx tsc -p tsconfig.json
```

**Important Notes:**
- After installing or updating npm packages in `miniprogram/`, you must rebuild npm in WeChat DevTools: **工具** -> **构建 npm**
- TypeScript source files (`.ts`) must be compiled to JavaScript (`.js`) before running in the simulator. The IDE does not auto-compile on save.
- 如果修改了 `app.json` 的组件路径，需要重新构建 npm

## Project Structure

```
miniprogram/              # Main miniprogram code
├── app.ts               # App entry point
├── app.json            # App configuration (pages, window, TDesign components)
├── app.wxss            # App global styles
├── tsconfig.json       # TypeScript config for compilation
├── pages/              # Page components
│   ├── album_home/     # Album home（首页 - Skyline renderer）
│   ├── upload/         # Upload（上传页 - WebView）
│   ├── settings/       # Settings/我的（设置页 - WebView）
│   ├── baby_profile/   # Baby Profile（宝宝档案 - WebView）
│   ├── media_detail/   # Media detail（内容详情 - WebView）
│   ├── 3d_viewer/      # 3D Model viewer（3D查看 - WebView）
│   ├── index/          # Legacy home page
│   ├── logs/           # Logs page
│   └── tech_validate/  # Tech validation page
├── components/         # Reusable components
│   ├── bottom-nav/      # 底部导航（4个Tab: 首页/相册/上传/我的）
│   ├── age_filter/      # Age filter component
│   ├── masonry_layout/  # Masonry layout component
│   ├── media_card/      # Media card component
│   ├── media_uploader/  # Media uploader component
│   └── navigation-bar/  # Custom navigation bar
├── services/           # API service layer
│   ├── media_service.ts # Media operations
│   └── storage_service.ts # Storage operations
├── utils/              # Utility functions
│   ├── age_calculator.ts
│   ├── date_utils.ts
│   ├── image_utils.ts
│   └── util.ts
├── constants/          # Constants
│   ├── album_constants.ts
│   └── storage_keys.ts
├── tests/              # E2E tests
│   ├── e2e/            # E2E infrastructure (global setup/teardown)
│   ├── specs/          # E2E test specs (.spec.ts)
│   └── reports/        # Test reports (auto-created)
├── miniprogram_npm/    # Built TDesign components
└── node_modules/       # Dependencies

tests/                   # Unit tests (.test.ts)
typings/                 # TypeScript type definitions
├── index.d.ts          # Global type declarations, exports models
└── models/             # Data models
    ├── baby.ts         # Baby model
    ├── baby_age.ts     # Baby age model
    └── media.ts        # Media model
```

## 目录结构规范 (Directory Structure Convention)

新增代码或目录时必须遵循以下规范：

### 标准目录结构
每个页面/组件包含 4 个文件：
- **.ts**: 逻辑、数据、事件处理
- **.wxml**: 视图结构
- **.wxss**: 组件样式（使用类名选择器，避免 ID 和元素选择器）
- **.json**: 配置

### 命名规范
- **页面文件夹**: 小写下划线命名法 (如 `user_profile/`)
- **组件文件夹**: 小写下划线命名法 (如 `article_card/`)
- **js/ts 文件**: 与文件夹名保持一致
- **图片资源**: 小写 + 下划线 或 小写 + 连字符

## Key Technologies

### 渲染策略
- **album_home（首页）**: 使用 **Skyline Renderer**（在 `album_home.json` 中按页面配置）
- **其他所有页面**: 使用默认 **WebView** 渲染器
- **componentFramework**: `glass-easel`（全局配置）
- **Custom Navigation Bar**: `navigationStyle: custom` in app.json

### Claymorphism 主题
位于 `miniprogram/styles/variables.wxss`，所有页面通过 `app.wxss` 导入：

```css
/* 关键设计 Token */
--clay-bg: #fffbf8              /* 米白背景 */
--clay-primary: #ffa87a          /* 橙色主色调 */
--clay-card-pink: #f1dce2        /* 粉色卡片 */
--clay-card-blue: #dceaf1        /* 蓝色卡片 */
--clay-card-beige: #f4e6d6       /* 米色卡片 */
--clay-card-mint: #e2f1e6        /* 绿色卡片 */
--clay-icon-bg: #f9f0e9          /* 图标背景 */  */

/* 阴影体系（柔和暖色调） */
--clay-shadow-card: 0px 6px 16px 0px rgba(230, 198, 179, 0.35)
```

### 底部导航组件 (`bottom-nav`)
- 4个Tab: 首页 🏠 / 相册 📖 / 上传 ➕ / 我的 👤
- 活跃态橙色 `#ffa87a`，非活跃态灰色 `#999`
- 在 `app.json` 全局注册为 `bottom-nav`
- 在各页面 wxml 中通过 `<bottom-nav current="home|upload|profile">` 使用

### UI 布局铁律：右上角禁止放置业务按钮
微信小程序的**系统胶囊按钮（关闭/转发）** 位于页面右上角，因此所有页面的 **右上角区域禁止放置任何业务按钮或交互元素**，包括：
- ❌ 保存按钮
- ❌ 设置入口
- ❌ 更多操作（•••）
- ❌ 分享按钮

替代方案：
- 导航栏左侧放置返回按钮（←）
- 按钮应放置在页面内容区底部居中（如保存、提交）
- 菜单/设置入口通过底部导航Tab或列表项提供

这条规则适用于 **Figma 设计稿** 和 **小程序代码实现** 两端。
- 设计时：确保右上角无交互元素
- 编码时：检查导航栏右侧只应有装饰性 spacer，无绑定事件的按钮

### Figma 设计稿对照
所有页面 UI 基于 Figma 设计稿精确实现。在设计->代码转换时，应：

1. 使用 Figma MCP 获取设计稿代码（React+Tailwind）
2. 转换为微信小程序 wxml/wxss
3. 使用**精确的十六进制颜色值**（而非 CSS 变量引用）以确保像素级还原
4. 375px 设计稿宽度，按 1rpx = 0.5px 转换

## Important Limitations

### JavaScript Syntax Compatibility
请使用微信小程序原生语法：
- 使用 Page / Component
- 所有数据通过 setData 更新
- 不使用 Vue/React 语法
- 使用 TDesign 组件（已全局注册）
- 给出 .wxml / .js / .json / .wxss 完整结构

微信小程序不支持 ES2020+ 语法，**禁止使用**以下语法：

| 语法 | 说明 | 替代方案 |
|------|------|----------|
| `?.` | 可选链 (Optional Chaining) | `obj && obj.prop` |
| `??` | 空值合并 (Nullish Coalescing) | `val !== null ? val : default` |
| `??=` | 空值赋值 | `if (val === null) val = default` |
| `?.()` | 可选调用 | `fn && fn()` |

**注意**: TypeScript 编译时不报错，但微信小程序 runtime 会报 `SyntaxError: Unexpected token .`

### Component Configuration

- TDesign 组件只在 `app.json` 全局注册（路径需加 `miniprogram_npm/` 前缀）
- 页面/组件的 `usingComponents` 中**不要**重复配置 `miniprogram_npm/...` 路径
- 自定义组件（如 `bottom-nav`）也在 `app.json` 全局注册，路径用 `/` 开头

## TypeScript Configuration

- Strict mode enabled (`strict: true`)
- **Target: ES5** - 必须使用 ES5，微信小程序不支持 ES6+ 语法
- Type definitions in `./typings` directory
- WeChat API types from `miniprogram-api-typings` package
- Jest for testing, configured via `jest.config.js`

## E2E Testing

E2E tests use `miniprogram-automator` to control WeChat DevTools programmatically.

### Windows 原生全自动模式（推荐）

在 Windows 原生环境下一键运行，脚本自动启动开发者工具、连接、测试：

```bash
# 方式 A：通过 Jest 框架（有断言、HTML 报告）
npm run test:first-screen:auto

# 方式 B：独立脚本（纯探查输出，无 Jest 依赖）
npm run start:first-screen
```

脚本会自动完成：
1. 检测微信开发者工具是否已运行
2. 如未运行，自动通过 cli.bat 启动（自动化模式）
3. 等待端口 9420 就绪
4. 连接 miniprogram-automator
5. 跳转到首屏，读取页面数据和 DOM 元素
6. 截图保存
7. 生成结构化 JSON 报告

### Prerequisites

1. WeChat DevTools must be installed (typically at `E:\ProgramData\Tencent\微信web开发者工具\`)
2. Enable automation port in DevTools: **设置 → 安全设置 → 服务端口 → 开启**

### Windows 纯环境测试（推荐）

在 Windows 环境下直接运行，无需 WSL：

**方法一：一键运行（批处理）**
```bash
# 在 Windows CMD/PowerShell 中执行
scripts\test-automation.bat
```

**方法二：手动启动并测试**
```bash
# 1. 启动开发者工具（自动化模式）
"E:\ProgramData\Tencent\微信web开发者工具\cli.bat" auto --port 9421 --auto-port 9420 --project "D:\code\yuanBabyGrowthDiary\miniprogram"

# 2. 运行测试
node scripts\windows-test.js
```

**方法三：使用 PowerShell 脚本**
```powershell
# 启动开发者工具
.\scripts\start-automation.ps1 -StartDevTools

# 运行测试
.\scripts\start-automation.ps1 -RunTest

# 一键启动并测试
.\scripts\start-automation.ps1 -StartDevTools -RunTest
```

### Test Organization

- **Unit tests**: `tests/**/*.test.ts` and `miniprogram/tests/**/*.test.ts` (excluding e2e)
- **E2E tests**: `miniprogram/tests/specs/**/*.spec.ts`
- E2E timeout: 120 seconds per test

### Known Issues

- `miniprogram-automator` 0.12.1 has a `reLaunch` serialization bug; use `App.callWxMethod` directly
- `App.captureScreenshot` may hang if DevTools window is not visible; keep window minimized rather than headless
- WSL 2 users should use `localhost` instead of `127.0.0.1` for WebSocket connections

## Data Models

The project uses these main models (exported from `typings/models/`):
- **Baby**: Baby profile model
- **BabyAge**: Age calculation model
- **Media**: Media (photo/video) model

## TDesign 组件库

使用 `tdesign-miniprogram`（腾讯官方维护版本，兼容微信小程序），配置在 `app.json` 的 `usingComponents`：

```json
{
  "t-action-sheet": "miniprogram_npm/tdesign-miniprogram/action-sheet/action-sheet",
  "t-button": "miniprogram_npm/tdesign-miniprogram/button/button",
  "t-cell": "miniprogram_npm/tdesign-miniprogram/cell/cell",
  "t-cell-group": "miniprogram_npm/tdesign-miniprogram/cell-group/cell-group",
  "t-empty": "miniprogram_npm/tdesign-miniprogram/empty/empty",
  "t-icon": "miniprogram_npm/tdesign-miniprogram/icon/icon",
  "t-image": "miniprogram_npm/tdesign-miniprogram/image/image",
  "t-input": "miniprogram_npm/tdesign-miniprogram/input/input",
  "t-loading": "miniprogram_npm/tdesign-miniprogram/loading/loading",
  "t-navbar": "miniprogram_npm/tdesign-miniprogram/navbar/navbar",
  "t-popup": "miniprogram_npm/tdesign-miniprogram/popup/popup",
  "t-stepper": "miniprogram_npm/tdesign-miniprogram/stepper/stepper"
}
```

**安装步骤**：
1. 在 `miniprogram/` 目录下执行：`npm i tdesign-miniprogram -S --production`
2. 在微信开发者工具中：**工具** -> **构建 npm**

**重要：组件路径必须加 `miniprogram_npm/` 前缀**，否则微信小程序无法解析。

完整组件列表请参考 [TDesign 微信小程序组件库官方文档](https://tdesign.tencent.com/miniprogram/overview)

## Common Tasks

### Adding a New Page
1. Create a new folder under `miniprogram/pages/` with 4 files
2. Add the page path to `pages` array in `miniprogram/app.json`
3. 如果是 Skyline 渲染，在页面 `.json` 中配置 `"renderer": "skyline"`
4. 如果使用底部导航，在 wxml 中添加 `<bottom-nav current="tab-key"></bottom-nav>`

### Adding a Component
1. Create a new folder under `miniprogram/components/`
2. Component requires: `.ts`, `.wxml`, `.json`, `.wxss` files
3. 组件需在 `.json` 中声明 `"component": true`
4. 全局使用的组件在 `app.json` 中注册，路径用 `/components/xxx/xxx`

### Adding Global Types
- Custom type declarations go in `typings/`
- WeChat API types are in `typings/types/wx/`
- Global types should be exported from `typings/index.d.ts`

### 适配 Figma 设计稿
1. 用 Figma MCP 获取设计信息（`get_design_context` / `get_metadata`）
2. 输出为 React+Tailwind 代码
3. 转换为 wxml/wxss，使用精确的颜色/圆角/阴影值
4. 设计稿宽度 375px，对应 rpx：`1px = 2rpx`

## Known Issues & Warnings

These warnings from third-party libraries can be safely ignored:

| Warning | Source | Resolution |
|---------|--------|------------|
| `Failed to load font at.alicdn.com` | iconfont CDN | Network issue, temporary |

### 当前已知问题
1. **App 空白屏幕 + timeout** — 需在 DevTools 中执行"工具 → 构建 npm"和"清除缓存"
2. **BOM 头** — JSON 文件可能包含 BOM 头，微信开发者工具会报错。用 `sed -i '1s/^\xEF\xBB\xBF//' file.json` 修复
3. **AppID** — 必须保留在 `project.config.json` 中，迁移到 `project.private.config.json` 会导致开发者工具无法读取
4. **TypeScript 编译** — 使用 `useCompilerPlugins: ["typescript"]` 自动编译，但手动编译也可用 `npx tsc`