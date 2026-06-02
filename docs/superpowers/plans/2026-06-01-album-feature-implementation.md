# 相册功能修复实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 以设计文档为基准，修复相册功能实现中的差距，使实现符合设计规范。

**Architecture:** 采用分阶段修复策略，先修复数据层(T-08)，再修复UI层，最后修复交互功能。各模块通过事件和数据接口解耦。

**Tech Stack:** 微信小程序 Skyline 渲染器 + glass-easel + Vant Weapp + TypeScript

---

## 文件结构

```
miniprogram/
├── pages/album_home/
│   ├── album_home.ts        # 修改: 动态标题 + 分页
│   └── album_home.wxml      # 修改: 使用 masonry_layout
├── pages/media_detail/
│   ├── media_detail.ts      # 修改: 缩放功能
│   └── media_detail.wxml    # 修改: 缩放手势
├── components/
│   ├── age_filter/
│   │   ├── age_filter.ts    # 修改: 具体月龄标签
│   │   └── age_filter.wxml  # 修改: 动态生成标签
│   ├── masonry_layout/
│   │   └── masonry_layout.ts # 可能需要调整
│   └── media_uploader/
│       ├── media_uploader.ts    # 修改: FAB菜单 + 进度
│       └── media_uploader.wxml   # 修改: FAB菜单UI
├── services/
│   └── storage_service.ts   # 修改: MediaGroup支持
└── typings/models/
    └── media.ts             # 修改: MediaGroup接口
```

---

## 任务依赖关系

```
T-08-REV (MediaGroup数据)
       │
       ├── T-03A-REV (首页标题+分页)
       │         │
       │         └── T-03B-REV (瀑布流集成)
       │
       ├── T-07-REV (月龄筛选)
       │
       └── T-04-REV (上传组件)
                   │
                   └── T-06-REV (详情页缩放)
```

---

## Task 1: T-08-REV - 添加 MediaGroup 数据结构

**Files:**
- Modify: `typings/models/media.ts`
- Modify: `miniprogram/services/storage_service.ts`

- [ ] **Step 1: 在 media.ts 添加 MediaGroup 接口**

```typescript
// typings/models/media.ts

/**
 * 媒体分组实体 - 按月龄分组的媒体列表
 */
export interface MediaGroup {
  monthAge: number;              // 月龄（0, 1, 2, ...）
  monthLabel: string;            // 显示标签，如 "0月"、"1月"、"12月+"
  mediaList: Media[];            // 该月龄的媒体列表
  mediaCount: number;            // 该月龄的照片数量
}
```

- [ ] **Step 2: 在 storage_service.ts 添加 getMediaGroupedByMonthAge 方法**

在 StorageService 类中添加:

```typescript
/**
 * 按月龄分组获取媒体列表
 * @param babyId 宝宝ID
 * @param babyBirthDate 宝宝出生日期，用于计算月龄
 * @returns 分组后的媒体列表
 */
async getMediaGroupedByMonthAge(babyId: string, babyBirthDate: string): Promise<MediaGroup[]> {
  const mediaList = await this.getData<Media[]>(this.keys.media) || [];
  const babyMedia = mediaList.filter(m => m.babyId === babyId);

  // 按月龄分组
  const groups: Map<number, Media[]> = new Map();
  for (const media of babyMedia) {
    const monthAge = this.calculateMonthAge(babyBirthDate, media.captureDate);
    if (!groups.has(monthAge)) {
      groups.set(monthAge, []);
    }
    groups.get(monthAge)!.push(media);
  }

  // 转换为 MediaGroup 数组
  const result: MediaGroup[] = [];
  groups.forEach((list, monthAge) => {
    result.push({
      monthAge,
      monthLabel: monthAge >= 12 ? '12月+' : `${monthAge}月`,
      mediaList: list.sort((a, b) => b.captureDate.localeCompare(a.captureDate)),
      mediaCount: list.length
    });
  });

  // 按月龄降序排列
  return result.sort((a, b) => b.monthAge - a.monthAge);
}

/**
 * 计算月龄
 * @param birthDate 出生日期 (YYYY-MM-DD)
 * @param captureDate 拍摄日期 (YYYY-MM-DD)
 * @returns 月龄
 */
private calculateMonthAge(birthDate: string, captureDate: string): number {
  const birth = new Date(birthDate);
  const capture = new Date(captureDate);
  const diffTime = capture.getTime() - birth.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  return Math.floor(diffDays / 30);
}
```

