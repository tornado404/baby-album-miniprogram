# 多宝宝支持 — 前后端适配方案

> **版本**: v1.0 | **最后更新**: 2026-06-09 | **状态**: ✅ 计划就绪
> **来源**: 用户需求（ce-plan 直接触发）

---

## 问题陈述

当前前端调用 API 需要 `babyId` 参数才能获取图片视频数据，但一个用户可能有多个宝宝。现有方案存在以下问题：

1. **存储键不一致** — `album_home.ts` 使用 `baby_diary_current_baby_id`，而 `storage_keys.ts` 定义的是 `album_current_baby_id`，容易导致"当前宝宝"状态丢失
2. **前端服务层绕过了 API** — `storage_service.ts` 和 `media_service.ts` 完全基于本地存储，不调用后端 API，上传成功后的媒体记录无法同步到首页
3. **`baby_profile` 只写本地存储** — 编辑宝宝信息不会调用 `PUT /babies/{id}`，切换设备后数据丢失
4. **缺少 `GET /media/{id}` 端点** — `media_detail.ts` 调用了 `/media/{id}` 但后端未实现
5. **`BabyResponse` 字段未填充** — `photoCount`、`videoCount`、`recordDays` 在路由中从未返回
6. **前端的 Baby/Media 类型与后端不同步** — 缺少 `order`、`dueDate`、`locationName`、`isArchived` 等字段
7. **无宝宝引导缺失** — 新用户无宝宝时，页面显示空状态但没有明确的创建流程

---

## 需求追踪

| 需求 ID | 描述 | 优先级 | 关联单元 |
|---------|------|--------|---------|
| FR-01 | "当前宝宝"状态在前端统一管理，跨页面持久化 | P0 | U1 |
| FR-02 | 宝宝列表页/首页宝宝选择器正常工作 | P0 | U1, U6 |
| FR-03 | 编辑宝宝资料后通过 API 同步到后端 | P0 | U2 |
| FR-04 | 媒体详情页可查看后端数据（含 babyAge） | P0 | U3 |
| FR-05 | 新增宝宝流程完整（onboarding → API 创建 → 设为当前） | P1 | U4 |
| FR-06 | BabyResponse 返回统计数据（photoCount/videoCount） | P1 | U5 |
| FR-07 | 无宝宝时的空状态引导 | P1 | U6 |
| FR-08 | 前端 Baby/Media 类型与后端对齐 | P2 | U7 |
| NFR-01 | 向后兼容 — 已有单宝宝用户不受影响 | P0 | 全部 |
| NFR-02 | 离线降级 — API 不可达时使用本地缓存 | P1 | U1, U2, U3 |

---

## 关键技术决策

| 决策 | 选择 | 备选 | 理由 |
|------|------|------|------|
| "当前宝宝"存在哪里 | 前端 `wx.setStorageSync` | 后端 session | 微信小程序无 cookie/session 机制；前端存储更简单，切换宝宝无需后端配合 |
| 存储 key 统一为 | `baby_diary_current_baby_id` | `album_current_baby_id` | 已在前端 4 个页面中使用，迁移成本最低 |
| 媒体服务架构 | API 优先 + 本地降级 | 纯 API / 纯本地 | 已有 API 优先模式（album_home），保持一致；离线时降级到本地 storage |
| BabyResponse 统计字段 | 后端实时计算 | 前端本地计算 | 数据准确性要求，多设备同步需求 |
| 前端类型同步 | 新增 `typings/models/` 补充字段 | 自动生成 | 后端无 OpenAPI 生成工具链，手动维护最可控 |

---

## 实施单元

### U1. 当前宝宝状态管理统一

**目标**：统一全app的"当前宝宝"存储 key 和读取逻辑，确保切换宝宝后所有页面感知变化。

**依赖**：无

**文件**：
- 🔧 修改 `miniprogram/constants/storage_keys.ts` — 统一 key 定义
- 🔧 修改 `miniprogram/pages/album_home/album_home.ts` — 使用常量引用
- 🔧 修改 `miniprogram/pages/album_home/album_home.js` — 对应 js 产物
- 🔧 修改 `miniprogram/pages/upload/upload.js` — 使用常量引用（无 .ts 源文件）
- 🔧 修改 `miniprogram/pages/baby_profile/baby_profile.ts` — 使用常量引用
- 🔧 修改 `miniprogram/pages/baby_list/baby_list.ts` — 使用常量引用
- 🔧 修改 `miniprogram/pages/media_detail/media_detail.ts` — 使用常量引用

**方案**：

