# 宝宝成长相册 - 功能设计文档 v1.0

> **版本**: v1.0 | **最后更新**: 2026-05-31
> **状态**: 📝 待开发 | **配套**: `docs/02-design/Spec.md`（功能规格）

**功能模块**: 宝宝相册基础框架

---

## 1. 功能概述

### 1.1 功能名称与标识

| 属性 | 值 |
|------|-----|
| 功能名称 | 宝宝成长相册 (Baby Growth Album) |
| 功能ID | ALBUM_V1 |
| 版本号 | 1.0.0 |
| 所属模块 | 相册模块 |
| 优先级 | P0 - 核心功能 |

### 1.2 简要描述

宝宝成长相册是记录宝宝成长瞬间的核心功能模块，提供图片上传、时间线浏览、瀑布流展示等能力，帮助父母便捷地记录和回顾宝宝的成长历程。

### 1.3 依赖关系

#### 1.3.1 前置依赖

- **宝宝信息模块 (BABY_PROFILE)**: 相册功能依赖宝宝基础信息（姓名、出生日期、性别），用于计算月龄和展示关联信息
- **本地存储服务**: 使用 `wx.getStorageSync` / `wx.setStorageSync` 进行数据持久化
- **登录模块**: 需要微信用户信息用于头像展示

#### 1.3.2 技术依赖

| 依赖项 | 版本要求 | 说明 |
|--------|----------|------|
| Skyline Renderer | 3.0.0+ | 渲染引擎 |
| glass-easel | 最新稳定版 | 组件框架 |
| Vant Weapp | 最新稳定版 | UI 组件库 |
| miniprogram-api-typings | 最新稳定版 | TypeScript 类型支持 |

#### 1.3.3 后续迭代依赖

- ALBUM_V2: 视频上传与播放功能
- ALBUM_V3: 照片评论与互动功能
- SHARE_V1: 分享与导出功能

---

## 2. 用户故事

### 2.1 核心用户故事

#### US-01: 照片上传
**角色**: 宝宝家长
**动作**: 我想要上传宝宝的照片
**收益**: 能够保存宝宝的珍贵成长瞬间，不会因手机更换而丢失

#### US-02: 按月龄浏览
**角色**: 宝宝家长
**动作**: 我想要按照宝宝的月龄时间线浏览照片
**收益**: 能够清晰地看到宝宝在不同月龄的成长变化，便于回顾

#### US-03: 瀑布流浏览
**角色**: 宝宝家长
**动作**: 我想要以瀑布流方式浏览照片
**收益**: 能够在有限的屏幕空间内展示更多照片，快速滑动浏览

#### US-04: 查看照片详情
**角色**: 宝宝家长
**动作**: 我想要点击照片查看大图和详细信息
**收益**: 能够仔细查看照片的拍摄时间、内容备注等细节

#### US-05: 空状态引导
**角色**: 新用户
**动作**: 我想要在还没有照片时得到使用引导
**收益**: 能够快速了解如何使用相册功能，开始记录宝宝成长

---

## 3. 功能需求

### 3.1 功能列表

| 需求ID | 需求名称 | 描述 | 优先级 |
|--------|----------|------|--------|
| FR-01 | 相册首页展示 | 显示相册首页，以最新照片优先展示 | P0 |
| FR-02 | 时间线导航 | 基于宝宝月龄的时间线导航功能 | P0 |
| FR-03 | 图片上传 | 支持从相册选择或拍照上传图片 | P0 |
| FR-04 | 瀑布流展示 | 响应式瀑布流布局展示照片 | P0 |
| FR-05 | 媒体详情查看 | 点击查看大图及详细信息 | P0 |
| FR-06 | 月龄分组展示 | 按宝宝月龄对照片进行分组 | P0 |

### 3.2 功能详细说明

#### FR-01: 相册首页展示

**描述**: 相册首页是用户进入相册模块后的第一个页面，以时间倒序展示所有照片。

**功能点**:
- 页面标题显示当前宝宝姓名 + "的成长相册"
- 自定义导航栏（复用 `navigation-bar` 组件）
- 页面加载时显示骨架屏或 loading 状态
- 照片列表以最新照片优先（倒序排列）
- 下拉刷新获取最新照片列表
- 上拉加载更多（分页加载）

**数据来源**: 本地存储（`StorageKey: 'album_media_list'`）

