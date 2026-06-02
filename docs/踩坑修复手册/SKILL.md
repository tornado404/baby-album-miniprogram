# 踩坑修复手册

> 记录本项目开发中遇到的真实问题、根因、修复、预防。每条按"症状→根因→修复→预防"四段式组织，方便后人快速定位。

## 目录

- [A. 运行时错误](#a-运行时错误)
  - [A1. showAuthTip 缺失导致"去授权"按钮无反应](#a1-showauthtip-缺失导致去授权按钮无反应)
  - [A2. 无效的 app.json rendererOptions.skyline["tagNameStyleIsolation"]](#a2-无效的-appjson-rendereroptionsskylinetagnamestyleisolation)
  - [A3. 组件 wxss 标签名选择器警告](#a3-组件-wxss-标签名选择器警告)
  - [A4. <scroll-view> flexbox 布局不生效](#a4-scroll-view-flexbox-布局不生效)
- [B. IDE 配置与编译](#b-ide-配置与编译)
  - [B1. Skyline 渲染要求 + 最低基础库版本未设](#b1-skyline-渲染要求--最低基础库版本未设)
  - [B2. tsconfig.json 缺失导致 .ts/.js 双份维护失控](#b2-tsconfigjson-缺失导致-tsjs-双份维护失控)
- [C. E2E 自动化](#c-e2e-自动化)
  - [C1. miniprogram-automator 0.12.1 reLaunch 序列化 bug](#c1-miniprogram-automator-0121-relaunch-序列化-bug)
  - [C2. WSL 2 + Windows DevTools 网络不通](#c2-wsl-2--windows-devtools-网络不通)
  - [C3. cli.bat 启动后被 WSL 进程组回收](#c3-clibat-启动后被-wsl-进程组回收)
  - [C4. App.captureScreenshot 永久 hang](#c4-appcapturescreenshot-永久-hang)
- [D. 已知不修的警告](#d-已知不修的警告)

---

## A. 运行时错误

### A1. showAuthTip 缺失导致"去授权"按钮无反应

**症状**

相册首页（`pages/album_home/album_home`）显示"去授权"按钮，点击无反应。Console 报：

```
pages/album_home/album_home" does not have a method "showAuthTip"
to handle event "click".
```

**根因**

`album_home.ts` 已新增 `showAuthTip` / `checkAuthorization` / `initPage` / `loadMediaList` / `isAuthorized` 等方法和字段，但**编译产物 `album_home.js` 没有同步**。小程序运行时只读 `.js`，WXML 的 `bind:click="showAuthTip"` 找不到方法就报这个错。

这是项目里 `.ts` / `.js` 双份维护的典型坑：源改了但忘编译，IDE 不会自动跑 tsc。

**修复**

1. 新建 `miniprogram/tsconfig.json`（ES5 目标，无 type check，能处理 `wx.*` 全局）：

```json
{
  "compilerOptions": {
    "target": "ES5",
    "module": "CommonJS",
    "strict": false,
    "noImplicitAny": false,
    "esModuleInterop": true,
    "allowJs": true,
    "skipLibCheck": true,
    "lib": ["ES2017", "DOM"],
    "ignoreDeprecations": "6.0"
  },
  "include": [
    "./pages/**/*.ts",
    "./components/**/*.ts",
    "./services/**/*.ts",
    "./utils/**/*.ts",
    "./app.ts"
  ],
  "exclude": ["node_modules", "miniprogram_npm", "tests", "scripts"]
}
```

2. 一次性重编所有 `.ts`：

```bash
cd miniprogram
npx tsc -p tsconfig.json
```

3. 用 WebSocket 验证（参见 docs/tests/arch.md）：

```ts
await automator.send('App.callFunction', {
  functionDeclaration:
    '() => { const p = getCurrentPages().pop(); return Object.keys(p).filter(k => typeof p[k] === "function"); }',
  args: []
});
// 应当看到 showAuthTip / checkAuthorization / initPage / loadMediaList
```

**预防**

| 方案 | 做法 | 收益 |
|------|------|------|
| **A. 提交构建脚本** | `package.json` 加 `"build:minip": "tsc -p miniprogram/tsconfig.json"` | 编辑 .ts 后跑 `npm run build:minip` |
| **B. pre-commit hook** | `.husky/pre-commit` 跑 tsc，失败就拦截提交 | 强制保证 .js 同步 |
| **C. 删 .js 只留 .ts** | 让 WeChat DevTools 直接编译 .ts | 单一真相，但需 IDE 配置支持 |
| **D. husky + lint-staged** | 只对 staged 的 .ts 跑 tsc | 多一层依赖，但最快 |

建议至少做 **A**（最简单），再考虑 **B** 或 **C**。

---

### A2. 无效的 app.json rendererOptions.skyline["tagNameStyleIsolation"]

**症状**

IDE Console 报：

```
无效的 app.json rendererOptions.skyline["tagNameStyleIsolation"]
```

**根因**

`app.json` 配了：

```json
"rendererOptions": {
  "skyline": {
    "tagNameStyleIsolation": "legacy",
    ...
  }
}
```

`"legacy"` 是早期 Skyline 版本的字段值，在 SDK 3.15.2 已经被移除/改名为别的了，写上去 IDE 直接拒绝编译。

**修复**

直接删除该字段，用 Skyline 默认样式隔离：

```diff
  "rendererOptions": {
    "skyline": {
      "defaultDisplayBlock": true,
      "defaultContentBox": true,
-     "tagNameStyleIsolation": "legacy",
      "disableABTest": true,
      "sdkVersionBegin": "3.0.0",
      "sdkVersionEnd": "15.255.255"
    }
  }
```

**预防**

- 配置 Skyline 时**只抄官方文档明确列出的字段**，不确定的就别加
- `CLAUDE.md` 和 `tech_validate.ts` 里的描述要跟实际 `app.json` 同步，删掉错描述

---

### A3. 组件 wxss 标签名选择器警告

**症状**

```
[pages/album_home/album_home] Some selectors are not allowed in component wxss,
including tag name selectors, ID selectors, and attribute selectors.
(./components/media_uploader/media_uploader.wxss:23:19)
```

**根因**

`media_uploader.wxss` 第 23 行有：

```css
.uploader-actions van-button {
  flex: 1;
}
```

`van-button` 是 Vant Weapp 自定义组件标签名，属于**标签名选择器**，组件 wxss 中被禁止（小程序组件样式隔离机制不允许影响子组件内部）。

更糟的是：当前 WXML 里 `.uploader-actions` 容器下根本没有 `van-button`（设计改了），这条规则成了死代码。

**修复**

直接删除这段：

```diff
  .uploader-actions {
    display: flex;
    gap: 12px;
    margin-top: 16px;
  }
-
- .uploader-actions van-button {
-   flex: 1;
- }
```

**预防**

- 组件 wxss 写样式时只对**自己的根 view**生效，别试图影响 `van-*`
- 要给 Vant 组件传样式，**走 Vant 自己的 externalClasses** 或 `css-variable`
- 改完 WXML 后顺手把 wxss 里失效的规则也清掉

---

### A4. <scroll-view> flexbox 布局不生效

**症状**

`<scroll-view>` 里用 `display: flex` 排版，发现子元素没按 flex 排。Console 告警：

```
[pages/album_home/album_home] [Component] <scroll-view>: 设置 enable-flex
属性以使 flexbox 布局生效
```

**根因**

SDK 3.x 后，`<scroll-view>` 默认不开 flexbox 布局（出于兼容老代码考虑），需要显式声明 `enable-flex`。

**修复**

所有用 flex 的 `<scroll-view>` 都加 `enable-flex`：

```diff
- <scroll-view scroll-x class="quick-filter">
+ <scroll-view scroll-x enable-flex class="quick-filter">
```

项目里共 3 处需要改：

- `components/age_filter/age_filter.wxml`
- `pages/index/index.wxml`
- `pages/logs/logs.wxml`

**预防**

- 写新的 `<scroll-view>` 默认就加 `enable-flex`，省得之后 IDE 报
- Code Review 时把这条作为 checklist 一项

---

## B. IDE 配置与编译

### B1. Skyline 渲染要求 + 最低基础库版本未设

**症状**

IDE 报：

```
Skyline 渲染模式在 2.29.2 及以上基础库支持。
当前小程序未设置线上最低基础库版本，在低版本的客户端中，
将使用 WebView 渲染模式进行渲染。
需要保证页面[pages/album_home/album_home]同时在两种渲染模式下都能够正常显示
```

**根因**

`project.config.json` 没设 `libVersion` 字段。IDE 没法推断出"最低基础库版本"，担心低版本客户端拿到 Skyline 页面会回退 WebView 渲染，触发兼容性问题。

**修复**

在 `miniprogram/project.config.json` 加 `libVersion: "2.32.3"`（>= 2.29.2 的稳定版）：

```diff
  "compileType": "miniprogram",
  "simulatorPluginLibVersion": {},
- "appid": "wx5d0e66dc0e6fb16d"
+ "appid": "wx5d0e66dc0e6fb16d",
+ "libVersion": "2.32.3"
```

设了之后：
- 本地调试用 2.32.3，Skyline 全功能可用
- 上传后客户端 < 2.32.3 会被微信强制升级，根除 WebView 回退

**版本选择**

| 你的需求 | 推荐 libVersion |
|----------|-----------------|
| 激进（最新特性） | `3.5.0` 或更新（看 IDE 下拉） |
| **稳妥（覆盖绝大多数用户）** | **`2.32.3`** ✓ |
| Skyline 刚出的版本 | `2.29.2`（最低） |

**线上最低版本"双保险"**

`libVersion` 只是项目声明。**真正决定线上行为**的是微信公众平台 → 设置 → 基本设置 → **基础库最低版本设置**。两个保持一致（建议都 `2.32.3`）。

**关键澄清**

`app.json` 里的 `rendererOptions.skyline.sdkVersionBegin` 是 Skyline 渲染器**启用的 SDK 起点**（与最低基础库版本是两个独立维度）：

- `libVersion: 2.32.3` — 项目最低兼容基线（IDE 和微信用）
- `sdkVersionBegin: 3.0.0` — Skyline 渲染器启用的 SDK 起点（运行时用）

两者不矛盾，即使设了 `libVersion: 2.32.3`，Skyline 仍然只在 3.0.0+ 客户端启用；2.32.3~2.x.x 用 WebView（但因 `libVersion` 限定 2.32.3+，实际跑不到那段用户）。

**预防**

- 任何想用 Skyline 的项目，**第一步就设 `libVersion >= 2.29.2`**
- 同步去 MP 公众平台设最低基础库版本

---

### B2. tsconfig.json 缺失导致 .ts/.js 双份维护失控

**症状**

修改了 `.ts` 文件但 `.js` 没同步，运行时各种"method not found"。详见 [A1](#a1-showauthtip-缺失导致去授权按钮无反应)。

**根因**

项目里每个页面/组件/服务都是 `.ts` + `.js` 双份。`.ts` 是源代码，`.js` 是编译产物，理论上 IDE 应该自动编译 `.ts → .js`。但实际上：

- 小程序根目录**没有 `tsconfig.json`**，根目录那个 `tsconfig.json` 是给 jest 用的
- IDE 在保存 `.ts` 时不会触发编译
- 开发者编辑 `.ts` 经常忘了手动编译

**修复**

参见 [A1](#a1-showauthtip-缺失导致去授权按钮无反应) 的修复步骤（新建 `miniprogram/tsconfig.json` + 跑 `tsc -p`）。

**预防**

- 至少加 `package.json` script: `"build:minip": "tsc -p miniprogram/tsconfig.json"`
- 编辑 .ts 后跑一次 `npm run build:minip`
- 长远考虑用 husky + lint-staged 在 pre-commit 跑

---

## C. E2E 自动化

### C1. miniprogram-automator 0.12.1 reLaunch 序列化 bug

**症状**

调 `automator.reLaunch({ url: '/pages/x' })`，IDE 报：

```
parameter.url should be String instead of Object
```

**根因**

miniprogram-automator 0.12.1 的 `reLaunch` 实现有序列化 bug。库内实际发的请求是：

```js
{ method: 'reLaunch', args: [{ url: { url: '/pages/x' } }] }
//                                     ^^^^^^^^^^^^^^^^
//                                     url 被包成对象
```

IDE 期望的格式：

```js
{ method: 'reLaunch', args: [{ url: '/pages/x' }] }   // url 是字符串
```

**修复**

绕开这个 bug，直接调 `callWxMethod`：

```ts
await automator.send('App.callWxMethod', {
  method: 'reLaunch',
  args: [{ url: '/pages/x' }]   // url 保持字符串
});
```

**或者根本别跳转**：IDE 默认打开项目就进 `app.json` 的第一个页面，spec 直接截当前页就行。

**预防**

- 升级到 `miniprogram-automator >= 0.13`（如果有修复）
- 在 util 层封装 `safeNavigate(type, url)`，所有跳转走这个，内部统一用 `callWxMethod` 绕过 bug

---

### C2. WSL 2 + Windows DevTools 网络不通

**症状**

WSL 里调 WebSocket 失败：

```
Error: connect ECONNREFUSED 127.0.0.1:9420
```

或 HTTP 也连不上 9421。

**根因**

WSL 2 默认是 NAT 网络模式（早期）或 mirrored 模式。早期 NAT 模式下 `127.0.0.1` 不一定直通 Windows localhost。9420 / 9421 又是 DevTools 自己开的端口，绑定在 Windows 0.0.0.0 / 127.0.0.1。

**修复**

WSL 2 用 `localhost` 不用 `127.0.0.1`：

```ts
// ✅ 通
await automator.connect({ wsEndpoint: 'ws://localhost:9420' });
await fetch('http://localhost:9421/...');

// ❌ 可能 ECONNREFUSED
await automator.connect({ wsEndpoint: 'ws://127.0.0.1:9420' });
```

**预防**

- 项目里所有 WSL → Windows 的连接统一用 `localhost`
- 在 `global-setup.ts` 等 E2E 配置里强制写死

---

### C3. cli.bat 启动后被 WSL 进程组回收

**症状**

WSL 里执行 `cmd.exe /c "cli.bat auto ..."` 启动 DevTools，DevTools 跑起来了，但 WSL shell 一退出 / 一段时间后，DevTools 进程被杀，9420 端口消失。

**根因**

WSL 把从 Linux 进程 spawn 出去的 Windows 进程挂在 WSL 进程组下，WSL shell 退出时把整个进程组一起 kill。

**修复**

用 `nohup` + `disown` 让进程脱离 WSL 进程组：

```bash
nohup bash scripts/keep-devtools.sh > /tmp/devtools-keep.log 2>&1 &
disown -a 2>/dev/null || true
```

`scripts/keep-devtools.sh` 本身做：

```bash
#!/bin/bash
set -e
cmd.exe /c "taskkill /F /IM wechatdevtools.exe" 2>/dev/null || true
sleep 1
cmd.exe /c "E:\\ProgramData\\Tencent\\微信web开发者工具\\cli.bat auto \
  --port 9421 --auto-port 9420 \
  --project D:\\code\\yuanBabyGrowthDiary\\miniprogram" \
  > /tmp/devtools-startup.log 2>&1 &
disown -a 2>/dev/null || true

# 守护：每 30s 检查端口，丢失就重启
while true; do
  sleep 30
  LISTENING=$(cmd.exe /c "netstat -ano" 2>&1 | grep "0.0.0.0:9420.*LISTENING")
  if [ -z "$LISTENING" ]; then
    echo "[$(date +%T)] 9420 not listening, restarting IDE..."
    cmd.exe /c "E:\\ProgramData\\Tencent\\微信web开发者工具\\cli.bat auto ..." > /tmp/devtools-startup.log 2>&1 &
    disown -a 2>/dev/null || true
  fi
done
```

**预防**

- 在 WSL 里启动任何 Windows 进程，都加 `nohup ... &` + `disown -a`
- 关键进程（DevTools、ADB 等）配套写守护脚本

---

### C4. App.captureScreenshot 永久 hang

**症状**

测试跑到 `automator.screenshot()` 一直不出结果，120s 后 Jest 超时。但同一会话里 `App.getCurrentPage` / `App.getPageStack` 都正常返回。

**根因**

WeChat DevTools 在 `--auto` 模式下启动后：

- 9420 WebSocket 监听开起来
- 项目配置加载完，page stack 已就绪
- **但模拟器渲染器没有真正激活**（因为没有可见 UI 窗口）

`App.captureScreenshot` 需要从渲染器内部拿一帧像素，渲染器没激活就一直等。

多次 IDE 重启后这个状态可能更糟：9420 在监听但渲染器假死。

**修复**

1. **临时方案**：让 DevTools 保持单次启动，不要反复重启
2. **真方案**：在 Windows 上保留 DevTools 窗口可见（哪怕最小化），不要用纯 `--auto` 模式
3. **CI 方案**：用 `miniprogram-ci` 的 preview 模式截图，协议不同不走 9420

守护脚本已经会保活 9420 端口，但要完全稳定，仍需 Windows 侧有 DevTools 窗口。

**预防**

- 跑 E2E 前确认 Windows DevTools 窗口是可见的（哪怕最小化）
- 不要在同一会话里反复 `taskkill` + `cli.bat auto` 启动 IDE
- 长期方向：把 E2E 截图任务改用 `miniprogram-ci` + 真机/模拟器

---

## D. 已知不修的警告

这些是已知的、来自第三方库的告警，**不影响功能**，等官方升级或网络恢复即可。

| 警告 | 来源 | 何时会修 |
|------|------|----------|
| `wx.getSystemInfoSync is deprecated` | Vant Weapp 1.11.7 `common/version.js` | 等 Vant 升级到不用这个 API |
| `Failed to load font at.alicdn.com/...` | iconfont CDN 慢/断 | 临时网络问题 |
| `Failed to load image img.yzcdn.cn/vant.Empty-1` | Vant Empty 占位图 CDN 404 | 临时 / 换默认图 |
| `Error: timeout at WAServiceMainContext` | DevTools 状态异常 | 守护脚本会保活 |
| `wx.saveFile / removeSavedFile 即将废弃` | Vant 懒加载代码（不在 `miniprogram_npm` 可见） | 等 Vant 升级 |

对应替换方案（Vant 升级后）：

- `wx.getSystemInfoSync` → `wx.getSystemSetting()` / `wx.getDeviceInfo()` / `wx.getWindowInfo()` / `wx.getAppBaseInfo()` 分场景替换
- `wx.saveFile` / `wx.removeSavedFile` → `wx.getFileSystemManager().saveFile()` / `.removeSavedFile()`
