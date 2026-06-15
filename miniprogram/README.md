# 宝宝成长相册 — 小程序前端

> 微信小程序 + TypeScript + TDesign 组件库

## 目录结构

```
miniprogram/
├── app.ts              # 应用入口
├── app.json            # 应用配置（页面、窗口、组件注册）
├── app.wxss            # 全局样式
├── sitemap.json        # 小程序索引配置
├── tsconfig.json       # TypeScript 配置
│
├── pages/              # 页面
│   ├── album_home/     # 首页（Skyline 渲染）
│   ├── upload/         # 上传页
│   ├── settings/       # 设置/我的页
│   ├── baby_profile/   # 宝宝档案页
│   ├── media_detail/   # 媒体详情页
│   ├── 3d_viewer/      # 3D 模型查看页
│   ├── index/          # 旧版首页
│   ├── logs/           # 日志页
│   └── tech_validate/  # 技术验证页
│
├── components/         # 组件
│   ├── bottom-nav/     # 底部导航（4 Tab）
│   ├── age_filter/     # 年龄筛选
│   ├── masonry_layout/ # 瀑布流布局
│   ├── media_card/     # 媒体卡片
│   ├── media_uploader/ # 媒体上传
│   ├── edit-overlay/   # 编辑覆盖层
│   └── navigation-bar/ # 自定义导航栏
│
├── services/           # API 服务层
│   ├── api.ts          # API 基础配置
│   ├── auth_api.ts     # 认证 API
│   ├── baby_api.ts     # 宝宝档案 API
│   ├── media_api.ts    # 媒体 API
│   ├── media_service.ts    # 媒体业务逻辑
│   ├── storage_service.ts  # 存储服务
│   ├── config_service.ts   # 配置服务
│   ├── request.ts      # 网络请求封装
│   └── mock_cloud_service.ts # 模拟云服务
│
├── utils/              # 工具函数
│   ├── age_calculator.ts   # 年龄计算
│   ├── date_utils.ts       # 日期处理
│   ├── image_utils.ts      # 图片处理
│   ├── i18n.ts             # 国际化
│   └── util.ts             # 通用工具
│
├── constants/          # 常量定义
│   ├── album_constants.ts  # 相册常量
│   └── storage_keys.ts     # 存储键名
│
├── config/             # 环境配置
│   └── api.ts          # API 地址配置
│
├── styles/             # 全局样式
│   ├── variables.wxss  # CSS 变量（主题色、间距等）
│   └── common.wxss     # 公共样式类
│
├── tests/              # E2E 测试
│   ├── e2e/            # E2E 基础设施
│   ├── specs/          # 测试用例
│   └── reports/        # 测试报告
│
└── miniprogram_npm/    # 构建后的 npm 包（TDesign）
```

## 渲染策略

- **album_home（首页）**: Skyline 渲染器（高性能）
- **其他页面**: WebView 渲染器

## 开发指南

### 安装依赖

```bash
cd miniprogram
npm install
```

### 构建 npm

在微信开发者工具中：**工具 → 构建 npm**

### 编译 TypeScript

```bash
npx tsc -p tsconfig.json
```

## 相关文档

- [前端开发规范](../docs/02-design/Spec.md)
- [UI 设计规范](../docs/02-design/Design.md)
- [测试指南](../docs/05-testing/e2e-快速上手.md)
