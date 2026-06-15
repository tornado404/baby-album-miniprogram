# Tech 文档 — 技术栈

> **版本**: v1.0 | **最后更新**: 2026-06-15
> **状态**: ✅ 已定稿
> **配套**: `docs/02-design/Design.md`（设计规范）、`docs/02-design/Spec.md`（功能规格）

---

## 宝宝成长相册 — 微信小程序技术栈说明

---

## 1. 技术栈总览

| 层级 | 技术 | 版本/说明 |
|------|------|-----------|
| **运行环境** | 微信小程序 | 基础库 >= 3.0.0 |
| **语言** | TypeScript / ES5 | TS 编译目标 ES5 |
| **渲染引擎** | Skyline + WebView 混合 | album_home 用 Skyline，其余用 WebView |
| **组件框架** | glass-easel | 微信新一代组件框架 |
| **UI 组件库** | TDesign 微信小程序版 | `tdesign-miniprogram` |
| **主题样式** | Claymorphism Custom CSS | `variables.wxss` + 各页面样式 |
| **构建工具** | WeChat DevTools 内置 TS 编译 | `useCompilerPlugins: ["typescript"]` |
| **单元测试** | Jest + ts-jest | `jest.config.js` |
| **E2E 测试** | miniprogram-automator | 控制 DevTools 自动化测试 |
| **版本管理** | Git + GitHub | 托管于 `tornado404/baby-album-miniprogram` |
| **设计工具** | Figma | Claymorphism UI 设计稿 |

---

## 2. 项目结构

```
├── CLAUDE.md                    # AI 编码助手指南
├── project.config.json          # 微信项目配置（含 AppID）
├── project.private.config.json  # 私有配置（git 追踪但不含 AppID）
├── .gitignore
├── tests/                       # 单元测试 (.test.ts)
├── typings/                     # TypeScript 类型定义
│   ├── index.d.ts
│   └── models/                  # 数据模型
│       ├── baby.ts
│       ├── baby_age.ts
│       └── media.ts
├── docs/                        # 项目文档
│   ├── PRD.md                   # 产品需求文档
│   ├── Design.md                # 设计规范
│   ├── Tech.md                  # 技术栈说明
│   └── Spec.md                  # 明细任务
├── scripts/                     # 自动化脚本
└── miniprogram/                 # 小程序主目录
    ├── app.ts / app.json / app.wxss
    ├── pages/                   # 10 个页面
    ├── components/              # 6 个组件
    ├── services/                # 2 个服务
    ├── utils/                   # 5 个工具模块
    ├── constants/               # 2 个常量模块
    ├── styles/                  # 全局样式
    ├── tests/                   # E2E 测试
    └── miniprogram_npm/         # 构建后的 npm 包
```

---

## 3. 渲染策略详解

### 3.1 为什么混合渲染？
微信小程序 Skyline 渲染器性能优于 WebView，但兼容性有限。权衡后采用混合策略：

| 页面 | 渲染器 | 原因 |
|------|--------|------|
| album_home（首页） | **Skyline** | 卡片/动画密集型，需要流畅滚动 |
| 其他所有页面 | **WebView** | 表单/媒体/导航页面，兼容性优先 |

### 3.2 配置方式
```json
// 全局（app.json）— 不设置 renderer，默认 WebView
{ "componentFramework": "glass-easel" }

// 页面级（album_home.json）— 按页面启用 Skyline
{ "renderer": "skyline" }
```

---

## 4. TDesign 组件库

### 4.1 全局注册组件
所有 TDesign 组件在 `app.json` 的 `usingComponents` 中全局注册：

```json
"t-button": "miniprogram_npm/tdesign-miniprogram/button/button"
```

**强制规则**：组件路径必须加 `miniprogram_npm/` 前缀。

### 4.2 自定义组件
同样在 `app.json` 全局注册（路径以 `/` 开头）：
```json
"bottom-nav": "/components/bottom-nav/bottom-nav"
```

### 4.3 npm 管理
```bash
# 安装
cd miniprogram
npm i tdesign-miniprogram -S --production

# 安装后必须在 DevTools 中执行
# 工具 → 构建 npm
```

---

## 5. CSS 主题系统

### 5.1 样式文件层级
```
app.wxss                    # 全局样式入口
  └─ @import variables.wxss  # CSS 变量（Token 体系）
  └─ @import common.wxss     # 通用工具类
```

