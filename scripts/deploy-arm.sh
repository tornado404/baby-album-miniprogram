#!/bin/bash
# =============================================================================
# deploy-arm.sh — ARM 本地测试服务器后端部署脚本
#
# 功能: SSH 到 ARM 板 → git pull → docker build → compose up → 健康检查
#
# 用法:
#   ./scripts/deploy-arm.sh                     # 部署当前分支
#   BRANCH=worktree-feat+arm-test-server ./scripts/deploy-arm.sh  # 指定分支
#
# 前置条件:
#   1. SSH key 已配置 (ssh-copy-id linaro@192.168.50.126)
#   2. ARM 板已安装 Docker (docker.io + docker-compose)
#   3. ARM 板已克隆仓库: git clone git@github.com:tornado404/baby-album-miniprogram.git
# =============================================================================
set -euo pipefail

# ── 配置 ──────────────────────────────────────────────────────────────────────
SSH_HOST="linaro@192.168.50.126"
REMOTE_DIR="/home/linaro/baby-album"
REMOTE_SERVER_DIR="${REMOTE_DIR}/server"
BRANCH="${BRANCH:-worktree-feat+arm-test-server}"
HEALTH_URL="http://localhost:8000/health"
SSH_RETRY=3
HEALTH_RETRIES=12
HEALTH_INTERVAL=10

# ── 颜色 ──────────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
log_info()  { echo -e "${GREEN}[INFO]${NC}  $(date '+%H:%M:%S') $*"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC}  $(date '+%H:%M:%S') $*"; }
log_error() { echo -e "${RED}[ERROR]${NC} $(date '+%H:%M:%S') $*"; }

# ── 1. SSH 连通性检查 ───────────────────────────────────────────────────────
log_info "连接到 ARM 测试服务器 (${SSH_HOST})..."

SSH_OK=false
for i in $(seq 1 $SSH_RETRY); do
    if ssh -o BatchMode=yes -o StrictHostKeyChecking=no -o ConnectTimeout=5 "$SSH_HOST" "echo OK" 2>/dev/null; then
        SSH_OK=true
        break
    fi
    log_warn "SSH 连接失败 (尝试 $i/$SSH_RETRY)，3 秒后重试..."
    sleep 3
done

if [ "$SSH_OK" != "true" ]; then
    log_error "无法连接到 ARM 服务器"
    log_error "请检查: 1) SSH key 是否配置  2) ARM 板是否开机  3) 网络连通性"
    exit 1
fi

# ── 2. 执行远程部署 ──────────────────────────────────────────────────────────
log_info "远程部署开始 — 分支: ${BRANCH}"

# 将分支名通过参数传递给远程脚本
# 通过环境变量传递代理，避免 bashrc 非交互式 shell 跳过
ssh -o BatchMode=yes "$SSH_HOST" "http_proxy=http://127.0.0.1:7890 https_proxy=http://127.0.0.1:7890 HTTP_PROXY=http://127.0.0.1:7890 HTTPS_PROXY=http://127.0.0.1:7890 bash -s -- '${BRANCH}'" << 'DEPLOY_SCRIPT'
set -euo pipefail

REPO_DIR="/home/linaro/baby-album"
SERVER_DIR="${REPO_DIR}/server"
BRANCH="${1:?分支名不能为空}"
HEALTH_URL="http://localhost:8000/health"
HEALTH_RETRIES=12
HEALTH_INTERVAL=10
NETWORK_RETRY=3

log_info()  { echo "[INFO]  $(date '+%H:%M:%S') $*"; }
log_warn()  { echo "[WARN]  $(date '+%H:%M:%S') $*"; }
log_error() { echo "[ERROR] $(date '+%H:%M:%S') $*"; }

# 2.1 检查仓库是否存在
if [ ! -d "$REPO_DIR/.git" ]; then
    log_error "仓库目录不存在: $REPO_DIR"
    log_error "请先在 ARM 板执行: git clone git@github.com:tornado404/baby-album-miniprogram.git"
    exit 1
fi

cd "$REPO_DIR"

# 2.2 记录当前版本
OLD_HASH=$(git rev-parse HEAD 2>/dev/null || echo "unknown")
log_info "当前版本: ${OLD_HASH:0:12}"

# 2.3 拉取最新代码
log_info "拉取代码: origin/${BRANCH}"

PULL_OK=false
for i in $(seq 1 $NETWORK_RETRY); do
    if git fetch origin "$BRANCH" 2>/dev/null; then
        PULL_OK=true
        break
    fi
    log_warn "git fetch 失败 (尝试 $i/$NETWORK_RETRY)，5 秒后重试..."
    sleep 5
done

if [ "$PULL_OK" != "true" ]; then
    log_error "git fetch 失败，网络不可达"
    exit 1
fi

# 2.4 检查是否有新提交
LOCAL_HASH=$(git rev-parse HEAD)
REMOTE_HASH=$(git rev-parse "origin/$BRANCH")

if [ "$LOCAL_HASH" = "$REMOTE_HASH" ]; then
    log_info "代码已是最新，无需部署"
    exit 0
fi

# 2.5 更新代码
log_info "更新到 origin/${BRANCH}..."
git reset --hard "origin/$BRANCH"

NEW_HASH=$(git rev-parse HEAD)
log_info "新版本: ${NEW_HASH:0:12}"

# 2.6 构建 Docker 镜像（ARM 板本地构建）
log_info "构建 API 镜像 (ARM64 本地构建，约 5-10 分钟)..."
cd "$SERVER_DIR"
docker build -t baby-api-base:latest .

# 2.7 重启服务
log_info "启动服务栈 (PostgreSQL, Redis, API, Nginx)..."
docker-compose -f docker-compose.yml -f docker-compose.arm.yml up -d --remove-orphans

# 2.8 健康检查
log_info "健康检查中..."

HEALTHY=false
for i in $(seq 1 $HEALTH_RETRIES); do
    if curl -sSf "$HEALTH_URL" > /dev/null 2>&1; then
        HEALTHY=true
        log_info "健康检查通过 (尝试 $i/$HEALTH_RETRIES)"
        break
    fi
    log_info "等待服务就绪... (尝试 $i/$HEALTH_RETRIES)"
    sleep $HEALTH_INTERVAL
done

# 2.9 自动回滚
if [ "$HEALTHY" != "true" ]; then
    log_error "============================================"
    log_error "健康检查失败 — 启动自动回滚"
    log_error "============================================"

    log_info "回滚到: ${OLD_HASH:0:12}"
    cd "$REPO_DIR"
    git reset --hard "$OLD_HASH"

    cd "$SERVER_DIR"
    docker build -t baby-api-base:latest .
    docker-compose -f docker-compose.yml -f docker-compose.arm.yml up -d --remove-orphans

    sleep 10
    if curl -sSf "$HEALTH_URL" > /dev/null 2>&1; then
        log_info "回滚成功 — 运行之前版本"
        exit 0
    fi

    log_error "严重异常：回滚也失败！需要人工介入"
    exit 1
fi

# 2.10 清理
docker image prune -f 2>/dev/null || true
log_info "============================================"
log_info "部署成功完成"
log_info "分支: ${BRANCH}"
log_info "版本: ${NEW_HASH:0:12}"
log_info "============================================"
DEPLOY_SCRIPT

EXIT_CODE=$?
if [ $EXIT_CODE -eq 0 ]; then
    log_info "ARM 服务器部署完成"
else
    log_error "ARM 服务器部署失败 (exit: $EXIT_CODE)"
fi
exit $EXIT_CODE