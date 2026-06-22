---
title: 'fix: 宝宝信息填写页面 4项问题修复'
date: 2026-06-22
type: fix
status: draft
---

# fix: 宝宝信息填写页面 4项问题修复

## Summary

修复宝宝信息填写页面（`baby_profile` + `upload`）的 4 个独立问题：出生日期选择后未持久化导致列表显示"年龄未知"、默认出生日期未随当天变化、上传页日期选择器显示为文本输入框、描述字段缺少多行输入支持。涉及前端 2 个页面和 1 个后端路由/服务。

## Problem Frame

用户填写宝宝档案时发现以下问题：

1. **出生日期保存后未生效** — 在 `baby_profile` 页面通过日期选择器选中出生日期，点击保存后返回宝宝列表页，仍然显示"年龄未知"（`{{item.ageText || '年龄未知'}}`，见 `baby_list.wxml:48`）。意味着 `birthDate` 未正确持久化到后端数据库，或后端计算 `age` 时 `birth_date` 仍为空。
2. **默认出生日期为固定值** — `baby_profile.ts:13` 硬编码 `birthDate: '2025-12-01'`，未根据当天日期动态生成。
3. **上传页日期选择器失效** — `upload.ts:123-137` 的 `onPickDate` 使用 `wx.showModal({editable: true})` 弹出文本输入框，而非原生日期选择器。
4. **描述字段仅支持单行文本** — `upload.ts:166-179` 的 `onInputDescription` 同样使用 `wx.showModal`，仅能输入单行文本，不支持多行内容。微信小程序无内置富文本编辑器组件，本计划将其升级为 `<textarea>` 多行输入。

## Requirements

| ID | Description | Priority |
|----|-------------|----------|
| R1 | 宝宝出生日期通过 `<picker mode="date">` 选择后能正确保存到后端数据库，并在宝宝列表页正确显示计算后的年龄文本 | P0 |
| R2 | `baby_profile` 页面出生日期默认值为当天日期，而非固定日期 | P0 |
| R3 | `upload` 页面日期选择使用原生 `<picker mode="date">` 组件，而非文本输入弹窗 | P0 |
| R4 | `upload` 页面描述字段使用 `<textarea>` 多行文本输入，替代单行文本弹窗 | P1 |

## Key Technical Decisions

### KTD1. `<picker mode="date">` 的 `bindchange` 事件返回值

微信 `<picker mode="date">` 的 `bindchange` 返回 `e.detail.value` 为字符串 `"YYYY-MM-DD"` 格式。现有 `baby_profile.ts:285-287` 的 `onBirthDateChange` 处理 `e.detail.value` 的逻辑是正确的。**但已有测试 (`baby_profile_runtime.test.ts:595`) 错误地将 `e.detail.value` 模拟为数组 `[2026, 6, 15]`，与实际返回类型不匹配。** 测试本身可能通过也可能失败，需要修复测试中的 mock 数据。

**Rationale:** 确认事件类型对正确推断根因至关重要。如果前端 handler 正确、API 正确发送，则问题大概率在后端持久化环节。

### KTD2. 后端 `birth_date` 持久化链路

`server/app/services/baby_service.py:125-130` 通过 `field_map = {"birthDate": "birth_date"}` + `setattr` 将请求中的 camelCase 字段映射到数据库模型的 snake_case 字段，逻辑正确。需要排查的潜在问题点：
- **事务提交异常**: `weight`/`height` 字段前端发送字符串（如 `"7.2"`），数据库模型为 `Decimal`，`setattr` 后 SQLAlchemy 提交时可能因类型转换失败导致回滚，连带 `birth_date` 的更新也未提交。
- **`exclude_unset=True` + `None` 处理**: Pydantic v2 的 `model_dump(exclude_unset=True)` 排除未显式设置的字段。前端 `babyProfile` 始终包含 `birthDate`，理论上无影响。

