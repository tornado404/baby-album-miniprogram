# 微信小程序开发脚本

此目录包含用于微信小程序开发、测试和 CI/CD 的脚本。

## 文件说明

| 文件 | 用途 | 运行环境 |
|------|------|----------|
| `capture-automated.js` | 全自动截屏（单进程 mp.screenshot） | Node.js |
| `capture-first-screen.js` | 手动模式截屏（DevTools 已启动） | Node.js |
| `capture-with-window.bat` | 一键截屏入口（双击运行） | Windows CMD |
| `first-screen-access.js` | 首屏数据读取 + DOM 探测 + npm 构建验证 | Node.js |
| `build-npm.js` | 修复 tdesign npm 构建（import/export→CommonJS） | Node.js |
| `launch-devtools.js` | DevTools 启动器（fs 模块搜索中文路径） | Node.js |
| `start-devtools-visible.bat` | DevTools 一键启动（双击，窗口可见） | Windows CMD |
| `ci.js` | miniprogram-ci 构建/上传 | Node.js |
| `CLAUDE.md` | 纠错经验记录 | - |

## 一键截屏

```bash
# 方式 A：双击 bat 文件
scripts\capture-with-window.bat

# 方式 B：npm script
npm run capture:full
```

详细指南见 [E2E 测试指南](../docs/E2E-Testing-Guide.md)。

## npm 构建修复

tdesign-miniprogram 的 `import/export` 语法需转换为 CommonJS：

```bash
npm run build:npm
```

## CI/CD 上传

```bash
npm run ci:build    # 构建 npm
npm run ci:preview  # 预览
npm run ci:upload   # 上传
```

## 前置条件

1. 微信开发者工具已安装
2. 设置 → 安全设置 → 服务端口 已开启
3. 已运行 `npm install` 安装依赖

## 端口配置

- **9420**: WebSocket 端口（miniprogram-automator 连接）
- **9421**: HTTP 端口（IDE 控制）

## 参考

- [E2E 测试指南](../docs/E2E-Testing-Guide.md)
- [截屏自动化指南](../docs/Automation-Screenshot-Guide.md)
- [微信自动化测试文档](https://developers.weixin.qq.com/miniprogram/dev/devtools/auto/)
- [miniprogram-ci 文档](https://developers.weixin.qq.com/miniprogram/dev/devtools/ci.html)