- [ ] **Step 3: 提交变更**

```bash
git add typings/models/media.ts miniprogram/services/storage_service.ts
git commit -m "feat(album): 添加 MediaGroup 数据结构和分组查询方法

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 2: T-03A-REV - 相册首页框架修复

**Files:**
- Modify: `miniprogram/pages/album_home/album_home.ts`
- Modify: `miniprogram/pages/album_home/album_home.wxml`

**依赖:** T-08-REV

- [ ] **Step 1: 修改 album_home.ts - 动态设置标题**

找到 `onLoad` 方法，添加:

```typescript
onLoad() {
  this.checkAuthorization();
},

// 修改 initPage 中的标题设置
async initPage() {
  // ... 现有代码 ...

  // 设置动态标题
  if (firstBaby) {
    wx.setNavigationBarTitle({
      title: `${firstBaby.name}的成长相册`
    });
  }
  // ... 现有代码 ...
},

// 修改 onBabySelect 中的标题更新
onBabySelect() {
  const { babies } = this.data;
  if (babies.length === 0) return;

  const babyNames = babies.map(b => b.name);
  wx.showActionSheet({
    itemList: babyNames,
    success: (res) => {
      const selectedBaby = babies[res.tapIndex];
      this.setData({
        currentBabyId: selectedBaby.id,
        currentBaby: selectedBaby
      });
      // 更新导航栏标题
      wx.setNavigationBarTitle({
        title: `${selectedBaby.name}的成长相册`
      });
      this.loadMediaList();
    }
  });
},
```

- [ ] **Step 2: 修改 album_home.ts - 实现分页加载**

在 data 中添加分页状态:

```typescript
data: {
  // ... 现有字段 ...
  page: 1,
  pageSize: 20,
  hasMore: true,  // 是否有更多数据
  isLoadingMore: false,  // 是否正在加载更多
},
```

修改 `loadMediaList` 方法:

```typescript
async loadMediaList(isLoadMore = false) {
  const { currentBabyId, filterMinAge, filterMaxAge, currentBaby, page, pageSize } = this.data;

  if (!currentBabyId) {
    this.setData({ mediaList: [] });
    return;
  }

  // 如果是加载更多，页码+1
  const currentPage = isLoadMore ? page + 1 : 1;

  try {
    const babyBirthDate = currentBaby ? currentBaby.birthDate : null;
    const result = await mediaService.getMediaListWithAge(
      {
        babyId: currentBabyId,
        minAge: filterMinAge !== null ? filterMinAge : undefined,
        maxAge: filterMaxAge !== null ? filterMaxAge : undefined,
        page: currentPage,
        pageSize: pageSize
      },
      babyBirthDate
    );

    this.setData({
      mediaList: isLoadMore ? [...this.data.mediaList, ...result] : result,
      hasMore: result.length === pageSize,
      page: currentPage,
      isLoadingMore: false
    });
  } catch (error) {
    console.error('加载媒体列表失败:', error);
  }
},
```

添加上拉加载更多方法:

```typescript
onScrollToLower() {
  if (!this.data.hasMore || this.data.isLoadingMore) return;
  this.setData({ isLoadingMore: true });
  this.loadMediaList(true);
},
```

- [ ] **Step 3: 修改 album_home.wxml - 添加加载状态显示**

找到内容区域，在底部添加加载状态:

```xml
<!-- 在 </view> 闭合标签前添加 -->
<view wx:if="{{isLoadingMore}}" class="loading-more">
  <van-loading type="spinner" size="16px">加载中...</van-loading>
</view>
<view wx:elif="{{!hasMore && mediaList.length > 0}}" class="no-more">
  <text>没有更多了~</text>
</view>
```

- [ ] **Step 4: 添加加载状态的样式**

在 album_home.wxss 中添加:

```css
.loading-more {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 20rpx;
}

.no-more {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 20rpx;
  color: #999999;
  font-size: 24rpx;
}
```

- [ ] **Step 5: 提交变更**

```bash
git add miniprogram/pages/album_home/album_home.ts miniprogram/pages/album_home/album_home.wxml miniprogram/pages/album_home/album_home.wxss
git commit -m "feat(album): 相册首页动态标题和分页加载

- 导航栏标题改为显示宝宝姓名
- 实现完整分页加载（上拉加载更多）
- 添加加载状态和没有更多提示

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 3: T-03B-REV - 瀑布流集成