#### FR-02: 时间线导航

**描述**: 基于宝宝出生日期计算月龄，提供按月龄筛选照片的能力。

**功能点**:
- 顶部横向滚动的时间线标签栏
- 标签格式: "0月"、"1月"、"2月"... "12月+"、"全部"
- 点击标签筛选对应月龄的照片
- 当前月龄标签高亮显示
- 时间线根据宝宝月龄动态生成（最大显示到当前月龄）

**月龄计算公式**:
```
月龄 = floor((当前日期 - 出生日期) / 30)
```

#### FR-03: 图片上传

**描述**: 支持两种图片上传方式：拍照和从相册选择。

**功能点**:
- 悬浮按钮（FAB）触发上传选项
- 点击后弹出操作菜单：拍照 / 从相册选择
- 使用 `wx.chooseMedia` API 选择图片
- 支持多选（最多9张）
- 上传前显示压缩选项（建议压缩以节省存储）
- 上传成功后保存到本地存储
- 上传过程显示进度提示
- 上传完成后自动刷新列表

**限制**:
- 单张图片大小限制: 10MB
- 支持格式: JPG, PNG, HEIC
- 每次最多选择: 9张

#### FR-04: 瀑布流展示

**描述**: 采用瀑布流布局展示照片列表，支持不同比例的图片自适应排列。

**功能点**:
- 双列瀑布流布局
- 图片按原始比例显示
- 图片加载时显示占位符（低版本渐变骨架屏，高版本使用 `van-image` 的 loading 状态）
- 点击图片进入详情页
- 长按图片显示操作菜单（删除、设为封面）
- 两列高度尽可能均衡

**布局算法**:
```
左列高度 = sum(图片高度 / 2) for even index
右列高度 = sum(图片高度 / 2) for odd index
新图片优先放入高度较小的列
```

#### FR-05: 媒体详情查看

**描述**: 点击照片后进入全屏查看模式，显示大图和详细信息。

**功能点**:
- 全屏图片展示，支持双指缩放
- 页面顶部显示: 照片拍摄日期、宝宝月龄
- 页面底部显示: 照片描述/备注（如有）
- 左滑/右滑切换上一张/下一张
- 点击返回按钮关闭详情页
- 右上角显示更多操作（删除、编辑备注）

**交互细节**:
- 使用 `swiper` 组件实现图片切换
- 缩放使用 `canvas` 或 `cover-image` 的手势识别

#### FR-06: 月龄分组展示

**描述**: 在时间线导航基础上，实现按月龄分组的数据管理和展示。

**功能点**:
- 数据按月龄分组存储
- 切换月龄标签时筛选对应分组数据
- "全部"标签显示所有照片
- 无照片的月龄标签显示但不可点击（或显示空状态）
- 月龄标签显示该月龄的照片数量角标

**数据结构**:
```typescript
interface MediaGroup {
  monthAge: number;        // 月龄（0开始）
  monthLabel: string;      // 显示标签 "0月"、"1月"...
  mediaList: Media[];      // 该月龄的照片列表
  mediaCount: number;      // 照片数量
}
```

---

## 4. 非功能需求

### 4.1 性能要求

| 指标 | 要求 | 说明 |
|------|------|------|
| 首屏加载时间 | < 1.5s | 相册首页首次加载时间 |
| 图片懒加载 | 支持 | 视口外图片延迟加载 |
| 分页加载 | 每页20条 | 上拉加载更多的数据量 |
| 图片压缩 | 宽度 <= 1920px | 上传前自动压缩大图 |
| 内存占用 | < 100MB | 页面可接受的最大内存占用 |

### 4.2 兼容性要求

#### 4.2.1 微信版本兼容

| 特性 | 最低版本要求 |
|------|--------------|
| Skyline 渲染引擎 | 微信 3.0.0+ |
| glass-easel 组件框架 | 微信 3.0.0+ |
| `wx.chooseMedia` API | 微信 2.18.0+ |
| `wx.getUserProfile` API | 微信 2.10.4+ |

#### 4.2.2 设备兼容

- 支持 iOS 和 Android 双平台
- 适配主流屏幕尺寸（以 iPhone 12/13/14 为基准）
- 适配折叠屏设备（展开/折叠状态）

### 4.3 安全考虑