### 5.2 设计 Token 体系
CSS 变量定义在 `miniprogram/styles/variables.wxss`，分为：
- **颜色**：背景、文字、卡片、UI元素
- **阴影**：通用、卡片、品牌色（按层级递进）
- **圆角**：6级圆角系统（12rpx ~ 9999rpx）
- **字号**：8级字号系统（20rpx ~ 40rpx）
- **间距**：6级间距（8rpx ~ 40rpx）

---

## 6. 编译与构建

### 6.1 TypeScript 编译
```bash
# 方式一：手动编译（推荐，确保 .js 最新）
cd miniprogram && npx tsc -p tsconfig.json

# 方式二：DevTools 自动编译
# 已在 project.config.json 启用 useCompilerPlugins: ["typescript"]
# 保存 .ts 文件即自动编译
```

### 6.2 编译配置
```json
{
  "compilerOptions": {
    "target": "ES5",          // 必须 ES5，微信不支持 ES6+
    "strict": true,
    "moduleResolution": "node"
  }
}
```

---

## 7. 测试体系

### 7.1 单元测试 (Jest)
```bash
npm run test:unit       # 仅运行单元测试
npm run test:coverage   # 带覆盖率
```

### 7.2 E2E 测试 (miniprogram-automator)
```bash
npm run test:e2e:auto          # 自动启动 DevTools + 测试
npm run test:first-screen:auto # 首屏加载测试
npm run start:first-screen     # 独立脚本（无 Jest）
```

### 7.3 测试目录
```
tests/                        # 单元测试
  ├── age_filter.test.ts
  ├── album_home.test.ts
  ├── masonry_integration.test.ts
  ├── media_uploader.test.ts
  ├── tech_validate.test.ts
  └── tech_validate_issues.test.ts

miniprogram/tests/            # E2E 测试
  ├── e2e/                    # 基础设施
  ├── specs/                  # 测试用例
  └── reports/                # 测试报告
```

---

## 8. 已知技术限制

### 8.1 JavaScript 语法限制
微信小程序 **不支持** ES2020+ 语法，禁止使用：
- 可选链 `?.`
- 空值合并 `??` / `??=`
- 可选调用 `?.()`

TS 编译不报错，但 runtime 报 `SyntaxError: Unexpected token .`

### 8.2 Skyline 限制
- `scroll-view` 需特殊配置（`type="list"`）
- 部分 CSS 选择器不兼容（`:active` 等）
- 当前仅 album_home 使用 Skyline

### 8.3 BOM 头问题
JSON 文件保存为 UTF-8 with BOM 会导致 WeChat DevTools 报错：
```
SyntaxError: Unexpected token ﻿ in JSON at position 0
```
修复方法：`sed -i '1s/^\xEF\xBB\xBF//' file.json`

---

## 9. 数据模型

### 9.1 Baby
| 字段 | 类型 | 说明 |
|------|------|------|
| id | string | 唯一标识 |
| name | string | 宝宝昵称 |
| birthDate | string | 出生日期 (YYYY-MM-DD) |
| gender | 'male' \| 'female' | 性别 |
| dueDate? | string | 预产期 |
| weight? | string | 体重 (kg) |
| height? | string | 身高 (cm) |
| avatar? | string | 头像 URL |

### 9.2 BabyAge
| 字段 | 类型 | 说明 |
|------|------|------|
| years | number | 岁 |
| months | number | 月 |
| days | number | 天 |
| totalDays | number | 总天数 |

### 9.3 Media
| 字段 | 类型 | 说明 |
|------|------|------|
| id | string | 唯一标识 |
| title | string | 标题/描述 |
| url | string | 文件 URL |
| thumbnailUrl | string | 缩略图 URL |
| captureDate | string | 拍摄日期 |
| type | 'image' \| 'video' | 媒体类型 |
| babyId | string | 关联宝宝 |
| babyAge | BabyAge | 当时的月龄 |

---

## 10. 版本历史

| Commit | 日期 | 说明 |
|--------|------|------|
| a46ddde | 2026-06-04 | 更新 CLAUDE.md 项目技术栈描述 |
| 9b2869c | 2026-06-04 | 精确还原 Figma Claymorphism UI |
| 5501b1b | 2026-06-04 | Claymorphism UI 改造 + TDesign 迁移 |
| 46a5bfc | 2026-06-03 | 撤回 AppID 迁移 + 修复 JSON BOM |
| 21d6a34 | 2026-06-03 | Skyline 从全局改为分页面配置 |