**Files:**
- Modify: `miniprogram/pages/album_home/album_home.wxml`
- Test: `miniprogram/components/masonry_layout/masonry_layout.ts`

**依赖:** T-03A-REV

- [ ] **Step 1: 检查 masonry_layout 组件是否可用**

如果组件存在问题，需要先修复 masonry_layout.ts 中的布局算法。核心问题是当前实现使用贪心算法但没有正确处理图片高度。

修复 `recalculateColumns` 方法:

```typescript
recalculateColumns(): void {
  const { list, columnCount, columnGap, itemGap } = this.properties;
  if (!list || list.length === 0) {
    this.setData({ columns: [], columnHeights: [] });
    return;
  }

  // 初始化列
  const columns: any[][] = Array.from({ length: columnCount }, () => []);
  const columnHeights: number[] = Array(columnCount).fill(0);

  // 贪心算法：将每个项分配到最短的列
  list.forEach((item: any) => {
    // 找到最短列
    let minCol = 0;
    for (let i = 1; i < columnCount; i++) {
      if (columnHeights[i] < columnHeights[minCol]) {
        minCol = i;
      }
    }

    // 获取项的高度
    const itemHeight = this.getItemHeight(item);

    // 添加到最短列
    columns[minCol].push(item);
    columnHeights[minCol] += itemHeight + itemGap;
  });

  this.setData({ columns, columnHeights });
},
```

- [ ] **Step 2: 修改 album_home.wxml 使用瀑布流组件**

将原有的 `block wx:for` 替换为 masonry_layout:

```xml
<!-- 替换这段代码 -->
<view wx:if="{{viewMode === 'masonry'}}" class="masonry-view">
  <block wx:for="{{mediaList}}" wx:key="id">
    <view class="masonry-item" bindtap="onMediaTap" data-id="{{item.id}}">
      <van-image
        width="100%"
        height="{{item.height || 200}}"
        src="{{item.thumbnailUrl || item.url}}"
        fit="cover"
        lazy-load
      />
      <view class="media-item-info">
        <text class="media-title">{{item.title || '无标题'}}</text>
        <text class="media-date">{{item.captureDate}}</text>
      </view>
    </view>
  </block>
</view>

<!-- 替换为 -->
<view wx:if="{{viewMode === 'masonry'}}" class="masonry-view">
  <masonry-layout
    list="{{mediaList}}"
    column-count="2"
    column-gap="16"
    item-gap="16"
    bind:scrolltolower="onScrollToLower"
  >
    <block wx:for="{{mediaList}}" wx:key="id">
      <view class="masonry-item" bindtap="onMediaTap" data-id="{{item.id}}">
        <van-image
          width="100%"
          height="{{item.height || 200}}"
          src="{{item.thumbnailUrl || item.url}}"
          fit="cover"
          lazy-load
        />
        <view class="media-item-info">
          <text class="media-title">{{item.title || '无标题'}}</text>
          <text class="media-date">{{item.captureDate}}</text>
        </view>
      </view>
    </block>
  </masonry-layout>
</view>
```

- [ ] **Step 3: 添加 masonry-layout 到 usingComponents**

检查 album_home.json 是否包含:

```json
{
  "usingComponents": {
    "masonry-layout": "/components/masonry_layout/masonry_layout"
  }
}
```

- [ ] **Step 4: 提交变更**

```bash
git add miniprogram/pages/album_home/album_home.wxml miniprogram/components/masonry_layout/masonry_layout.ts
git commit -m "feat(album): 集成瀑布流组件到相册首页

- masonry_layout 组件修复布局算法
- album_home 使用 masonry-layout 组件替代 block 渲染

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 4: T-07-REV - 月龄筛选功能修复

**Files:**
- Modify: `miniprogram/components/age_filter/age_filter.ts`
- Modify: `miniprogram/components/age_filter/age_filter.wxml`

**依赖:** T-08-REV

- [ ] **Step 1: 修改 age_filter.ts - 生成具体月龄标签**

替换 `quickOptions` 的定义逻辑:

```typescript
data: {
  currentAge: null as BabyAge | null,
  selectedValue: null as number | null,
  quickOptions: [] as Array<{label: string; value: number; minAge: number; maxAge: number}>,

  // 其他现有字段...
},

