# "我的"页面功能补齐 — 产品/技术规格

## 1. 概述

本文档定义宝宝成长日记小程序"我的"（设置）页面的功能补齐范围，包含前端 UI 调整、新建页面设计以及后端新 API 开发。

### 范围摘要

| 项目 | 类型 | 涉及范围 |
|------|------|---------|
| 设置页修复 | 前端修改 | `settings` 页面（wxml/ts/wxss） |
| 成就徽章页 | 新建页面 | `achievements` 页面（4 文件）+ `app.json` 注册 |
| 成长对比页 | 新建页面 + 新 API | `growth_compare` 页面（4 文件）+ 后端 analytics 路由 |
| 用户资料 API | 已有 | `GET /api/v1/auth/me` — 前端修正数据绑定 |
| 成就徽章 API | 已有 | `GET /api/v1/analytics/achievements` — 前端过滤已获得 |

---

## 2. 设置页修改（settings）

### 2.1 菜单项变更

**删除以下菜单项：**
- ~~外观模式~~（原第 96-105 行）
- ~~存储管理~~（原第 74-83 行）

**修改菜单路由：**
- 成就徽章：原 `data-key="achievements"` 路由至 `/pages/achievements/achievements`
- 成长对比：原 `data-key="growth_compare"` 路由至 `/pages/growth_compare/growth_compare`

### 2.2 用户卡片 — 真实数据绑定

当前 `userName` 硬编码为"星星妈妈"，改为调用 `GET /api/v1/auth/me`。

**请求：**
```
GET /api/v1/auth/me
Authorization: Bearer <token>
```

**响应：**
```json
{
  "userId": "xxx",
  "nickName": "星星妈妈",
  "avatarUrl": "https://...",
  "recordDays": 120,
  "totalPhotos": 50,
  "totalVideos": 10
}
```

**前端绑定：**
- `userName` ← `nickName`
- `userAvatar` ← `avatarUrl`（若无则为默认占位头像）
- `recordDays` ← `recordDays`

### 2.3 统计卡片 — 数据修正

**当前：** 照片 / 视频 / 记录（照片+视频合计）
**改为：** 照片 / 视频 / 3D模型

| 列 | 数据源 | 字段 |
|----|--------|------|
| 照片 | `GET /api/v1/analytics/stats` | `photoCount` |
| 视频 | `GET /api/v1/analytics/stats` | `videoCount` |
| 3D模型 | `GET /api/v1/analytics/stats` | `modelCount` |

`modelCount` 数据已在 `settings.ts` 获取（第 70 行），只需在 WXML 中修正显示。

### 2.4 用户卡片 — 成就徽章计数

在用户卡片右侧增加小型徽章计数入口：

```
┌──────────────────────────────┐
│ [A]  星星妈妈           [🏆] │
│      记录天数：120天     3枚 │
└──────────────────────────────┘
```

- 数据源：`GET /api/v1/analytics/achievements` → 过滤 `unlocked === true` → 取 `length`
- 点击跳转至 `/pages/achievements/achievements`
- CSS 样式可复用已存在的 `.achievement-badge`

### 2.5 样式修正

用户卡片和统计卡片的阴影值从 `0px 4px 12px` 修正为设计规范值：
```
0px 6px 16px 0px rgba(230, 198, 179, 0.35)
```

---

## 3. 成就徽章页（新建）

### 3.1 页面配置

- 路由：`/pages/achievements/achievements`
- 在 `app.json` 的 `pages` 数组中注册
- 页面自身 `.json` 中注册 `bottom-nav` 组件
- WebView 渲染器（默认）

### 3.2 UI 布局

```
┌──────────────────────────────┐
│ ← 我的            已获得 5枚 │   ← 导航栏 + 计数
├──────────────────────────────┤
│                              │
│ ┌──────┐ ┌──────┐ ┌──────┐ │
│ │ 🏅   │ │ 📸   │ │ 🎬   │ │   ← 3列网格
│ │初来乍到│ │小有成就│ │影像记│ │
│ │首次上传│ │累计10张│ │上传5个│ │
│ │2025/3 │ │2025/4 │ │2025/5│ │
│ └──────┘ └──────┘ └──────┘ │
│                              │
│ ┌──────┐ ┌──────┐ ┌──────┐ │
│ │ 🌟   │ │ 🏆   │ │ ...  │ │
│ │三十而立│ │百日坚持│ │      │ │
│ └──────┘ └──────┘ └──────┘ │
│                              │
├──────────────────────────────┤
│         [底部导航]           │
└──────────────────────────────┘
```

