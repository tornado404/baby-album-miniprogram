# 宝宝成长相册 (Baby Album)

> 微信小程序 — 记录宝宝成长的每一刻

![](screenshot-album-home.png)

## 项目概述

宝宝成长相册是一款微信小程序，用于记录宝宝成长的照片和视频，带有年龄里程碑标注。

### 核心功能

- 📷 照片/视频上传与管理
- 👶 多宝宝档案管理
- 📅 年龄里程碑自动计算
- 🎨 Claymorphism UI 设计风格
- ☁️ 后端存储服务（MinIO + FastAPI）

## 技术栈

| 层级 | 技术 |
|------|------|
| **前端** | 微信小程序 + TypeScript + TDesign 组件库 |
| **后端** | Python FastAPI + PostgreSQL + MinIO + Celery |
| **测试** | Jest + miniprogram-automator (E2E) |
| **部署** | Docker + ARM 测试服务器 |

## 快速开始

### 前置要求

- 微信开发者工具
- Node.js 18+

### 安装

```bash
# 安装依赖
npm install

# 构建 npm（在微信开发者工具中）
# 工具 → 构建 npm

# 编译 TypeScript
cd miniprogram && npx tsc -p tsconfig.json
```

### 运行

1. 打开微信开发者工具
2. 导入项目（选择 `miniprogram/` 目录）
3. AppID: `wx3db22b5d6da5d38a`

### 测试

```bash
# 运行所有测试
npm test

# 仅运行单元测试
npm run test:unit

# E2E 测试（需微信开发者工具运行中）
npm run test:e2e
```

## 目录结构

```
miniprogram/          # 小程序代码
├── README.md         # 小程序代码组织说明
├── pages/            # 页面
├── components/       # 组件
├── services/         # API 服务层
├── utils/            # 工具函数
├── constants/        # 常量定义
├── config/           # 环境配置
├── styles/           # 全局样式
└── tests/            # E2E 测试

server/               # 后端代码
├── README.md         # 后端服务说明
├── app/              # FastAPI 应用
├── migrations/       # 数据库迁移
└── tests/            # 后端测试

docs/                 # 文档中心
├── PRD-v2.md         # 产品需求文档
├── 01-requirements/  # 需求规格
├── 02-design/        # 设计规范（含 tasks/ 子目录）
├── 03-architecture/  # 系统架构
├── 04-features/      # 功能模块
├── 05-testing/       # 测试体系
├── 06-standards/     # 开发规范
├── 07-plans/         # 项目计划
├── deployment/       # 部署指南
└── archive/          # 历史归档

typings/              # TypeScript 类型定义
├── index.d.ts        # 全局类型声明
├── models/           # 数据模型（Baby, Media）
└── types/            # 微信 API 类型

tests/                # 单元测试
├── README.md         # 测试组织说明
└── CLAUDE.md         # 测试纠错经验

scripts/              # 自动化脚本
├── README.md         # 脚本说明
└── CLAUDE.md         # 脚本纠错经验
```

## 文档

详细文档请参阅 [`docs/README.md`](./docs/README.md)。

## 相关链接

- [Figma 设计稿](https://www.figma.com/design/KcqY6GUSvdn24Ur1qKkcim)
- [TDesign 微信小程序组件库](https://tdesign.tencent.com/miniprogram/overview)
- [GitHub 仓库](https://github.com/tornado404/baby-album-miniprogram)

## License

[MIT](./LICENSE)