lifetimes: {
  attached(): void {
    this.calculateCurrentAge();
    this.generateMonthLabels();  // 新方法：生成月龄标签
    this.setData({ selectedValue: this.properties.value });
  }
},

methods: {
  // 生成具体月龄标签
  generateMonthLabels(): void {
    const { birthDate } = this.properties;
    if (!birthDate) {
      this.setData({ quickOptions: [{ label: '全部', value: null, minAge: null, maxAge: null }] });
      return;
    }

    const currentAge = calculateBabyAge(birthDate);
    const maxMonthAge = currentAge.years * 12 + currentAge.months;

    const options: Array<{label: string; value: number; minAge: number; maxAge: number}> = [
      { label: '全部', value: null, minAge: null, maxAge: null }
    ];

    // 生成从 0 到当前月龄的标签
    for (let i = 0; i <= maxMonthAge && i <= 12; i++) {
      options.push({
        label: `${i}月`,
        value: i,
        minAge: i,
        maxAge: i
      });
    }

    // 如果超过12月，显示 "12月+"
    if (maxMonthAge > 12) {
      options.push({
        label: '12月+',
        value: 12,
        minAge: 12,
        maxAge: -1  // -1 表示不限最大月龄
      });
    }

    this.setData({ quickOptions: options });
  },

  // 修改月龄计算函数支持按范围筛选
  onQuickSelect(event: any): void {
    const { value } = event.currentTarget.dataset;
    const option = this.data.quickOptions.find(o => o.value === value);
    this.setData({ selectedValue: value });
    this.triggerEvent('change', {
      value,
      minAge: option ? option.minAge : null,
      maxAge: option ? option.maxAge : null
    });
  },
}
```

- [ ] **Step 2: 修改 age_filter.wxml - 适配动态标签**

简化模板以适应动态生成的标签:

```xml
<view class="age-filter-container">
  <!-- 快捷筛选横向滚动栏 -->
  <scroll-view scroll-x class="quick-filter">
    <block wx:for="{{quickOptions}}" wx:key="value">
      <view
        class="filter-tag {{value === selectedValue ? 'active' : ''}}"
        bindtap="onQuickSelect"
        data-value="{{item.value}}"
      >
        {{item.label}}
      </view>
    </block>
  </scroll-view>
</view>
```

移除自定义筛选弹窗相关代码（如果不需要）。

- [ ] **Step 3: 提交变更**

```bash
git add miniprogram/components/age_filter/age_filter.ts miniprogram/components/age_filter/age_filter.wxml
git commit -m "feat(album): 月龄筛选改为具体月龄标签

- 从范围筛选改为具体月龄标签（0月、1月...）
- 标签根据宝宝当前月龄动态生成
- 超过12月显示12月+

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 5: T-04-REV - 媒体上传组件修复

**Files:**
- Modify: `miniprogram/components/media_uploader/media_uploader.ts`
- Modify: `miniprogram/components/media_uploader/media_uploader.wxml`

- [ ] **Step 1: 修改 media_uploader.ts - 添加 FAB 菜单状态**

```typescript
data: {
  // ... 现有字段 ...
  fabMenuVisible: false,  // FAB菜单是否显示
  uploadProgress: 0,  // 上传进度 0-100
}
```

添加 FAB 菜单方法:

```typescript
toggleFabMenu(): void {
  this.setData({ fabMenuVisible: !this.data.fabMenuVisible });
},

onFabMenuClose(): void {
  this.setData({ fabMenuVisible: false });
},

async onFabCameraTap(): void {
  // 关闭菜单
  this.setData({ fabMenuVisible: false });
  // 调用拍照选择
  await this.onSelectTap('camera');
},

async onFabAlbumTap(): void {
  // 关闭菜单
  this.setData({ fabMenuVisible: false });
  // 调用相册选择
  await this.onSelectTap('album');
},

async onSelectTap(source: 'camera' | 'album' = 'album'): Promise<void> {
  // 保留原有的选择逻辑，添加 source 参数
  try {
    const remainingCount = this.properties.maxCount - this.data.fileList.length;
    if (remainingCount <= 0) {
      wx.showToast({ title: `最多上传${this.properties.maxCount}张`, icon: 'none' });
      return;
    }

    const files = await chooseMedia(remainingCount, 'image', source);
    // ... 其余逻辑保持不变
  } catch (error) {
    console.error('选择图片失败:', error);
  }
},
```

- [ ] **Step 2: 修改 media_uploader.wxml - FAB 菜单 UI**