| 安全项 | 实施方案 |
|--------|----------|
| 用户隐私 | 不强制获取用户信息，照片存储在本地 |
| 数据安全 | 本地存储，数据不外传 |
| 图片来源 | 仅支持用户主动上传的图片 |

### 4.4 数据存储策略

| 数据类型 | 存储方式 | 存储位置 |
|----------|----------|----------|
| 照片元数据 | `wx.setStorageSync` | 本地 Storage |
| 照片文件 | `wx.env.USER_DATA_PATH` | 用户数据目录 |
| 宝宝信息 | `wx.setStorageSync` | 本地 Storage |

---

## 5. UI/UX 设计方向

### 5.1 整体视觉风格

**设计语言**: 温馨、简洁、亲子风格

**视觉特点**:
- 采用柔和的圆角设计（border-radius: 12rpx ~ 16rpx）
- 大量留白，减少视觉负担
- 卡片式布局，层次分明
- 动效适度，避免过度动画

### 5.2 色彩方案

| 用途 | 颜色名称 | Hex 值 | 使用场景 |
|------|----------|--------|----------|
| 主色 | 温暖粉 | `#FFB7C5` | 强调色、按钮、标签 |
| 辅色 | 清新蓝 | `#87CEEB` | 次要操作、图标 |
| 背景色 | 纯白 | `#FFFFFF` | 页面背景 |
| 卡片背景 | 浅灰白 | `#FAFAFA` | 卡片、列表项背景 |
| 文字主色 | 深灰 | `#333333` | 标题、重要文字 |
| 文字辅色 | 中灰 | `#666666` | 描述文字、次要信息 |
| 文字弱色 | 浅灰 | `#999999` | 占位符、时间戳 |
| 分割线 | 边框灰 | `#EEEEEE` | 分割线、边框 |
| 危险色 | 柔红 | `#FF6B6B` | 删除操作、错误提示 |
| 成功色 | 草绿 | `#52C41A` | 成功提示 |

### 5.3 布局原则

#### 5.3.1 页面结构

```
+------------------+
|   导航栏 (44px)   |  <- 自定义导航栏
+------------------+
|   时间线标签栏     |  <- 横向滚动 (80rpx)
+------------------+
|                  |
|   瀑布流照片列表   |  <- 自适应高度
|                  |
|                  |
|                  |
+------------------+
|        [+]      |  <- 悬浮上传按钮 (右下角)
+------------------+
```

#### 5.3.2 瀑布流布局规范

| 属性 | 规范值 |
|------|--------|
| 列数 | 2列 |
| 列间距 | 16rpx |
| 行间距 | 16rpx |
| 内边距 | 24rpx |
| 图片圆角 | 12rpx |
| 卡片阴影 | `0 2rpx 8rpx rgba(0,0,0,0.08)` |

### 5.4 关键交互模式

| 交互场景 | 交互方式 | 反馈 |
|----------|----------|------|
| 点击照片 | 单指单击 | 跳转详情页（100ms fade） |
| 长按照片 | 长按 > 500ms | 显示操作菜单 |
| 下拉刷新 | 下拉动作 | 顶部loading动画 |
| 上拉加载 | 上拉到底部 | 底部loading提示 |
| 点击上传按钮 | 单指单击 | 展开操作菜单 |
| 切换时间线标签 | 单指单击 | 列表筛选动画 |

### 5.5 组件选用

| 场景 | 组件选择 | 备注 |
|------|----------|------|
| 导航栏 | `navigation-bar` | 已有的自定义组件 |
| 瀑布流 | `waterfall-flow` | 需新增自定义组件 |
| 时间线标签 | `van-tabs` | Vant 组件库 |
| 图片展示 | `van-image` | Vant 组件库，支持懒加载 |
| 上传按钮 | `van-button` + `van-popup` | FAB 悬浮按钮 |
| 加载状态 | `van-loading` | Vant 组件库 |
| 空状态 | 自定义 `empty-state` 组件 | 需新增 |
| 操作菜单 | `van-action-sheet` | Vant 组件库 |
| 详情页图片 | `swiper` + `cover-image` | 原生组件实现缩放 |

---

## 6. 技术架构

### 6.1 数据模型设计

#### 6.1.1 Media 实体（媒体实体）

