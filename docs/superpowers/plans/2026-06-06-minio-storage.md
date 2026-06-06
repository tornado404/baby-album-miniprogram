# MinIO 对象存储 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在云服务器上部署独立 MinIO 容器，实现图片/视频直传 + 缩略图生成

**Architecture:** MinIO 作为独立容器运行（独立 docker-compose），后端通过 presigned URL 实现前端直传，缩略图由 Celery + Pillow 异步生成

**Tech Stack:** MinIO (S3-compatible), Python minio SDK, Pillow, Celery, FastAPI

---

## 文件变更清单

| 文件 | 操作 | 说明 |
|------|------|------|
| `server/docker-compose-minio.yml` | 新建 | MinIO 独立 Docker Compose |
| `server/scripts/init_minio.py` | 新建 | 初始化 bucket + 策略 |
| `server/app/services/file_service.py` | 新建 | MinIO 预签名 URL 生成 |
| `server/app/services/thumbnail_service.py` | 新建 | Pillow 缩略图生成 |
| `server/app/routers/upload.py` | 修改 | 对接 MinIO 预签名 |
| `server/app/config.py` | 修改 | 增加 MinIO 配置项 |
| `server/.env.example` | 修改 | 增加 MinIO 环境变量 |
| `miniprogram/pages/upload/upload.ts` | 修改 | 上传流程适配 |
| `docs/storage-PRD.md` | 已更新 | 设计文档 |

---

### Task 1: 部署 MinIO 独立容器

**Files:**
- Create: `server/docker-compose-minio.yml`

- [ ] **Step 1: 创建独立 docker-compose-minio.yml**

```yaml
# docker-compose-minio.yml
# 独立 MinIO 对象存储服务（不耦合业务服务）
# 管理控制台: http://<server-ip>:9001  账号: Cs516@2026 / Cs516@2026

services:
  minio:
    image: minio/minio:latest
    container_name: baby-minio
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: Cs516@2026
      MINIO_ROOT_PASSWORD: Cs516@2026
      MINIO_DOMAIN: 101.126.41.146
    volumes:
      - /opt/baby-minio/data:/data
    ports:
      - "9000:9000"
      - "9001:9001"
    healthcheck:
      test: ["CMD", "mc", "ready", "local"]
      interval: 30s
      timeout: 10s
      retries: 3
    restart: unless-stopped
```

- [ ] **Step 2: 上传部署到服务器**

```bash
# 1. 将 docker-compose-minio.yml 传到服务器
cd D:\code\yuanBabyGrowthDiary
scp -o StrictHostKeyChecking=no server/docker-compose-minio.yml root@101.126.41.146:/opt/baby-minio/

# 2. 创建数据目录
ssh -o StrictHostKeyChecking=no root@101.126.41.146 "mkdir -p /opt/baby-minio/data"

# 3. 启动容器
ssh -o StrictHostKeyChecking=no root@101.126.41.146 \
  "cd /opt/baby-minio && docker compose -f docker-compose-minio.yml up -d"

# 4. 验证运行
ssh -o StrictHostKeyChecking=no root@101.126.41.146 \
  "curl -s http://localhost:9000/minio/health/live"
# 期望输出: {"status":"alive"}
```

- [ ] **Step 3: 验证 Web 控制台**

```
浏览器打开 http://101.126.41.146:9001
账号: Cs516@2026
密码: Cs516@2026
确认控制台可正常登录
```

- [ ] **Step 4: 提交**

```bash
git add server/docker-compose-minio.yml
git commit -m "feat: MinIO 独立部署 docker-compose"
```

---

### Task 2: MinIO Bucket 初始化

**Files:**
- Create: `server/scripts/init_minio.py`

- [ ] **Step 1: 创建初始化脚本**

