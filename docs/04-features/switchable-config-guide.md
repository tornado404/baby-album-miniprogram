# 环境配置切换操作指南

> **版本**: v1.0 | **最后更新**: 2026-06-09
> **状态**: ✅ 已完成
> **配套**: `docs/01-requirements/switchable-config-PRD.md`（需求文档）、`docs/plans/2026-06-09-001-feat-switchable-api-config-plan.md`（实现计划）

---

## 概述

小程序支持三套 API 后端环境，可在**不修改源码**的前提下切换：

| 环境 | API 地址 | 用途 |
|------|---------|------|
| **development** | `http://localhost:8000/api/v1` | 本地 Docker Compose 开发 |
| **testing** | `http://101.126.41.146:8000/api/v1` | 云服务器测试 |
| **production** | `https://api.baby-album.com/api/v1` | 正式上线 |

**配置优先级**（自上而下覆盖）：

```
1. 编译常量 DEFAULT_ENV（CI/CD 构建时注入，优先级最高）
2. wx.setStorageSync 持久化配置（运行时切换，开发调试用）
3. 默认值 'testing'
```

---

## 1. 开发调试：运行时切换（推荐）

开发人员在微信开发者工具中调试时，通过设置页的"开发者面板"切换环境，**无需改代码、无需重新编译**。

### 操作步骤

1. 打开小程序，进入 **"我的"** 页面
2. 滑动到底部，找到 **🛠 开发者设置**
3. 点击开发者设置行，底部弹出**环境选择器**
4. 选择目标环境：
   - **本地开发** → 指向本机 Docker 后端
   - **测试服务器** → 指向云服务器测试后端
   - **生产环境** → 指向正式域名（仅在开发模式下可选）
5. 点击 **"确认切换"**
6. 弹窗提示"环境已切换，是否立即重启小程序？"
   - 点击 **"立即重启"** → 小程序自动退出，重新打开后生效
   - 点击 **"稍后重启"** → 手动关闭小程序重开

### 注意事项

- 切换后必须**重启小程序**才能生效（`config/api.ts` 在模块初始化时读取配置）
- 每次重启后会恢复上次选中的环境（配置已持久化到微信本地存储）
- 开发者面板在**生产构建包中自动隐藏**（安全保护）
- 切换后可在控制台看到日志：`[config] 环境已切换至: testing 测试服务器`

---

## 2. CI/CD 构建：编译常量注入

构建时为 `project.config.json` 注入 `setting.define.DEFAULT_ENV`，通过 `miniprogram-ci` 打包时替换全局常量。

### 命令

```bash
# 开发构建（指向 localhost）
npm run build:dev

# 测试构建（指向云服务器）
npm run build:test

# 生产构建（指向正式域名）
npm run build:prod
```

### 操作流程

每个构建命令依次完成：

1. 备份 `project.config.json` → `project.config.json.bak`
2. 注入 `setting.define.DEFAULT_ENV`（例如 `"\"testing\""`）
3. 调用 `miniprogram-ci` 或开发者工具进行构建
4. 恢复 `project.config.json`（清除 `define` 字段）

### 手动使用

```bash
# 仅注入（不构建），适合 CI 多步骤场景
node scripts/build.js testing

# 执行构建（如 miniprogram-ci）
npm run ci:build

# 构建完成后恢复
node scripts/build.js --restore
```

### 验证注入是否成功

```bash
node -e "var c=require('./project.config.json'); console.log(c.setting.define.DEFAULT_ENV)"
# 输出: "\"testing\""
```

---

## 3. CI/CD 自动化：GitHub Actions

配置文件：`.github/workflows/miniprogram-ci.yml`

### 触发条件

- **push 到 `master` 或 `feat/*`** 且涉及 `miniprogram/**`、`scripts/**`、`package.json`、`project.config.json`
- **PR 到 `master`** 且涉及上述路径

### 自动流程

