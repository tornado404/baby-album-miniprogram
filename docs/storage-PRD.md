# 相册数据存储服务设计文档

> 版本：v2.0 | 最后更新：2026-06-06 | 状态：📝 设计阶段
> 配套：`docs/backend/architecture.md`（后端架构）、`docs/integration-PRD.md`（联调方案）

---

## 1. 存储架构总览

### 1.1 核心理念

| 数据类别 | 存储位置 | 说明 |
|----------|----------|------|
| **用户/宝宝/媒体元数据** | PostgreSQL | 结构化数据，通过 API 读写 |
| **图片/视频/3D 模型文件** | MinIO（对象存储） | S3 兼容，通过预签名 URL 直传 |
| **JWT Token / 缓存** | 微信本地存储 | `wx.getStorageSync` 轻量缓存 |
| **App 配置 / 主题偏好** | 微信本地存储 | 少量 KV 数据 |

### 1.2 为什么不用复杂的客户端缓存层？

当前项目是**微信小程序**，不是 PWA/Web 应用：
- 微信小程序天然有 `wx.getStorageSync` 本地缓存
- 小程序每次打开都是冷启动，复杂的同步引擎收益有限
- 微信本地存储上限 10MB，不适合做大文件缓存
- 保持简单：文件存 MinIO，数据读 API，少量 KV 存本地

---

## 2. MinIO 部署方案

### 2.1 Docker Compose 配置

在现有 `docker-compose.yml` 中增加 MinIO 服务：

```yaml
minio:
  image: minio/minio:latest
  container_name: baby-minio
  command: server /data --console-address ":9001"
  environment:
    MINIO_ROOT_USER: ${MINIO_ROOT_USER:-minioadmin}
    MINIO_ROOT_PASSWORD: ${MINIO_ROOT_PASSWORD:-minioadmin}
  volumes:
    - miniodata:/data
  ports:
    - "9000:9000"    # S3 API
    - "9001:9001"    # Web 控制台
  healthcheck:
    test: ["CMD", "mc", "ready", "local"]
    interval: 10s
    timeout: 5s
    retries: 5
  restart: unless-stopped
  networks:
    - baby-network

volumes:
  miniodata:  # 新增
```

### 2.2 MinIO 初始化（创建 Bucket）

```python
# scripts/init_minio.py
# 首次部署时运行：python scripts/init_minio.py

from minio import Minio

client = Minio(
    "localhost:9000",
    access_key="minioadmin",
    secret_key="minioadmin",
    secure=False,
)

# 创建 bucket
bucket_name = "baby-album"
if not client.bucket_exists(bucket_name):
    client.make_bucket(bucket_name)
    print(f"Bucket '{bucket_name}' created")

    # 设置公开读策略（缩略图可直接访问）
    policy = {
        "Version": "2012-10-17",
        "Statement": [
            {
                "Effect": "Allow",
                "Principal": {"AWS": "*"},
                "Action": ["s3:GetObject"],
                "Resource": [f"arn:aws:s3:::{bucket_name}/thumbnails/*"],
            }
        ],
    }
    client.set_bucket_policy(bucket_name, policy)
    print("Public read policy set for thumbnails/")
else:
    print(f"Bucket '{bucket_name}' already exists")
```

---

## 3. 文件存储结构

### 3.1 Bucket 目录

```
bucket: baby-album
├── photos/
│   └── {userId}/
│       └── {uuid}.{ext}          # 原图
├── thumbnails/
│   └── {userId}/
│       └── {uuid}_300x300.webp   # 缩略图
├── videos/
│   └── {userId}/
│       └── {uuid}.mp4            # 视频
├── avatars/
│   └── {userId}/
│       └── avatar_{timestamp}.{ext}  # 头像
└── 3dmodels/
    └── {userId}/
        └── {uuid}.glb            # 3D 模型
```

### 3.2 文件路径生成规则

```python
# app/services/file_service.py
import uuid
import os

def generate_file_path(user_id: str, file_type: str, ext: str) -> str:
    """生成 MinIO 对象路径"""
    uuid_str = uuid.uuid4().hex
    dir_map = {
        "image": "photos",
        "video": "videos",
        "avatar": "avatars",
        "threedmodel": "3dmodels",
    }
    directory = dir_map.get(file_type, "others")
    return f"{directory}/{user_id}/{uuid_str}.{ext}"
```

---

## 4. 上传流程（前端直传 MinIO）

### 4.1 预签名 URL 模式

```
小程序端                          API 服务                              MinIO
  │                                 │                                    │
  │── 1. POST /upload/sign ───────►│                                    │
  │     { fileName, fileType,      │── 生成 presigned PUT URL           │
  │       babyId }                 │    有效期: 15 分钟                  │
  │◄── 返回 { uploadUrl,            │                                    │
  │       cosKey }                 │                                    │
  │                                 │                                    │
  │── 2. wx.uploadFile ─────────── │ ─── 直传 MinIO ──────────────────►│
  │     使用 uploadUrl PUT          │                                    │
  │◄── 返回 ETag ─────────────────│ ◄─────────────────────────────────│
  │                                 │                                    │
  │── 3. POST /media ────────────►│                                    │
  │     { babyId, cosKey, title }  │── INSERT INTO media               │
  │◄── 返回 media 记录 ───────────│── Celery 异步缩略图生成            │
```