```python
#!/usr/bin/env python3
"""scripts/init_minio.py - MinIO Bucket 初始化
首次部署时运行: python scripts/init_minio.py
"""

from minio import Minio
import os

MINIO_ENDPOINT = os.getenv("MINIO_ENDPOINT", "localhost:9000")
MINIO_ACCESS_KEY = os.getenv("MINIO_ACCESS_KEY", "Cs516@2026")
MINIO_SECRET_KEY = os.getenv("MINIO_SECRET_KEY", "Cs516@2026")
BUCKET_NAME = os.getenv("MINIO_BUCKET", "baby-album")

client = Minio(
    MINIO_ENDPOINT,
    access_key=MINIO_ACCESS_KEY,
    secret_key=MINIO_SECRET_KEY,
    secure=False,
)

# 创建 bucket
if not client.bucket_exists(BUCKET_NAME):
    client.make_bucket(BUCKET_NAME)
    print(f"✅ Bucket '{BUCKET_NAME}' created")
else:
    print(f"ℹ️  Bucket '{BUCKET_NAME}' already exists")

# 设置缩略图目录为公开读
policy = {
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Principal": {"AWS": "*"},
            "Action": ["s3:GetObject"],
            "Resource": [f"arn:aws:s3:::{BUCKET_NAME}/thumbnails/*"],
        }
    ],
}
client.set_bucket_policy(BUCKET_NAME, policy)
print(f"✅ Public read policy set for thumbnails/")

# 验证
print(f"\n📋 Bucket: {BUCKET_NAME}")
print(f"📡 Endpoint: {MINIO_ENDPOINT}")
print(f"🔗 Console: http://101.126.41.146:9001")
```

- [ ] **Step 2: 在服务器上安装 minio SDK 并运行初始化**

```bash
# 安装 Python minio SDK
ssh root@101.126.41.146 "pip3 install minio --break-system-packages"

# 上传并运行初始化脚本
scp -o StrictHostKeyChecking=no server/scripts/init_minio.py root@101.126.41.146:/opt/baby-album/scripts/
ssh root@101.126.41.146 "cd /opt/baby-album && python3 scripts/init_minio.py"
# 期望输出:
# ✅ Bucket 'baby-album' created
# ✅ Public read policy set for thumbnails/
```

- [ ] **Step 3: 验证 bucket**

```bash
# 通过 mc 客户端验证
ssh root@101.126.41.146 "docker exec baby-minio mc ls data/"
# 期望输出: [2026-01-01 00:00:00 UTC]     0B baby-album/
```

- [ ] **Step 4: 提交**

```bash
git add server/scripts/init_minio.py
git commit -m "feat: MinIO bucket 初始化脚本"
```

---

### Task 3: 后端 MinIO 配置 + 预签名 URL 服务

**Files:**
- Modify: `server/app/config.py` — 新增 MinIO 配置项
- Create: `server/app/services/file_service.py` — 预签名 URL 生成
- Modify: `server/app/routers/upload.py` — 对接 MinIO
- Modify: `server/.env.example` — 新增环境变量

- [ ] **Step 1: 修改 config.py 增加 MinIO 配置**

```python
# 在 server/app/config.py 的 Settings 类中增加

# MinIO 对象存储
MINIO_ENDPOINT: str = "101.126.41.146:9000"
MINIO_ACCESS_KEY: str = "Cs516@2026"
MINIO_SECRET_KEY: str = "Cs516@2026"
MINIO_BUCKET: str = "baby-album"
MINIO_PUBLIC_URL: str = "http://101.126.41.146:9000"
```

- [ ] **Step 2: 创建 file_service.py**