```typescript
/**
 * 媒体实体 - 存储照片/视频的元数据
 */
interface Media {
  id: string;                    // 唯一标识符，格式: med_{timestamp}_{random}
  babyId: string;                // 关联的宝宝ID
  type: 'image' | 'video';      // 媒体类型（V1仅支持image）
  url: string;                   // 本地文件路径
  thumbnailUrl: string;          // 缩略图路径
  width: number;                 // 图片宽度（px）
  height: number;                // 图片高度（px）
  size: number;                  // 文件大小（bytes）
  shootDate: number;             // 拍摄日期时间戳
  monthAge: number;              // 拍摄时宝宝月龄
  description: string;           // 描述/备注
  createdAt: number;             // 创建时间戳
  updatedAt: number;             // 更新时间戳
  isDeleted: boolean;            // 软删除标记
}

/**
 * 媒体列表排序选项
 */
type MediaSortBy = 'shootDate_desc' | 'shootDate_asc' | 'createdAt_desc' | 'createdAt_asc';

/**
 * 媒体查询参数
 */
interface MediaQuery {
  babyId?: string;
  monthAge?: number | null;      // null表示全部
  sortBy?: MediaSortBy;
  page?: number;
  pageSize?: number;
}
```

#### 6.1.2 Baby 实体（宝宝实体）

```typescript
/**
 * 宝宝实体 - 存储宝宝基本信息
 */
interface Baby {
  id: string;                    // 唯一标识符，格式: baby_{timestamp}_{random}
  name: string;                  // 宝宝姓名
  gender: 'male' | 'female' | 'unknown';
  birthDate: number;             // 出生日期时间戳
  avatarUrl: string;             // 宝宝头像/封面图
  coverImageUrl: string;         // 相册封面图
  createdAt: number;             // 创建时间戳
  updatedAt: number;             // 更新时间戳
}

/**
 * 计算宝宝月龄
 * @param birthDate 出生日期时间戳
 * @param targetDate 目标日期时间戳（默认当前日期）
 * @returns 月龄（向下取整）
 */
function calculateMonthAge(birthDate: number, targetDate?: number): number {
  const now = targetDate || Date.now();
  const diffDays = Math.floor((now - birthDate) / (1000 * 60 * 60 * 24));
  return Math.floor(diffDays / 30);
}
```

#### 6.1.3 MediaGroup 实体（媒体分组实体）

```typescript
/**
 * 媒体分组实体 - 按月龄分组的媒体列表
 */
interface MediaGroup {
  monthAge: number;              // 月龄（0, 1, 2, ...）
  monthLabel: string;            // 显示标签，如 "0月"、"1月"、"12月+"
  mediaList: Media[];            // 该月龄的媒体列表
  mediaCount: number;            // 该月龄的照片数量
  coverImage?: Media;            // 该月龄的封面图（第一张）
}
```

### 6.2 页面结构

```
miniprogram/
├── pages/
│   └── album/
│       ├── index/                      # 相册首页
│       │   ├── index.ts
│       │   ├── index.wxml
│       │   ├── index.wxss
│       │   └── index.json
│       ├── detail/                     # 照片详情页
│       │   ├── detail.ts
│       │   ├── detail.wxml
│       │   ├── detail.wxss
│       │   └── detail.json
│       └── upload/                     # 上传页面（可选，复杂上传可独立页面）
│           ├── upload.ts
│           ├── upload.wxml
│           ├── upload.wxss
│           └── upload.json
└── components/
    └── album/
        ├── waterfall-flow/             # 瀑布流组件
        │   ├── waterfall-flow.ts
        │   ├── waterfall-flow.wxml
        │   ├── waterfall-flow.wxss
        │   └── waterfall-flow.json
        ├── media-card/                  # 媒体卡片组件
        │   ├── media-card.ts
        │   ├── media-card.wxml
        │   ├── media-card.wxss
        │   └── media-card.json
        ├── timeline-nav/               # 时间线导航组件
        │   ├── timeline-nav.ts
        │   ├── timeline-nav.wxml
        │   ├── timeline-nav.wxss
        │   └── timeline-nav.json
        └── empty-state/                # 空状态组件
            ├── empty-state.ts
            ├── empty-state.wxml
            ├── empty-state.wxss
            └── empty-state.json
```

### 6.3 组件设计

#### 6.3.1 waterfall-flow 瀑布流组件

**Props:**
```typescript
interface WaterfallFlowProps {
  mediaList: Media[];              // 媒体列表
  columnCount: number;             // 列数，默认2
  columnGap: number;               // 列间距，默认16
  rowGap: number;                  // 行间距，默认16
  loading: boolean;                // 加载状态
  finished: boolean;               // 是否加载完成
}
```