1. **storage_keys.ts**：统一导出当前宝宝 key
   ```typescript
   export const STORAGE_KEYS = {
     // ... existing keys
     currentBabyId: 'baby_diary_current_baby_id',  // 统一使用此值
   };
   ```
   移除旧定义 `currentBabyId: 'album_current_baby_id'`

2. **各页面改造**：将硬编码的 `'baby_diary_current_baby_id'` 替换为 `STORAGE_KEYS.currentBabyId`
   - album_home.ts 第 40、52、267 行
   - upload.js 第 29 行
   - baby_profile.ts 第 26、105 行
   - baby_list.ts 第 65 行
   - media_detail.ts 第 35、38、62 行

3. **album_home.ts onShow 增强**：除了检测 babyId 变化，还要在 `currentBabyId` 变化时重新加载宝宝列表（`loadBabies()`），确保宝宝选择器数据最新

**测试场景**：

| # | 场景 | 动作 | 预期 |
|---|------|------|------|
| 1 | 切换宝宝 | album_home 中点击另一个宝宝 | 媒体列表刷新、babyId 持久化到 storage |
| 2 | 从上传页返回 | 上传完成后 navigateBack | album_home onShow 读取当前 babyId，刷新列表 |
| 3 | 从宝宝列表页切换 | baby_list 中点击切换 | storage 写入新 babyId，回到首页后生效 |
| 4 | 跨页面一致性 | 在 baby_profile 修改后返回首页 | 当前宝宝不变（同一个 storage key） |

---

### U2. 宝宝资料页对接 API

**目标**：`baby_profile` 页面从仅写本地存储改为调用 `PUT /babies/{id}` 和 `POST /babies/` API，确保数据在后端持久化。

**依赖**：无

**文件**：
- 🔧 修改 `miniprogram/pages/baby_profile/baby_profile.ts`
- 🔧 修改 `miniprogram/pages/baby_profile/baby_profile.js`（编译产物）
- ✨ 新增 `miniprogram/pages/baby_onboarding/baby_onboarding.ts`（如不存在）
- 🔧 修改 `miniprogram/pages/baby_onboarding/baby_onboarding.ts`（如已存在）

**方案**：

1. **baby_profile.ts onLoad 增强**：优先从 API 加载宝宝数据
   ```typescript
   // 优先从 API 获取
   wx.request({
     url: API_CONFIG.baseURL + '/babies/' + babyId,
     method: 'GET',
     header: { 'Authorization': 'Bearer ' + token },
     success: function (res) {
       if (res.statusCode === 200 && res.data) {
         // 用 API 数据填充表单
       }
     },
     fail: function () { /* fallback 到本地缓存 */ },
   });
   ```

2. **baby_profile.ts onSave 改造**：调用 API 保存
   ```typescript
   // API 优先保存
   wx.request({
     url: API_CONFIG.baseURL + '/babies/' + babyId,
     method: 'PUT',
     data: { name, gender, birthDate, avatar },
     header: { 'Authorization': 'Bearer ' + token },
     success: function () {
       // 同步更新本地缓存
       wx.showToast({ title: '保存成功' });
       wx.navigateBack();
     },
     fail: function () { /* 降级到本地保存 */ },
   });
   ```
   - 新建宝宝（无 babyId）时调用 `POST /babies/`，从响应中获取新 id 写入 storage

3. **本地缓存同步**：API 成功后再更新 `album_babies` 本地缓存，保持离线可用

**测试场景**：

| # | 场景 | 动作 | 预期 |
|---|------|------|------|
| 1 | 编辑已有宝宝 | 修改名字、生日，点保存 | PUT 请求成功，storage 同步更新 |
| 2 | 新建宝宝 | 填写信息后保存 | POST 请求成功，新 id 设为 currentBabyId |
| 3 | API 不可达时降级 | 断网后保存 | 仅写入本地缓存，下次联网时提示同步 |
| 4 | 页面加载时数据加载 | 进入已有宝宝的 profile | 优先显示 API 数据，失败时显示本地缓存 |

---

### U3. 新增 `GET /media/{id}` 端点

**目标**：后端实现单个媒体详情接口，返回带 `babyAge` 计算结果的完整媒体信息，供 `media_detail.ts` 调用。

**依赖**：无

**文件**：
- ✨ 新增 `server/app/routers/media.py` 中 `GET /{media_id}` 端点（或修改，如已有但缺失）
- ✨ 新增 `server/app/schemas/media.py` — MediaDetailOut schema（可选）
- 🔧 修改 `server/app/services/media_service.py` — 添加 `get_media` 方法

**方案**：

