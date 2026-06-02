# 相册功能详细任务规格

## 项目信息
- **项目名称**: 宝宝成长相册 (Baby Growth Album)
- **所属模块**: 相册功能模块
- **创建日期**: 2026-05-31
- **版本**: v1.1 (调整后)

### 版本变更说明 (v1.1)
1. 新增 T-00 技术可行性验证任务 (2h)
2. 拆分 T-03 为 T-03A、T-03B、T-03C，降低复杂度
3. T-05 瀑布流组件优先级提升至 P0
4. T-07 月龄筛选功能优先级提升至 P1
5. T-09 改为持续集成验证模式
6. 新增迭代版本划分 (v0.1/v0.2/v0.3)

---

## 目录

- [T-00: 技术可行性验证](#t-00-技术可行性验证)
- [T-01: 项目结构搭建](#t-01-项目结构搭建)
- [T-02: 宝宝信息数据模型](#t-02-宝宝信息数据模型)
- [T-03A: 相册首页框架](#t-03a-相册首页框架)
- [T-03B: 瀑布流集成](#t-03b-瀑布流集成)
- [T-03C: 月龄筛选集成](#t-03c-月龄筛选集成)
- [T-04: 媒体上传组件](#t-04-媒体上传组件)
- [T-05: 瀑布流组件](#t-05-瀑布流组件)
- [T-06: 媒体详情页](#t-06-媒体详情页)
- [T-07: 月龄筛选功能](#t-07-月龄筛选功能)
- [T-08: 本地存储服务](#t-08-本地存储服务)
- [T-09: 持续集成验证](#t-09-持续集成验证)

---

## T-00: 技术可行性验证

**任务名称**: 技术可行性验证 - Validate Skyline + glass-easel + Vant Weapp compatibility

### 描述
在正式开发前，验证 Skyline 渲染器 + glass-easel 组件框架与 Vant Weapp 组件库的兼容性，确保瀑布流等核心功能可以正常实现。

### 前置条件
- [ ] 已阅读 CLAUDE.md 了解项目技术栈
- [ ] 已阅读 iteration_assessment.md 了解风险点

### 开发步骤

1. **创建验证页面**
   ```
   miniprogram/pages/tech_validate/
   ```

2. **验证 Vant Weapp 基础组件**
   - 导入 van-button、van-cell 等基础组件
   - 测试组件渲染是否正常
   - 记录兼容性问题

3. **验证瀑布流布局方案**
   - 方案A: 使用 Vant Weapp 现有组件组合
   - 方案B: 自定义瀑布流组件
   - 测试动态高度计算
   - 测试懒加载效果

4. **验证 glass-easel 组件隔离**
   - 测试组件样式隔离
   - 测试组件通信
   - 测试 slot 插槽

5. **输出验证报告**
   - 整理兼容性问题清单
   - 确定推荐的技术方案
   - 提供风险缓解建议

### 测试方法
- [ ] 微信开发者工具模拟器运行正常
- [ ] 真机 (iOS/Android) 运行正常
- [ ] 所有基础 Vant 组件正常渲染
- [ ] 瀑布流布局正常工作

### 预期输出文件

| 文件路径 | 说明 |
|----------|------|
| `miniprogram/pages/tech_validate/` | 验证页面目录 |
| `docs/task/album_feature/tech_validation_report.md` | 技术验证报告 |

### 注意事项
- 此任务为风险预防性质
- 发现问题及时调整技术方案
- 验证通过后再启动大规模开发

---

## T-01: 项目结构搭建

**任务名称**: 项目结构搭建 - Create album feature directory structure per CLAUDE.md conventions

### 描述
创建相册功能模块的完整目录结构，遵循CLAUDE.md中定义的小写下划线命名规范和标准目录结构。

### 前置条件
- [ ] 了解CLAUDE.md中的目录结构规范
- [ ] 了解页面和组件的四个标准文件(.ts/.wxml/.wxss/.json)

### 开发步骤

1. **创建页面目录结构**
   ```
   miniprogram/pages/album_home/          # 相册首页
   miniprogram/pages/media_detail/        # 媒体详情页
   ```

2. **创建组件目录结构**
   ```
   miniprogram/components/media_uploader/    # 媒体上传组件
   miniprogram/components/masonry_layout/    # 瀑布流布局组件
   miniprogram/components/age_filter/        # 月龄筛选组件
   miniprogram/components/media_card/        # 媒体卡片组件
   ```

3. **创建服务层目录**
   ```
   miniprogram/services/storage_service.ts   # 本地存储服务
   miniprogram/services/media_service.ts     # 媒体服务
   ```

4. **创建数据模型目录**
   ```
   typings/models/
       ├── baby.ts       # 宝宝数据模型
       └── media.ts      # 媒体数据模型
   ```

5. **创建常量定义目录**
   ```
   miniprogram/constants/
       ├── album_constants.ts   # 相册相关常量
       └── storage_keys.ts      # 存储键名常量
   ```

6. **创建工具函数目录**
   ```
   miniprogram/utils/
       ├── date_utils.ts         # 日期工具函数
       ├── image_utils.ts        # 图片处理工具
       └── age_calculator.ts     # 月龄计算工具
   ```

7. **更新app.json**
   - 在pages数组中添加新页面路径
   - 在window配置中确保navigationBar样式正确

### 测试方法
- [ ] 验证所有目录和文件已按规范创建
- [ ] 验证app.json中页面路径配置正确
- [ ] 验证微信开发者工具中可以正常编译

### 预期输出文件

| 文件路径 | 说明 |
|----------|------|
| `miniprogram/pages/album_home/` | 相册首页目录（4个标准文件） |
| `miniprogram/pages/media_detail/` | 媒体详情页目录（4个标准文件） |
| `miniprogram/components/media_uploader/` | 上传组件目录 |
| `miniprogram/components/masonry_layout/` | 瀑布流组件目录 |
| `miniprogram/components/age_filter/` | 筛选组件目录 |
| `miniprogram/components/media_card/` | 卡片组件目录 |
| `miniprogram/services/storage_service.ts` | 存储服务 |
| `miniprogram/services/media_service.ts` | 媒体服务 |
| `typings/models/baby.ts` | 宝宝模型定义 |
| `typings/models/media.ts` | 媒体模型定义 |
| `miniprogram/constants/album_constants.ts` | 相册常量 |
| `miniprogram/utils/date_utils.ts` | 日期工具 |
| `miniprogram/utils/image_utils.ts` | 图片工具 |
| `miniprogram/utils/age_calculator.ts` | 月龄计算 |

### 注意事项
- 严格遵循小写下划线命名法
- 每个页面/组件必须包含.ts/.wxml/.wxss/.json四个文件
- 组件需要在json中配置`component: true`
- 新页面需在app.json的pages数组中注册

---

## T-02: 宝宝信息数据模型

**任务名称**: 宝宝信息数据模型 - Define Baby and Media data models with TypeScript interfaces

### 描述
定义Baby（宝宝）和Media（媒体）的TypeScript数据模型接口，包含属性类型定义、验证规则和必要的类型守卫。

### 前置条件
- [ ] T-01 项目结构搭建已完成
- [ ] 了解TypeScript接口定义规范
- [ ] 了解WeChat小程序数据存储格式

### 开发步骤

1. **定义Baby模型接口**
   ```typescript
   // typings/models/baby.ts

   /**
    * 宝宝性别枚举
    */
   export enum BabyGender {
     Male = 'male',
     Female = 'female',
     Unknown = 'unknown'
   }

   /**
    * 宝宝数据模型
    */
   export interface Baby {
     id: string;                    // 唯一标识符
     name: string;                  // 宝宝姓名
     birthDate: string;             // 出生日期 (YYYY-MM-DD)
     gender: BabyGender;            // 性别
     avatar?: string;               // 头像URL
     createdAt: string;             // 创建时间 ISO8601
     updatedAt: string;             // 更新时间 ISO8601
   }

   /**
    * 创建宝宝的输入参数
    */
   export interface CreateBabyInput {
     name: string;
     birthDate: string;
     gender: BabyGender;
     avatar?: string;
   }

   /**
    * 更新宝宝的输入参数
    */
   export interface UpdateBabyInput {
     name?: string;
     birthDate?: string;
     gender?: BabyGender;
     avatar?: string;
   }
   ```

2. **定义Media模型接口**
   ```typescript
   // typings/models/media.ts

   /**
    * 媒体类型枚举
    */
   export enum MediaType {
     Photo = 'photo',
     Video = 'video'
   }

   /**
    * 媒体数据模型
    */
   export interface Media {
     id: string;                    // 唯一标识符
     babyId: string;                // 关联宝宝ID
     type: MediaType;               // 媒体类型
     url: string;                   // 媒体URL
     thumbnailUrl?: string;         // 缩略图URL
     width?: number;                // 原始宽度
     height?: number;               // 原始高度
     size: number;                  // 文件大小(bytes)
     title?: string;                // 标题/描述
     captureDate: string;           // 拍摄日期 (YYYY-MM-DD)
     babyAge?: BabyAge;             // 拍摄时宝宝月龄
     tags?: string[];               // 标签
     createdAt: string;             // 创建时间 ISO8601
     updatedAt: string;             // 更新时间 ISO8601
   }

   /**
    * 宝宝月龄信息
    */
   export interface BabyAge {
     years: number;                 // 年龄（岁）
     months: number;                // 月龄（月）
     days: number;                  // 天龄（日）
   }

   /**
    * 创建媒体的输入参数
    */
   export interface CreateMediaInput {
     babyId: string;
     type: MediaType;
     url: string;
     thumbnailUrl?: string;
     width?: number;
     height?: number;
     size: number;
     title?: string;
     captureDate: string;
     tags?: string[];
   }

   /**
    * 媒体查询参数
    */
   export interface MediaQuery {
     babyId?: string;
     type?: MediaType;
     startDate?: string;
     endDate?: string;
     minAge?: number;               // 最小月龄（月）
     maxAge?: number;               // 最大月龄（月）
     tags?: string[];
     page?: number;
     pageSize?: number;
   }
   ```

3. **定义类型守卫函数**
   ```typescript
   // typings/models/media.ts

   export function isBaby(obj: unknown): obj is Baby {
     return obj !== null && typeof obj === 'object' && 'id' in obj && 'name' in obj;
   }

   export function isMedia(obj: unknown): obj is Media {
     return obj !== null && typeof obj === 'object' && 'id' in obj && 'babyId' in obj;
   }
   ```

4. **在index.d.ts中导出模型**
   - 更新 `typings/index.d.ts` 添加模型导出

### 测试方法
- [ ] TypeScript编译无错误
- [ ] 类型守卫函数正确识别对象类型
- [ ] 所有可选字段正确设置为可选

### 预期输出文件

| 文件路径 | 说明 |
|----------|------|
| `typings/models/baby.ts` | 宝宝数据模型定义 |
| `typings/models/media.ts` | 媒体数据模型定义 |
| `typings/index.d.ts` | 更新导出声明 |

### 注意事项
- 使用string类型存储日期，需明确格式为YYYY-MM-DD
- ID使用UUID v4格式确保唯一性
- 文件大小使用bytes为单位
- 类型定义需与实际存储结构一致

---

## T-03A: 相册首页框架

**任务名称**: 相册首页框架 - Build album home page skeleton with navigation and layout

### 描述
开发相册首页基础框架，搭建导航栏、页面布局结构、状态管理基础。不包含瀑布流和月龄筛选的具体实现。

### 前置条件
- [ ] T-00 技术验证已完成
- [ ] T-01 项目结构搭建已完成
- [ ] T-02 数据模型定义已完成
- [ ] T-08 本地存储服务已完成

### 开发步骤

1. **配置页面.json**
   ```json
   {
     "usingComponents": {
       "van-nav-bar": "vant-weapp/nav-bar/index",
       "van-button": "vant-weapp/button/index"
     },
     "navigationBarTitleText": "成长相册",
     "enablePullDownRefresh": true
   }
   ```

2. **实现页面逻辑 (album_home.ts)**
   - 定义页面数据状态
     - `currentBabyId`: 当前宝宝ID
     - `mediaList`: 媒体列表
     - `viewMode`: 视图模式 ('timeline' | 'masonry')
     - `isLoading`: 加载状态
   - 实现生命周期函数
     - `onLoad`: 初始化加载媒体列表
     - `onShow`: 每次显示时检查数据更新
     - `onPullDownRefresh`: 下拉刷新
   - 实现基础事件处理
     - `switchViewMode`: 切换视图模式（预留）
     - `onMediaTap`: 点击媒体项跳转详情
     - `onUploadTap`: 点击上传按钮

3. **实现页面模板 (album_home.wxml)**
   - 顶部导航栏（使用van-nav-bar）
   - 宝宝选择器（简单下拉）
   - 视图模式切换按钮（预留）
   - 内容区域（临时使用简单列表）
   - 底部上传按钮（悬浮）

4. **实现页面样式 (album_home.wxss)**
   - 页面基础布局样式
   - 悬浮按钮样式

### 测试方法
- [ ] 页面可以正常加载显示
- [ ] 宝宝切换后媒体列表正确更新
- [ ] 下拉刷新功能正常
- [ ] 点击媒体项可以跳转详情页

### 预期输出文件

| 文件路径 | 说明 |
|----------|------|
| `miniprogram/pages/album_home/album_home.ts` | 页面逻辑 |
| `miniprogram/pages/album_home/album_home.wxml` | 页面结构 |
| `miniprogram/pages/album_home/album_home.wxss` | 页面样式 |
| `miniprogram/pages/album_home/album_home.json` | 页面配置 |

### 注意事项
- 此任务专注于框架搭建，不实现复杂布局
- 为后续T-03B、T-03C集成预留接口
- Skyline渲染器下注意组件隔离

---

## T-03B: 瀑布流集成

**任务名称**: 瀑布流集成 - Integrate masonry layout into album home

### 描述
将 T-05 完成的瀑布流组件集成到相册首页，调试瀑布流布局性能，实现图片懒加载。

### 前置条件
- [ ] T-03A 相册首页框架已完成
- [ ] T-05 瀑布流组件已完成

### 开发步骤

1. **更新页面配置**
   ```json
   {
     "usingComponents": {
       "van-nav-bar": "vant-weapp/nav-bar/index",
       "van-button": "vant-weapp/button/index",
       "masonry-layout": "/components/masonry_layout/masonry_layout"
     }
   }
   ```

2. **集成瀑布流组件**
   - 在 album_home.wxml 中替换内容区为 masonry-layout
   - 传递 mediaList 到瀑布流组件
   - 配置列数和间距参数

3. **实现懒加载集成**
   - 配置图片懒加载阈值
   - 测试不同网络环境下的加载效果
   - 优化占位图显示

4. **性能调优**
   - 测试大量图片 (100+) 滚动性能
   - 监控内存占用
   - 调优滚动流畅度

### 测试方法
- [ ] 瀑布流布局显示正确
- [ ] 图片懒加载正常触发
- [ ] 滚动流畅无卡顿
- [ ] 内存占用正常

### 预期输出文件

| 文件路径 | 说明 |
|----------|------|
| `miniprogram/pages/album_home/album_home.ts` | 更新页面逻辑 |
| `miniprogram/pages/album_home/album_home.wxml` | 更新页面结构 |

### 注意事项
- 如遇性能问题，优先优化图片尺寸
- 瀑布流组件如有bug先在组件内修复

---

## T-03C: 月龄筛选集成

**任务名称**: 月龄筛选集成 - Integrate age filter into album home

### 描述
将 T-07 完成的月龄筛选功能集成到相册首页，调试筛选交互和列表更新逻辑。

### 前置条件
- [ ] T-03A 相册首页框架已完成
- [ ] T-07 月龄筛选功能已完成

### 开发步骤

1. **更新页面配置**
   ```json
   {
     "usingComponents": {
       "van-nav-bar": "vant-weapp/nav-bar/index",
       "van-button": "vant-weapp/button/index",
       "masonry-layout": "/components/masonry_layout/masonry_layout",
       "age-filter": "/components/age_filter/age_filter"
     }
   }
   ```

2. **集成筛选组件**
   - 在 album_home.wxml 中添加 age-filter 组件
   - 配置 babyId 和 birthDate 属性
   - 绑定筛选值变化事件

3. **实现筛选逻辑**
   - 接收筛选条件变化事件
   - 从存储服务获取筛选后的数据
   - 更新 mediaList 触发视图更新

4. **实现时间线视图**
   - 添加时间线/瀑布流视图切换
   - 时间线按月份分组展示
   - 月份标签吸顶效果

### 测试方法
- [ ] 月龄筛选功能正常
- [ ] 筛选后列表正确更新
- [ ] 视图切换正常
- [ ] 时间线分组显示正确

### 预期输出文件

| 文件路径 | 说明 |
|----------|------|
| `miniprogram/pages/album_home/album_home.ts` | 更新页面逻辑 |
| `miniprogram/pages/album_home/album_home.wxml` | 更新页面结构 |
| `miniprogram/pages/album_home/album_home.wxss` | 更新页面样式 |

### 注意事项
- 筛选逻辑需考虑性能，大数据量时使用索引
- 时间线分组需提前计算好月份边界

---

## T-04: 媒体上传组件

**任务名称**: 媒体上传组件 - Implement image upload functionality using Vant Weapp components

### 描述
实现图片选择和上传功能组件，支持选择图片、预览、压缩优化和上传进度显示。

### 前置条件
- [ ] T-01 项目结构搭建已完成
- [ ] T-02 数据模型定义已完成

### 开发步骤

1. **配置组件.json**
   ```json
   {
     "component": true,
     "usingComponents": {
       "van-popup": "vant-weapp/popup/index",
       "van-button": "vant-weapp/button/index",
       "van-uploader": "vant-weapp/uploader/index",
       "van-field": "vant-weapp/field/index",
       "van-dialog": "vant-weapp/dialog/index",
       "van-loading": "vant-weapp/loading/index"
     }
   }
   ```

2. **定义组件属性 (media_uploader.ts)**
   ```typescript
   Component({
     properties: {
       visible: {
         type: Boolean,
         value: false
       },
       babyId: {
         type: String,
         value: ''
       },
       maxCount: {
         type: Number,
         value: 9
       }
     },

     data: {
       fileList: [] as any[],
       uploadLoading: false,
       captureDate: '',
       title: ''
     },

     methods: {
       onClose(): void,
       onSelectTap(): void,
       onAfterRead(event: any): void,
       onDeleteItem(event: any): void,
       onDateChange(event: any): void,
       onTitleInput(event: any): void,
       onConfirm(): void,
       onCancel(): void,
       compressImage(filePath: string): Promise<string>,
       uploadFile(filePath: string): Promise<string>
     }
   })
   ```

3. **实现图片选择**
   - 使用`wx.chooseMedia`API
   - 支持图片和视频选择
   - 设置图片数量限制

4. **实现图片压缩**
   - 使用`wx.compressImage`API
   - 压缩质量设置为80%
   - 目标宽度1920px

5. **实现上传功能**
   - 使用`wx.cloud.uploadFile`或本地存储
   - 显示上传进度
   - 错误处理和重试机制

6. **实现组件模板 (media_uploader.wxml)**
   - van-popup弹出层容器
   - van-uploader图片选择器
   - 日期选择器（captureDate）
   - 标题输入框
   - 确认/取消按钮

7. **实现组件样式 (media_uploader.wxss)**
   - 弹出层样式
   - 上传区域样式
   - 预览图片网格样式
   - 按钮样式

### 测试方法
- [ ] 组件可以正常打开和关闭
- [ ] 可以选择本地图片
- [ ] 图片预览显示正常
- [ ] 可以删除已选图片
- [ ] 日期选择器正常工作
- [ ] 上传过程显示进度
- [ ] 上传成功后正确回调

### 预期输出文件

| 文件路径 | 说明 |
|----------|------|
| `miniprogram/components/media_uploader/media_uploader.ts` | 组件逻辑 |
| `miniprogram/components/media_uploader/media_uploader.wxml` | 组件结构 |
| `miniprogram/components/media_uploader/media_uploader.wxss` | 组件样式 |
| `miniprogram/components/media_uploader/media_uploader.json` | 组件配置 |

### 注意事项
- Vant Weapp的uploader组件需正确配置
- 图片压缩可提升存储效率和加载性能
- 上传失败需提供重试机制
- 组件销毁时需清理临时文件

---

## T-05: 瀑布流组件

**任务名称**: 瀑布流组件 - Create masonry/waterfall layout component

### 描述
创建可复用的瀑布流布局组件，支持动态列数、懒加载和滚动优化。

### 前置条件
- [ ] T-01 项目结构搭建已完成

### 开发步骤

1. **配置组件.json**
   ```json
   {
     "component": true,
     "styleIsolation": "apply-shared"
   }
   ```

2. **定义组件属性 (masonry_layout.ts)**
   ```typescript
   Component({
     properties: {
       columnCount: {
         type: Number,
         value: 2
       },
       columnGap: {
         type: Number,
         value: 8
       },
       itemGap: {
         type: Number,
         value: 8
       },
       list: {
         type: Array,
         value: []
       }
     },

     data: {
       columns: [] as any[][],
       columnHeights: [] as number[]
     },

     lifetimes: {
       attached(): void {
         this recalculateColumns();
       }
     },

     methods: {
       recalculateColumns(): void,
       onScrollToLower(): void,
       getItemHeight(item: any): number
     },

     observers: {
       'list, columnCount, columnGap': function() {
         this.recalculateColumns();
       }
     }
   })
   ```

3. **实现瀑布流算法**
   - 计算每列高度
   - 将项分配到最短列
   - 考虑图片懒加载高度

4. **实现组件模板 (masonry_layout.wxml)**
   - 使用flex布局实现列
   - slot插槽接收外部内容
   - 滚动加载触发区域

5. **实现组件样式 (masonry_layout.wxss)**
   - 列容器flex布局
   - 列宽计算：`calc((100% - gap * (count - 1)) / count)`
   - 列内元素间距

6. **实现懒加载**
   - 使用 IntersectionObserver 监听可见性
   - 图片进入可视区域才加载
   - 占位图处理

### 测试方法
- [ ] 瀑布流布局显示正确
- [ ] 列数可以动态调整
- [ ] 滚动时性能流畅
- [ ] 图片懒加载正常
- [ ] 触底加载更多功能正常

### 预期输出文件

| 文件路径 | 说明 |
|----------|------|
| `miniprogram/components/masonry_layout/masonry_layout.ts` | 组件逻辑 |
| `miniprogram/components/masonry_layout/masonry_layout.wxml` | 组件结构 |
| `miniprogram/components/masonry_layout/masonry_layout.wxss` | 组件样式 |
| `miniprogram/components/masonry_layout/masonry_layout.json` | 组件配置 |

### 注意事项
- Skyline渲染器下需注意布局兼容性
- 大量数据时需考虑分页加载
- 图片高度需预先计算或使用占位
- 使用 `slot` 插槽提供灵活性

---

## T-06: 媒体详情页

**任务名称**: 媒体详情页 - Build media detail view page

### 描述
构建媒体详情查看页面，支持图片放大浏览、Swiper滑动切换、删除确认和详情编辑。

### 前置条件
- [ ] T-01 项目结构搭建已完成
- [ ] T-02 数据模型定义已完成
- [ ] T-08 本地存储服务已完成

### 开发步骤

1. **配置页面.json**
   ```json
   {
     "usingComponents": {
       "van-nav-bar": "vant-weapp/nav-bar/index",
       "van-icon": "vant-weapp/icon/index",
       "van-action-sheet": "vant-weapp/action-sheet/index",
       "van-dialog": "vant-weapp/dialog/index",
       "van-loading": "vant-weapp/loading/index"
     },
     "navigationBarTitleText": "照片详情",
     "navigationBarBackgroundColor": "#000000"
   }
   ```

2. **实现页面逻辑 (media_detail.ts)**
   - 定义页面数据状态
     - `media`: 当前媒体详情
     - `mediaList`: 同批次媒体列表
     - `currentIndex`: 当前索引
     - `showActions`: 是否显示操作菜单
   - 实现生命周期函数
     - `onLoad`: 接收mediaId参数加载数据
   - 实现事件处理
     - `onSwiperChange`: Swiper切换事件
     - `onDeleteTap`: 删除按钮点击
     - `onEditTap`: 编辑按钮点击
     - `onDownloadTap`: 下载保存
     - `onShareTap`: 分享

3. **实现页面模板 (media_detail.wxml)**
   - 全屏背景（黑色）
   - van-swiper图片轮播
   - 顶部导航栏（透明背景）
   - 底部信息展示栏
   - 操作菜单（van-action-sheet）

4. **实现页面样式 (media_detail.wxss)**
   - 全屏图片展示样式
   - 图片fit: aspectFill
   - 信息栏样式（毛玻璃效果）
   - 动画过渡样式

5. **实现图片预览功能**
   - 使用van-image的preview功能
   - 支持手势缩放
   - 支持左右滑动切换

6. **实现删除功能**
   - 显示确认对话框
   - 删除后返回上一页或刷新列表

### 测试方法
- [ ] 页面可以正常加载显示
- [ ] 图片可以正常放大缩小
- [ ] Swiper滑动切换正常
- [ ] 删除功能正常
- [ ] 返回按钮正常

### 预期输出文件

| 文件路径 | 说明 |
|----------|------|
| `miniprogram/pages/media_detail/media_detail.ts` | 页面逻辑 |
| `miniprogram/pages/media_detail/media_detail.wxml` | 页面结构 |
| `miniprogram/pages/media_detail/media_detail.wxss` | 页面样式 |
| `miniprogram/pages/media_detail/media_detail.json` | 页面配置 |

### 注意事项
- 导航栏使用透明背景需设置`navigationBarTransparent`
- 大图加载需显示loading状态
- 删除操作需二次确认防止误删
- 详情页返回时需刷新列表数据

---

## T-07: 月龄筛选功能

**任务名称**: 月龄筛选功能 - Implement age/month filtering

### 描述
实现按宝宝月龄筛选媒体的功能，支持快捷筛选选项和自定义范围选择。

### 前置条件
- [ ] T-01 项目结构搭建已完成
- [ ] T-02 数据模型定义已完成
- [ ] T-08 本地存储服务已完成

### 开发步骤

1. **配置组件.json**
   ```json
   {
     "component": true,
     "usingComponents": {
       "van-tabs": "vant-weapp/tabs/index",
       "van-tab": "vant-weapp/tab/index",
       "van-picker": "vant-weapp/picker/index"
     }
   }
   ```

2. **定义组件属性 (age_filter.ts)**
   ```typescript
   Component({
     properties: {
       babyId: {
         type: String,
         value: ''
       },
       birthDate: {
         type: String,
         value: ''
       },
       value: {
         type: Number,
         value: null  // null表示全部
       }
     },

     data: {
       currentAge: 0,
       quickOptions: [
         { label: '全部', value: null },
         { label: '0-3月', value: 3 },
         { label: '3-6月', value: 6 },
         { label: '6-12月', value: 12 },
         { label: '1-2岁', value: 24 },
         { label: '2岁以上', value: -1 }
       ],
       customVisible: false,
       customValue: [0, 36]
     },

     methods: {
       onQuickSelect(event: any): void,
       onCustomTap(): void,
       onCustomConfirm(event: any): void,
       calculateAge(): BabyAge
     }
   })
   ```

3. **实现月龄计算逻辑**
   ```typescript
   // miniprogram/utils/age_calculator.ts

   export function calculateBabyAge(birthDate: string, targetDate?: string): BabyAge {
     const birth = new Date(birthDate);
     const target = targetDate ? new Date(targetDate) : new Date();

     const diffTime = target.getTime() - birth.getTime();
     const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

     const years = Math.floor(diffDays / 365);
     const remainingDays = diffDays % 365;
     const months = Math.floor(remainingDays / 30);
     const days = remainingDays % 30;

     return { years, months, days };
   }

   export function formatAge(age: BabyAge): string {
     if (age.years > 0) {
       return `${age.years}岁${age.months}月`;
     }
     return `${age.months}月${age.days}天`;
   }
   ```

4. **实现组件模板 (age_filter.wxml)**
   - 快捷筛选横向滚动栏
   - 自定义筛选按钮
   - 选中状态高亮显示

5. **实现组件样式 (age_filter.wxss)**
   - 横向滚动容器样式
   - 筛选标签样式（选中/未选中）
   - 选中态下划线动画

6. **实现自定义筛选弹窗**
   - van-picker双列选择器
   - 最小月龄和最大月龄选择

### 测试方法
- [ ] 快捷筛选选项显示正确
- [ ] 点击筛选项触发事件
- [ ] 月龄计算结果准确
- [ ] 自定义筛选功能正常
- [ ] 筛选状态正确保存和恢复

### 预期输出文件

| 文件路径 | 说明 |
|----------|------|
| `miniprogram/components/age_filter/age_filter.ts` | 组件逻辑 |
| `miniprogram/components/age_filter/age_filter.wxml` | 组件结构 |
| `miniprogram/components/age_filter/age_filter.wxss` | 组件样式 |
| `miniprogram/components/age_filter/age_filter.json` | 组件配置 |
| `miniprogram/utils/age_calculator.ts` | 月龄计算工具 |

### 注意事项
- 月龄计算需考虑闰年情况
- 快捷筛选的年龄范围需与业务需求一致
- 筛选组件需支持受控和非受控模式

---

## T-08: 本地存储服务

**任务名称**: 本地存储服务 - Implement local storage service for media data

### 描述
实现媒体数据的本地存储服务，支持增删改查操作、数据缓存管理和存储迁移。

### 前置条件
- [ ] T-01 项目结构搭建已完成
- [ ] T-02 数据模型定义已完成

### 开发步骤

1. **定义存储服务接口 (storage_service.ts)**
   ```typescript
   // miniprogram/services/storage_service.ts

   /**
    * 存储服务类
    */
   class StorageService {
     private readonly PREFIX = 'album_';
     private readonly VERSION = 'v1';

     // 存储键名
     private keys = {
       babies: `${this.PREFIX}babies`,
       media: `${this.PREFIX}media`,
       settings: `${this.PREFIX}settings`,
       version: `${this.PREFIX}version`
     };

     /**
      * 初始化存储服务
      */
     async init(): Promise<void>;

     /**
      * 检查存储版本并迁移
      */
     private checkVersion(): Promise<void>;

     /**
      * 保存数据到本地存储
      */
     private setData<T>(key: string, data: T): Promise<void>;

     /**
      * 从本地存储获取数据
      */
     private getData<T>(key: string): Promise<T | null>;

     // ---- 宝宝相关操作 ----

     /**
      * 获取所有宝宝
      */
     async getBabies(): Promise<Baby[]>;

     /**
      * 获取单个宝宝
      */
     async getBaby(id: string): Promise<Baby | null>;

     /**
      * 创建宝宝
      */
     async createBaby(input: CreateBabyInput): Promise<Baby>;

     /**
      * 更新宝宝信息
      */
     async updateBaby(id: string, input: UpdateBabyInput): Promise<Baby>;

     /**
      * 删除宝宝
      */
     async deleteBaby(id: string): Promise<void>;

     // ---- 媒体相关操作 ----

     /**
      * 获取媒体列表
      */
     async getMediaList(query?: MediaQuery): Promise<Media[]>;

     /**
      * 获取单个媒体
      */
     async getMedia(id: string): Promise<Media | null>;

     /**
      * 创建媒体
      */
     async createMedia(input: CreateMediaInput): Promise<Media>;

     /**
      * 更新媒体
      */
     async updateMedia(id: string, input: Partial<CreateMediaInput>): Promise<Media>;

     /**
      * 删除媒体
      */
     async deleteMedia(id: string): Promise<void>;

     /**
      * 批量删除媒体
      */
     async deleteMediaByBaby(babyId: string): Promise<void>;

     // ---- 缓存管理 ----

     /**
      * 清除所有缓存
      */
     async clearCache(): Promise<void>;

     /**
      * 获取存储使用情况
      */
     async getStorageUsage(): Promise<{ used: number; limit: number }>;
   }

   export const storageService = new StorageService();
   ```

2. **实现存储键管理**
   - 定义常量存储键名
   - 实现键名生成函数

3. **实现数据序列化**
   - JSON.stringify/parse封装
   - 错误处理和默认值

4. **实现宝宝CRUD操作**
   - 从本地存储读取babies数组
   - 创建时生成UUID
   - 更新时合并对象
   - 删除时过滤数组

5. **实现媒体CRUD操作**
   - 支持查询条件过滤
   - 分页处理
   - 按月龄筛选逻辑

6. **实现缓存管理**
   - 内存缓存层
   - 缓存过期机制
   - 存储空间检查

7. **实现数据迁移**
   - 版本号检查
   - 迁移脚本执行

### 测试方法
- [ ] 宝宝CRUD操作正常
- [ ] 媒体CRUD操作正常
- [ ] 查询筛选功能正常
- [ ] 分页功能正常
- [ ] 数据持久化正常
- [ ] 存储空间检查正常

### 预期输出文件

| 文件路径 | 说明 |
|----------|------|
| `miniprogram/services/storage_service.ts` | 存储服务实现 |
| `miniprogram/constants/storage_keys.ts` | 存储键名常量 |

### 注意事项
- 使用Promise封装同步API
- 大数据量时考虑分页加载
- 存储操作需添加错误处理
- 定期清理无用临时文件

---

## T-09: 持续集成验证

**任务名称**: 持续集成验证 - Continuous integration and validation

### 描述
将验证工作融入开发流程，在每个迭代版本完成后进行集成验证，确保功能完整性和性能达标。非独立测试阶段。

### 前置条件
- [ ] 对应迭代版本任务已完成

### 开发步骤

1. **v0.1 完成后验证**
   - 验证基础架构完整性
   - 验证数据模型正确性
   - 验证本地存储服务可用
   - 验证瀑布流组件正常渲染

2. **v0.2 完成后验证**
   - 验证相册首页功能完整
   - 验证媒体上传组件正常
   - 验证月龄筛选功能正常
   - 验证时间线视图正常

3. **v0.3 完成后验证**
   - 验证媒体详情页功能
   - 真机性能测试
   - 兼容性测试 (iOS/Android)
   - 最终交付检查

4. **验证清单 (每次迭代)**

   | 验证项 | v0.1 | v0.2 | v0.3 |
   |--------|------|------|------|
   | 页面加载正常 | ✓ | ✓ | ✓ |
   | 组件渲染正常 | ✓ | ✓ | ✓ |
   | 数据存储正常 | ✓ | ✓ | ✓ |
   | 交互功能正常 | - | ✓ | ✓ |
   | 真机测试 | - | - | ✓ |
   | 性能达标 | - | - | ✓ |

5. **性能指标**

   | 指标 | 目标 | 测试方法 |
   |------|------|----------|
   | 首页加载时间 | < 2s | 计时器测量 |
   | 列表滚动FPS | >= 50 | 性能面板 |
   | 内存占用 | < 150MB | 调试面板 |
   | 页面切换时间 | < 300ms | 计时器测量 |

### 测试方法

#### 迭代验证清单
- [ ] 页面可正常加载
- [ ] 数据存储读写正常
- [ ] 组件交互正常
- [ ] 性能指标达标
- [ ] 真机测试通过

#### 交付前检查
- [ ] 所有功能可正常使用
- [ ] 无严重性能问题
- [ ] iOS/Android 均测试通过
- [ ] 文档已更新

### 预期输出文件

| 文件路径 | 说明 |
|----------|------|
| `docs/task/album_feature/integration_report.md` | 集成验证报告 |

### 注意事项
- 验证是持续过程，不是单独阶段
- 发现问题及时修复后再继续
- 每次迭代都需要真机验证

---

## 附录

### 相关技术文档

- [微信小程序开发文档](https://developers.weixin.qq.com/miniprogram/dev/framework/)
- [Vant Weapp组件库](https://vant-contrib.gitee.io/vant-weapp/)
- [Skyline渲染器指南](https://developers.weixin.qq.com/miniprogram/dev/framework/runtime/skyline/skyline.html)
- [glass-easel组件框架](https://github.com/wechat-miniprogram/glass-easel)

### 术语表

| 术语 | 说明 |
|------|------|
| Skyline | 微信小程序自定义渲染引擎 |
| glass-easel | 微信小程序组件框架 |
| 瀑布流 | Masonry Layout，一种不等高图片布局方式 |
| 月龄 | 宝宝出生后的月数 |
| CRUD | Create/Read/Update/Delete增删改查 |

---

*文档最后更新: 2026-05-31*
