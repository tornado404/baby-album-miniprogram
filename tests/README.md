# 单元测试

此目录存放项目的单元测试文件（`*.test.ts`）。

## 测试组织

```
tests/
├── CLAUDE.md              # 测试纠错经验与教训
├── e2e/                   # E2E 测试配置（全局 setup/teardown）
│
# 组件测试
├── age_filter.test.ts           # 年龄筛选组件
├── age_filter_integration.test.ts # 年龄筛选集成测试
├── masonry_layout.test.ts       # 瀑布流布局组件
├── masonry_integration.test.ts  # 瀑布流集成测试
├── media_uploader.test.ts       # 媒体上传组件
│
# 页面测试
├── album_home.test.ts           # 首页
├── media_detail.test.ts         # 媒体详情页
├── upload_flow.test.ts          # 上传流程
├── onboarding.test.ts           # 引导页
│
# 服务测试
├── storage_service.test.ts      # 存储服务
├── config_service.test.ts       # 配置服务
├── config_api.test.ts           # API 配置
│
# 工具测试
├── model.test.ts                # 数据模型
├── i18n.test.ts                 # 国际化
├── skyline_compat.test.ts       # Skyline 兼容性
├── tech_validate.test.ts        # 技术验证
├── tech_validate_issues.test.ts # 技术验证问题记录
```

## 运行测试

```bash
# 运行所有单元测试
npm run test:unit

# 运行特定测试文件
npx jest tests/album_home.test.ts

# 带 coverage 运行
npm run test:coverage

# 监听模式
npm run test:watch
```

## 测试文件命名规范

- `*.test.ts` — TypeScript 单元测试
- `*.test.js` — 编译后的 JavaScript 测试（保持同步）
- `*_integration.test.ts` — 集成测试（涉及多个组件协作）

## E2E 测试

E2E 测试位于 `miniprogram/tests/specs/`，详见：
- [E2E 测试指南](../docs/05-testing/E2E-Testing-Guide.md)
- [E2E 快速上手](../docs/05-testing/e2e-快速上手.md)

## 相关文档

- [测试体系文档](../docs/05-testing/)
- [纠错经验](./CLAUDE.md)
