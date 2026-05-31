# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a WeChat Mini Program (微信小程序) for tracking baby growth and development. The project uses TypeScript with the Skyline renderer and glass-easel component framework.

## Development Environment

- **WeChat DevTools**: Required for running and debugging the miniprogram
- Open `project.config.json` to understand the devtools configuration (appid: `wx3db22b5d6da5d38a`)

## Project Structure

```
miniprogram/           # Main miniprogram code
  app.ts              # App entry point
  app.json            # App configuration
  app.wxss            # App global styles
  pages/              # Page components
    index/            # Home page
    logs/             # Logs page
  components/         # Reusable components
    navigation-bar/   # Custom navigation bar
  sitemap.json        # SEO sitemap
typings/              # TypeScript type definitions
  types/wx/           # WeChat API typings (miniprogram-api-typings)
  index.d.ts          # Global type declarations
```

## 目录结构规范 (Directory Structure Convention)

新增代码或目录时必须遵循以下规范：

### 标准目录结构
```
miniprogram/
├── pages/            # 页面目录 - 每个页面单独一个文件夹
│   └── [page-name]/
│       ├── [page-name].ts      # 逻辑层
│       ├── [page-name].wxml    # 视图层
│       ├── [page-name].wxss    # 样式
│       └── [page-name].json    # 配置
├── components/       # 组件目录 - 可复用组件
│   └── [component-name]/
│       ├── [component-name].ts
│       ├── [component-name].wxml
│       ├── [component-name].wxss
│       └── [component-name].json
├── utils/            # 工具函数
├── services/         # API 服务层
├── constants/       # 常量定义
├── images/           # 图片资源
├── styles/          # 公共样式
└── lib/             # 第三方库
```

### 命名规范
- **页面文件夹**: 小写下划线命名法 (如 `user_profile/`)
- **组件文件夹**: 小写下划线命名法 (如 `article_card/`)
- **js/ts 文件**: 与文件夹名保持一致
- **图片资源**: 小写 + 下划线 或 小写 + 连字符

### 文件内容规范
每个页面/组件的 4 个文件职责：
- **.ts**: 逻辑、数据、事件处理
- **.wxml**: 视图结构
- **.wxss**: 组件样式（应使用类名选择器，避免使用 ID 和元素选择器）
- **.json**: 配置（继承父组件或全局样式）

## TypeScript Configuration

- TypeScript strict mode is enabled (`strict: true`)
- Type definitions are in `./typings` directory
- WeChat API types come from `miniprogram-api-typings` package

## Key Technologies

- **Skyline Renderer**: Custom rendering engine for better performance
- **glass-easel**: Component framework (replaces the original component system)
- **Custom Navigation Bar**: Uses `navigation-style: custom` in app.json
- **Component Isolation**: Uses `tagNameStyleIsolation: "legacy"` for component style isolation

## Common Tasks

### Adding a New Page
1. Create a new folder under `miniprogram/pages/`
2. Add the page path to `pages` array in `miniprogram/app.json`

### Adding a Component
1. Create a new folder under `miniprogram/components/`
2. Component requires: `.ts`, `.wxml`, `.json`, `.wxss` files

### Working with TypeScript
- Custom type declarations go in `typings/`
- WeChat API types are in `typings/types/wx/`
- If adding global types, update `typings/index.d.ts`