**Events:**
```typescript
interface WaterfallFlowEvents {
  'bind:clickitem': (e: { detail: Media }) => void;   // 点击媒体
  'bind:longpressitem': (e: { detail: Media }) => void; // 长按媒体
  'bind:loadmore': () => void;        // 加载更多
  'bind:refresh': () => void;          // 下拉刷新
}
```

#### 6.3.2 media-card 媒体卡片组件

**Props:**
```typescript
interface MediaCardProps {
  media: Media;                     // 媒体数据
  mode: 'thumb' | 'preview';       // 模式：缩略图/预览
  showMonthAge?: boolean;          // 是否显示月龄标签
}
```

**Events:**
```typescript
interface MediaCardEvents {
  'bind:click': (e: { detail: Media }) => void;
  'bind:longpress': (e: { detail: Media }) => void;
}
```

#### 6.3.3 timeline-nav 时间线导航组件

**Props:**
```typescript
interface TimelineNavProps {
  currentMonthAge: number | null;  // 当前选中的月龄，null表示"全部"
  maxMonthAge: number;              // 最大月龄
  monthAgeCounts: Record<number, number>;  // 各月龄的照片数量
}
```

**Events:**
```typescript
interface TimelineNavEvents {
  'bind:change': (e: { detail: number | null }) => void;  // null表示"全部"
}
```

#### 6.3.4 empty-state 空状态组件

**Props:**
```typescript
interface EmptyStateProps {
  type: 'no_data' | 'no_result' | 'error';  // 空状态类型
  message?: string;                          // 自定义提示文字
  actionText?: string;                       // 操作按钮文字
}
```

**Events:**
```typescript
interface EmptyStateEvents {
  'bind:action': () => void;                 // 点击操作按钮
}
```

### 6.4 API 考虑（本地存储）

由于 V1 版本使用本地存储，不涉及后端 API。以下为数据访问层的接口设计，未来扩展后端时可无缝对接。

#### 6.4.1 存储 Key 定义

```typescript
// constants/storage.ts
export const STORAGE_KEYS = {
  BABY_LIST: 'baby_list',                     // 宝宝列表
  CURRENT_BABY_ID: 'current_baby_id',         // 当前选中的宝宝ID
  ALBUM_MEDIA_PREFIX: 'album_media_',         // 媒体数据前缀，后接babyId
} as const;
```

#### 6.4.2 MediaService 数据服务层

```typescript
// services/mediaService.ts

/**
 * 获取媒体列表
 * @param query 查询参数
 * @returns 媒体列表和总数
 */
function getMediaList(query: MediaQuery): { list: Media[]; total: number };

/**
 * 获取媒体详情
 * @param mediaId 媒体ID
 * @returns 媒体详情
 */
function getMediaById(mediaId: string): Media | null;

/**
 * 创建媒体记录
 * @param media 媒体数据
 * @returns 创建的媒体ID
 */
function createMedia(media: Omit<Media, 'id' | 'createdAt' | 'updatedAt'>): string;

/**
 * 更新媒体信息
 * @param mediaId 媒体ID
 * @param updates 更新字段
 * @returns 是否成功
 */
function updateMedia(mediaId: string, updates: Partial<Media>): boolean;

/**
 * 删除媒体（软删除）
 * @param mediaId 媒体ID
 * @returns 是否成功
 */
function deleteMedia(mediaId: string): boolean;

/**
 * 按月龄分组获取媒体列表
 * @param babyId 宝宝ID
 * @returns 分组后的媒体列表
 */
function getMediaGroupedByMonth(babyId: string): MediaGroup[];

/**
 * 保存图片到本地
 * @param tempFilePath 临时文件路径
 * @returns 保存后的文件路径
 */
function saveImageToLocal(tempFilePath: string): string;

/**
 * 生成缩略图
 * @param filePath 原图路径
 * @param maxWidth 最大宽度
 * @returns 缩略图路径
 */
function generateThumbnail(filePath: string, maxWidth: number): string;
```

---

## 7. 边界情况与错误处理

### 7.1 空状态处理

#### 7.1.1 场景分类

