# 微信小程序开发脚本

此目录包含用于微信小程序开发、测试、CI/CD 以及**后端部署**的脚本。

## 后端部署

### 部署环境概览

| 环境 | 服务器 | 用户 | 部署方式 | 用途 |
|------|--------|------|----------|------|
| **生产**（腾讯云） | 101.126.41.146 | root | `deploy-to-server.sh` | 线上正式环境 |
| **测试**（ARM） | 192.168.50.126 | linaro | `deploy-arm.sh` | 本地 ARM 开发板测试 |

### 部署命令

```bash
# 生产环境部署（云服务器）
./scripts/deploy-to-server.sh

# ARM 测试环境部署（本地开发板）
./scripts/deploy-arm.sh
```

### ARM 测试环境架构

```
┌──────────────────────────────────────────────────┐
│  ARM 开发板 (192.168.50.126)                      │
│                                                   │
│  ┌──────────┐  ┌─────────┐  ┌──────────────────┐ │
│  │ Nginx:80 │→ │ API:8000│→ │ PostgreSQL:5432  │ │
│  │ (反向代理)│  │ (FastAPI)│  │ Redis:6379       │ │
│  └──────────┘  └─────────┘  └──────────────────┘ │
│                  ↓                               │
│  ┌──────────────────────────────────────────────┐│
│  │ MinIO:9000 (对象存储) / :9001 (控制台)        ││
│  └──────────────────────────────────────────────┘│
└──────────────────────────────────────────────────┘
```

### 服务配置分离

生产配置保留在 `server/` 主配置文件中，ARM 测试环境的差异通过覆盖文件实现：

| 文件 | 作用 |
|------|------|
| `server/docker-compose.yml` | 公共配置（生产+测试共用） |
| `server/docker-compose.arm.yml` | ARM 覆盖（server_name、nginx 挂载路径） |
| `server/docker-compose-minio.yml` | MinIO 独立配置 |
| `server/nginx/default.conf` | 生产 nginx 配置（server_name: 101.126.41.146） |
| `server/nginx/default.conf.arm` | ARM nginx 配置（server_name: 192.168.50.126） |

ARM 部署使用 compose override 模式：
```bash
docker-compose -f docker-compose.yml -f docker-compose.arm.yml up -d
```

### 首次部署 ARM

首次部署需要构建 API 镜像（ARM 本地构建，约 5-10 分钟）：
```bash
# 在 ARM 板上
cd /home/linaro/baby-album/server
docker build -t baby-api-base:latest .

# 或使用部署脚本（自动完成所有步骤）
./scripts/deploy-arm.sh
```

镜像构建后，后续更新代码只需重启容器（无需重新构建）：
```bash
docker-compose -f docker-compose.yml -f docker-compose.arm.yml restart api
```

### 服务管理命令

```bash
# 查看所有容器状态
docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'

# 查看日志
docker logs baby-api -f --tail 50
docker logs baby-postgres -f --tail 20

# 重启单个服务
docker-compose -f docker-compose.yml -f docker-compose.arm.yml restart api
docker-compose -f docker-compose-minio.yml restart minio

# 重建容器（配置变更后使用）
docker-compose -f docker-compose.yml -f docker-compose.arm.yml up -d --force-recreate

# 停止所有服务
docker-compose -f docker-compose.yml -f docker-compose.arm.yml down
docker-compose -f docker-compose-minio.yml down

# 更新 API 代码（无需构建镜像，代码通过卷挂载）
# 1. 在本地修改 app/ 目录下的代码
# 2. 重启 API 容器
cd /home/linaro/baby-album/server
docker-compose -f docker-compose.yml -f docker-compose.arm.yml restart api
```

### 服务访问地址

| 服务 | ARM 测试环境 | 生产环境 |
|------|-------------|---------|
| API 直连 | http://192.168.50.126:8000 | http://101.126.41.146:8000 |
| Nginx 代理 | http://192.168.50.126/ | http://101.126.41.146/ |
| Swagger 文档 | http://192.168.50.126:8000/docs | http://101.126.41.146:8000/docs |
| MinIO API | http://192.168.50.126:9000 | http://101.126.41.146:9000 |
| MinIO 控制台 | http://192.168.50.126:9001 | http://101.126.41.146:9001 |

### 账号信息

| 服务 | 账号 | 密码 |
|------|------|------|
| PostgreSQL | app | Cs516@2026 |
| MinIO 管理 | Cs516@2026 | Cs516@2026 |
| ARM SSH | linaro | 89728972 |
| 云服务器 SSH | root | Cs516@123456 |

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

详细指南见 [E2E 测试指南](../docs/05-testing/E2E-Testing-Guide.md)。

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

- [E2E 测试指南](../docs/05-testing/E2E-Testing-Guide.md)
- [截屏自动化指南](../docs/05-testing/Automation-Screenshot-Guide.md)
- [微信自动化测试文档](https://developers.weixin.qq.com/miniprogram/dev/devtools/auto/)
- [miniprogram-ci 文档](https://developers.weixin.qq.com/miniprogram/dev/devtools/ci.html)