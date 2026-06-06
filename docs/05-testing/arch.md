# E2E 测试原理

> 本文档总结本项目 E2E 截图测试框架的工作原理、通信协议、数据流、关键实现细节及已知坑。
> 配套上手文档：[`e2e-快速上手.md`](./e2e-快速上手.md)。

## 1. 整体架构

```
┌─────────────────── WSL (Linux) ─────────────────────┐    ┌────────────────── Windows ─────────────────────┐
│                                                     │    │                                                  │
│  Jest 测试进程                                       │    │   微信开发者工具 IDE (Electron 主进程)            │
│  ┌───────────────────────────────────────────────┐  │    │   ┌──────────────────────────────────────────┐   │
│  │ globalSetup                                   │  │    │   │  HTTP 服务（9421，127.0.0.1）           │   │
│  │   connect('ws://localhost:9420')              │  │    │   │  - 开启服务端口                          │   │
│  │   globalThis.__AUTOMATOR__ = miniProgram      │  │    │   └──────────────────────────────────────────┘   │
│  └───────────────────────────────────────────────┘  │    │   ┌──────────────────────────────────────────┐   │
│  ┌───────────────────────────────────────────────┐  │    │   │  WebSocket 服务（9420，0.0.0.0）         │   │
│  │ quick-screenshot.spec.ts                      │  │    │   │  - JSON-RPC over WS                      │   │
│  │   automator.send('App.getCurrentPage')  ──────┼──┼────┼──▶│  - 命令: App.* / Tool.* / Page.*        │   │
│  │   automator.send('App.captureScreenshot')─────┼──┼────┼──▶│                                          │   │
│  │   ←── {data: "iVBORw0KGgo..." (base64 PNG)}  │◀─┼──┼────┼──┤  调用 native screenshot 抓渲染器一帧      │   │
│  │   Buffer.from(ss.data, 'base64')              │  │    │   │           │                              │   │
│  │   fs.writeFileSync(screenshot.png)            │  │    │   │           ▼                              │   │
│  └───────────────────────────────────────────────┘  │    │   │  base64(PNG)  ── 响应回 WSL                │   │
│                                                     │    │   └──────────────────────────────────────────┘   │
│  /mnt/d/.../screenshots/ ◀── 同一份文件 ─────────────┼────┼──▶ D:\code\yuanBabyGrowthDiary\miniprogram\tests\ │
│                                                     │    │         reports\screenshots\                      │
└─────────────────────────────────────────────────────┘    └──────────────────────────────────────────────────┘
```

**核心要点**：截图流程不需要显示器，不需要抓屏，完全在 IDE 进程内部从渲染器拿像素数据。

## 2. 通信协议

### 2.1 端口

| 端口 | 协议 | 用途 | 绑定 |
|------|------|------|------|
| 9421 | HTTP | IDE 控制（开启服务端口、ticket、登录态） | `127.0.0.1` |
| **9420** | **WebSocket** | **automator 真正的双向通信通道** | `0.0.0.0` |

两个端口都由 DevTools 自己实现，不依赖任何外部服务。DevTools 进程关闭，两个端口同时消失。

### 2.2 WebSocket 上的 JSON-RPC

每条消息格式：

```jsonc
// 客户端 → IDE
{
  "id": "msg_<uuid>",      // 每条消息独立 UUID
  "method": "App.<command>",
  "params": { ... }        // 或 [...], 视命令而定
}

// IDE → 客户端（成功）
{
  "id": "msg_<uuid>",
  "result": { ... }        // 命令的返回数据
}

// IDE → 客户端（失败）
{
  "id": "msg_<uuid>",
  "error": { "message": "..." }
}
```

无连接 ID、无会话概念，所有消息都是单次请求-响应模式。

### 2.3 常用命令

