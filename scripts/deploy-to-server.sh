#!/bin/bash
# 部署脚本 - 将后端服务部署到云服务器
# 使用: ./deploy-to-server.sh

set -e

SERVER="root@101.126.41.146"
PASSWORD="Cs516@123456"
REMOTE_DIR="/opt/baby-album"

echo "=== 部署到 $SERVER ==="

# 1. 确保远端已安装 Docker
sshpass -p "$PASSWORD" ssh -o StrictHostKeyChecking=no "$SERVER" "
  if ! command -v docker &> /dev/null; then
    echo '安装 Docker...'
    curl -fsSL https://get.docker.com | bash
    systemctl enable docker
    systemctl start docker
  fi
  mkdir -p $REMOTE_DIR
  echo 'Docker 就绪: ' \$(docker --version)
"

# 2. 同步项目文件到服务器
echo "同步项目文件..."
sshpass -p "$PASSWORD" rsync -avz --delete \
  --exclude='__pycache__/' \
  --exclude='.git/' \
  --exclude='.env' \
  --exclude='node_modules/' \
  ../server/docker-compose.yml \
  ../server/docker-compose-minio.yml \
  ../server/Dockerfile \
  ../server/nginx/ \
  ../server/scripts/ \
  ../server/pyproject.toml \
  ../server/app/ \
  "$SERVER:$REMOTE_DIR/"

# 3. 在服务器上创建 .env 文件
echo "配置环境变量..."
sshpass -p "$PASSWORD" ssh "$SERVER" "
cat > $REMOTE_DIR/.env << 'ENVEOF'
APP_NAME=宝宝成长相册 API
DEBUG=false
DATABASE_URL=postgresql+asyncpg://app:Cs516@2026@postgres:5432/baby_album
REDIS_URL=redis://redis:6379/0
JWT_SECRET=baby-album-jwt-secret-2026
JWT_REFRESH_SECRET=baby-album-refresh-secret-2026
WECHAT_APP_ID=wx5d0e66dc0e6fb16d
WECHAT_APP_SECRET=placeholder  # ← 部署前请替换为微信小程序后台的真实 AppSecret
COS_SECRET_ID=placeholder
COS_SECRET_KEY=placeholder
COS_BUCKET=baby-album
COS_REGION=ap-guangzhou
# MinIO 对象存储（独立常驻服务，通过 IP:port 访问）
# 部署到云服务器时替换为实际 IP
MINIO_ENDPOINT=101.126.41.146:9000
MINIO_EXTERNAL_ENDPOINT=101.126.41.146:9000
MINIO_ACCESS_KEY=Cs516@2026
MINIO_SECRET_KEY=Cs516@2026
MINIO_BUCKET=baby-album
MINIO_PUBLIC_URL=http://101.126.41.146:9000
# 上传限制
UPLOAD_MAX_SIZE=20971520
# 限流
RATE_LIMIT_PER_MINUTE=100
ENVEOF
"

# 4. 启动 Docker 服务
echo "启动 Docker 容器..."
sshpass -p "$PASSWORD" ssh "$SERVER" "
  cd $REMOTE_DIR

  # 启动 MinIO（独立常驻服务）
  if ! docker ps --format '{{.Names}}' | grep -q '^minio$'; then
    echo '启动 MinIO...'
    docker compose -f docker-compose-minio.yml up -d
    sleep 3
  fi

  docker compose pull
  docker compose up -d postgres redis
  echo '等待数据库就绪...'
  sleep 5
  docker compose up -d api nginx
  echo '所有服务已启动'
"

# 5. 验证部署
echo "验证部署..."
sleep 3
sshpass -p "$PASSWORD" ssh "$SERVER" "
  echo '=== 运行中容器 ==='
  docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'
  echo ''
  echo '=== API 健康检查 ==='
  curl -s http://localhost:8000/health || echo 'API 尚未就绪'
"

echo "=== 部署完成 ==="
echo "API 地址: http://$SERVER:8000"
echo "Swagger 文档: http://$SERVER:8000/docs"