# 微信小程序 E2E 自动化测试 + AI 视觉检测方案

> **版本**: v1.0 | **最后更新**: 2026-06-01
> **状态**: 📝 设计阶段
> **配套**: `docs/05-testing/E2E-Testing-Guide.md`（测试指南）、`docs/05-testing/arch.md`（测试架构）

---

## 1. 背景

宝宝成长相册小程序需要一套自动化测试方案，覆盖完整用户旅程（登录 → 页面跳转 → 操作），并通过 AI 视觉模型判断 UI 是否符合预期，支持后续接入 CI。

## 2. 技术架构

```
┌─────────────────────────────────────────────────────────────┐
│                        测试引擎                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ miniprogram- │  │   Puppeteer  │  │   AI 视觉    │      │
│  │  automator   │→ │  (截图采集)   │→ │  (GLM5/V4)   │      │
│  │  流程控制    │  │              │  │  UI 判断     │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│         ↓                                                   │
│  ┌──────────────┐  ┌──────────────┐                        │
│  │  报告生成    │  │   JSON +     │                        │
│  │              │← │  HTML 报告   │                        │
│  └──────────────┘  └──────────────┘                        │
└─────────────────────────────────────────────────────────────┘
```

## 3. 技术选型

| 层级 | 工具 | 说明 |
|------|------|------|
| 流程控制 | miniprogram-automator | 连接微信开发者工具，执行页面跳转、点击等操作 |
| 截图采集 | miniprogram-automator + 内置截图 | DevTools 内置截图能力，无需额外 Puppeteer |
| AI 视觉 | GLM5 / DeepSeek V4 Flash API | 用户自提供 API Key，按调用量计费 |
| 测试框架 | Jest | 配合 miniprogram-automator 使用 |
| 报告生成 | 自定义 reporter | JSON（机器读取）+ HTML（人工审查） |

## 4. 文件结构

```
miniprogram/
├── tests/                          # 测试代码
│   ├── e2e/
│   │   ├── index.ts               # 测试入口（流程编排）
│   │   ├── reporter.ts             # 报告生成器
│   │   ├── ai-validator.ts         # AI 视觉验证
│   │   └── types.ts                # 类型定义
│   ├── specs/                      # 测试规格
│   │   └── album-flow.ts           # 核心流程测试用例
│   └── reports/                    # 测试报告输出
│       └── *.json / *.html
└── package.json
```

## 5. 测试流程

覆盖完整用户旅程：

| 步骤 | 页面 | 操作 | 截图 | AI 验证点 |
|------|------|------|------|-----------|
| 1 | album_home | 加载相册首页 | ✓ | 页面标题、媒体卡片列表、上传按钮 |
| 2 | 媒体上传 | 点击上传按钮，选择图片 | ✓ | 上传弹窗、选择器 |
| 3 | media_detail | 点击媒体卡片 | ✓ | 详情页、缩略图信息 |
| 4 | 返回相册 | 返回上一页 | ✓ | 相册列表恢复 |
| 5 | 日志页 | 跳转日志 | ✓ | 日志列表 |

## 6. AI 验证 Prompt 格式

```json
{
  "model": "glm-4v",
  "prompt": "你是一个 UI 测试工程师。请判断截图中的小程序界面是否符合以下预期：\n- 页面标题为\"宝宝相册\"\n- 存在媒体卡片列表（Masonry 布局）\n- 底部有上传按钮\n\n回复格式（仅返回 JSON）：\n{\n  \"pass\": true/false,\n  \"issues\": [\"问题1描述\", \"问题2描述\"],\n  \"confidence\": 0.95\n}"
}
```

## 7. 报告输出格式

### 7.1 JSON 报告（机器可读）

```json
{
  "timestamp": "2026-06-01T10:30:00.000Z",
  "duration": 45000,
  "totalSteps": 5,
  "passedSteps": 5,
  "failedSteps": 0,
  "results": [
    {
      "step": 1,
      "page": "album_home",
      "action": "reLaunch",
      "screenshot": "screenshots/01-album-home.png",
      "aiResult": {
        "pass": true,
        "issues": [],
        "confidence": 0.98
      }
    }
  ]
}
```

### 7.2 HTML 报告（人工审查）

- 包含测试概览（通过/失败数、耗时）
- 每个步骤的截图 + AI 判断结果
- 失败步骤高亮显示
- 支持截图放大查看

## 8. CI 集成（预留）

```yaml
# .github/workflows/e2e.yml
- name: Run E2E Tests
  run: |
    npm run test:e2e
  env:
    AI_API_KEY: ${{ secrets.AI_API_KEY }}
    AI_MODEL: ${{ vars.AI_MODEL || 'glm-4v' }}

- name: Upload Reports
  uses: actions/upload-artifact@v4
  if: always()
  with:
    name: e2e-reports
    path: miniprogram/tests/reports/
```

## 9. 使用方式

```bash
# 安装依赖
npm install -D miniprogram-automator jest @types/jest

# 启动开发者工具并开启自动化端口
./cli --auto <project-path> --auto-port 9421

# 运行测试
npm run test:e2e

# 查看报告
open miniprogram/tests/reports/latest/report.html
```

## 10. 注意事项

1. **开发者工具安全端口**：需在 DevTools -> 设置 -> 安全设置开启服务端口
2. **截图时机**：在页面数据稳定后截图，避免加载中状态
3. **AI 成本控制**：失败时重试一次，避免网络波动导致误判
4. **截图数量**：关键节点截图，预计 5-8 张/流程