1. **media_service.py 新增 `get_media` 方法**：
   ```python
   async def get_media(self, media_id: str, user_id: str) -> Optional[Media]:
       r = await self.db.execute(
           select(Media).where(Media.id == media_id, Media.user_id == user_id, Media.is_deleted == False)
       )
       return r.scalar_one_or_none()
   ```

2. **media.py 新增端点**：
   ```python
   @router.get("/{media_id}", response_model=MediaOut)
   async def get_media(
       media_id: str,
       user_id: str = Depends(get_current_user_id),
       db: AsyncSession = Depends(get_db),
   ):
       m = await MediaService(db).get_media(media_id, user_id)
       if not m:
           raise HTTPException(404, "Media not found")
       return MediaOut(
           id=m.id, type=m.type.value, title=m.title,
           thumbnailUrl=m.thumbnail_url, cosUrl=m.cos_url,
           captureDate=m.capture_date, fileSize=m.file_size or 0,
           width=m.width, height=m.height,
           locationName=m.location_name, tags=m.tags,
           moment=m.moment, milestone=m.milestone,
           isArchived=m.is_archived,
           babyAge={
               "years": m.baby_age_yrs or 0,
               "months": m.baby_age_mos or 0,
               "days": m.baby_age_days or 0,
           } if m.baby_age_yrs is not None else None,
       )
   ```

3. **MediaOut 补充 babyAge 字段**：当前 MediaOut 缺少 `babyAge`，需添加
   ```python
   class MediaOut(BaseModel):
       # ... existing fields
       babyAge: Optional[dict] = None  # { years, months, days }
   ```

**测试场景**：

| # | 场景 | 动作 | 预期 |
|---|------|------|------|
| 1 | 获取自己的媒体详情 | GET /media/{自己的媒体id} | 返回完整媒体信息含 babyAge |
| 2 | 获取不存在的媒体 | GET /media/{无效id} | 404 |
| 3 | 获取别人的媒体 | 用自己 token 请求别人的媒体 | 404（user_id 限定） |
| 4 | 媒体带 babyAge | 已有 age 计算过的媒体 | 返回 {years, months, days} |

---

### U4. 新增宝宝流程（Baby Onboarding）

**目标**：确保新用户首次使用时有完整的创建宝宝引导流程。目前 `baby_onboarding` 页面已存在，但需确认是否对接了 API。

**依赖**：无（可独立完成）

**文件**：
- 🔧 修改 `miniprogram/pages/baby_onboarding/baby_onboarding.ts` — 对接 API
- 🔧 修改 `miniprogram/pages/baby_onboarding/baby_onboarding.js` — 编译产物
- 🔧 修改 `miniprogram/pages/album_home/album_home.ts` — 无宝宝时显示空状态

**方案**：

1. **baby_onboarding 对接 API**：创建宝宝时调用 `POST /babies/`
   - 成功后从响应获取 `id`
   - 写入 `baby_diary_current_baby_id` 和 `album_babies` 缓存
   - 跳转到首页

2. **album_home 无宝宝空状态**：`onLoad` / `onShow` 中判断 `babies.length === 0`
   - 显示空状态提示"添加宝宝开始记录成长"
   - 提供"添加宝宝"按钮，跳转到 `baby_onboarding`
   - 隐藏媒体列表区域

3. **album_home 逻辑调整**：`onBabyStripTap` 中如果 `babies.length === 0`，直接引导到创建页

**测试场景**：

| # | 场景 | 动作 | 预期 |
|---|------|------|------|
| 1 | 全新用户（无宝宝） | 首次登录进入首页 | 显示空状态引导，无媒体列表 |
| 2 | 创建宝宝成功 | 填写信息后提交 | API 创建成功，跳转到首页显示该宝宝数据 |
| 3 | 创建宝宝失败（网络问题） | 断网后创建 | 降级到本地存储创建，提示"已保存到本地" |

---

### U5. BabyResponse 统计字段补全

**目标**：`GET /babies/` 和 `GET /babies/{id}` 返回实际的照片/视频数量，供前端显示统计数据。

**依赖**：无

**文件**：
- 🔧 修改 `server/app/routers/baby.py` — 填充 photoCount/videoCount/recordDays
- 🔧 修改 `server/app/services/baby_service.py` — 添加统计查询方法

**方案**：