### 3.3 数据 API

**已有：** `GET /api/v1/analytics/achievements`

```json
{
  "code": 0,
  "data": {
    "badges": [
      {
        "key": "first_upload",
        "name": "初来乍到",
        "icon": "🏅",
        "desc": "首次上传照片",
        "unlocked": true,
        "unlockedAt": "2025-03-15T10:30:00Z"
      },
      ...
    ]
  }
}
```

**前端处理：** 过滤 `unlocked === true` 的项渲染网格。
**计数显示：** `已获得 5/9 枚徽章`

### 3.4 扩展性说明

徽章定义位于后端 `achievement_service.py:21-31` 的 `BADGE_DEFINITIONS` 列表。未来新增徽章（如"家人观看 10 次""获赞 50 次"）只需：

1. 在 `BADGE_DEFINITIONS` 中新增条目（key/name/icon/desc）
2. 在 `AchievementService.check_and_award()` 中新增检测逻辑
3. 前端自动渲染，无需修改 WXML

---

## 4. 成长对比页（新建 + 新 API）

### 4.1 页面概念

将宝宝在不同里程碑阶段的照片与最新照片进行上下对比，直观展示成长变化。

### 4.2 页面配置

- 路由：`/pages/growth_compare/growth_compare`
- 在 `app.json` 的 `pages` 数组中注册
- 页面自身 `.json` 中注册 `bottom-nav` 组件
- WebView 渲染器（默认）

### 4.3 UI 布局

```
┌──────────────────────────────┐
│ ← 我的        成长对比      │   ← 导航栏
├──────────────────────────────┤
│                              │
│   ← [出生] [满月] [翻身] →  │   ← 里程碑 tabs（可横向滑动）
│                              │
│  ┌────────────────────────┐  │
│  │                        │  │
│  │   里程碑封面照片         │  │   ← 当前选中里程碑的封面
│  │   (大图展示)            │  │
│  │                        │  │
│  │   满月 · 共3张照片      │  │   ← 里程碑名称 + 照片数
│  └────────────────────────┘  │
│                              │
│  ───  vs  ───               │   ← 视觉分隔线
│                              │
│  ┌────────────────────────┐  │
│  │                        │  │
│  │   最新照片              │  │   ← 最新一张照片
│  │                        │  │
│  │   2025-06-15 · 5个月3天│  │   ← 拍摄日期 + 当时年龄
│  └────────────────────────┘  │
│                              │
├──────────────────────────────┤
│         [底部导航]           │
└──────────────────────────────┘
```

### 4.4 布局细节

**上半区（约 60% 高度）：**
- 顶部：水平滚动的里程碑标签（pill 样式），当前选中的高亮
- 中间：里程碑封面照片（大图，自适应宽度，保持比例）
- 底部标签行：里程碑名称 + 该里程碑内的照片数量

**下半区（约 40% 高度）：**
- 分隔线："vs" 标签
- 最新照片展示
- 照片下方信息行：拍摄日期 + 当时的宝宝年龄

**交互逻辑：**
- 点击上方里程碑标签 → 切换显示对应里程碑的封面照片
- 封面照片在"未来里程碑会有封面照片"功能上线前，取该里程碑中拍摄日期最新的照片

### 4.5 新 API：成长对比

**端点：** `GET /api/v1/analytics/growth-compare?baby_id={babyId}`

**请求参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `baby_id` | string | 是 | 宝宝 ID |

**响应：**

```json
{
  "code": 0,
  "data": {
    "milestones": [
      {
        "key": "满月",
        "name": "满月",
        "coverUrl": "https://cos.bucket.com/xxx.jpg",
        "thumbnailUrl": "https://cos.bucket.com/xxx_thumb.jpg",
        "photoCount": 5,
        "firstDate": "2025-02-15",
        "lastDate": "2025-03-20"
      },
      {
        "key": "翻身",
        "name": "翻身",
        "coverUrl": "https://cos.bucket.com/yyy.jpg",
        "thumbnailUrl": "https://cos.bucket.com/yyy_thumb.jpg",
        "photoCount": 3,
        "firstDate": "2025-05-10",
        "lastDate": "2025-06-01"
      }
    ],
    "latestPhoto": {
      "id": "media-uuid",
      "url": "https://cos.bucket.com/zzz.jpg",
      "thumbnailUrl": "https://cos.bucket.com/zzz_thumb.jpg",
      "captureDate": "2025-06-15",
      "babyAge": {
        "years": 0,
        "months": 5,
        "days": 3
      }
    }
  }
}
```

