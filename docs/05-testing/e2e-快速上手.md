# E2E 快速截图上手指南

> **版本**: v1.0 | **最后更新**: 2026-06-15
> **状态**: ✅ 已定稿 | **配套**: `docs/05-testing/E2E-Testing-Guide.md`（完整指南）

目标：在 WSL 中运行 miniprogram-automator，连接 Windows 上的微信开发者工具，截取小程序画面。

## 前置条件

| 环境 | 状态 |
|------|------|
| Windows 微信开发者工具 | ✅ 已安装（`E:\ProgramData\Tencent\微信web开发者工具\cli.bat`） |
| 服务端口 | ✅ 已开启（HTTP 9421 + WS 9420） |
| WSL Node.js + npm | ✅ 已就绪 |
| miniprogram-automator | ✅ 已安装（v0.12.1） |

## 启动步骤

### 第 1 步：后台启动微信开发者工具（推荐用守护脚本）

在 WSL 中：
```bash
nohup bash scripts/keep-devtools.sh > /tmp/devtools-keep.log 2>&1 &
disown -a 2>/dev/null || true
```

`keep-devtools.sh` 会：
- 杀掉残留的 `wechatdevtools.exe`
- 调用 `cli.bat auto --port 9421 --auto-port 9420 --project miniprogram` 启动 IDE
- 每 30s 检查端口 9420 是否在监听，丢失就自动重启

也可以手动在 Windows 终端运行：
```bat
"E:\ProgramData\Tencent\微信web开发者工具\cli.bat" auto --port 9421 --auto-port 9420 --project "D:\code\yuanBabyGrowthDiary\miniprogram"
```

### 第 2 步：验证端口在监听

```bash
cmd.exe /c "netstat -ano" 2>&1 | grep -E "9420|9421"
```

应看到：
```
TCP    0.0.0.0:9420           0.0.0.0:0              LISTENING
TCP    127.0.0.1:9421         0.0.0.0:0              LISTENING
```

### 第 3 步：在 WSL 中运行测试

```bash
cd /mnt/d/code/yuanBabyGrowthDiary
npm run test:e2e -- quick-screenshot
```

## 预期输出

```
PASS  miniprogram/tests/specs/quick-screenshot.spec.ts
  快速截图 - 当前页面
    ✓ 连接开发者工具并截图当前页面 (3000ms)

  ✅ 截图成功！
  📁 WSL 路径: /mnt/d/code/yuanBabyGrowthDiary/miniprogram/tests/reports/screenshots/screenshot_20260601_183849.png
  📐 尺寸: 390 x 844
  💾 大小: 19.9 KB
  💡 Windows 路径: D:\code\yuanBabyGrowthDiary\miniprogram\tests\reports\screenshots\screenshot_20260601_183849.png
```

## 截图保存位置

```
miniprogram/tests/reports/screenshots/
├── screenshot_20260601_183849.png
└── ...
```

- WSL 路径：`/mnt/d/code/yuanBabyGrowthDiary/miniprogram/tests/reports/screenshots/`
- Windows 路径：`D:\code\yuanBabyGrowthDiary\miniprogram\tests\reports\screenshots\`

两条路径在 WSL 和 Windows 下都能直接打开。

## 关键端口说明

| 端口 | 协议 | 用途 | 绑定地址 |
|------|------|------|----------|
| 9421 | HTTP | IDE 控制（开启服务端口、ticket 等） | 127.0.0.1 |
| 9420 | WebSocket | automator 控制（`App.*` / `Tool.*` 命令） | 0.0.0.0 |

WSL 2（mirrored 模式）下两个端口都通过 `localhost` 访问。

## 工作原理

```
┌──────────────────┐                       ┌──────────────────────┐
│   WSL 环境       │                       │  Windows 环境         │
│                  │                       │                      │
│  npm run test:e2e│                       │  微信开发者工具        │
│       │          │                       │  ┌────────────────┐  │
│       ▼          │                       │  │ 小程序运行画面  │  │
│  Jest ────────────────── WebSocket ─────→│  │   (模拟器)     │  │
│       │          │     ws://localhost    │  └────────────────┘  │
│       ▼          │         :9420         │                      │
│  automator       │                       │  cli.bat / DevTools  │
│  .send()         │                       │                      │
│  (App.* / Tool.*)│                       │                      │
│       │          │                       │                      │
│       ▼          │                       │                      │
│  PNG Buffer      │                       │                      │
│  写入 screenshots/│                       │                      │
└──────────────────┘                       └──────────────────────┘
```

## 历史问题与解决

| 问题 | 原因 | 解决 |
|------|------|------|
| `ECONNREFUSED 127.0.0.1:9421` | WSL 2 mirrored 模式下 `127.0.0.1` 不一定直通 | 用 `localhost` 代替 |
| IDE 退出后 9420 端口关闭 | 守护进程被 WSL 进程组回收 | `nohup + disown` 让进程脱离 WSL 进程树 |
| `cli.bat` 在 WSL 中以 `start /B` 启动失败 | WSL 解析 `start /B title with spaces` 异常 | 直接在 WSL 中用 `cmd.exe /c "cli.bat ..."` |
| `reLaunch` 参数被包成 `{url: {url: ...}}` | miniprogram-automator 0.12.1 bug | 直接用 `callWxMethod('reLaunch', {url: x})`；或干脆不跳转（IDE 默认打开项目就进首页） |
| `automator.screenshot()` 偶尔卡死 | IDE 在多次重启后进入坏状态 | 守护脚本检测到 9420 丢失就重启 IDE；调用方增加重试 |

## 进阶用法

### 通用 automator API

```typescript
const automator = (global as any).__AUTOMATOR__;

// 调任意 IDE 协议方法
const ss = await automator.send('App.captureScreenshot', {});     // 截图
const page = await automator.send('App.getCurrentPage', {});      // 当前页
const data = await automator.send('App.getAppData', {});          // App.data
await automator.send('App.callWxMethod', { method: 'showModal', args: [{...}] });
```

完整协议命令列表参考 IDE 的 `cli` / `wechatdevtools.exe --help`。

### 截取特定元素

```typescript
// 假定有一个 Element 对象
const element = await automator.send('Page.getElement', { selector: '.upload-btn' });
// 部分 IDE 协议支持 element screenshot，否则只能用整页截图
```

### 等待特定时间 / 选择器

```typescript
await new Promise(r => setTimeout(r, 2000));   // 简单等待
// 或查询 DOM 状态
const exists = await automator.send('Page.getElement', { selector: '.van-popup' });
```

### 模拟点击

```typescript
await automator.send('Page.handleEvent', {
  type: 'click',
  selector: '.upload-btn'
});
```

## 下一步

框架已就绪，可继续扩展：
- `album-flow.spec.ts` — 多步用户旅程 + 关键节点截图
- `media-detail.spec.ts` — 媒体详情页交互验证
- 集成到 CI（GitHub Actions）做回归截图对比