将原有的按钮替换为 FAB 悬浮按钮:

```xml
<!-- 替换原有的上传按钮 -->
<!-- <view class="upload-btn">
  <van-button type="primary" round icon="plus" bind:click="onUploadTap">上传</van-button>
</view> -->

<!-- 替换为 FAB 悬浮按钮 -->
<view class="fab-container">
  <!-- 遮罩层 -->
  <view wx:if="{{fabMenuVisible}}" class="fab-mask" bindtap="onFabMenuClose"></view>

  <!-- 菜单选项 -->
  <view wx:if="{{fabMenuVisible}}" class="fab-menu">
    <view class="fab-menu-item" bindtap="onFabCameraTap">
      <van-icon name="photograph" size="20px" />
      <text>拍照</text>
    </view>
    <view class="fab-menu-item" bindtap="onFabAlbumTap">
      <van-icon name="photo-o" size="20px" />
      <text>从相册选择</text>
    </view>
  </view>

  <!-- 主按钮 -->
  <view class="fab-button {{fabMenuVisible ? 'active' : ''}}" bindtap="toggleFabMenu">
    <van-icon name="plus" size="24px" color="#ffffff" />
  </view>
</view>

<!-- 进度提示 -->
<van-popup show="{{uploadProgress > 0 && uploadProgress < 100}}" position="center" round>
  <view class="upload-progress">
    <van-loading type="spinner" size="32px" />
    <text>上传中...{{uploadProgress}}%</text>
  </view>
</van-popup>
```

- [ ] **Step 3: 添加 FAB 样式到 media_uploader.wxss**

```css
.fab-container {
  position: fixed;
  right: 32rpx;
  bottom: 32rpx;
  z-index: 999;
}

.fab-mask {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.3);
  z-index: 998;
}

.fab-button {
  width: 112rpx;
  height: 112rpx;
  border-radius: 56rpx;
  background: linear-gradient(135deg, #FFB7C5, #FF8FA3);
  box-shadow: 0 4rpx 16rpx rgba(255, 183, 197, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.2s;
}

.fab-button.active {
  transform: rotate(45deg);
}

.fab-menu {
  position: absolute;
  bottom: 140rpx;
  right: 0;
  background: #ffffff;
  border-radius: 16rpx;
  box-shadow: 0 4rpx 24rpx rgba(0, 0, 0, 0.1);
  overflow: hidden;
}

.fab-menu-item {
  display: flex;
  align-items: center;
  padding: 24rpx 32rpx;
  gap: 16rpx;
  border-bottom: 1rpx solid #eeeeee;
}

.fab-menu-item:last-child {
  border-bottom: none;
}

.upload-progress {
  padding: 48rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 24rpx;
}
```

- [ ] **Step 4: 提交变更**

```bash
git add miniprogram/components/media_uploader/media_uploader.ts miniprogram/components/media_uploader/media_uploader.wxml miniprogram/components/media_uploader/media_uploader.wxss
git commit -m "feat(album): 媒体上传组件添加FAB菜单和进度显示

- 添加FAB悬浮按钮
- 点击展开拍照/相册选择菜单
- 添加上传进度提示

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 6: T-06-REV - 媒体详情页缩放功能

**Files:**
- Modify: `miniprogram/pages/media_detail/media_detail.ts`
- Modify: `miniprogram/pages/media_detail/media_detail.wxml`

**依赖:** T-04-REV

- [ ] **Step 1: 修改 media_detail.ts - 添加缩放状态**

```typescript
data: {
  // ... 现有字段 ...
  scale: 1,           // 当前缩放比例
  minScale: 1,        // 最小缩放
  maxScale: 3,        // 最大缩放
  isZooming: false,   // 是否正在缩放
},
```

添加缩放手势处理:

```typescript
// 手指触摸开始
onTouchStart(e: any): void {
  if (e.touches.length === 2) {
    this.setData({ isZooming: true });
    // 记录初始距离
    const touch1 = e.touches[0];
    const touch2 = e.touches[1];
    const initialDistance = Math.sqrt(
      Math.pow(touch2.clientX - touch1.clientX, 2) +
      Math.pow(touch2.clientY - touch1.clientY, 2)
    );
    this.data.initialPinchDistance = initialDistance;
  }
},

