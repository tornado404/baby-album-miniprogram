#!/bin/bash
# deploy-arm.sh — ARM 本地测试服务器后端部署脚本
# 使用: ./deploy-arm.sh
#
# 前置条件:
#   1. sshpass 已安装 (apt install sshpass)
#   2. ARM 板已安装 Docker (docker.io)
#   3. ARM 板 root 文件系统已挂载 /opt/baby-minio/data
#
# 目标: linaro@192.168.50.126:89728972

set -e

SERVER="linaro@192.168.50.126"
PASSWORD="89728972"
REMOTE_DIR="/home/linaro/baby-album/server"

echo "=== ARM 测试服务器部署 ==="
echo "目标: $SERVER → $REMOTE_DIR"

# 1. 确保远端已安装 Docker
sshpass -p "$PASSWORD" ssh -o StrictHostKeyChecking=no "$SERVER" "
  if ! command -v docker &> /dev/null; then
    echo '安装 Docker...'
    sudo apt-get update -qq
    sudo apt-get install -y -qq docker.io docker-compose
    sudo systemctl enable docker
    sudo systemctl start docker
  fi
  mkdir -p $REMOTE_DIR
  echo 'Docker 就绪: ' \$(docker --version)
"

# 2. 同步代码
echo "同步代码..."
sshpass -p "$PASSWORD" rsync -avz --delete \
  --exclude='__pycache__/' \
  --exclude='.venv/' \
  --exclude='node_modules/' \
  --exclude='.git/' \
  ../server/ \
  "$SERVER:$REMOTE_DIR/"

# 3. 创建 .env（本地已有 server/.env，同步已包含；此处确保关键值与本地一致）
echo "确保 .env 已同步..."

# 4. 构建 API 镜像（ARM 需本地构建）
echo "构建 API 镜像（ARM 上本地构建，约 5-10 分钟）..."
sshpass -p "$PASSWORD" ssh "$SERVER" "
  cd $REMOTE_DIR
  docker build -t baby-api-base:latest . 2>&1
"

# 5. 确保 MinIO 数据目录
echo "确保 MinIO 数据目录..."
sshpass -p "$PASSWORD" ssh "$SERVER" "
  sudo mkdir -p /opt/baby-minio/data
  sudo chmod 777 /opt/baby-minio/data
"

# 6. 启动 MinIO
echo "启动 MinIO..."
sshpass -p "$PASSWORD" ssh "$SERVER" "
  cd $REMOTE_DIR
  docker-compose -f docker-compose-minio.yml up -d 2>&1
"

# 7. 启动主服务栈（使用 ARM override 配置）
echo "启动主服务栈 (PostgreSQL, Redis, API, Nginx)..."
sshpass -p "$PASSWORD" ssh "$SERVER" "
  cd $REMOTE_DIR
  docker-compose -f docker-compose.yml -f docker-compose.arm.yml up -d 2>&1
"

# 8. 等待服务就绪
echo "等待服务就绪..."
sleep 10

# 9. 初始化 MinIO 存储桶
echo "初始化 MinIO 存储桶..."
sshpass -p "$PASSWORD" ssh "$SERVER" "
  cd $REMOTE_DIR
  docker exec baby-api python3 /app/scripts/init_minio.py 2>&1 || echo 'init_minio 跳过（API 未就绪或脚本不存在）'
"

# 10. 验证
echo "验证部署..."
sshpass -p "$PASSWORD" ssh "$SERVER" "
  echo '=== 运行中容器 ==='
  docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'
  echo ''
  echo '=== API 健康检查 ==='
  curl -s http://localhost:8000/health || echo 'API 未就绪'
  echo ''
  echo '=== Nginx 代理检查 ==='
  curl -s http://localhost/health || echo 'Nginx 未就绪'
  echo ''
  echo '=== MinIO 控制台 ==='
  echo 'http://192.168.50.126:9001 (Cs516@2026 / Cs516@2026)'
"

echo ""
echo "=== 部署完成 ==="
echo "API 直连:    http://192.168.50.126:8000"
echo "Nginx 代理:  http://192.168.50.126/"
echo "MinIO 控制台: http://192.168.50.126:9001"
echo "Swagger 文档: http://192.168.50.126:8000/docs"