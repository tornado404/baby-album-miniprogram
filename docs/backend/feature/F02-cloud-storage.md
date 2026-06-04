# F02 - 云存储与媒体管理

> Feature ID: F02 | 优先级: P0 | 版本: v2.0 | 状态: 📝 设计阶段

---

## 1. Feature 概述

### 1.1 核心目标

为小程序提供图片/视频/3D模型的上传至 COS/OSS、CDN 加速访问、缩略图生成能力。

### 1.2 业务价值

- 替代当前 Demo 假数据，实现真实媒体内容上传和展示
- 用户数据不因换手机而丢失
- 支持多设备访问同一份云端数据

### 1.3 依赖

- F01 用户认证（上传需用户身份）
- COS/OSS Bucket 已创建 + CDN 已配置

---

## 2. 技术设计

### 2.1 上传流程（前端直传 COS）

```
小程序端                           API 服务                     COS/OSS
   │                                 │                            │
   │── wx.chooseMedia() 选择文件 ───│                            │
   │                                 │                            │
   │── POST /api/v1/upload/sign ───►│                            │
   │     { fileName, fileType }     │── 生成 STS 临时密钥        │
   │◄── 返回签名 + uploadUrl ──────│     + COS 上传签名          │
   │                                 │                            │
   │── wx.uploadFile 直传 COS ──────│───────────────────────────►│
   │     (带签名 header)            │                            │
   │◄── 返回 cosKey ───────────────│◄───────────────────────────│
   │                                 │                            │
   │── POST /api/v1/media ─────────►│                            │
   │     { babyId, title, type,    │── INSERT INTO media        │
   │       cosKey, captureDate }   │── 触发缩略图生成（异步）     │
   │◄── 返回 media 记录 ───────────│                            │
```

### 2.2 数据模型

**Media 表（Prisma Schema）**

```prisma
model Media {
  id            String    @id @default(uuid())
  userId        String
  babyId        String
  type          MediaType
  title         String    @default("")
  cosKey        String
  cosUrl        String?
  thumbnailKey  String?
  thumbnailUrl  String?
  width         Int?
  height        Int?
  fileSize      BigInt    @default(0)
  mimeType      String?
  captureDate   DateTime
  babyAgeYrs    Int?
  babyAgeMos    Int?
  babyAgeDays   Int?
  tags          String[]  @default([])
  isDeleted     Boolean   @default(false)
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  user User @relation(fields: [userId], references: [id])
  baby Baby @relation(fields: [babyId], references: [id])

  @@index([babyId, captureDate(sort: Desc)])
  @@index([userId])
}

enum MediaType {
  image
  video
  threedmodel
}
```

### 2.3 API 端点

| 方法 | 路径 | 说明 | 鉴权 |
|------|------|------|------|
| POST | `/api/v1/upload/sign` | 获取 COS 上传签名 | JWT |
| POST | `/api/v1/media` | 创建媒体记录（上传完成后调用） | JWT |
| GET | `/api/v1/media` | 分页获取媒体列表 | JWT |
| GET | `/api/v1/media/:id` | 获取单条媒体详情 | JWT |
| PUT | `/api/v1/media/:id` | 更新标题/描述 | JWT |
| DELETE | `/api/v1/media/:id` | 软删除媒体 | JWT |

### 2.4 文件规格

| 类型 | 支持格式 | 最大大小 | 缩略图策略 |
|------|----------|----------|------------|
| 图片 | JPG, PNG, WebP, HEIC | 20MB | Sharp 库生成 300x300 缩略图 |
| 视频 | MP4 | 100MB | FFmpeg 截取首帧作为封面 |
| 3D模型 | GLTF, GLB | 30MB | 不生成缩略图（前端实时渲染预览） |

### 2.5 COS 目录结构

```
{bucket}/
├── {user_id}/
│   ├── photos/
│   │   ├── {media_id}.jpg        # 原图
│   │   └── {media_id}_thumb.jpg  # 缩略图
│   ├── videos/
│   │   ├── {media_id}.mp4        # 原视频
│   │   └── {media_id}_thumb.jpg  # 视频封面
│   └── 3dmodels/
│       └── {media_id}.glb        # 3D模型
```

---

## 3. 接口设计

### 3.1 获取媒体列表

`GET /api/v1/media?babyId=1&ageMonth=6&pageSize=20&cursor=30`

**响应**:
```json
{
  "code": 0,
  "data": {
    "list": [
      {
        "id": 31,
        "title": "第一次翻身",
        "type": "image",
        "thumbnailUrl": "https://cdn.example.com/1/photos/31_thumb.jpg",
        "cosUrl": "https://cdn.example.com/1/photos/31.jpg",
        "captureDate": "2026-01-15",
        "babyAge": { "years": 0, "months": 6, "days": 3 }
      }
    ],
    "hasMore": true,
    "nextCursor": "31",
    "total": 45
  }
}
```

### 3.2 创建媒体

`POST /api/v1/media`

**请求体**:
```json
{
  "babyId": 1,
  "title": "第一次翻身",
  "type": "image",
  "cosKey": "1/photos/uuid-photo.jpg",
  "captureDate": "2026-01-15"
}
```

---

## 4. 前端对接要点

- 上传先调 `/upload/sign` 拿临时密钥，再 `wx.uploadFile` 直传 COS
- 列表优先用 `thumbnailUrl`，加快瀑布流加载
- 详情页用 `cosUrl` 原图
- 视频使用 `wx.createVideoContext` 播放

---

## 5. 验收标准

| ID | 验收条件 |
|----|----------|
| AC-F02-01 | 图片上传成功率 > 99% |
| AC-F02-02 | 缩略图在上传后 3s 内生成 |
| AC-F02-03 | 媒体列表分页加载，每页 20 条 |
| AC-F02-04 | 按 babyId + 月龄正确筛选 |
| AC-F02-05 | 大文件使用 COS 分片上传 |

---

*详细用户故事和技术故事拆解见 `story/S02-upload-stories.md`*