1. **baby_service.py 新增统计方法**：
   ```python
   async def get_baby_stats(self, baby_id: str, user_id: str) -> dict:
       """返回宝宝的 photoCount, videoCount, recordDays"""
       # 查询 media 表中该宝宝的照片/视频数量
       r = await self.db.execute(
           select(
               func.count().filter(Media.type == MediaType.IMAGE).label("photos"),
               func.count().filter(Media.type == MediaType.VIDEO).label("videos"),
           ).where(Media.baby_id == baby_id, Media.user_id == user_id, Media.is_deleted == False)
       )
       row = r.one()
       # recordDays: 不同 captureDate 的数量
       r2 = await self.db.execute(
           select(func.count(func.distinct(Media.capture_date)))
           .where(Media.baby_id == baby_id, Media.user_id == user_id, Media.is_deleted == False)
       )
       record_days = r2.scalar() or 0
       return {
           "photoCount": row.photos or 0,
           "videoCount": row.videos or 0,
           "recordDays": record_days,
       }
   ```

2. **baby.py 路由填充统计字段**：
   ```python
   @router.get("/", response_model=list[BabyResponse])
   async def list_babies(...):
       svc = BabyService(db)
       babies = await svc.list_babies(user_id)
       result = []
       for b in babies:
           stats = await svc.get_baby_stats(b.id, user_id)
           result.append(BabyResponse(
               id=b.id, name=b.name, gender=b.gender,
               birthDate=b.birth_date, **stats
           ))
       return result
   ```
   注意：批量查询时 N+1 问题。优化方案：可以先一次性查出所有宝宝的统计，再组装。

3. **优化 N+1**：使用子查询或 group_by 一次查询所有宝宝的统计
   ```python
   async def get_babies_stats(self, baby_ids: list[str], user_id: str) -> dict[str, dict]:
       """批量返回 {baby_id: {photoCount, videoCount, recordDays}}"""
       ...
   ```

**测试场景**：

| # | 场景 | 动作 | 预期 |
|---|------|------|------|
| 1 | 宝宝有 3 张照片 1 个视频 | GET /babies/ | 返回 photoCount=3, videoCount=1 |
| 2 | 宝宝无媒体 | GET /babies/{id} | photoCount=0, videoCount=0 |
| 3 | 媒体被软删除后 | 删除媒体后查询 | 统计不包含已删除的媒体 |

---

### U6. 首页宝宝选择器流程增强

**目标**：完善 album_home 的宝宝选择器交互，确保多宝宝场景下切换流畅，无宝宝时引导创建。

**依赖**：U1（统一存储 key）、U4（宝宝创建流程）

**文件**：
- 🔧 修改 `miniprogram/pages/album_home/album_home.ts`
- 🔧 修改 `miniprogram/pages/album_home/album_home.js`
- 🔧 修改 `miniprogram/pages/album_home/album_home.wxml`

**方案**：

1. **启动流程增强**（`onLoad` / `onShow`）：
   ```typescript
   onShow: function () {
     // 1. 重载宝宝列表（确保最新）
     this.loadBabies();
     
     // 2. 读取当前 babyId
     var babyId = wx.getStorageSync(STORAGE_KEYS.currentBabyId) || '';
     
     // 3. 如果 storage 中有 babyId，且与当前不同，切换
     if (babyId && babyId !== this.data.currentBabyId) {
       this.setData({ currentBabyId: babyId });
       this.fetchBabyInfo(babyId);
       this.fetchMediaList(babyId, 1);
     } else if (babyId) {
       // 刷新当前宝宝的数据
       this.fetchBabyInfo(babyId);
       this.fetchMediaList(babyId, 1);
     }
     // 如果没有 babyId，等 loadBabies 完成后决定
   },
   ```

2. **`loadBabies` 回调处理**：加载完成后
   - 如果 `babies.length === 0` → 显示空状态
   - 如果 `currentBabyId` 不在 babies 中 → 默认选第一个
   - 否则保持当前选择

3. **宝宝选择器样式增强**：确保多宝宝时横向滚动条正常，当前宝宝高亮

**测试场景**：

| # | 场景 | 动作 | 预期 |
|---|------|------|------|
| 1 | 从宝宝列表页切换宝宝 | 在 baby_list 选择"小月亮" | 回到首页后显示"小月亮"的媒体 |
| 2 | 宝宝选择器滚动 | 4+ 个宝宝 | 横向可滚动，当前宝宝居中高亮 |
| 3 | storage 中 babyId 无效 | 手动修改 storage 为不存在的 id | 自动选择 babies[0]，更新 storage |
| 4 | 无宝宝 | 用户无宝宝 | 空状态 + "添加宝宝"按钮 |

---

### U7. 前端类型对齐

**目标**：使前端 `Baby` 和 `Media` 接口与后端模型对齐，减少字段缺失导致的潜在 bug。

**依赖**：无（纯类型修改）

**文件**：
- 🔧 修改 `typings/models/baby.ts` — 补充字段
- 🔧 修改 `typings/models/media.ts` — 补充字段

**方案**：