**空数据处理：**
- 无里程碑数据时：`milestones` 返回空数组 `[]`
- 无最新照片时：`latestPhoto` 返回 `null`，前端显示占位图

**API 实现逻辑：**

```python
# 在 analytics 路由新增端点
@router.get("/growth-compare")
async def get_growth_compare(
    baby_id: str = Query(...),
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    # 1. 验证宝宝归属
    baby = await BabyService(db).get_baby(baby_id, user_id)
    if not baby:
        raise HTTPException(404, "Baby not found")

    # 2. 查询有里程碑标记的媒体，按里程碑分组
    rows = await db.execute(
        select(
            Media.milestone,
            func.count(Media.id).label("cnt"),
            func.min(Media.capture_date).label("first_date"),
            func.max(Media.capture_date).label("last_date"),
        ).where(
            Media.baby_id == baby_id,
            Media.is_deleted == False,
            Media.milestone.isnot(None),
            Media.milestone != "",
        ).group_by(Media.milestone)
        .order_by(func.min(Media.capture_date).asc())
    )

    milestones = []
    for row in rows:
        # 取该里程碑中最新的一张照片作为封面
        cover = await db.execute(
            select(Media).where(
                Media.baby_id == baby_id,
                Media.milestone == row.milestone,
                Media.is_deleted == False,
            ).order_by(Media.capture_date.desc()).limit(1)
        )
        cover_media = cover.scalar_one_or_none()

        milestones.append({
            "key": row.milestone,
            "name": row.milestone,
            "coverUrl": cover_media.cos_url if cover_media else None,
            "thumbnailUrl": cover_media.thumbnail_url if cover_media else None,
            "photoCount": row.cnt,
            "firstDate": row.first_date,
            "lastDate": row.last_date,
        })

    # 3. 查询最新照片
    latest = await db.execute(
        select(Media).where(
            Media.baby_id == baby_id,
            Media.is_deleted == False,
        ).order_by(Media.capture_date.desc()).limit(1)
    )
    latest_media = latest.scalar_one_or_none()

    latest_photo = None
    if latest_media:
        latest_photo = {
            "id": latest_media.id,
            "url": latest_media.cos_url,
            "thumbnailUrl": latest_media.thumbnail_url,
            "captureDate": latest_media.capture_date,
            "babyAge": latest_media.baby_age if hasattr(latest_media, 'baby_age') else None,
        }

    return {"code": 0, "data": {"milestones": milestones, "latestPhoto": latest_photo}}
```

---

## 5. 路由注册

在 `app.json` 的 `pages` 数组中追加：

```json
"pages/achievements/achievements",
"pages/growth_compare/growth_compare"
```

建议插在 `"pages/about/about"` 之前。

---

## 6. 实现顺序

| 序号 | 任务 | 依赖 |
|------|------|------|
| 1 | 后端：`GET /api/v1/analytics/growth-compare` 新端点 | 无 |
| 2 | 前端：`settings` 页面修复（菜单删除、数据绑定修正、徽章计数） | 无 |
| 3 | 前端：`achievements` 新建页面 | 第 2 步（设置页路由需要它） |
| 4 | 前端：`growth_compare` 新建页面 | 第 1 步（需要 API 数据） |

---

## 7. 不做事项（明确排除）

- ~~外观模式/存储管理：从菜单移除，不保留入口~~
- ~~不在本阶段新增 "家人观看""点赞" 类徽章检测逻辑~~
- ~~不在增长对比页内实现照片放大/全屏预览~~
- ~~不在增长对比页内实现里程碑照片多图浏览（左右滑动切换里程碑，非切换单里程碑内多图）~~
- ~~不修改底部导航组件~~
- ~~不涉及分享设置页、宝宝列表页等其他已有页面的修改~~