| 命令 | 作用 | 返回 |
|------|------|------|
| `App.getCurrentPage` | 当前页 | `{pageId, path, query}` |
| `App.getPageStack` | 整页栈 | `{pageStack: [...]}` |
| `App.callWxMethod` | 调任意 wx API | `result` |
| **`App.captureScreenshot`** | **截当前模拟器一帧** | **`{data: <base64 PNG>}`** |
| `Tool.getInfo` | IDE/SDK 版本 | `{version, SDKVersion}` |
| `App.exit` | 退出小程序（不关 IDE） | — |

完整列表参考 `E:\ProgramData\Tencent\微信web开发者工具\cli.bat --help`。

## 3. 截图数据流

### 3.1 IDE 启动阶段

```bash
# Windows 终端执行一次（或者用 scripts/keep-devtools.sh 后台守护）
"E:\ProgramData\Tencent\微信web开发者工具\cli.bat" auto \
  --port 9421 \
  --auto-port 9420 \
  --project "D:\code\yuanBabyGrowthDiary\miniprogram"
```

发生的事：
1. 启动 `wechatdevtools.exe`（Electron 主进程）
2. 主进程内开 HTTP 服务（`127.0.0.1:9421`）
3. 主进程内开 WebSocket 服务（`0.0.0.0:9420`）
4. 加载 `--project` 指定的小程序项目
5. 渲染器初始化，进入 `app.json` 的第一个页面（这里就是 `pages/album_home/album_home`）

### 3.2 测试触发截图

```typescript
// miniprogram/tests/specs/quick-screenshot.spec.ts
const ss = await automator.send('App.captureScreenshot', {});
const buffer = Buffer.from(ss.data, 'base64');   // base64 → Buffer
fs.writeFileSync(filepath, buffer);              // 写盘
```

`automator.send(method, params)` 内部做的事：
1. 生成 UUID 当 `id`
2. 序列化为 `{id, method, params}` 发到 WebSocket
3. 把 `{resolve, reject}` 注册到内部 `callbacks: Map<id, ...>`
4. 等响应消息到达 → 用 `id` 找到 callback → `resolve(result)` / `reject(error)`

### 3.3 IDE 内部处理

收到 `App.captureScreenshot`：
1. DevTools 主进程找到当前激活的模拟器渲染器
2. 调 native screenshot API（不是 OS 截屏，是渲染器内部 API）拿当前帧
3. 编码成 PNG（`390×844`，iPhone 模拟器分辨率）
4. base64 编码
5. 回包 `{result: {data: "<base64>"}}`

### 3.4 文件落盘

- WSL 视角：`/mnt/d/code/yuanBabyGrowthDiary/miniprogram/tests/reports/screenshots/screenshot_<时间戳>.png`
- Windows 视角：`D:\code\yuanBabyGrowthDiary\miniprogram\tests\reports\screenshots\screenshot_<时间戳>.png`

两条路径指向**同一份文件**（WSL 2 的 `/mnt/d` 就是 Windows 的 D 盘），所以测试在 WSL 写入，Windows 资源管理器能直接看到。

## 4. WSL 2 联网细节

### 4.1 网络模式

WSL 2 默认是 **mirrored 模式**：
- WSL 的 `localhost` = Windows 的 `localhost`（互通）
- WSL 的 `127.0.0.1` = Windows 的 `127.0.0.1`（互通）
- 无需用 Windows 的 IP（`192.168.x.x`）

### 4.2 关键差异

| 错误 | 原因 | 解决 |
|------|------|------|
| `ECONNREFUSED 127.0.0.1:9421` | 早期 NAT 模式下 `127.0.0.1` 不一定直通 | 用 `localhost` |
| `ws://` 偶尔 `ECONNREFUSED 9420` | 9420 端口只在 DevTools 完全初始化后才监听 | 加 wait + 守护 |
| `cli.bat` 启动后被 WSL 进程组回收 | 父 shell 退出时子进程被一起带走 | `nohup` + `disown` |

## 5. 关键实现

### 5.1 连接复用（`global-setup.ts`）