```python
# server/app/services/file_service.py
"""MinIO 文件操作服务"""
import uuid
from datetime import timedelta
from pathlib import Path

from minio import Minio
from app.config import settings

# MinIO 客户端（全局单例）
minio_client = Minio(
    settings.MINIO_ENDPOINT,
    access_key=settings.MINIO_ACCESS_KEY,
    secret_key=settings.MINIO_SECRET_KEY,
    secure=False,
)

DIR_MAP = {
    "image": "photos",
    "video": "videos",
    "avatar": "avatars",
    "threedmodel": "3dmodels",
}


def generate_file_path(user_id: str, file_type: str, ext: str) -> str:
    """生成 MinIO 对象路径"""
    directory = DIR_MAP.get(file_type, "others")
    uuid_str = uuid.uuid4().hex
    return f"{directory}/{user_id}/{uuid_str}.{ext}"


def get_upload_url(user_id: str, file_name: str, file_type: str) -> dict:
    """生成预签名上传 URL"""
    ext = file_name.rsplit(".", 1)[-1] if "." in file_name else "bin"
    object_path = generate_file_path(user_id, file_type, ext)
    url = minio_client.presigned_put_object(
        settings.MINIO_BUCKET,
        object_path,
        expires=timedelta(minutes=15),
    )
    return {
        "uploadUrl": url,
        "cosKey": object_path,
        "method": "PUT",
    }


def get_file_url(cos_key: str) -> str:
    """获取文件公开访问 URL"""
    return f"{settings.MINIO_PUBLIC_URL}/{settings.MINIO_BUCKET}/{cos_key}"


def delete_file(cos_key: str) -> None:
    """删除 MinIO 中的文件"""
    minio_client.remove_object(settings.MINIO_BUCKET, cos_key)
```

- [ ] **Step 3: 修改 upload.py 路由**

```python
# server/app/routers/upload.py - 修改 upload_sign 使用 MinIO

@router.post("/sign", response_model=UploadSignResponse)
async def upload_sign(
    req: UploadSignRequest,
    user_id: str = Depends(get_current_user_id),
):
    result = get_upload_url(user_id, req.fileName, req.fileType)
    return UploadSignResponse(**result)
```

- [ ] **Step 4: 修改 .env.example**

```bash
# 在 server/.env.example 中增加
MINIO_ENDPOINT=101.126.41.146:9000
MINIO_ACCESS_KEY=Cs516@2026
MINIO_SECRET_KEY=Cs516@2026
MINIO_BUCKET=baby-album
MINIO_PUBLIC_URL=http://101.126.41.146:9000
```

- [ ] **Step 5: 提交**

```bash
git add server/app/config.py server/app/services/file_service.py \
      server/app/routers/upload.py server/.env.example
git commit -m "feat: MinIO 预签名 URL 服务 + upload 路由对接"
```

---

### Task 4: Pillow 缩略图生成（Celery 任务）

**Files:**
- Create: `server/app/services/thumbnail_service.py`
- Modify: `server/app/tasks/__init__.py`

- [ ] **Step 1: 创建 thumbnail_service.py**

```python
# server/app/services/thumbnail_service.py
"""Pillow 缩略图生成"""
from io import BytesIO
from PIL import Image
from minio import Minio
from app.config import settings

minio_client = Minio(
    settings.MINIO_ENDPOINT,
    access_key=settings.MINIO_ACCESS_KEY,
    secret_key=settings.MINIO_SECRET_KEY,
    secure=False,
)


def generate_thumbnail(cos_key: str, user_id: str) -> tuple[str, str]:
    """生成 300×300 WebP 缩略图，返回 (thumbnail_key, thumbnail_url)"""
    # 1. 从 MinIO 下载原图
    response = minio_client.get_object(settings.MINIO_BUCKET, cos_key)
    image_data = response.read()

    # 2. Pillow 缩放
    img = Image.open(BytesIO(image_data))
    img.thumbnail((300, 300))

    # 3. 上传缩略图
    thumb_key = (
        cos_key.replace("photos/", "thumbnails/")
        .rsplit(".", 1)[0]
        + "_300x300.webp"
    )
    buffer = BytesIO()
    img.save(buffer, format="WEBP", quality=80)
    buffer.seek(0)

    minio_client.put_object(
        settings.MINIO_BUCKET,
        thumb_key,
        buffer,
        buffer.getbuffer().nbytes,
        content_type="image/webp",
    )

    # 4. 生成缩略图 URL
    thumb_url = (
        f"{settings.MINIO_PUBLIC_URL}"
        f"/{settings.MINIO_BUCKET}/{thumb_key}"
    )
    return thumb_key, thumb_url


def generate_avatar_thumbnail(cos_key: str, user_id: str) -> tuple[str, str]:
    """生成头像缩略图（200×200 方形裁剪）"""
    response = minio_client.get_object(settings.MINIO_BUCKET, cos_key)
    image_data = response.read()

    img = Image.open(BytesIO(image_data))

    # 居中裁剪为正方形
    size = min(img.width, img.height)
    left = (img.width - size) // 2
    top = (img.height - size) // 2
    img = img.crop((left, top, left + size, top + size))
    img.thumbnail((200, 200))

    thumb_key = (
        cos_key.replace("avatars/", "thumbnails/")
        .rsplit(".", 1)[0]
        + "_200x200.webp"
    )
    buffer = BytesIO()
    img.save(buffer, format="WEBP", quality=85)
    buffer.seek(0)

    minio_client.put_object(
        settings.MINIO_BUCKET,
        thumb_key,
        buffer,
        buffer.getbuffer().nbytes,
        content_type="image/webp",
    )
    thumb_url = (
        f"{settings.MINIO_PUBLIC_URL}"
        f"/{settings.MINIO_BUCKET}/{thumb_key}"
    )
    return thumb_key, thumb_url
```