### KTD3. `upload` 页表单控件改用 WXML 原生组件

当前 `upload` 页的日期和描述字段均通过 `bindtap` + `wx.showModal` 交互，改为直接使用 WXML 中的 `<picker>` 和 `<textarea>` 组件，保持与 `baby_profile` 页一致的交互模式。

## Implementation Units

### U1. [前后端] 排查并修复出生日期保存链路

**Goal:** 查明 `birthDate` 保存后宝宝列表仍显示"年龄未知"的根因并修复。

**Dependencies:** 无

**Files:**
- `miniprogram/pages/baby_profile/baby_profile.ts` (modify)
- `server/app/services/baby_service.py` (modify if needed)
- `tests/baby_profile_runtime.test.ts` (modify)

**Approach:**

1. **后端排查步骤：**
   - 在 `server/app/routers/baby.py` 的 `update_baby` 端点中，在 `BabyService.update_baby` 返回后打印 `baby.birth_date` 值（临时 `print/logging`），确认数据库实际存储值。
   - 检查 `server/app/services/baby_service.py:125-130` 的 `field_map` 转换是否生效。验证 `data.model_dump(exclude_unset=True)` 的返回内容，确认 `birthDate` 被包含且值正确。
   - 重点关注 `weight`/`height` 字段的 `str → Decimal` 转换是否可能在 `commit` 时抛异常导致整个事务回滚。参见 `baby.py` 模型 `weight: Numeric(5,2)`、`height: Numeric(5,1)`。
2. **前端排查步骤：**
   - 在微信开发者工具调试 `onSave` 的 API PUT 请求体，确认 `birthDate` 字段确实包含在 `babyProfile` 中。
   - 如果 `onBirthDateChange` 绑定有问题（事件类型不匹配），修复 handler 确保 `birthDate` 正确更新。
3. **修复方案：**
   - 如果根因是 `weight`/`height` 的类型转换异常：在 `update_baby` 方法中 `setattr` 调用时排除这两个字段，或添加显式类型转换。前端保存可正常发送 `weight`/`height`，后端忽略或不处理。
   - 如果根因是 `setattr` 字段名映射问题：确认 `BabyUpdate` schema 字段名与 `field_map` 一一对应。
4. **测试修复：** 修复 `baby_profile_runtime.test.ts:595` 中 `onBirthDateChange` 的 mock 数据 — 将 `value: [2026, 6, 15]` 改为 `value: "2026-06-15"`（字符串，而非数组）。

**Patterns to follow:**
- 现有 `baby_onboarding.ts:72` 使用 `birthDate` 字段的方式作为参考
- 后端 `test_baby_service.py:132-147` 的 `test_updates_fields_and_commits` 测试模式

**Test scenarios:**
- **Happy path**: PUT 请求发送包含 `birthDate` 的完整 `babyProfile`，后端返回 200 + `age` 计算正确 → 验证 `_compute_age_text("2026-06-22")` 返回非空年龄文本
- **Edge case**: `birthDate` 为当天日期，年龄应显示 "0个月0天"
- **Edge case**: `birthDate` 为将来日期，`_compute_age_text` 应返回 `None`（安全处理）
- **Error path**: `weight`/`height` 字段导致提交异常 ⇒ 确保 `birthDate` 仍被正确更新，或事务整体回滚时前端进入 `saveLocalFallback` 本地存储路径

**Verification:**
- 后端：在 API 容器中 `docker logs baby-api --tail=20` 确认 PUT 请求日志包含正确的 `birth_date` 值
- 前端：微信开发者工具中打开 `baby_profile`，修改生日后保存，返回宝宝列表页确认显示年龄文本而非"年龄未知"

---

### U2. 宝宝档案页默认出生日期动态化

**Goal:** 将 `baby_profile` 页的默认出生日期从硬编码 `'2025-12-01'` 改为当天日期。

**Dependencies:** 无

