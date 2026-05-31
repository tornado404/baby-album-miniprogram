# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a WeChat Mini Program (微信小程序) for tracking baby growth and development. The project uses TypeScript with the Skyline renderer and glass-easel component framework.

## Development Environment

- **WeChat DevTools**: Required for running and debugging the miniprogram
- AppID: `wx3db22b5d6da5d38a` (configured in `project.config.json`)

## Common Commands

```bash
# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

**Note**: After installing or updating npm packages in `miniprogram/`, you must rebuild npm in WeChat DevTools: **工具** -> **构建 npm**

## Project Structure

```
miniprogram/              # Main miniprogram code
├── app.ts               # App entry point
├── app.json            # App configuration (pages, window, Vant components)
├── app.wxss            # App global styles
├── pages/              # Page components
│   ├── index/          # Home page
│   ├── logs/           # Logs page
│   ├── album_home/     # Album home page
│   ├── media_detail/   # Media detail page
│   └── tech_validate/   # Tech validation page
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
├── miniprogram_npm/    # Built Vant Weapp components
└── node_modules/       # Dependencies

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
- **Component Isolation**: Uses `tagNameStyleIsolation: "legacy"` for style isolation

## Important Limitations

### JavaScript Syntax Compatibility

微信小程序不支持 ES2020+ 语法，**禁止使用**以下语法：

| 语法 | 说明 | 替代方案 |
|------|------|----------|
| `?.` | 可选链 (Optional Chaining) | `obj && obj.prop` |
| `??` | 空值合并 (Nullish Coalescing) | `val !== null ? val : default` |
| `??=` | 空值赋值 | `if (val === null) val = default` |
| `?.()` | 可选调用 | `fn && fn()` |

**注意**: TypeScript 编译时不报错，但微信小程序 runtime 会报 `SyntaxError: Unexpected token .`

### Component Configuration

- Vant 组件只在 `app.json` 全局注册
- 页面/组件的 `usingComponents` 中**不要**重复配置 `miniprogram_npm/...` 路径
- 微信小程序解析组件路径时相对于自身目录，会导致路径错误拼接

## TypeScript Configuration

- Strict mode enabled (`strict: true`)
- **Target: ES5** - 必须使用 ES5，微信小程序不支持 ES6+ 语法
- Type definitions in `./typings` directory
- WeChat API types from `miniprogram-api-typings` package
- Jest for testing, configured via `jest.config.js`

## Data Models

The project uses these main models (exported from `typings/models/`):
- **Baby**: Baby profile model
- **BabyAge**: Age calculation model
- **Media**: Media (photo/video) model

## Vant Weapp 组件库

使用 `@vant/weapp`（腾讯官方维护版本，兼容微信小程序），配置在 `app.json` 的 `usingComponents`：

```json
{
  "van-button": "miniprogram_npm/@vant/weapp/button/index",
  "van-cell": "miniprogram_npm/@vant/weapp/cell/index",
  "van-field": "miniprogram_npm/@vant/weapp/field/index",
  "van-icon": "miniprogram_npm/@vant/weapp/icon/index",
  "van-loading": "miniprogram_npm/@vant/weapp/loading/index",
  "van-nav-bar": "miniprogram_npm/@vant/weapp/nav-bar/index",
  "van-popup": "miniprogram_npm/@vant/weapp/popup/index"
}
```

**注意**：`vant-weapp` 0.5.x 版本使用 ES 模块格式（`dist` 目录），微信小程序不支持。必须使用 `@vant/weapp` 版本。

完整组件列表请参考 [@vant/weapp 官方文档](https://vant-contrib.gitee.io/vant-weapp/)

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
