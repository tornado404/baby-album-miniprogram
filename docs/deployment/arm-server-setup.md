# ARM 本地测试服务器搭建指南

## 概述

ARM 本地测试服务器 (192.168.50.126) 用于在局域网环境中运行后端服务，方便快速测试和持续集成。配合 git post-push hook，推送 `worktree-feat*` 分支代码后自动部署。

## 前置条件

- ARM 开发板（如树莓派、香橙派等 ARM64 设备）
- 操作系统：Ubuntu/Debian ARM64
- 局域网 IP：192.168.50.126（固定 IP）
- 账号：linaro

## 一、ARM 板初始环境搭建

### 1.1 安装 Docker

```bash
sudo apt-get update
sudo apt-get install -y docker.io docker-compose-v2
sudo systemctl enable docker
sudo systemctl start docker
sudo usermod -aG docker $USER
# 注销后重新登录使组生效
```

### 1.2 配置 Git SSH Key

```bash
ssh-keygen -t ed25519 -f ~/.ssh/id_ed25519 -N ""
cat ~/.ssh/id_ed25519.pub
# 将公钥添加到 GitHub: https://github.com/settings/keys
```

### 1.3 克隆仓库

```bash
git clone git@github.com:tornado404/baby-album-miniprogram.git /home/linaro/baby-album
cd /home/linaro/baby-album
git checkout worktree-feat+arm-test-server
```

### 1.4 创建环境变量文件

```bash
cp server/.env.example server/.env
# 编辑 server/.env 中的配置
```

### 1.5 首次手动启动验证

```bash
cd server
docker compose -f docker-compose.yml -f docker-compose.arm.yml up -d
```

等待服务启动后验证：

```bash
# 检查容器状态
docker ps

# API 健康检查
curl http://localhost:8000/health

# Nginx 代理检查
curl http://localhost/health
```

## 二、WSL2 开发机配置

### 2.1 SSH 免密登录

```bash
# 生成 SSH key（如已存在则跳过）
ssh-keygen -t ed25519 -f ~/.ssh/id_ed25519 -N ""

# 复制到 ARM 板
ssh-copy-id linaro@192.168.50.126
# 密码: 89728972

# 验证免密登录
ssh -o BatchMode=yes linaro@192.168.50.126 "echo OK"
```

### 2.2 配置 SSH Config（可选）

创建/编辑 `~/.ssh/config`：

```
Host baby-arm
    HostName 192.168.50.126
    User linaro
    IdentityFile ~/.ssh/id_ed25519
```

之后可以简写为：`ssh baby-arm`

### 2.3 安装 git post-push hook

```bash
# 在 WSL2 中执行
cd /mnt/d/code/yuanBabyGrowthDiary/.git/worktrees/feat+arm-test-server
ln -sf ../../../../scripts/hooks/post-push hooks/post-push
```

## 三、使用方式

### 自动部署（推荐）

1. 修改代码提交到 worktree 分支
2. `git push` — push 成功后自动触发部署
3. 观察终端输出，查看部署状态

### 手动部署

```bash
# 从项目根目录
./scripts/deploy-arm.sh

# 或指定分支
BRANCH=worktree-feat+arm-test-server ./scripts/deploy-arm.sh
```

### 部署验证

```bash
# API 直连
curl http://192.168.50.126:8000/health

# Nginx 代理
curl http://192.168.50.126/health

# Swagger 文档
curl http://192.168.50.126:8000/docs

# MinIO 控制台
# http://192.168.50.126:9001
# (Cs516@2026 / Cs516@2026)
```

## 四、备用方案：定时轮询

如果 post-push hook 因故未触发，ARM 板可配置 crontab 定期轮询：

```bash
# 在 ARM 板执行
crontab -e
# 添加:
*/10 * * * * cd /home/linaro/baby-album && git fetch origin && [ $(git rev-parse HEAD) != $(git rev-parse origin/worktree-feat+arm-test-server) ] && git reset --hard origin/worktree-feat+arm-test-server && cd server && docker build -t baby-api-base:latest . && docker compose -f docker-compose.yml -f docker-compose.arm.yml up -d
```

## 五、排错指南

| 问题 | 原因 | 解决 |
|------|------|------|
| `ssh: connect to host 192.168.50.126 port 22: No route to host` | ARM 板关机或网络不通 | 检查 ARM 板电源和网络 |
| `Permission denied (publickey)` | SSH key 未配置 | 运行 `ssh-copy-id` |
| `docker: command not found` | Docker 未安装 | 执行步骤 1.1 |
| `git@github.com: Permission denied (publickey)` | ARM 板 Git SSH key 未配置 | 执行步骤 1.2 |
| `health check failed` | API 启动失败 | `docker logs baby-api` 查看日志 |