| 场景 | 状态类型 | 提示文案 | 操作引导 |
|------|----------|----------|----------|
| 首次进入，无宝宝 | `no_baby` | "还没有添加宝宝哦~" | "去添加宝宝" 按钮 |
| 有宝宝，无照片 | `no_photo` | "还没有记录成长瞬间~" | "上传第一张照片" 按钮 |
| 有照片，无筛选结果 | `no_result` | "该月龄暂无照片" | "查看全部照片" 按钮 |

#### 7.1.2 空状态组件设计

```typescript
// 不同场景的图标和文案配置
const EMPTY_STATE_CONFIG = {
  no_baby: {
    icon: 'friends-o',          // Vant图标
    title: '还没有添加宝宝哦~',
    description: '添加宝宝后即可开始记录成长点滴',
    actionText: '去添加宝宝',
  },
  no_photo: {
    icon: 'photo-o',
    title: '还没有记录成长瞬间~',
    description: '上传照片，记录宝宝的每一个珍贵时刻',
    actionText: '上传第一张照片',
  },
  no_result: {
    icon: 'search',
    title: '该月龄暂无照片',
    description: '可以切换到其他月龄查看',
    actionText: '查看全部照片',
  },
};
```

### 7.2 加载状态处理

#### 7.2.1 页面级加载

- **首次加载**: 显示全屏骨架屏或 `van-loading`
- **下拉刷新**: 顶部 `van-loading` 动画 + 文字提示 "正在刷新..."
- **上拉加载**: 底部 `van-loading` 动画或 "加载中..." 文字
- **加载完成**: 显示 "没有更多了~" 结束提示

#### 7.2.2 图片级加载

- **加载中**: 显示灰色占位背景或 `van-image` 的 loading 状态
- **加载失败**: 显示破损图片占位符 + 重试按钮
- **加载成功**: 淡入动画显示（300ms ease-out）

### 7.3 错误状态处理

| 错误场景 | 用户提示 | 处理方式 |
|----------|----------|----------|
| 上传失败 | "上传失败，请重试" | 显示重试按钮 |
| 图片加载失败 | "图片加载失败" | 显示占位图 + 重试 |
| 存储空间不足 | "存储空间不足，请清理" | 引导清理或其他操作 |
| 存储读写错误 | "数据保存失败" | 提示重试，记录日志 |

```typescript
// 错误码定义
const ERROR_CODES = {
  UPLOAD_FAILED: 'ALBUM_E001',
  IMAGE_LOAD_FAILED: 'ALBUM_E002',
  STORAGE_FULL: 'ALBUM_E003',
  STORAGE_ERROR: 'ALBUM_E004',
  INVALID_PARAMS: 'ALBUM_E005',
} as const;
```

### 7.4 边界条件处理

| 边界场景 | 处理方案 |
|----------|----------|
| 月龄超过12个月 | 显示 "12月+" 标签 |
| 月龄计算为负数（异常数据） | 默认为0月龄 |
| 图片尺寸异常（宽或高为0） | 使用默认 4:3 比例 |
| 同一毫秒多次上传 | 使用 `uuid` 确保唯一ID |
| 存储数据损坏 | 捕获异常，返回空列表 |
| 宝宝被删除但有照片残留 | 级联删除或忽略显示 |

---

## 8. 验收标准

### 8.1 功能验收标准

#### FR-01: 相册首页展示

| 验收点 | 验收条件 | 测试方法 |
|--------|----------|----------|
| AC-01-01 | 页面加载时显示 loading 状态 | 启动相册页，观察加载动画 |
| AC-01-02 | 照片列表以最新优先倒序展示 | 上传不同日期照片，验证排序 |
| AC-01-03 | 下拉刷新能获取最新数据 | 下拉操作，验证列表更新 |
| AC-01-04 | 上拉加载更多功能正常 | 上拉到列表底部，验证加载更多 |
| AC-01-05 | 导航栏显示宝宝姓名 | 验证标题文本正确 |

#### FR-02: 时间线导航

| 验收点 | 验收条件 | 测试方法 |
|--------|----------|----------|
| AC-02-01 | 时间线横向滚动正常 | 手指左右滑动，验证滚动流畅 |
| AC-02-02 | 点击月龄标签筛选对应照片 | 选择不同标签，验证列表变化 |
| AC-02-03 | 当前选中标签高亮显示 | 验证选中态样式 |
| AC-02-04 | 月龄计算正确 | 对比照片拍摄日期与月龄显示 |
| AC-02-05 | 无照片月龄标签显示正确 | 验证数量角标数值 |