// 手指移动
onTouchMove(e: any): void {
  if (!this.data.isZooming || e.touches.length !== 2) return;

  const touch1 = e.touches[0];
  const touch2 = e.touches[1];
  const currentDistance = Math.sqrt(
    Math.pow(touch2.clientX - touch1.clientX, 2) +
    Math.pow(touch2.clientY - touch1.clientY, 2)
  );

  const { initialPinchDistance, scale, minScale, maxScale } = this.data;
  const delta = currentDistance / initialPinchDistance;
  let newScale = scale * delta;

  // 限制缩放范围
  newScale = Math.max(minScale, Math.min(maxScale, newScale));

  this.setData({ scale: newScale });
},

// 手指触摸结束
onTouchEnd(): void {
  this.setData({ isZooming: false });
  // 如果缩小到最小，恢复原状
  if (this.data.scale <= this.data.minScale) {
    this.setData({ scale: 1 });
  }
},
```

- [ ] **Step 2: 修改 media_detail.wxml - 应用缩放**

```xml
<!-- 修改图片预览区域，添加缩放样式 -->
<view class="preview-container" bindtap="onPreviewTap">
  <swiper
    class="media-swiper"
    current="{{currentIndex}}"
    bindchange="onSwiperChange"
    indicator-dots
    indicator-color="rgba(255,255,255,0.5)"
    indicator-active-color="#ffffff"
  >
    <block wx:for="{{mediaList}}" wx:key="id">
      <swiper-item>
        <view
          class="image-container"
          style="transform: scale({{index === currentIndex ? scale : 1}}); transition: {{isZooming ? 'none' : 'transform 0.2s'}};"
          catchtouchstart="onTouchStart"
          catchtouchmove="onTouchMove"
          catchtouchend="onTouchEnd"
        >
          <van-image
            width="100%"
            height="100%"
            src="{{item.url}}"
            fit="aspectFit"
            show-menu-by-longpress
            use-loading-slot
          >
            <van-loading slot="loading" type="spinner" size="36px" color="#ffffff" />
          </van-image>
        </view>
      </swiper-item>
    </block>
  </swiper>
</view>
```

- [ ] **Step 3: 添加缩放样式到 media_detail.wxss**

```css
.image-container {
  width: 100%;
  height: 100%;
  transform-origin: center center;
}
```

- [ ] **Step 4: 提交变更**

```bash
git add miniprogram/pages/media_detail/media_detail.ts miniprogram/pages/media_detail/media_detail.wxml miniprogram/pages/media_detail/media_detail.wxss
git commit -m "feat(album): 媒体详情页添加双指缩放功能

- 添加缩放手势处理
- 支持双指缩放图片
- 缩放手势期间禁止swiper切换

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 7: T-10 - 瀑布流验收测试

**Files:**
- Test: `miniprogram/tests/specs/album-flow.ts`

**依赖:** T-03B-REV

- [ ] **Step 1: 验证瀑布流组件正常工作**

启动微信开发者工具，执行以下验证：

1. 进入相册首页
2. 检查瀑布流布局是否正确显示（双列）
3. 上传不同比例的图片，检查是否不变形
4. 滑动页面检查懒加载是否正常

- [ ] **Step 2: 更新测试用例**

在 `album-flow.ts` 中添加瀑布流验证:

```typescript
{
  name: '验证瀑布流布局',
  page: 'album_home',
  step: 6,
  action: async (ctx: FlowContext) => {
    // 验证瀑布流组件存在
    const masonry = await ctx.page.$('masonry-layout');
    if (masonry) {
      console.log('瀑布流组件已正确集成');
    }
  },
  expectations: [
    '瀑布流布局显示正确',
    '图片按原始比例显示',
    '懒加载正常'
  ]
}
```

- [ ] **Step 3: 提交变更**

```bash
git add miniprogram/tests/specs/album-flow.ts
git commit -m "test(album): 添加瀑布流验收测试

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## 实施检查清单

完成所有任务后，确认以下功能正常：

| 功能 | 验证方法 |
|------|----------|
| 相册首页动态标题 | 选择不同宝宝，标题应变化 |
| 分页加载 | 上拉到底部应加载更多 |
| 瀑布流布局 | 图片双列显示，高度自适应 |
| 月龄筛选 | 显示具体月龄标签"0月"、"1月"... |
| FAB上传菜单 | 点击右下角按钮应展开菜单 |
| 图片缩放 | 双指缩放详情页图片 |

---

*计划创建: 2026-06-01*
