# S05 - 数据分析与导出故事 (Analytics & Export Stories)

> 关联 Feature: F05 数据分析与导出 | 目标迭代: v2.0

---

## 用户故事 (User Stories)

### US-ANALYTICS-01: 查看成就徽章

**作为** 用户
**我想要** 获得并使用成就徽章
**以便** 记录我的使用里程碑，获得成就感

**验收条件**:
- 完成特定条件后弹出徽章获得动画
- 「我的」页面展示已获得徽章列表
- 未获得徽章灰色显示并提示解锁条件
- 支持徽章数量统计

---

### US-ANALYTICS-02: 生成成长报告

**作为** 家长
**我想要** 查看宝宝一段时间内的成长报告
**以便** 了解记录习惯和宝宝成长趋势

**验收条件**:
- 支持选择时间范围（近1月/3月/6月/全部）
- 展示照片数量趋势、月度分布
- 展示身高体重曲线（如有数据）
- 报告可分享给家人

---

### US-ANALYTICS-03: 导出照片和数据

**作为** 用户
**我想要** 将所有照片和数据导出下载
**以便** 备份到电脑或制作实体相册

**验收条件**:
- 支持导出全部照片原图（ZIP）
- 支持导出数据（JSON）
- 显示导出进度
- 导出完成后提供下载
- 支持从 JSON 文件恢复数据

---

## 技术故事 (Technical Stories)

### TS-ANALYTICS-01: 成就检查服务

**描述**: 开发可复用的成就检查模块，在关键 API 后触发

**涉及文件**:
- `app/services/achievementChecker.ts`（新增）

**实现要点**:
- 每个成就定义: badgeKey, name, description, checkFn(userId)
- checkFn: 查询 users 表统计字段、media 表数量等
- INSERT INTO achievements ... ON DUPLICATE KEY（幂等）
- 返回新获得的成就列表

---

### TS-ANALYTICS-02: 成长报告接口

**描述**: 实现 GET /api/v1/analytics/report

**涉及文件**:
- `app/routers/analytics.ts`

**实现要点**:
- 查询参数: babyId, startDate, endDate
- 按月聚合: `GROUP BY DATE_FORMAT(capture_date, '%Y-%m')`
- 关联 babies 表获取身高体重历史
- 计算: 日均上传、最活跃日、最长连续记录天数
- 生成结构化报告 JSON

---

### TS-ANALYTICS-03: 数据导出接口

**描述**: 实现 POST /api/v1/export/data

**涉及文件**:
- `app/routers/export.ts`
- `app/services/exportService.ts`

**实现要点**:
- JSON 导出: SELECT babies + media → JSON.stringify → 上传 COS
- ZIP 导出: 遍历 media，从 COS 下载原图 → archiver 打包 → 上传 COS
- 异步任务模式: 返回 taskId，GET /export/status/:taskId 轮询进度
- Redis 记录任务状态（pending/processing/done/failed）

---

### TS-ANALYTICS-04: 数据导入接口

**描述**: 实现 POST /api/v1/export/import

**涉及文件**:
- `app/routers/export.ts`

**实现要点**:
- 解析 JSON 内容
- 按 id 去重（已有记录跳过）
- 批量 INSERT IGNORE
- 返回导入摘要（新增/跳过/失败）

---

### TS-ANALYTICS-05: 用户统计接口

**描述**: 实现 GET /api/v1/analytics/stats

**涉及文件**:
- `app/routers/analytics.ts`

**实现要点**:
- 查询 users 表基础统计
- 聚合本月/本周上传数
- 查询 achievements 数量
- 查询 share_relations 数量

---

## Story 与 Feature 的关联

```
F05 数据分析与导出
├── US-ANALYTICS-01 查看成就徽章
├── US-ANALYTICS-02 生成成长报告
├── US-ANALYTICS-03 导出照片和数据
├── TS-ANALYTICS-01 成就检查服务
├── TS-ANALYTICS-02 成长报告接口
├── TS-ANALYTICS-03 数据导出接口
├── TS-ANALYTICS-04 数据导入接口
└── TS-ANALYTICS-05 用户统计接口
```
