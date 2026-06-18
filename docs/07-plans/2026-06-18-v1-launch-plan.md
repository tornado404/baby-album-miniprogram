# 宝宝成长日记 v1 上线计划（7天）

> **版本**: v1.0 | **最后更新**: 2026-06-18
> **状态**: ✅ 已定稿
> **决策**: 3Tab 导航（成长/记录/我的）+ 轻量版发布

## 上线范围

### ✅ v1 核心页面（6个）

| 页面 | 路由 | 角色 |
|------|------|------|
| index | 入口路由 | 登录检测 + 分发 |
| onboarding | 微信登录 | JWT 认证 + 隐私协议 |
| baby_onboarding | 新建宝宝 | 首次填写宝宝信息 |
| album_home | 成长首页 | 瀑布流相册 + 筛选 |
| upload | 上传记录 | 照片/视频上传（MinIO） |
| settings | 我的 | 统计 + 菜单 + 资料 |

### ⏸️ 暂缓（v2 迭代）

- `gallery`（素材库）— v2 作为"整理"上线
- `journey`（成长历程）— v2 作为"成长"主页打磨
- `3d_viewer` / `logs` / `tech_validate` — 已移除

### 🔧 保留但需修补

- `media_detail` — 对接后端 PUT/DELETE API
- `baby_profile` / `baby_list` / `share_settings` / `achievements` / `growth_compare` / `about`

---

## Day 1-2：核心缺陷修复

| # | 任务 | 文件 | 优先级 |
|---|------|------|--------|
| 1 | baby_onboarding 补生日/性别字段 + API 传递 | `baby_onboarding.ts/.wxml/.wxss` | 🔴 |
| 2 | media_detail 编辑/删除对接后端 API | `media_detail.js`, `media_api.ts` | 🔴 |
| 3 | album_home 年龄段筛选对接实际数据过滤 | `album_home.ts/.js` | 🔴 |
| 4 | 移除 logs/3d_viewer/tech_validate 空壳页面 | `app.json` | 🟡 |

## Day 3：当前变更收尾 + 导航确认

| # | 任务 | 说明 |
|---|------|------|
| 5 | 完成 album_home 未提交变更（分享邀请+删除功能） | 135行 diff |
| 6 | 确认 bottom-nav 3Tab 配置正确 | 6个使用页面 |
| 7 | 验证页面对应路由正确性 | 入口/跳转逻辑 |

## Day 4：微信配置 + 合规

| # | 任务 | 说明 |
|---|------|------|
| 8 | 配置 request 合法域名（ARM 服务器域名/IP + HTTPS） | 小程序管理后台 |
| 9 | 检查并补充用户隐私协议 | onboarding 页 |
| 10 | 确认小程序类目正确 | 工具-亲子 / 教育-早教 |
| 11 | 生成小程序码供提交审核 | |

## Day 5：端到端全流程测试

真实环境跑通：

```
未登录 → 微信授权登录 → 新建宝宝(带生日) → 成长首页
→ 上传照片(2-3张) → 瀑布流展示 → 点击查看详情
→ 编辑描述 → 删除照片 → 成就页面 → 家人共享
```

重点关注：
- 离线降级逻辑（API 不可用时走本地缓存）
- Skyline 渲染兼容性
- 大文件上传超时
- 清除缓存后重新登录不丢失数据

## Day 6：性能优化 + Bug 修复

- 首屏加载性能优化（album_home Skyline 渲染）
- 上传进度反馈优化
- 修复测试日发现的 bug
- 编译 .ts → .js：`cd miniprogram && npx tsc -p tsconfig.json`

## Day 7：提交审核 + 发布

- **代码冻结**，只修阻塞级 bug
- 重新构建 npm + 清除缓存（解决空白屏 + timeout 问题）
- 上传代码 → 提交审核 → 审核通过后发布

---

## 已知风险

| 风险 | 影响 | 缓解方案 |
|------|------|----------|
| ARM 服务器 HTTPS 未配置 | 小程序无法调 API | Day 4 优先确认；备选备案域名 |
| 微信审核不通过 | 无法发布 | Day 4 补齐隐私协议和类目 |
| 开发环境 mock_openid 导致重复创建 | 数据混乱 | 已修复前端防御逻辑 |
| 上传存储配额不足 | 用户无法上传 | 确认 MinIO 配额和清理策略 |