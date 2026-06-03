# E2E 自动化测试指南

本文档介绍如何在 Windows 环境下使用 `miniprogram-automator` 进行微信小程序的 E2E 自动化测试。

## 环境准备

### 1. 安装微信开发者工具

确保已安装微信开发者工具，默认路径：`E:\ProgramData\Tencent\微信web开发者工具\`

### 2. 安装依赖

```bash
npm install
```

## 快速开始

### 一键截屏（推荐）

```bash
# 方式 A: 双击 bat 文件
scripts\capture-with-window.bat

# 方式 B: npm script
npm run capture:full

# 方式 C: 直接运行 Node.js 脚本
node scripts/capture-automated.js
```

自动完成：
1. 查找 cli.bat（Node.js fs 模块处理 Unicode 中文路径）
2. 启动微信开发者工具（窗口可见）
3. 激活 DevTools 窗口到前台（PowerShell user32 API）
4. 连接 miniprogram-automator
5. 导航到首屏，等待渲染完成
6. 截图（`mp.screenshot()`，390x844 模拟器内容）
7. 保存到 `miniprogram/tests/reports/first-screen/`

### 手动模式（需提前启动 DevTools）

```bash
# 确保 DevTools 已启动且窗口可见，然后：
npm run capture:first-screen
```

### 数据读取（无截屏）

```bash
npm run start:first-screen
```
自动启动 DevTools → 导航首屏 → 读取页面数据 → 探测 DOM 元素 → 生成 JSON 报告。

## 测试脚本一览

| 命令 | 脚本 | 说明 |
|------|------|------|
| `npm run capture:full` | `capture-with-window.bat` | 一键截屏（双击可用） |
| `npm run capture:auto` | `capture-automated.js` | 全自动截屏（单进程 mp.screenshot） |
| `npm run capture:first-screen` | `capture-first-screen.js` | 手动模式截屏（DevTools 已启动） |
| `npm run start:first-screen` | `first-screen-access.js` | 数据读取 + DOM 探测 + npm 构建验证 |
| `npm run build:npm` | `build-npm.js` | 修复 npm 构建（tdesign import/export→CommonJS） |

## 脚本说明

### capture-automated.js（核心脚本）

单进程模式，在同一 Node.js 进程中完成全部操作：
- DevTools 启动 → 端口等待 → 窗口激活 → 连接 → 导航 → 渲染等待 → `mp.screenshot()`
- **关键**：cli.bat 子进程引用保持存活，`mp.screenshot()` 才能成功
- 输出：390x844 模拟器纯内容截图

### first-screen-access.js

数据读取工具，不依赖 Jest，直接输出：
- 页面数据（isAuthorized、viewMode、mediaList 等 15 个字段）
- DOM 元素探测（17 个选择器）
- npm 构建验证（检查 miniprogram_npm 是否残留 import/export）
- 截图（后台模式可能超时，优雅降级）

### build-npm.js

修复 `tdesign-miniprogram` 的 ES module 语法问题：
- 使用 `@babel/core + @babel/preset-env` 将 import/export 转换为 CommonJS
- 在 DevTools「工具 → 构建 npm」之后运行

## 端口说明

- **9420**: WebSocket 自动化端口（miniprogram-automator 连接）
- **9421**: HTTP 服务端口（IDE 控制）

## 常见问题

### 1. 截图卡住（mp.screenshot 无响应）

**原因**：cli.bat auto 模式启动 DevTools 后，`mp.screenshot()` 在单独进程中调用会永久挂起。

**解决**：
- 使用 `capture-automated.js`（单进程模式，已验证可靠）
- 或手动启动 DevTools + `capture:first-screen`（窗口可见即可）

### 2. reLaunch 参数必须是字符串

```javascript
// ❌ 错误
await mp.reLaunch({ url: '/pages/album_home/album_home' });

// ✅ 正确
await mp.reLaunch('/pages/album_home/album_home');
```

### 3. 解构导入导致错误

```javascript
const { connect } = require('miniprogram-automator');
// → Cannot read properties of undefined (reading 'launcher')

const m = require('miniprogram-automator');
const mp = await m.connect({ wsEndpoint }); // ✅ 正确
```

### 4. MiniProgram 没有 .page 属性

```javascript
await mp.page.data(); // ❌ undefined
const page = await mp.currentPage(); // ✅ 正确
const data = await page.data();
```

### 5. npm 构建错误（SyntaxError: Unexpected token {）

**原因**：`tdesign-miniprogram 1.15.0` 的 `miniprogram_dist` 含 `import/export`，DevTools 构建 npm 未转换。

**修复**：
```bash
npm run build:npm
```

## 项目结构

```
scripts/
├── capture-automated.js        # 全自动截屏（单进程 mp.screenshot）
├── capture-first-screen.js     # 手动模式截屏
├── capture-with-window.bat     # 一键截屏入口（双击）
├── first-screen-access.js      # 首屏数据读取 + npm 构建验证
├── build-npm.js                # npm 构建修复
├── launch-devtools.js          # DevTools 启动器（处理 Unicode 路径）
├── start-devtools-visible.bat  # DevTools 一键启动（双击）
└── CLAUDE.md                   # 纠错经验记录
```

## 参考文档

- [微信自动化测试文档](https://developers.weixin.qq.com/miniprogram/dev/devtools/auto/)
- [miniprogram-automator API](https://www.npmjs.com/package/miniprogram-automator)