```typescript
// miniprogram/tests/e2e/global-setup.ts
const automator = await require('miniprogram-automator').connect({
  wsEndpoint: 'ws://localhost:9420'
});
globalThis.__AUTOMATOR__ = automator;
```

- Jest 的 `globalSetup` 在所有 spec 运行前执行一次
- 之后每个 spec 通过 `(global as any).__AUTOMATOR__` 拿到同一个连接
- 避免每个 spec 重新建立 WebSocket（建立 + 握手要 1-2s）

### 5.2 不调 reLaunch 的设计

`miniprogram-automator` 0.12.1 的 `automator.reLaunch({url})` 有序列化 bug：
```js
// 库内实际发的：
{ method: 'reLaunch', args: [{ url: { url: '/path' } }] }  // ← url 被包成对象
// IDE 期望：
{ method: 'reLaunch', args: [{ url: '/path' }] }            // ← url 应该是字符串
```

绕过方案：
```typescript
// 方案 A：直接走 callWxMethod
await automator.send('App.callWxMethod', {
  method: 'reLaunch',
  args: [{ url: PAGE_PATH }]   // url 是字符串
});

// 方案 B（本框架选择）：根本不跳转
// IDE 默认打开项目就进 app.json 的第一个页面
const cur = await automator.send('App.getCurrentPage', {});
// → { path: "pages/album_home/album_home", ... }
```

### 5.3 守护脚本（`scripts/keep-devtools.sh`）

DevTools 进程不稳定：跑过几次测试后 9420 端口会无声丢失，渲染器进入"假活"状态（`getCurrentPage` 还能返回，`captureScreenshot` 永远 hang）。

```bash
#!/bin/bash
# 每 30s 检查 9420 是否在监听，丢失就重启 IDE
while true; do
  sleep 30
  LISTENING=$(cmd.exe /c "netstat -ano" | grep "0.0.0.0:9420.*LISTENING")
  if [ -z "$LISTENING" ]; then
    cmd.exe /c "...cli.bat auto --port 9421 --auto-port 9420 --project ..."
  fi
done
```

## 6. 已知坑与解决

| # | 现象 | 原因 | 解决 |
|---|------|------|------|
| 1 | `ECONNREFUSED 9421` | WSL NAT 模式下 127 不通 | 用 `localhost` |
| 2 | `cli.bat` 启动后被回收 | WSL 进程组 | `nohup + disown` |
| 3 | `reLaunch` 参数被包成对象 | 0.12.1 序列化 bug | `callWxMethod` 绕过 |
| 4 | `App.captureScreenshot` 永久 hang | DevTools `auto` 模式无窗口 → renderer 未激活 | 守护进程保活 / 用可见窗口模式 |
| 5 | `getCurrentPage` 正常但 `captureScreenshot` 不响应 | 渲染器进入坏状态 | 重启 IDE |

## 7. 文件清单

| 文件 | 角色 |
|------|------|
| `miniprogram/tests/specs/quick-screenshot.spec.ts` | Jest spec，对当前页截图 |
| `miniprogram/tests/e2e/global-setup.ts` | 共享 automator 连接 |
| `miniprogram/jest.config.js` (e2e project) | `globalSetup` 指向 `global-setup.ts` |
| `scripts/keep-devtools.sh` | IDE 守护脚本（WSL 用） |
| `scripts/start-devtools.bat` / `.ps1` / `-silent.bat` | Windows 侧启动脚本 |
| `docs/e2e-快速上手.md` | 上手指南 |
| `docs/05-testing/arch.md` | 本文档（原理总结） |

## 8. 未来扩展方向

- **多步用户旅程**：`album-flow.spec.ts` 已存在框架，跑 6 步完整流程
- **CI 集成**：在 GitHub Actions 启动 Windows runner + 守护 DevTools
- **视觉回归**：截图归档 + 像素 diff 检测 UI 回归
- **协议探针**：把 `automator.send` 包装成 SDK，统一管理超时与重试
