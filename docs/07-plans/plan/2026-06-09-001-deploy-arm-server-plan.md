# Plan: ARM 本地测试服务器自动部署方案 (方案③)

> **版本**: v1.0 | **最后更新**: 2026-06-09
> **状态**: ✅ 活跃
> **配套**: `docs/deployment/arm-server-setup.md`（服务器搭建指南）

---

## Summary

为局域网 ARM 开发板 (`192.168.50.126`) 配置 git post-push hook 自动部署机制，实现推送 worktree 分支代码后后端服务自动更新到 ARM 测试服务器。同时保留 `scripts/deploy-arm.sh` 作为手动部署入口。

## Problem Frame

ARM 测试服务器位于局域网内（无公网 IP），无法接收 GitHub WebHook 推送。但 WSL2 开发机和 ARM 板在同一个 `192.168.50.0/24` 网段，且开发机可通过 SSH 访问 ARM 板。利用这一条件：**开发机推送代码到 GitHub 后，git post-push hook 自动触发 SSH → ARM 板拉取代码 → 重启 Docker 服务**，实现半自动持续部署。

## Key Technical Decisions

| # | 决策 | 方案 | 理由 |
|---|------|------|------|
| KTD1 | 触发时机 | **git post-push hook** | push 成功后自动触发，无需手动执行；push 失败时 hook 不运行，避免空部署 |
| KTD2 | 代码更新方式 | **ARM 板 git pull**（从 GitHub 拉取） | 不依赖 sshpass/SFTP 同步；ARM 板可直接访问 github.com（HTTPS） |
| KTD3 | 部署入口 | **`deploy-arm.sh` 既是独立脚本也是 hook 调用目标** | 同一份部署逻辑，手动和自动共用，避免两份逻辑不同步 |
| KTD4 | Hook 存储位置 | **项目 `scripts/hooks/` 目录 + 安装脚本** | post-push hook 不被 git 跟踪，通过安装脚本从项目目录复制到 worktree 的 git hooks 目录 |
| KTD5 | 镜像构建策略 | **ARM 板本地 `docker build`** | ARM64 架构无法直接拉取 x86 镜像；python:3.11-slim 有 ARM64 官方镜像 |

## Implementation Units

### U1. 创建 ARM 板 Docker Compose 覆盖配置

**Goal:** 创建 `server/docker-compose.arm.yml`，覆盖 nginx server_name 为 ARM 板 IP，适配 ARM64 架构。

**Requirements:** ARM 服务器 `192.168.50.126` 上的 Docker Compose 服务编排需要覆盖默认配置中的 nginx server_name 和镜像架构。

**Files:**
- `server/docker-compose.arm.yml` (create)
- `server/nginx/default.conf.arm` (create)

**Approach:**

`docker-compose.arm.yml` 覆盖 `docker-compose.yml` 中 nginx 的 volumes 配置，使用 ARM 特化的 `default.conf.arm` 配置文件（server_name 改为 `192.168.50.126`）。通过 `docker compose -f docker-compose.yml -f docker-compose.arm.yml up -d` 联合加载。

`nginx/default.conf.arm` 与 `default.conf` 的差异仅在三处：
1. `server_name` 改为 `192.168.50.126`
2. 移除 SSL/443 端口（局域网环境）
3. 注释改为 ARM 标识

**Test expectation:** none — 配置文件无运行时可测试行为。验证方式：部署后 `curl http://192.168.50.126/health` 返回 200。

---

### U2. 创建 ARM 部署脚本

**Goal:** 创建 `scripts/deploy-arm.sh`，实现 SSH 到 ARM 板 → git pull → docker compose up -d → 健康检查 → 自动回滚的完整流水线。

**Requirements:** 支持手动执行、支持被 git hook 调用、支持健康检查自动回滚。

**Files:**
- `scripts/deploy-arm.sh` (create)

**Approach:**

参考 `server/scripts/webhook/deploy.sh` 的部署逻辑，适配 ARM 环境：

1. SSH 登录 ARM 板 (`linaro@192.168.50.126`) 执行远程命令
2. 在 ARM 板上 `cd /home/linaro/baby-album && git fetch origin worktree-feat+arm-test-server`
3. 记录旧版本 hash → `git reset --hard origin/worktree-feat+arm-test-server`
4. ARM 板本地 `docker build -t baby-api-base:latest .`（ARM64 需本地构建）
5. `docker compose -f docker-compose.yml -f docker-compose.arm.yml up -d`
6. SSH 端口转发健康检查（或通过 ARM 板 curl）
7. 健康检查失败时自动回滚代码版本并重启旧容器

