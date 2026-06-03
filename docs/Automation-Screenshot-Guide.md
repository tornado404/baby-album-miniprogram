# 小程序首屏截图自动化指南

## 方案概述

使用 `miniprogram-automator` 的 `mp.screenshot()` API 在单 Node.js 进程中完成：
启动 DevTools → 连接 → 导航 → 渲染等待 → 截图 → 保存。

输出：**390x844 模拟器纯内容截图**（非桌面截图）。

## 使用方法

### 一键截屏（推荐）

```bash
# 双击 bat 文件
scripts\capture-with-window.bat

# 或 npm script
npm run capture:full
```

自动完成：
1. 查找 `cli.bat`（Node.js fs 模块正确处理中文路径）
2. 启动 DevTools（`cli.bat auto` 模式，窗口可见）
3. 等待端口 9420 就绪（TCP 可达性检测）
4. 激活 DevTools 窗口到前台（PowerShell user32 API）
5. 连接 miniprogram-automator
6. 导航到 `/pages/album_home/album_home`
7. 等待页面渲染（轮询 `isLoading` + 2s Skyline 渲染等待）
8. `mp.screenshot()` → 保存到 reports 目录

### 分步执行

```bash
# 仅截屏（需 DevTools 已启动且窗口可见）
npm run capture:first-screen

# 仅读取数据（自动启动 DevTools，后台模式无窗口也 OK）
npm run start:first-screen
```

## 输出目录

截图保存到：

```
miniprogram/tests/reports/first-screen/
├── capture-auto_20260603_112034/
│   └── 01-album-home.png       # 390x844 模拟器截图
└── first-screen_20260603_013619/
    ├── 01-album-home.png       # 截图（可能因后台模式为空）
    └── screen-report.json      # 页面数据 + DOM 探测报告
```

## 技术要点

### mp.screenshot() 单进程要求

`mp.screenshot()` 要求 DevTools 的 `cli.bat auto` 子进程引用在同一 Node.js 进程中保持存活。跨进程调用会永久挂起。

```javascript
// ✅ 同一进程（可靠）
const child = spawn(cliPath, ['auto', ...]);
// ... wait for port ...
const mp = await connect({ wsEndpoint });
const ss = await mp.screenshot(); // 成功

// ❌ 不同进程（超时）
// 进程 A: 启动 DevTools（child reference 在 A 中）
// 进程 B: connect + screenshot（B 没有 child reference → 超时）
```

### waitForPageReady 三阶段策略

```javascript
// 阶段1: 轮询 isLoading === false
// 阶段2: 静置 2s（Skyline 渲染器布局计算）
// 阶段3: 验证 DOM 元素已渲染（.empty-container / .upload-btn）
```

### DevTools 窗口激活

使用 PowerShell user32 API 激活窗口：

```powershell
$sig = '[DllImport("user32.dll")]...SetForegroundWindow(IntPtr h);'
$t = Add-Type -MemberDefinition $sig -Name W32 -Namespace Win32 -PassThru
[Win32.W32]::ShowWindowAsync($h, 9)    # SW_RESTORE
[Win32.W32]::SetForegroundWindow($h)   # Bring to front
```

## 常见问题

### 截图超时

**可能原因**：DevTools 窗口在后台或最小化。

**解决**：脚本会自动尝试用户32 API 激活窗口。如果仍超时，请确保 DevTools 窗口未被完全隐藏。

### GDI+ Save 错误

**原因**：PowerShell `Bitmap.Save()` 路径含 `..` 或目录不存在。

**解决**：使用 `[IO.Path]::GetFullPath()` + `[IO.Directory]::CreateDirectory()`。

### cli.bat 找不到

脚本自动搜索以下路径：
- `E:\ProgramData\Tencent\*`
- `C:\Program Files\Tencent\*`
- `C:\Program Files (x86)\Tencent\*`
- `D:\Program Files\Tencent\*`

## 相关脚本

| 脚本 | 用途 |
|------|------|
| `capture-automated.js` | 全自动截屏（单进程 mp.screenshot） |
| `capture-first-screen.js` | 手动模式截屏（DevTools 已启动） |
| `first-screen-access.js` | 首屏数据读取 + DOM 探测 + npm 验证 |
| `launch-devtools.js` | DevTools 启动器（fs 模块搜索中文路径） |
| `build-npm.js` | npm 构建修复（import/export→CommonJS） |