1. **`typings/models/baby.ts` 补充**：
   ```typescript
   export interface Baby {
     id: string;
     name: string;
     birthDate?: string;
     gender?: BabyGender;
     avatar?: string;
     dueDate?: string;        // 新增
     weight?: string;         // 新增
     height?: string;         // 新增
     order?: number;          // 新增
     photoCount?: number;     // 新增
     videoCount?: number;     // 新增
     recordDays?: number;     // 新增
     createdAt: string;
     updatedAt?: string;
   }
   ```

2. **`typings/models/media.ts` 补充**：
   ```typescript
   export interface Media {
     id: string;
     babyId: string;
     type: MediaType;
     cosUrl?: string;            // 新增（替代 url）
     cosKey?: string;            // 新增
     thumbnailUrl?: string;
     url?: string;               // 保留（本地兼容）
     width?: number;
     height?: number;
     fileSize?: number;          // 修改：size → fileSize（可选）
     size?: number;              // 保留（本地兼容）
     title?: string;
     captureDate: string;
     locationName?: string;      // 新增
     moment?: string;            // 新增
     milestone?: string;         // 新增
     isArchived?: boolean;       // 新增
     tags?: string[];
     babyAge?: BabyAge;
     createdAt: string;
     updatedAt: string;
   }
   ```

**测试场景**：

| # | 场景 | 动作 | 预期 |
|---|------|------|------|
| 1 | TypeScript 编译 | `npx tsc` | 编译通过，无类型错误 |
| 2 | album_home 使用 cosUrl | media API 返回 cosUrl | 页面正常显示（已有映射处理） |

---

## 边界范围

### 范围内
- 前端"当前宝宝"状态管理统一
- `baby_profile` 对接 API（PUT/POST）
- 新增 `GET /media/{id}` 端点
- BabyResponse 统计字段填充
- 宝宝创建流程（onboarding）对接 API
- 首页无宝宝空状态
- 前端类型对齐

### 范围外（当前不做）
- 不实现多宝宝同时显示（一个页面显示所有宝宝的媒体混合）
- 不实现宝宝排序拖拽
- 不实现后端"当前宝宝"session 机制
- 不实现宝宝头像上传到 MinIO（仅 emoji/本地路径）
- 不改造 `storage_service.ts` 为纯 API 模式（保持离线降级能力）

---

## 实施顺序

```
U1 (当前宝宝状态统一) ───────────────────────────────────┐
                                                          │
U3 (GET /media/{id} 新增) ────────────────────────────────┤
                                                          │
U5 (BabyResponse 统计补齐) ───────────────────────────────┤
                                                          ├── 并行可独立完成
U4 (宝宝创建流程) ────────────────────────────────────────┤
                                                          │
U7 (前端类型对齐) ────────────────────────────────────────┤
                                                          │
U2 (baby_profile 对接 API) ───────────────────────────────┘
                                                          │
U6 (首页宝宝选择器增强) ──────────────── 依赖 U1, U4 完成 ──┘
```

**建议执行顺序**：
1. **第 1 批（独立、零风险）**：U1, U3, U5, U7 — 互不依赖，可并行
2. **第 2 批**：U4, U2 — 宝宝创建和编辑，依赖 U1 的存储 key 统一
3. **第 3 批**：U6 — 首页增强，依赖 U1 和 U4

---

## 开放问题

- **BabyResponse age 字段**：当前 schema 定义了 `age: Optional[str]` 但路由未填充。是否在接口中一并返回格式化年龄？建议做（前端 album_home 第 98 行有自己的 calcAge，可以用后端数据替代）
- **`storage_service.ts` 去留**：当前是完全本地存储层，与 API 服务并存。后续是否逐步废弃？建议保持离线降级能力，但新增功能优先走 API

---

## 风险与依赖

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| 修改 storage key 导致运行时报错 | 部分页面读不到 currentBabyId | 分阶段修改，先加兼容代码再移除旧 key |
| `GET /media/{id}` 新增端点部署前 media_detail 不可用 | 详情页只显示 fallback | U3 优先部署；目前已有 fallback 机制 |
| baby_profile 改 API 后离线不可用 | 用户断网时无法编辑 | 保留本地降级路径，API 失败时写本地 |
| N+1 查询（统计字段） | 宝宝多时 API 响应慢 | 使用批量查询（`get_babies_stats`）优化 |

---

## 系统影响

- **后端**：新增 1 个端点 + 2 个查询方法，无 schema 变更
- **前端**：4 个页面逻辑调整 + 2 个类型文件修改 + 1 个常量文件修改
- **数据**：已有数据无需迁移，向后兼容