**Files:**
- `miniprogram/pages/baby_profile/baby_profile.ts` (modify)
- `tests/baby_profile_runtime.test.ts` (modify)

**Approach:**

1. 删除 `data` 中硬编码的 `birthDate: '2025-12-01'`。
2. 在 `onLoad` 中动态生成当天日期字符串（格式 `YYYY-MM-DD`），作为初始 `birthDate`。
3. 同时设置 `birthDateArray` 供兼容用途。
4. 如果 API 加载后返回有效的 `birthDate`，会覆盖这个默认值（现有 `loadFromApi` 逻辑已支持）。
5. 参考 `upload.ts:50-57` 的日期生成实现。

**Patterns to follow:**
- `upload.ts:50-57` 的日期生成：`new Date()` → `getFullYear()/getMonth()/getDate()` → 补零 → 拼接

**Test scenarios:**
- **Happy path**: `onLoad` 调用后 `birthDate` 应为当天日期字符串
- **Edge case**: 跨月跨年边界（如 1月1日、12月31日），补零逻辑应正确处理
- **Edge case**: `loadFromApi` 返回有效 `birthDate` 后应覆盖默认值

**Verification:**
- 单测验证 `birthDate` 初始值等于格式化后的当天日期
- 微信开发者工具验证打开页面时日期选择器显示当天日期

---

### U3. 上传页日期选择器改用原生组件

**Goal:** 将 `upload` 页的日期输入从 `wx.showModal` 文本弹窗改为 `<picker mode="date">` 原生组件。

**Dependencies:** 无

**Files:**
- `miniprogram/pages/upload/upload.wxml` (modify)
- `miniprogram/pages/upload/upload.ts` (modify)
- `miniprogram/pages/upload/upload.wxss` (modify, optional for styling)
- `tests/upload_flow.test.ts` (modify, optional)

**Approach:**

1. **WXML 修改**: 将当前日期行的 `bindtap="onPickDate"` 替换为 `<picker mode="date" value="{{captureDate}}" start="2020-01-01" end="2030-12-31" bindchange="onCaptureDateChange">` 包裹原有的显示视图。
2. **TS 修改**: 移除 `onPickDate` 方法（`wx.showModal` 实现），增加 `onCaptureDateChange` handler：
   ```javascript
   onCaptureDateChange: function (e) {
     this.setData({ captureDate: e.detail.value });
   }
   ```
3. 保持 `captureDate` 和 `todayDate` 的现有逻辑不变（`onLoad` 中已设置默认值）。
4. 同步移除不需要的 `onInputDescription` 中的 `wx.showModal` 逻辑（该 handler 将在 U4 中替换）。

**Patterns to follow:**
- `baby_profile.wxml:65` 的 `<picker mode="date">` 实现
- `baby_profile.ts:285-287` 的 `onBirthDateChange` handler

**Test scenarios:**
- **Happy path**: `<picker mode="date">` 选择日期后 `captureDate` 更新为选中值
- **Edge case**: 已选文件后调整日期，`captureDate` 正确覆盖
- **Edge case**: 不选日期直接确认，`captureDate` 保持默认值（当天日期）

**Verification:**
- 微信开发者工具中打开上传页 → 选择文件进入步骤2 → 点击日期字段 → 应弹出原生日期选择器而非文本输入框

---

### U4. 上传页描述字段改为多行文本输入

**Goal:** 将 `upload` 页的描述输入从 `wx.showModal` 单行文本改为 WXML 中的 `<textarea>` 多行输入。

**Dependencies:** 无

**Files:**
- `miniprogram/pages/upload/upload.wxml` (modify)
- `miniprogram/pages/upload/upload.ts` (modify)
- `miniprogram/pages/upload/upload.wxss` (modify)

**Approach:**

