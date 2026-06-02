# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a WeChat Mini Program (微信小程序) for tracking baby growth and development. The project uses TypeScript with the Skyline renderer and glass-easel component framework.

## Development Environment

- **WeChat DevTools**: Required for running and debugging the miniprogram
- AppID: `wx3db22b5d6da5d38a` (configured in `project.config.json`)

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

## Project Structure

```
miniprogram/              # Main miniprogram code
├── app.ts               # App entry point
├── app.json            # App configuration (pages, window, TDesign components)
├── app.wxss            # App global styles
├── tsconfig.json       # TypeScript config for compilation
├── pages/              # Page components
│   ├── album_home/     # Album home page (first page in app.json)
│   ├── index/          # Home page
│   ├── logs/           # Logs page
│   ├── media_detail/   # Media detail page
│   └── tech_validate/  # Tech validation page
├── components/         # Reusable components
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

- **Skyline Renderer**: Custom rendering engine for better performance
- **glass-easel**: Component framework (configured in `app.json`)
- **Custom Navigation Bar**: Uses `navigationStyle: custom` in app.json
- **Component Isolation**: 默认样式隔离（Skyline 模式）

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

- TDesign 组件只在 `app.json` 全局注册
- 页面/组件的 `usingComponents` 中**不要**重复配置 `miniprogram_npm/...` 路径
- 微信小程序解析组件路径时相对于自身目录，会导致路径错误拼接

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
  "t-action-sheet": "tdesign-miniprogram/action-sheet/action-sheet",
  "t-button": "tdesign-miniprogram/button/button",
  "t-cell": "tdesign-miniprogram/cell/cell",
  "t-cell-group": "tdesign-miniprogram/cell-group/cell-group",
  "t-empty": "tdesign-miniprogram/empty/empty",
  "t-icon": "tdesign-miniprogram/icon/icon",
  "t-image": "tdesign-miniprogram/image/image",
  "t-input": "tdesign-miniprogram/input/input",
  "t-loading": "tdesign-miniprogram/loading/loading",
  "t-navbar": "tdesign-miniprogram/navbar/navbar",
  "t-popup": "tdesign-miniprogram/popup/popup",
  "t-stepper": "tdesign-miniprogram/stepper/stepper"
}
```

**安装步骤**：
1. 在 `miniprogram/` 目录下执行：`npm i tdesign-miniprogram -S --production`
2. 在微信开发者工具中：**工具** -> **构建 npm**

完整组件列表请参考 [TDesign 微信小程序组件库官方文档](https://tdesign.tencent.com/miniprogram/overview)

## Common Tasks

### Adding a New Page
1. Create a new folder under `miniprogram/pages/`
2. Add the page path to `pages` array in `miniprogram/app.json`

### Adding a Component
1. Create a new folder under `miniprogram/components/`
2. Component requires: `.ts`, `.wxml`, `.json`, `.wxss` files

### Adding Global Types
- Custom type declarations go in `typings/`
- WeChat API types are in `typings/types/wx/`
- Global types should be exported from `typings/index.d.ts`

## Known Issues & Warnings

These warnings from third-party libraries can be safely ignored:

| Warning | Source | Resolution |
|---------|--------|------------|
| `Failed to load font at.alicdn.com` | iconfont CDN | Network issue, temporary |
