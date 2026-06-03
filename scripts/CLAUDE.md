# Scripts/CLAUDE.md

本目录包含微信小程序的自动化测试、构建、截屏等脚本。以下是编写和调试这些脚本过程中的纠错经验记录。

---

## 1. miniprogram-automator API 陷阱

### 1.1 不能解构导入
```javascript
// ❌ 错误 - destructured import 会丢失 this 绑定，导致 "Cannot read properties of undefined (reading 'launcher')"
const { connect } = require('miniprogram-automator');
const mp = await connect({ wsEndpoint });

// ✅ 正确
const m = require('miniprogram-automator');
const mp = await m.connect({ wsEndpoint });
```

### 1.2 reLaunch 参数必须是字符串
```javascript
// ❌ 错误 - 微信开发者工具 API 不接受对象参数
await mp.reLaunch({ url: '/pages/album_home/album_home' });
// → "parameter error: parameter.url should be String instead of Object"

// ✅ 正确
await mp.reLaunch('/pages/album_home/album_home');
```

### 1.3 MiniProgram 没有 .page 属性
```javascript
// ❌ 错误 - MiniProgram 实例没有 .page 属性
const data = await mp.page.data();

// ✅ 正确 - 使用 currentPage() 或 reLaunch/navigateTo 返回值
const page = await mp.reLaunch('/pages/album_home/album_home');
// 或
const page = await mp.currentPage();
```

### 1.4 mp.screenshot() 需要 DevTools 窗口可见
```javascript
// ⚠️ 已知限制
// mp.screenshot() 在 DevTools 窗口不可见（后台/最小化）时会永久挂起
// 即使在 auto-launch 模式（windowsHide: false）下，只要 DevTools 窗口不在前台也会超时
// 必须 20s 超时保护，优雅降级而非硬失败

const ss = await Promise.race([
  mp.screenshot(),
  new Promise((_, reject) => setTimeout(() => reject(new Error('screenshot timeout')), 20000))
]);
```

### 1.5 cli.bat auto 进程生命周期影响截图
当使用 `cli.bat auto --auto-port 9420` 启动 DevTools 时，`cli.bat` 进程在启动完成后即退出（exit code 0）。此后：
- **数据读取**（connect/reLaunch/navigateTo/data/$/$$）正常工作
- **mp.screenshot()** 可能超时（即使端口 9420 仍监听）
- **推测原因**：截图功能依赖 DevTools IDE 进程内某状态，cli.bat 退出后该状态丢失

解决方案：尽量在 cli.bat 仍在运行时完成截图，或使用手动启动 DevTools 模式。

---

## 2. Windows 环境特殊问题

### 2.1 .bashrc UTF-16 BOM 错误
Git Bash 的 `.bashrc` 文件以 UTF-16 LE BOM（`\xFF\xFE`）开头，导致每个 bash 命令执行前都出现：
```
$'\377\376.': command not found
```
这不影响命令执行，但会污染输出。修复方式：将 `.bashrc` 另存为 UTF-8 无 BOM。

### 2.2 批处理文件编码
Windows `cmd.exe` 对 UTF-8 BOM 敏感：
```
// ❌ UTF-8 with BOM → cmd.exe 将 REM 注释的每个单词当作命令执行
// → 'DevTools' 不是内部或外部命令

// ✅ 正确
// 1. 保存为 UTF-8 无 BOM
// 2. 文件开头添加: chcp 65001 >nul
// 3. 行尾使用 \r\n (CRLF)
```

### 2.3 包含中文的路径
微信开发者工具安装在包含中文的路径：
```
E:\ProgramData\Tencent\微信web开发者工具\cli.bat
```

在 JavaScript 字符串中使用该路径时：
```javascript
// ❌ 错误 - JavaScript 将 \P、\T 等视为转义序列，无声丢弃反斜杠
const cli = 'E:\ProgramData\Tencent\微信web开发者工具\cli.bat';
// → 实际值: "E:ProgramDataTencent微信web开发者工具cli.bat" (反斜杠全部丢失)

// ✅ 正确 - 使用正斜杠 (Windows Node.js 支持)
const cli = 'E:/ProgramData/Tencent/微信web开发者工具/cli.bat';

// ✅ 也正确 - 双反斜杠转义
const cli = 'E:\\ProgramData\\Tencent\\微信web开发者工具\\cli.bat';
```

### 2.4 spawn .bat 文件需 shell: true
```javascript
// ❌ 错误 - 直接 spawn .bat 文件返回 ENOENT
spawn('cli.bat', [...args]);

// ✅ 正确
spawn('cli.bat', [...args], { shell: true });
```