**关键设计点：**
- 使用 `ssh -o BatchMode=yes` 确保无交互（SSH key 认证见 U3）
- 远程命令用 heredoc 组织，避免多次 SSH 连接
- 健康检查通过 ssh 在远端执行 `curl -s http://localhost:8000/health`

**Test scenarios:**
- Happy path: 推送有后端变更的 commit → SSH 连接成功 → git pull 成功 → docker build 成功 → 健康检查通过
- Edge: 无新提交（hash 相同）→ 跳过部署，exit 0
- Failure: 健康检查失败 → 自动 git reset --hard 回滚 → 重启旧容器
- Failure: SSH 连接失败 → 非零退出，hook 不阻塞 push
- Failure: git fetch 网络错误 → 重试 3 次后退出

---

### U3. 配置 SSH 免密认证

**Goal:** 配置 WSL2 开发机到 ARM 板的 SSH key 认证，使 `deploy-arm.sh` 可无密码执行。

**Files:**
- 部署说明文档（内嵌在 README 或脚本注释中）

**Approach:**
1. 在 WSL2 执行 `ssh-keygen -t ed25519 -f ~/.ssh/id_ed25519 -N ""`（如不存在）
2. `ssh-copy-id linaro@192.168.50.126`（首次需密码 `89728972`）
3. 验证 `ssh -o BatchMode=yes linaro@192.168.50.126 "echo OK"` 返回 OK
4. 配置 `~/.ssh/config`：

```
Host baby-arm
    HostName 192.168.50.126
    User linaro
    IdentityFile ~/.ssh/id_ed25519
```

**Test scenarios:**
- Happy path: `ssh baby-arm "docker ps"` 无需密码直接返回
- Failure: SSH key 未安装 → 提示运行 `ssh-copy-id`
- Edge: 密钥变更后 → 需重新 `ssh-copy-id`

---

### U4. 配置 git post-push hook

**Goal:** 在 worktree 中配置 post-push hook，push 成功后自动调用 `scripts/deploy-arm.sh`。

**Files:**
- `scripts/hooks/post-push` (create)
- 安装说明（内嵌在脚本注释或 README）

**Approach:**

创建 `scripts/hooks/post-push` 脚本：

```bash
#!/bin/bash
# post-push hook — push 成功后自动部署到 ARM 测试服务器
# 安装: ln -sf ../../scripts/hooks/post-push .git/hooks/post-push

# 仅对 worktree 分支生效
BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [[ "$BRANCH" != "worktree-feat"* ]]; then
    exit 0
fi

# 检查是否有 server/ 目录变更
# （无 server/ 变更时跳过部署）
if ! git diff --name-only HEAD.."@{upstream}" 2>/dev/null | grep -q "^server/"; then
    echo "[post-push] 无 server/ 目录变更，跳过 ARM 部署"
    echo "[post-push] 如需强制部署，运行: ./scripts/deploy-arm.sh"
    exit 0
fi

echo "[post-push] 检测到 server/ 变更，开始部署到 ARM 服务器..."
./scripts/deploy-arm.sh
```

**要点：**
1. Hook 只对 `worktree-feat*` 分支生效，防止误触发其他分支的部署
2. 自动检测是否有 `server/` 目录变更，无变更时跳过部署（前端代码变更不需要部署到 ARM）
3. Hook 运行在 push 成功之后（post-push vs pre-push），不阻塞 push 过程
4. 即使 hook 失败，push 已经完成，不影响远程仓库

**安装方式：**
```bash
cd /mnt/d/code/yuanBabyGrowthDiary/.git/worktrees/feat+arm-test-server
ln -sf ../../../../scripts/hooks/post-push hooks/post-push
```

**Test expectation:** none — hook 逻辑在 U2 的 `deploy-arm.sh` 测试中覆盖。

---

### U5. ARM 板初始环境搭建文档

**Goal:** 记录在 ARM 板上首次搭建后端运行环境所需的步骤。

**Files:**
- `docs/deployment/arm-server-setup.md` (create)