1. **WXML 修改**: 在步骤2的表单区域中，将描述行从 `bindtap="onInputDescription"` 改为直接放置 `<textarea>` 组件。
   ```wxml
   <view class="form-field form-field-desc">
     <text class="field-label">描述</text>
     <textarea
       class="field-textarea"
       value="{{description}}"
       placeholder="这一天的故事...（选填）"
       bindinput="onDescriptionInput"
       maxlength="500"
       auto-height
     />
   </view>
   ```
2. **TS 修改**: 移除 `onInputDescription` 方法，增加 `onDescriptionInput` handler：
   ```javascript
   onDescriptionInput: function (e) {
     this.setData({ description: e.detail.value });
   }
   ```
3. **WXSS 修改**: 添加 `<textarea>` 的基础样式（边框、内边距、字体、圆角），与 Claymorphism 设计风格保持一致。

**Patterns to follow:**
- 微信小程序官方 `<textarea>` 组件文档
- 现有 `baby_profile` 页的输入字段样式 (`field-text-input`)

**Test scenarios:**
- **Happy path**: 在 `<textarea>` 中输入多行文本，`description` 数据正确更新
- **Edge case**: 清空描述内容，`description` 应设为空字符串
- **Edge case**: 输入超长内容（超过 `maxlength`），应被截断
- **Edge case**: 含换行符的多行文本在上传 API 请求中正确传递（`uploadFile` 中 `title: _this.data.description || ''`）

**Verification:**
- 微信开发者工具中打开上传页 → 选择文件进入步骤2 → 描述字段应显示为多行输入框，可输入换行文本

---

## Scope Boundaries

### In scope
- `baby_profile` 页面出生日期的默认值修复和保存链路排查
- `upload` 页面日期选择器和描述输入组件的 WXML 改造
- 后端 `update_baby` 链路的排查（含临时日志添加）
- 相关单测的修正

### Deferred for later
- 真正的富文本编辑器（支持加粗/颜色/图文混排）—— 微信小程序无原生组件，引入第三方组件会增加体积和复杂度，当前建议接受 `<textarea>` 方案
- 预产期（`dueDate`）相关代码的清理或修复（如不需要可后续移除）

### Deferred to Follow-Up Work
- 宝宝列表页 `ageText` 显示缓存策略优化（当前 API 返回即展示，但 `album_home.ts:249` 会用 API 响应覆盖本地 `album_babies` 存储）

---

## Risks & Dependencies

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| 后端 `weight`/`height` 字段类型转换导致事务回滚 | Medium | High — 会连带 `birthDate` 更新也未提交 | U1 中优先排查此点，在 `setattr` 时对 `weight`/`height` 做 str→Decimal 显式转换，或排除这两个字段不做更新 |
| `<picker mode="date">` 在 Skyline 页面有兼容问题 | Low | Low — `upload` 使用 WebView 渲染器，不受 Skyline 限制 | 无需特殊处理 |
| 本地存储和 API 存储数据不一致，`album_home` 可能用旧数据覆盖 | Low | Medium — 影响首次展示但 `onShow` 会重新请求 | 属于既有问题，本计划不涉及 |

## Sources & Research

- **代码分析**: `baby_profile.ts; baby_profile.wxml; baby_list.wxml; upload.ts; upload.wxml; server/app/routers/baby.py; server/app/services/baby_service.py; server/app/schemas/baby.py; server/app/models/baby.py`
- **已有测试**: `tests/baby_profile_runtime.test.ts` (`onBirthDateChange` mock 数据错误)；`tests/upload_flow.test.ts`（完整上传链路，未覆盖日期/描述组件）
- **微信原生组件文档**: `<picker mode="date">` 的 `bindchange` 返回 `e.detail.value` 为字符串 `YYYY-MM-DD`

## Open Questions

- **Q1**: 后端 `update_baby` 中 `weight` 和 `height` 字段是否真的会导致 `commit` 异常？需在 ARM 测试服务器的 API 容器中实际验证。如果确认无异常，排查方向改为数据库端问题（如字段类型、约束等）。