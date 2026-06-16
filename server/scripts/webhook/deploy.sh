#!/bin/bash
# =============================================================================
# webhook/deploy.sh — WebHook 触发的自动部署脚本
#
# 由 GitHub WebHook 监听器 (listener.py) 调用。
# 功能: git pull → docker compose up -d → 健康检查 → 自动回滚
#
# 环境变量:
#   DEPLOY_BRANCH — 要部署的分支（由 listener.py 传入）
#   REPO_DIR     — 仓库根目录（默认 /opt/baby-album）
# =============================================================================
set -euo pipefail

# ── 配置 ──────────────────────────────────────────────────────────────────────
REPO_DIR="${REPO_DIR:-/opt/baby-repo}"
BRANCH="${DEPLOY_BRANCH:-master}"
COMPOSE_FILE="server/docker-compose.yml"
HEALTH_URL="http://localhost:8000/health"
NETWORK_RETRY=3          # git 网络重试次数
HEALTH_RETRIES=12         # 健康检查重试次数
HEALTH_INTERVAL=10        # 健康检查间隔（秒）

# ── 颜色（仅本地日志）───────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'

log_info()  { echo -e "${GREEN}[INFO]${NC}  $(date '+%H:%M:%S') $*"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC}  $(date '+%H:%M:%S') $*"; }
log_error() { echo -e "${RED}[ERROR]${NC} $(date '+%H:%M:%S') $*"; }

# ── 1. 检查前置条件 ──────────────────────────────────────────────────────────
log_info "部署开始 — 分支: ${BRANCH}"

if [ ! -d "$REPO_DIR" ]; then
    log_error "仓库目录不存在: $REPO_DIR"
    exit 1
fi

cd "$REPO_DIR"

if [ ! -d ".git" ]; then
    log_error "不是 git 仓库: $REPO_DIR"
    exit 1
fi

if ! command -v docker &>/dev/null; then
    log_error "docker 未安装"
    exit 1
fi

# ── 2. 记录当前版本（用于回滚）───────────────────────────────────────────────
OLD_HASH=$(git rev-parse HEAD 2>/dev/null || echo "unknown")
log_info "当前版本: ${OLD_HASH:0:12}"

# ── 3. 拉取最新代码 ──────────────────────────────────────────────────────────
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

# 检查是否有新提交
LOCAL_HASH=$(git rev-parse HEAD)
REMOTE_HASH=$(git rev-parse "origin/$BRANCH")

if [ "$LOCAL_HASH" = "$REMOTE_HASH" ]; then
    log_info "代码已是最新，无需部署"
    exit 0
fi

# 执行 fast-forward（服务器始终与远程保持一致，不会产生冲突）
log_info "更新到 origin/${BRANCH}..."
git reset --hard "origin/$BRANCH"

NEW_HASH=$(git rev-parse HEAD)
log_info "新版本: ${NEW_HASH:0:12}"

# ── 4. 更新子模块（如果有）───────────────────────────────────────────────────
if [ -f .gitmodules ]; then
    git submodule update --init --recursive 2>/dev/null || log_warn "子模块更新跳过"
fi

# ── 5. 写入版本号供 API /health 读取 ───────────────────────────────────
log_info "写入版本号: ${NEW_HASH}"
echo "$NEW_HASH" > server/app/VERSION

# ── 6. 确保 MinIO 常驻服务运行 ──────────────────────────────────────────────
if ! docker ps --format '{{.Names}}' | grep -q '^minio$'; then
    log_info "启动 MinIO 常驻服务..."
    docker run -d \
      --name minio \
      -p 9000:9000 -p 9001:9001 \
      -e MINIO_ROOT_USER=Cs516@2026 \
      -e MINIO_ROOT_PASSWORD=Cs516@2026 \
      -v /opt/baby-minio/data:/data \
      --restart unless-stopped \
      minio/minio:latest server /data --console-address ':9001' 2>/dev/null || true
    sleep 3
fi

# ── 7. 重启 Docker 容器 ──────────────────────────────────────────────────────
log_info "重启 API 容器..."
cd "$REPO_DIR"

# 使用 docker compose 重新创建容器（代码通过 volume 挂载，无需重新 build）
if ! docker compose -p baby-album -f "$COMPOSE_FILE" up -d --force-recreate api; then
    log_error "docker compose up 失败"
    exit 1
fi

# ── 8. 健康检查 ──────────────────────────────────────────────────────────────
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

# ── 9. 回滚（如果健康检查失败）───────────────────────────────────────────────
if [ "$HEALTHY" != "true" ]; then
    log_error "============================================"
    log_error "健康检查失败 — 启动自动回滚"
    log_error "============================================"

    # 回滚代码
    log_info "回滚到: ${OLD_HASH:0:12}"
    git reset --hard "$OLD_HASH"

    # 重启容器（回滚后的代码）
    if docker compose -p baby-album -f "$COMPOSE_FILE" up -d --force-recreate api; then
        sleep 10
        if curl -sSf "$HEALTH_URL" > /dev/null 2>&1; then
            log_info "回滚成功 — 运行之前版本"
            exit 0
        fi
    fi

    log_error "严重异常：回滚也失败！需要人工介入"
    exit 1
fi

# ── 10. 清理 ──────────────────────────────────────────────────────────────────
docker image prune -f 2>/dev/null || true
log_info "============================================"
log_info "部署成功完成"
log_info "分支: ${BRANCH}"
log_info "版本: ${NEW_HASH:0:12}"
log_info "时间: $(date '+%Y-%m-%d %H:%M:%S')"
log_info "============================================"