#### FR-03: 图片上传

| 验收点 | 验收条件 | 测试方法 |
|--------|----------|----------|
| AC-03-01 | 悬浮按钮在页面右下角显示 | 进入相册页，观察按钮位置 |
| AC-03-02 | 点击按钮弹出操作菜单 | 点击按钮，验证菜单展开 |
| AC-03-03 | 拍照上传功能正常 | 选择拍照，验证相机启动 |
| AC-03-04 | 相册选择功能正常 | 选择相册，验证图片选择器 |
| AC-03-05 | 支持多选（最多9张） | 尝试选择多张图片 |
| AC-03-06 | 上传过程显示进度 | 观察上传过程提示 |
| AC-03-07 | 上传成功自动刷新列表 | 上传后验证新照片出现 |

#### FR-04: 瀑布流展示

| 验收点 | 验收条件 | 测试方法 |
|--------|----------|----------|
| AC-04-01 | 两列瀑布流布局正常 | 进入相册页，验证双列显示 |
| AC-04-02 | 图片按原始比例显示 | 上传不同比例图片，验证不变形 |
| AC-04-03 | 图片懒加载正常 | 滑动页面，观察图片加载时机 |
| AC-04-04 | 加载中显示占位符 | 滑动时观察占位状态 |
| AC-04-05 | 点击图片跳转详情页 | 点击照片，验证页面跳转 |

#### FR-05: 媒体详情查看

| 验收点 | 验收条件 | 测试方法 |
|--------|----------|----------|
| AC-05-01 | 详情页全屏显示大图 | 进入详情页，验证图片大小 |
| AC-05-02 | 显示拍摄日期和月龄 | 查看详情信息显示 |
| AC-05-03 | 左右滑动切换图片 | 左右滑动，验证图片切换 |
| AC-05-04 | 双指缩放功能正常 | 双指操作，验证缩放效果 |
| AC-05-05 | 返回按钮关闭详情页 | 点击返回，验证页面关闭 |

#### FR-06: 月龄分组展示

| 验收点 | 验收条件 | 测试方法 |
|--------|----------|----------|
| AC-06-01 | 数据按月龄正确分组 | 检查数据结构 |
| AC-06-02 | 切换标签正确筛选数据 | 选择标签，验证数据过滤 |
| AC-06-03 | "全部"标签显示所有照片 | 点击全部，验证完整列表 |
| AC-06-04 | 分组数据按时间倒序 | 验证组内排序正确 |

### 8.2 非功能验收标准

#### 性能要求

| 验收点 | 验收条件 | 测试方法 |
|--------|----------|----------|
| PF-01 | 首屏加载 < 1.5s | 使用性能测试工具测量 |
| PF-02 | 图片懒加载正常 | 观察网络请求 |
| PF-03 | 无内存泄漏 | 长时间使用后检查 |

#### 兼容性要求

| 验收点 | 验收条件 | 测试方法 |
|--------|----------|----------|
| CT-01 | iOS 系统正常显示 | 使用 iPhone 测试 |
| CT-02 | Android 系统正常显示 | 使用 Android 测试 |
| CT-03 | Skyline 渲染模式正常 | 检查控制台无渲染警告 |

#### 安全要求

| 验收点 | 验收条件 | 测试方法 |
|--------|----------|----------|
| SC-01 | 不存在隐私泄露 | 代码审查 |
| SC-02 | 本地存储数据不外传 | 网络审查 |

---

## 9. 后续迭代预告

### 9.1 V1.1 迭代计划

- [ ] 视频上传与播放
- [ ] 照片备注/标签功能
- [ ] 照片编辑（裁剪、滤镜）

### 9.2 V2.0 迭代计划

- [ ] 云端同步能力
- [ ] 家庭成员共享
- [ ] 成长报告生成

---

## 10. 参考文档

- [微信小程序开发文档](https://developers.weixin.qq.com/miniprogram/dev/framework/)
- [Vant Weapp 组件库](https://vant-contrib.gitee.io/vant-weapp/)
- [Skyline 渲染引擎](https://developers.weixin.qq.com/miniprogram/dev/framework/runtime/skyline/skyline.html)
- [glass-easel 组件框架](https://github.com/wechat-miniprogram/glass-easel)