```
checkout → npm ci → npm run test:unit → node scripts/build.js <env>
    → 验证注入 → node scripts/build.js --restore → git diff 验证配置文件未污染
```

### 环境选择策略

| 触发方式 | 构建环境 |
|---------|---------|
| push 到 master（非 PR） | `production` |
| 其他分支 push | `testing` |
| PR 到 master | `testing` |

> ⚠️ **当前 CI 仅作构建验证**，不自动上传到微信平台（需要上传密钥 + IP 白名单）。

---

## 4. 三端环境配置速查

### 4.1 本地开发（development）

| 组件 | 配置 | 启动方式 |
|------|------|---------|
| 后端 API | `localhost:8000` | `cd server && docker-compose up` |
| MinIO | `localhost:9000` | 由 docker-compose 自动启动 |
| PostgreSQL | `localhost:5432` | 由 docker-compose 自动启动 |
| 小程序 | 开发者面板 → 本地开发 | 微信开发者工具打开项目 |

**后端 `.env` 配置参考：**

```ini
MINIO_ENDPOINT=localhost:9000
MINIO_PUBLIC_URL=http://localhost:9000
```

### 4.2 云服务器测试（testing，默认）

| 组件 | 配置 | 说明 |
|------|------|------|
| 后端 API | `101.126.41.146:8000` | 云服务器 Docker 部署 |
| MinIO | `101.126.41.146:9000` | 独立容器 |
| PostgreSQL | docker-compose 内部 | 服务器上运行 |
| 小程序 | 开发者面板 → 测试服务器 | 或默认即 testing |

### 4.3 正式生产（production）

| 组件 | 配置 | 说明 |
|------|------|------|
| 后端 API | `api.baby-album.com` | 正式域名 |
| MinIO | 同服务器 | 需配置域名 |
| 小程序 | `npm run build:prod` | 构建时注入常量 |

---

## 5. 常见问题

### Q: 切换环境后 API 请求还是旧的地址？

**原因**：`API_CONFIG` 在模块初始化时已绑定，切换后需重启小程序。
**解决**：弹窗时点击"立即重启"，或手动关闭小程序重新打开。

### Q: 开发者面板不见了？

**原因**：生产构建（`DEFAULT_ENV=production`）禁用了运行时切换能力，属于安全设计。
**解决**：使用 `npm run build:dev` 或 `npm run build:test` 构建后再测试。

### Q: `project.config.json` 被修改了？

**原因**：`build.js` 在注入 `define` 后未正常恢复（如进程被强制终止）。
**解决**：
```bash
# 方案一：执行恢复命令
node scripts/build.js --restore

# 方案二：手动删除 define 字段
# 编辑 project.config.json，删除 setting.define 整块内容
```

### Q: 构建时 `define` 不生效？

**原因**：`setting.define` 仅在 `miniprogram-ci` 打包时生效，对微信开发者工具的实时编译不生效。
**解决**：开发调试使用"运行时切换"（第 1 节），CI 构建使用 `build.js`（第 2 节）。

### Q: 多人协作时各人本地配置冲突？

**解决**：运行时切换的配置存储在微信本地存储（`wx.setStorageSync`），不涉及项目文件，不会冲突。如需持久化的本地配置文件，使用 `project.private.config.json`（已列入 `.gitignore`）。

---

## 6. 相关文件

| 文件 | 作用 |
|------|------|
| `miniprogram/config/api.ts` | 配置中心，定义三套环境 + 切换逻辑 |
| `miniprogram/services/config_service.ts` | 运行时切换编程接口 |
| `miniprogram/pages/settings/settings.ts` | 设置页 + 开发者面板 |
| `scripts/build.js` | 编译常量注入脚本 |
| `scripts/ci.js` | miniprogram-ci 构建/上传工具 |
| `.github/workflows/miniprogram-ci.yml` | CI 自动构建工作流 |
| `project.config.json` | 项目配置（含 `setting.define` 注入位） |
| `server/.env.example` | 后端环境模板（含 MinIO 多环境注释） |