### 4.2 后端实现示例

```python
# app/services/file_service.py
from minio import Minio
from app.config import settings

minio_client = Minio(
    settings.MINIO_ENDPOINT,       # minio:9000
    access_key=settings.MINIO_ACCESS_KEY,
    secret_key=settings.MINIO_SECRET_KEY,
    secure=False,                  # 内网 HTTP
)

async def get_upload_url(user_id: str, file_name: str, file_type: str) -> dict:
    """生成预签名上传 URL"""
    ext = file_name.rsplit(".", 1)[-1] if "." in file_name else "bin"
    object_path = generate_file_path(user_id, file_type, ext)
    url = minio_client.presigned_put_object(
        settings.MINIO_BUCKET,
        object_path,
        expires=timedelta(minutes=15),
    )
    return {"uploadUrl": url, "cosKey": object_path, "method": "PUT"}
```

---

## 5. API 端点（补充）

### 5.1 文件上传相关

| 方法 | 路径 | 说明 | 鉴权 |
|------|------|------|------|
| POST | `/api/v1/upload/sign` | 获取 MinIO 预签名上传 URL | JWT |
| GET  | `/api/v1/upload/{cosKey}` | 获取文件访问 URL | JWT |

### 5.2 响应示例

```json
POST /api/v1/upload/sign
{
  "fileName": "baby_photo.jpg",
  "fileType": "image",
  "babyId": "uuid-xxx"
}

Response:
{
  "uploadUrl": "http://minio:9000/baby-album/photos/user-id/abc.jpg?X-Amz-Algorithm=...",
  "cosKey": "photos/user-id/abc.jpg",
  "method": "PUT"
}
```

---

## 6. 缩略图生成

### 6.1 异步任务

```python
# app/tasks/thumbnail.py
from io import BytesIO
from PIL import Image
from minio import Minio

async def generate_thumbnail(cos_key: str):
    """生成 300×300 WebP 缩略图"""
    # 1. 从 MinIO 下载原图
    response = minio_client.get_object(settings.MINIO_BUCKET, cos_key)
    image_data = response.read()

    # 2. Pillow 缩放
    img = Image.open(BytesIO(image_data))
    img.thumbnail((300, 300))

    # 3. 上传缩略图
    thumb_key = cos_key.replace("photos/", "thumbnails/").rsplit(".", 1)[0] + "_300x300.webp"
    buffer = BytesIO()
    img.save(buffer, format="WEBP", quality=80)
    buffer.seek(0)

    minio_client.put_object(
        settings.MINIO_BUCKET, thumb_key, buffer, buffer.getbuffer().nbytes,
        content_type="image/webp",
    )

    # 4. 更新 media 记录的 thumbnail_url
    thumb_url = f"{settings.MINIO_PUBLIC_URL}/{settings.MINIO_BUCKET}/{thumb_key}"
    return thumb_key, thumb_url
```

---

## 7. 前端存储简化

### 7.1 仅保留的本地存储

| 键名 | 用途 | TTL |
|------|------|-----|
| `album_auth_token` | JWT accessToken | 2h（与 JWT 一致） |
| `album_auth_refresh` | refreshToken | 30d |
| `album_user_id` | 用户 ID | 永久 |
| `album_current_baby_id` | 当前宝宝 ID | 永久 |
| `album_baby_profiles` | 宝宝列表缓存 | 5min |
| `album_media_cache_{babyId}` | 媒体列表缓存 | 2min |

### 7.2 读取策略

```
1. 页面 onLoad → 尝试调 API 获取数据
2. API 成功 → 更新本地缓存 → 渲染
3. API 失败（网络问题）→ 读本地缓存 → 渲染
4. 无缓存 → 展示空状态 / 骨架屏
```

### 7.3 不需要实现的复杂逻辑

- ❌ UnifiedStorage 层层封装
- ❌ SyncOrchestrator 状态机
- ❌ 离线 pending 队列
- ❌ TTL 自动过期扫描
- ❌ 旧键名自动迁移

---

## 8. 部署步骤

### 8.1 服务器操作

```bash
# 1. 在 docker-compose.yml 中增加 MinIO 服务
# 2. 重新部署
cd /opt/baby-album
docker compose up -d minio

# 3. 初始化 bucket
docker exec baby-api python scripts/init_minio.py

# 4. 验证
curl http://localhost:9000/minio/health/live
```

### 8.2 环境变量新增

```bash
# .env 新增
MINIO_ENDPOINT=minio:9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_BUCKET=baby-album
MINIO_PUBLIC_URL=http://101.126.41.146:9000
```

---

## 9. 工作量估算

| 内容 | 工时 | 说明 |
|------|------|------|
| docker-compose 增加 MinIO | 0.5h | 已有 compose 文件 |
| 初始化脚本 init_minio.py | 0.5h | 创建 bucket + 策略 |
| `file_service.py` 预签名 URL | 1h | MinIO SDK 封装 |
| `thumbnail.py` 缩略图任务 | 1h | Pillow 缩放 + WebP |
| 前端上传流程适配 | 1h | sign → 直传 → media create |
| **合计** | **~4h** | 半日内完成 |