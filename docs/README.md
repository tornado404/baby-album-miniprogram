# 📚 宝宝成长相册 — 文档中心

> **项目**: 宝宝成长相册（Baby Album）— 微信小程序
> **仓库**: [baby-album-miniprogram](https://github.com/tornado404/baby-album-miniprogram)
> **Figma**: [Claymorphism UI 设计稿](https://www.figma.com/design/KcqY6GUSvdn24Ur1qKkcim)

---

## 文档体系

```
docs/
├── PRD-v2.md                      ← 🎯 产品需求（顶层入口，不动）
│
├── 01-requirements/               # 需求规格 — 为什么做 & 做什么
├── 02-design/                     # 设计规范 — 做成什么样
├── 03-architecture/               # 系统架构 — 整体怎么搭
├── 04-features/                   # 功能模块 — 具体怎么做
├── 05-testing/                    # 测试体系 — 怎么验证
├── 06-standards/                  # 开发规范 — 要遵守什么
├── 07-plans/                      # 项目计划 — 怎么做 & 做得怎样
└── archive/                       # 历史归档
```

---

## 1️⃣ 需求规格 (01-requirements/)

| 文档 | 说明 | 状态 |
|------|------|------|
| [`storage-PRD.md`](./01-requirements/storage-PRD.md) | 相册数据存储服务设计（MinIO + 直传方案） | 📝 设计阶段 |
| [`integration-PRD.md`](./01-requirements/integration-PRD.md) | 前后端联调需求文档 | 📝 待评审 |
| [`switchable-config-PRD.md`](./01-requirements/switchable-config-PRD.md) | 可切换API服务器配置 — 本地/云服务器环境切换 | 📝 设计阶段 |

## 2️⃣ 设计规范 (02-design/)

| 文档 | 说明 | 状态 |
|------|------|------|
| [`Design.md`](./02-design/Design.md) | UI/UX 设计规范 — Claymorphism 粘土风格 | v1.2 ✅ |
| [`Spec.md`](./02-design/Spec.md) | 功能规格说明书 — 开发任务明细 | v1.0 ✅ |
| [`Tech.md`](./02-design/Tech.md) | 技术栈说明 — 微信小程序 + 后端全栈 | v1.0 ✅ |

## 3️⃣ 系统架构 (03-architecture/)

| 文档 | 说明 |
|------|------|
| [`backend/README.md`](./03-architecture/backend/README.md) | 后端总览 — Python FastAPI + PostgreSQL |
| [`backend/architecture.md`](./03-architecture/backend/architecture.md) | 架构深度设计（数据库/部署/工程结构） |
| [`backend/feature/`](./03-architecture/backend/feature/) | 后端功能设计（认证/存储/同步/分享/分析） |
| [`backend/story/`](./03-architecture/backend/story/) | 后端用户故事 |

## 4️⃣ 功能模块 (04-features/)

| 文档 | 说明 |
|------|------|
| [`album_v1/feature_design.md`](./04-features/album_v1/feature_design.md) | 相册 v1 功能设计 |
| [`story/story.md`](./04-features/story/story.md) | 前端用户故事 |
| [`switchable-config-guide.md`](./04-features/switchable-config-guide.md) | 环境配置切换操作指南 — 本地/测试/生产三端切换 |

## 5️⃣ 测试体系 (05-testing/)

| 文档 | 说明 | 适用场景 |
|------|------|----------|
| [`E2E-Testing-Guide.md`](./05-testing/E2E-Testing-Guide.md) | E2E 测试完整指南 | 首次配置 |
| [`e2e-快速上手.md`](./05-testing/e2e-快速上手.md) | E2E 测试快速上手指南 | 快速入门 |
| [`Automation-Screenshot-Guide.md`](./05-testing/Automation-Screenshot-Guide.md) | 自动化截图测试指南 | 截图测试 |
| [`arch.md`](./05-testing/arch.md) | E2E 测试框架架构原理 | 深入理解 |

## 6️⃣ 开发规范 (06-standards/)

| 文档 | 说明 |
|------|------|
| [`dev_rules.md`](./06-standards/dev_rules.md) | 编码规范 & 常见错误 |
| [`踩坑修复手册/SKILL.md`](./06-standards/踩坑修复手册/SKILL.md) | 踩坑修复手册 — 已知问题解决方案 |

## 7️⃣ 项目计划 (07-plans/)

| 目录 | 说明 |
|------|------|
| [`plan/`](./07-plans/plan/) | 实施策略与路线图 |
| [`task/`](./07-plans/task/) | 任务追踪与迭代评估 |
| [`superpowers/plans/`](./07-plans/superpowers/plans/) | AI 辅助实施计划 |
| [`superpowers/specs/`](./07-plans/superpowers/specs/) | AI 辅助规格调整 |

## 📦 归档 (archive/)

| 文档 | 说明 |
|------|------|
| [`PRD.md`](./archive/PRD.md) | 旧版 PRD（v1.x 基础版，已由 PRD-v2 替代） |

---

## 文档导航指南

根据你的角色选择入口：

| 角色 | 推荐入口 |
|------|----------|
| 🎨 **产品 / 设计** | `PRD-v2.md` → `Design.md` |
| 🖥️ **前端开发** | `Tech.md` → `Spec.md` → `album_v1/feature_design.md` → `switchable-config-guide.md`（环境切换） |
| ⚙️ **后端开发** | `backend/README.md` → `backend/architecture.md` |
| 🧪 **测试** | `e2e-快速上手.md` → `E2E-Testing-Guide.md` → `arch.md` |
| 📋 **项目管理** | `07-plans/plan/` → `07-plans/task/` |

---

> 最后更新: 2026-06-06 | 文档结构规范 v2.0