**Approach:**

记录以下步骤：
1. 在 ARM 板安装 Docker：`sudo apt-get install docker.io docker-compose-v2`
2. 克隆仓库：`git clone git@github.com:tornado404/baby-album-miniprogram.git /home/linaro/baby-album`
3. 切换到 worktree 分支：`cd /home/linaro/baby-album && git checkout worktree-feat+arm-test-server`
4. 创建 `.env` 文件（模板可参考 `server/.env.example`）
5. 初始化 MinIO 存储桶：`python3 server/scripts/init_minio.py`
6. 手动首次启动验证：`cd server && docker compose -f docker-compose.yml -f docker-compose.arm.yml up -d`
7. 验证 API：`curl http://localhost:8000/health`

**Test expectation:** none — 文档性质，首次搭建时手动验证即可。

---

### U6. ARM 板定时轮询（备用方案）

**Goal:** 在 ARM 板上配置 crontab 定时轮询作为备用机制，防止 post-push hook 意外失败时 ARM 服务器长期不更新。

**Files:**
- （在 ARM 板上配置，不入版本库）

**Approach:**

在 ARM 板执行 `crontab -e`，添加：
```bash
# 每 10 分钟检查 worktree 分支是否有新提交（仅在 hook 失败时回退）
*/10 * * * * cd /home/linaro/baby-album && git fetch origin && [ $(git rev-parse HEAD) != $(git rev-parse origin/worktree-feat+arm-test-server) ] && git reset --hard origin/worktree-feat+arm-test-server && cd server && docker build -t baby-api-base:latest . && docker compose -f docker-compose.yml -f docker-compose.arm.yml up -d
```

**要点：**
- 轮询间隔 10 分钟，不频繁
- 仅在 post-push hook 失败（如 WSL2 关闭后推送）时生效
- 作为保险，不替代 post-push hook 的主流程

---

## 完整工作流

```
开发机 WSL2                           ARM 板 (192.168.50.126)
─────────────────                    ────────────────────────

git push origin worktree-feat+arm-test-server
    │
    ├──→ GitHub 接收代码 ✓
    │
    └──→ post-push hook 自动触发
         │
         ├── 检查: 当前分支 worktree-feat*?     ✓
         ├── 检查: server/ 有变更?             → 是/否（无变更则跳过）
         │
         └── ./scripts/deploy-arm.sh
              │
              ├── ssh linaro@192.168.50.126
              │    │
              │    ├── cd /home/linaro/baby-album
              │    ├── git fetch origin worktree-feat+arm-test-server
              │    ├── git reset --hard origin/worktree-feat+arm-test-server
              │    ├── docker build -t baby-api-base:latest .
              │    ├── docker compose -f docker-compose.yml -f docker-compose.arm.yml up -d
              │    └── curl http://localhost:8000/health → 200 ✓
              │
              └── 健康检查通过 → 部署成功 ✓
                  失败 → 自动回滚

备用: ARM 板 crontab 每 10 分钟轮询 (post-push hook 失败时兜底)
```

## 风险与注意事项

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| SSH key 过期/变更 | hook 无法连接到 ARM 板 | hook 失败不阻塞 push；cron 备用；手动 `deploy-arm.sh` 可用 |
| WSL2 IP 变动 | 无影响（hook 从 WSL2 发起 SSH） | SSH 是出站连接，不依赖 WSL2 IP |
| ARM 板关机 | 部署失败 | hook 失败不阻塞 push；启动后手动 `deploy-arm.sh` |
| Docker build 失败（ARM 板） | 新代码无法运行 | deploy-arm.sh 有回滚逻辑 |
| post-push hook 未安装 | 部署不触发 | 需要执行安装命令；cron 备用可兜底 |
| 本分支 PR 合并到 master | 前端 ARM 配置进入 master | **本分支不合并到 master**，仅作为开发分支 |

## 开放问题

| 问题 | 状态 |
|------|------|
| ARM 板 Python 依赖是否需预装 build-essential？某些 pip 包需要编译原生扩展 | 实施时确认 |
| ARM 板是否已安装 `git` 和 `docker`？ | 需首次搭建时确认 |
| WSL2 中 git push 成功后 post-push hook 是否在主进程运行？是否应后台异步执行？ | 建议加 `&` 或 `nohup` 避免阻塞终端 |