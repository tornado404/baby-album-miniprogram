# F05 - 数据分析与导出

> **Feature ID**: F05 | **优先级**: P1 | **版本**: v3.0 | **最后更新**: 2026-06-15
> **状态**: 📝 设计阶段
> **配套**: `docs/03-architecture/backend/README.md`（后端总览）、`docs/03-architecture/backend/story/S05-analytics-stories.md`（用户故事）
> **目标迭代**: v2.0

---

## 1. Feature 概述

### 1.1 核心目标

提供用户使用数据统计、宝宝成长数据分析、成就徽章系统、以及数据导出功能。

### 1.2 业务价值

- 成就感驱动：通过徽章和统计激励用户持续记录
- 实用价值：成长报告帮助父母了解宝宝成长规律
- 数据可移植性：支持导出数据，避免平台锁定

### 1.3 依赖

- F03 数据同步（需要完整的云端数据）

---

## 2. 子模块

### 2.1 成就徽章系统

#### 2.1.1 徽章定义

| 徽章 | 名称 | 触发条件 | badge_key |
|------|------|----------|-----------|
| 🏅 | 初来乍到 | 首次上传照片 | first_upload |
| 📸 | 记录达人 | 累计上传 100 张 | photo_100 |
| 🎬 | 影像记录者 | 上传第一个视频 | first_video |
| 🗓️ | 坚持之星 | 连续 7 天记录 | streak_7 |
| 📅 | 月度全勤 | 自然月每天记录 | monthly_full |
| 🍼 | 满月纪念 | 宝宝满月时有记录 | full_moon |
| 🎂 | 周岁纪念 | 宝宝一岁时有记录 | first_birthday |
| 👨‍👩‍👧 | 全家福 | 邀请 2 位以上家人 | family_3 |
| 🏆 | 千张达人 | 累计 1000 张 | photo_1000 |

#### 2.1.2 数据模型

**achievements 表**

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | UUID PK | 记录ID |
| `user_id` | UUID FK | 用户ID |
| `badge_key` | VARCHAR(32) | 徽章标识 |
| `awarded_at` | DATETIME | 获得时间 |

**UNIQUE KEY**: `(user_id, badge_key)` 保证同一徽章不重复发放

#### 2.1.3 触发机制

```
POST /api/v1/media 等操作处理完成后:
  1. UPDATE users SET total_photos = total_photos + 1
  2. 调用 achievementChecker 检查所有成就条件
  3. 满足条件 → INSERT INTO achievements（幂等）
  4. 返回新获得成就列表给前端
```

### 2.2 成长报告

#### 2.2.1 报告内容

- 时间跨度内上传照片/视频数量
- 按月分布统计
- 里程碑时间轴
- 身高体重增长曲线（数据来源：babies 表）
- 最活跃记录时段

#### 2.2.2 API 端点

| 方法 | 路径 | 说明 | 鉴权 |
|------|------|------|------|
| GET | `/api/v1/analytics/report?babyId=1&start=2026-01&end=2026-06` | 生成成长报告 | JWT |
| GET | `/api/v1/analytics/stats` | 用户整体统计 | JWT |
| GET | `/api/v1/analytics/achievements` | 已获得成就列表 | JWT |

### 2.3 数据导出

#### 2.3.1 导出格式

- **JSON**: 完整数据导出（可重新导入）
- **ZIP**: 照片原图打包下载

#### 2.3.2 API 端点

| 方法 | 路径 | 说明 | 鉴权 |
|------|------|------|------|
| POST | `/api/v1/export/data` | 发起导出任务（异步） | JWT |
| GET | `/api/v1/export/status/:taskId` | 查询导出任务进度 | JWT |
| GET | `/api/v1/export/download/:taskId` | 下载导出文件 | JWT |
| POST | `/api/v1/export/import` | 从 JSON 导入数据 | JWT |

---

## 3. 前端对接要点

- 设置页「数据统计」卡片对接 `GET /analytics/stats`
- 成就弹窗使用动画效果
- 导出功能放在设置页「存储管理」中
- 成长报告可作为分享卡片发送给家人

---

## 4. 验收标准

| ID | 验收条件 |
|----|----------|
| AC-F05-01 | 首次上传照片后触发「初来乍到」徽章 |
| AC-F05-02 | 累计 100 张照片触发「记录达人」徽章 |
| AC-F05-03 | 成长报告数据准确、展示清晰 |
| AC-F05-04 | JSON 导出包含完整数据并可重新导入 |
| AC-F05-05 | ZIP 导出包含所有原图且可成功下载 |

---

*详细用户故事和技术故事拆解见 `story/S05-analytics-stories.md`*