- [ ] **Step 2: 提交**

```bash
git add server/app/services/thumbnail_service.py
git commit -m "feat: Pillow 缩略图生成服务"
```

---

### Task 5: 部署更新到服务器

**Files:**
- N/A（部署操作）

- [ ] **Step 1: 同步代码到服务器并重启 API**

```bash
# 1. 上传所有新文件
cd D:\code\yuanBabyGrowthDiary
ssh root@101.126.41.146 "mkdir -p /opt/baby-album/app/services"
scp -o StrictHostKeyChecking=no server/app/services/file_service.py \
    server/app/services/thumbnail_service.py \
    server/app/routers/upload.py \
    server/app/config.py \
    root@101.126.41.146:/opt/baby-album/app/

# 2. 安装 minio SDK
ssh root@101.126.41.146 "pip3 install minio --break-system-packages"

# 3. 更新 .env
ssh root@101.126.41.146 "cat >> /opt/baby-album/.env << 'EOF'
MINIO_ENDPOINT=101.126.41.146:9000
MINIO_ACCESS_KEY=Cs516@2026
MINIO_SECRET_KEY=Cs516@2026
MINIO_BUCKET=baby-album
MINIO_PUBLIC_URL=http://101.126.41.146:9000
EOF"

# 4. 重建并重启 API
ssh root@101.126.41.146 "cd /opt/baby-album && docker compose build api && docker compose up -d api --force-recreate"
```

- [ ] **Step 2: 验证预签名 API**

```bash
# 获取 token
TOKEN=$(curl -s -X POST http://101.126.41.146:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"code":"test"}' | python3 -c "import sys,json;print(json.load(sys.stdin)['accessToken'])")

# 测试预签名 URL
curl -s http://101.126.41.146:8000/api/v1/upload/sign \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"fileName":"test.jpg","fileType":"image","babyId":"demo-1"}'
# 期望输出: {"uploadUrl":"http://minio:9000/...","cosKey":"photos/...","method":"PUT"}
```

- [ ] **Step 3: 提交**

```bash
git add server/.env.example
git commit -m "deploy: MinIO 部署更新 + API 验证"
```

---

## 验收标准

| ID | 验收条件 | Task |
|----|----------|------|
| AC-01 | MinIO 容器独立运行，Web 控制台可访问 | Task 1 |
| AC-02 | baby-album bucket 已创建，thumbnails 目录公开读 | Task 2 |
| AC-03 | POST /upload/sign 返回有效的预签名 URL | Task 3 |
| AC-04 | 预签名 URL 可用于 wx.uploadFile 直传 | Task 3 |
| AC-05 | 上传后缩略图自动生成（300×300 WebP） | Task 4 |
| AC-06 | 所有服务运行中新旧 API 兼容 | Task 5 |