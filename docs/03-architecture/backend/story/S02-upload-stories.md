# S02 - 上传与存储故事 (Upload & Storage Stories)

> **版本**: v1.0 | **最后更新**: 2026-06-15
> **状态**: 📝 设计阶段
> **配套**: `docs/03-architecture/backend/feature/F02-cloud-storage.md`（关联 Feature）
> **目标迭代**: v1.1

---

## 用户故事 (User Stories)

### US-UPLOAD-01: 拍照上传

**作为** 家长
**我想要** 用手机拍照后直接上传到云端
**以便** 即时记录宝宝的成长瞬间

**验收条件**:
- 点击 FAB → 选择「拍照」→ 调用系统相机
- 拍照后可预览，确认后上传
- 上传过程显示进度条
- 上传成功后自动刷新首页时间轴
- 上传失败显示错误提示并允许重试

---

### US-UPLOAD-02: 从相册选择多张上传

**作为** 家长
**我想要** 从手机相册批量选择宝宝的近期照片上传
**以便** 一次性整理多天的照片

**验收条件**:
- 支持选择最多 9 张照片
- 显示已选照片缩略图预览
- 支持取消已选照片
- 批量上传逐一显示进度
- 全部上传完成后显示结果统计

---

### US-UPLOAD-03: 视频上传

**作为** 家长
**我想要** 上传宝宝的视频记录
**以便** 记录宝宝学走路、说话等动态时刻

**验收条件**:
- 支持从相册选择 MP4 视频
- 提示视频时长限制（建议 3 分钟内）
- 上传过程显示进度
- 自动生成视频封面缩略图

---

### US-UPLOAD-04: 上传 3D 模型

**作为** 家长
**我想要** 上传宝宝满月、百日的 3D 扫描模型
**以便** 立体保存宝宝珍贵模样

**验收条件**:
- 支持 GLB/GLTF 格式
- 提示文件大小限制
- 上传成功后可在 3D 查看页预览

---

## 技术故事 (Technical Stories)

### TS-UPLOAD-01: COS上传签名接口

**描述**: 实现 POST /api/v1/upload/sign，返回 STS 临时密钥

**涉及文件**:
- `app/routers/upload.py`
- `app/services/file_service.py`

**实现要点**:
- 调用 COS STS SDK 生成临时密钥
- 限制上传路径为 `{userId}/photos|videos|3dmodels/`
- 限制单文件大小（根据类型不同）
- 临时密钥有效期 30 分钟

---

### TS-UPLOAD-02: 创建媒体记录接口

**描述**: 实现 POST /api/v1/media，写入 media 表

**涉及文件**:
- `app/routers/media.py`

**实现要点**:
- 接收 babyId, title, type, cosKey, captureDate
- 根据 baby.birth_date 自动计算 babyAge
- INSERT INTO media + 写入 sync_log
- 异步触发缩略图生成（消息队列或Pillow 异步处理（Celery））

---

### TS-UPLOAD-03: 缩略图生成服务

**描述**: 图片上传后异步生成缩略图并上传到 COS

**涉及文件**:
- `app/tasks/thumbnail.py`

**实现要点**:
- 使用 Sharp 库将图片缩放到 300x300
- 缩略图上传到 `{userId}/photos/{mediaId}_thumb.jpg`
- 更新 media.thumbnail_key + thumbnail_url
- 视频使用 FFmpeg 截取首帧

---

### TS-UPLOAD-04: 媒体列表接口

**描述**: 实现 GET /api/v1/media，分页 + 按月龄筛选

**涉及文件**:
- `app/routers/media.py`

**实现要点**:
- 查询参数: babyId, ageMonth(可选), pageSize, cursor
- SQL WHERE: user_id + baby_id + is_deleted=0
- 月龄筛选: 基于 capture_date 和 baby.birth_date 计算
- ORDER BY capture_date DESC, LIMIT pageSize
- 游标分页 (WHERE id < cursor)

---

### TS-UPLOAD-05: 上传队列管理（前端）

**描述**: 前端封装上传任务队列，支持并发控制

**涉及文件**:
- `miniprogram/services/uploadService.ts`（新增）

**实现要点**:
- 队列最大并发数 3
- 每个任务流程: getSign → wx.uploadFile → createMedia
- 支持暂停/恢复/取消
- 监听 uploadFile.onProgressUpdate 回调进度
- 失败自动重试 3 次

---

### TS-UPLOAD-06: 媒体删除与清理

**描述**: 实现软删除 + 定时清理机制

**涉及文件**:
- `app/routers/media.py`（DELETE handler）
- `server/src/jobs/cleanDeletedMedia.ts`（cron job）

**实现要点**:
- DELETE: 设置 is_deleted=1，不立即删文件
- Cron job: 每日凌晨清理 30 天前的软删除记录
- 清理时调用 COS SDK 删除文件 + DELETE FROM media

---

## Story 与 Feature 的关联

```
F02 云存储与媒体管理
├── US-UPLOAD-01 拍照上传
├── US-UPLOAD-02 多张选择上传
├── US-UPLOAD-03 视频上传
├── US-UPLOAD-04 3D模型上传
├── TS-UPLOAD-01 COS上传签名接口
├── TS-UPLOAD-02 创建媒体记录接口
├── TS-UPLOAD-03 缩略图生成服务
├── TS-UPLOAD-04 媒体列表接口
├── TS-UPLOAD-05 上传队列管理（前端）
└── TS-UPLOAD-06 媒体删除与清理
```
