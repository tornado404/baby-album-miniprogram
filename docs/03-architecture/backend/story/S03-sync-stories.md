# S03 - 数据同步故事 (Data Sync Stories)

> 关联 Feature: F03 数据同步服务

---

## 用户故事 (User Stories)

### US-SYNC-01: 首次登录数据迁移

**作为** 已有本地数据的用户
**我想要** 更新到 v1.1 后自动将本地数据迁移到云端
**以便** 数据不丢失且可以跨设备访问

**验收条件**:
- 检测到本地 storage 有数据时触发迁移
- 显示迁移进度（如「正在同步 45 条记录...」）
- 迁移完成后本地 storage 保留为缓存
- 迁移失败时保留本地数据，下次启动重试
- 迁移期间不允许操作

---

### US-SYNC-02: 多端数据一致

**作为** 多设备用户
**我想要** 在 iPad 和 iPhone 上看到相同的宝宝成长记录
**以便** 随时随地方便记录

**验收条件**:
- 在设备A上传照片 → 设备B打开后能看到
- 数据冲突时以最新修改为准
- 启动时增量同步延迟 < 2 秒

---

### US-SYNC-03: 宝宝档案云端管理

**作为** 用户
**我想要** 在任意设备上编辑宝宝信息
**以便** 信息保持最新

**验收条件**:
- 编辑宝宝档案后云端实时更新
- 在其他设备上可查看最新信息
- 离线编辑后联网自动同步

---

## 技术故事 (Technical Stories)

### TS-SYNC-01: syncService 同步编排服务（前端）

**描述**: 开发同步策略编排服务，管理全量/增量同步逻辑

**涉及文件**:
- `miniprogram/services/syncService.ts`（新增）

**实现要点**:
- `fullSync()`: 首次登录触发，POST /sync/full 全量上传本地
- `incrementalSync()`: 启动时触发，GET /sync/delta 拉取增量
- `pushChange()`: CRUD 操作后实时 POST/PUT 到 API
- `resolveConflict()`: 以 updated_at 为准解决冲突
- `getSyncStatus()`: 返回上次同步时间 + 待同步数量

---

### TS-SYNC-02: 全量同步接口

**描述**: 实现 POST /api/v1/sync/full

**涉及文件**:
- `app/routers/sync.py`

**实现要点**:
- 接收 babies[] + media[] 数组
- 批量 INSERT 到 PostgreSQL（使用事务）
- 写入 sync_log
- 返回本地 ID → 云端 ID 映射表

---

### TS-SYNC-03: 增量同步接口

**描述**: 实现 GET /api/v1/sync/delta?since=timestamp

**涉及文件**:
- `app/routers/sync.py`

**实现要点**:
- 查询 sync_log WHERE user_id + created_at > since
- 按 entity_type + entity_id 去重
- 返回变更实体列表（含完整字段）

---

### TS-SYNC-04: 宝宝 CRUD 接口

**描述**: 实现 babies 的完整 CRUD

**涉及文件**:
- `app/routers/babies.ts`

**实现要点**:
- POST /babies: INSERT + sync_log
- PUT /babies/:id: UPDATE + updated_at + sync_log
- DELETE /babies/:id: 软删除 (is_deleted=1) + sync_log
- 所有操作校验 user_id 归属

---

### TS-SYNC-05: 离线操作队列（前端）

**描述**: 支持离线操作暂存，网络恢复后自动同步

**涉及文件**:
- `miniprogram/services/syncService.ts`

**实现要点**:
- 使用 wx.onNetworkStatusChange 监听网络状态
- 离线时操作写入 pendingSyncQueue（本地 storage）
- 网络恢复时按 FIFO 顺序执行队列
- 冲突时以云端为准

---

### TS-SYNC-06: localStorage 缓存层改造

**描述**: 将当前 StorageService 改造为缓存层

**涉及文件**:
- `miniprogram/services/storageService.ts`

**实现要点**:
- 保留 getXxxSync / setXxxSync 方法
- 新增 syncToCloud() 方法
- 新增 updateFromCloud() 方法
- 所有写操作同时更新本地缓存 + 触发 API 同步

---

## Story 与 Feature 的关联

```
F03 数据同步服务
├── US-SYNC-01 首次登录数据迁移
├── US-SYNC-02 多端数据一致
├── US-SYNC-03 宝宝档案云端管理
├── TS-SYNC-01 syncService 同步编排服务（前端）
├── TS-SYNC-02 全量同步接口
├── TS-SYNC-03 增量同步接口
├── TS-SYNC-04 宝宝 CRUD 接口
├── TS-SYNC-05 离线操作队列（前端）
└── TS-SYNC-06 localStorage 缓存层改造
```