### 2.5 端口检测用 127.0.0.1 而非 localhost
Windows 上 `localhost` 可能优先解析为 IPv6 `::1`，导致连接失败：
```javascript
// ❌ 可能失败 (IPv6 优先)
createConnection(9420, 'localhost');

// ✅ 正确
createConnection(9420, '127.0.0.1');
```

---

## 3. Skyline 渲染器与页面加载时序

### 3.1 isLoading 状态机
页面 `album_home` 的生命周期：
```
onLoad → checkAuthorization() → initPage()
  → setData({ isLoading: true })      ← 显示加载中
  → storageService.getBabies()        ← 异步读取本地数据
  → setData({ babies, currentBaby })
  → loadMediaList()                   ← 再次异步读取
  → setData({ isLoading: false })     ← 隐藏加载中
```

`setData` 是异步的，数据从逻辑层发送到渲染层需要时间。Skyline 渲染器在此基础上还需要额外的布局计算时间。

### 3.2 waitForPageReady 三阶段策略
```javascript
async function waitForPageReady(page, timeoutMs = 20000) {
  // 阶段1: 轮询 isLoading === false (数据加载完成)
  // 阶段2: 静置 2s (等待 Skyline 渲染器完成布局计算)
  // 阶段3: 验证关键 DOM 元素已渲染 (如 .empty-container, .upload-btn)
  //        再静置 500ms 稳定布局
}
```

### 3.3 固定延迟不可靠
```javascript
// ❌ 错误 - 固定 2s 延迟不够，按钮被拉伸到底部
await sleep(2000);
takeScreenshot();

// ✅ 正确 - 等待 isLoading + 额外渲染等待 + DOM 验证
await waitForPageReady(page);
takeScreenshot();
```

---

## 4. npm 构建问题

### 4.1 tdesign-miniprogram import/export 语法
`tdesign-miniprogram 1.15.0` 的 `miniprogram_dist/` 目录中所有 `.js` 文件使用 ES module 语法（`import`/`export`），但微信小程序 runtime 只支持 CommonJS（`require`/`module.exports`）。

微信开发者工具的「工具 → 构建 npm」在某些版本中仅复制文件，未进行语法转换，导致运行时 `SyntaxError: Unexpected token {`。

### 4.2 修复方法
使用 `@babel/core` + `@babel/preset-env` 批量转换：
```javascript
const result = babelCore.transformSync(content, {
  presets: [[presetEnv, {
    modules: 'commonjs',      // import → require
    targets: { chrome: '53' } // 微信小程序基础库对应版本
  }]]
});
```

运行方式：`node scripts/build-npm.js`

### 4.3 检测方法
自动化检查 `miniprogram_npm/` 中是否残留 import/export：
```javascript
if (/^(import|export)\b/m.test(fileContent)) {
  // 标记为问题文件
}
```

---

## 5. 文件操作与写文件

### 5.1 Write 工具要求先 Read
`Write` 工具要求目标文件必须先被 `Read` 过（即使是新建文件）。如果文件不存在，可先用 `Bash` 的 `touch` 创建空文件，再 `Read`，再 `Write`。

### 5.2 Bash 写文件方法
在 Git Bash 中写文件到 Windows 路径的可靠方法：
```bash
# 方法1: python3 heredoc (注意编码)
python3 -c "open('path/to/file','w').write(open('/dev/stdin','r').read())" << 'EOF'
content here
EOF

# 方法2: node -e (内联 JavaScript)
node -e "const fs=require('fs');fs.writeFileSync('path/to/file','content','utf-8')"

# 方法3: 先用 touch 创建，再用 Write 工具 (推荐)
```

---

## 6. CI/CD 与测试

### 6.1 npm 脚本注册
`package.json` 中的脚本应遵循已存在的命名风格：
```json
{
  "build:npm": "node scripts/build-npm.js",
  "start:first-screen": "node scripts/first-screen-access.js",
  "capture:first-screen": "node scripts/capture-first-screen.js"
}
```

### 6.2 测试文件命名
- **单元测试**: `tests/**/*.test.ts` (由 Jest 的 unit 项目处理)
- **E2E 测试**: `miniprogram/tests/specs/**/*.spec.ts` (由 Jest 的 e2e 项目处理)
- **独立脚本**: `scripts/*.js` (直接 node 执行)

---

## 7. 记忆与持久化

重要发现应使用 `Memory` 工具写入 `C:\Users\zzc245\.claude\projects\D--code-yuanBabyGrowthDiary\memory\` 目录，以便跨会话持久化。记忆文件头部包含 metadata（type/description），正文结尾标注 **Why:** 和 **How to apply:**。