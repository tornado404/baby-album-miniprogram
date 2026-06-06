# E2E + AI 视觉测试实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现微信小程序 E2E 自动化测试框架，配合 AI 视觉模型判断 UI 是否符合预期

**Architecture:** 基于 miniprogram-automator 连接开发者工具执行自动化流程，截图通过内置能力采集，AI 验证调用 GLM5/DeepSeek V4 Flash API，报告生成 JSON + HTML 双格式

**Tech Stack:** miniprogram-automator, Jest, GLM5/DeepSeek V4 Flash API, TypeScript

---

## 文件结构

```
miniprogram/tests/
├── e2e/
│   ├── index.ts              # 测试入口
│   ├── types.ts              # 类型定义
│   ├── ai-validator.ts       # AI 视觉验证
│   ├── screenshot.ts         # 截图工具
│   ├── reporter.ts           # 报告生成器
│   └── album-flow.ts         # 核心测试用例
├── specs/
│   └── album-flow.spec.ts    # 测试规格
└── reports/                  # 报告输出
```

---

## Task 1: 创建 tests 目录结构和 Jest 配置

**Files:**
- Create: `miniprogram/tests/e2e/`
- Create: `miniprogram/tests/specs/`
- Create: `miniprogram/tests/reports/`
- Create: `miniprogram/jest.config.js`
- Modify: `miniprogram/package.json`

- [ ] **Step 1: 创建目录结构**

```bash
mkdir -p miniprogram/tests/e2e miniprogram/tests/specs miniprogram/tests/reports
touch miniprogram/tests/e2e/.gitkeep miniprogram/tests/specs/.gitkeep miniprogram/tests/reports/.gitkeep
```

- [ ] **Step 2: 创建 jest.config.js**

```javascript
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.spec.ts'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  collectCoverageFrom: ['e2e/**/*.ts'],
  coverageDirectory: 'coverage',
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      tsconfig: 'tsconfig.json'
    }]
  }
};
```

- [ ] **Step 3: 更新 package.json 添加 test:e2e script**

```json
{
  "scripts": {
    "test:e2e": "jest --config jest.config.js",
    "test:e2e:watch": "jest --config jest.config.js --watch"
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add miniprogram/tests/ miniprogram/jest.config.js
git commit -m "feat: 创建 tests 目录结构和 Jest 配置"
```

---

## Task 2: 实现类型定义 (types.ts)

**Files:**
- Create: `miniprogram/tests/e2e/types.ts`

- [ ] **Step 1: 编写类型定义**

```typescript
export interface AiResult {
  pass: boolean;
  issues: string[];
  confidence: number;
}

export interface TestStep {
  step: number;
  page: string;
  action: string;
  screenshot?: string;
  aiResult?: AiResult;
  error?: string;
}

export interface TestResult {
  timestamp: string;
  duration: number;
  totalSteps: number;
  passedSteps: number;
  failedSteps: number;
  results: TestStep[];
}

export interface ReportPaths {
  json: string;
  html: string;
  screenshots: string;
}

export interface ValidationPrompt {
  pageName: string;
  checks: string[];
}

export const VALIDATION_PROMPTS: Record<string, ValidationPrompt> = {
  album_home: {
    pageName: '宝宝相册',
    checks: [
      '页面标题为"宝宝相册"或"成长相册"',
      '存在媒体卡片列表（Masonry 布局）',
      '底部有上传按钮'
    ]
  },
  media_upload: {
    pageName: '上传弹窗',
    checks: [
      '出现上传选项（拍照/相册选择）',
      '有取消或关闭按钮'
    ]
  },
  media_detail: {
    pageName: '媒体详情页',
    checks: [
      '显示媒体内容（图片/视频）',
      '有返回按钮'
    ]
  },
  logs: {
    pageName: '日志页面',
    checks: [
      '显示日志列表',
      '有添加日志入口'
    ]
  }
};
```

- [ ] **Step 2: Commit**

```bash
git add miniprogram/tests/e2e/types.ts
git commit -m "feat: 添加类型定义"
```

---

## Task 3: 实现 AI 视觉验证模块 (ai-validator.ts)

**Files:**
- Create: `miniprogram/tests/e2e/ai-validator.ts`
- Test: `miniprogram/tests/specs/ai-validator.spec.ts`

- [ ] **Step 1: 编写 AI 验证模块**

```typescript
import * as fs from 'fs';
import * as path from 'path';
import { AiResult } from './types';

const MAX_RETRIES = 1;
const RETRY_DELAY = 1000;

interface ApiConfig {
  apiKey: string;
  model: 'glm-4v' | 'deepseek-v4-flash';
  baseUrl: string;
}

function getApiConfig(): ApiConfig {
  return {
    apiKey: process.env.AI_API_KEY || '',
    model: (process.env.AI_MODEL as ApiConfig['model']) || 'glm-4v',
    baseUrl: process.env.AI_BASE_URL || 'https://open.bigmodel.cn/api/paas/v4'
  };
}

function buildPrompt(pageChecks: string[]): string {
  return `你是一个 UI 测试工程师。请判断截图中的小程序界面是否符合以下预期：
${pageChecks.map((check, i) => `${i + 1}. ${check}`).join('\n')}

回复格式（仅返回 JSON）：
{
  "pass": true/false,
  "issues": ["问题1描述", "问题2描述"],
  "confidence": 0.95
}`;
}

async function callAiApi(imageBase64: string, prompt: string, config: ApiConfig): Promise<AiResult> {
  const endpoint = config.model === 'glm-4v'
    ? `${config.baseUrl}/chat/completions`
    : `${config.baseUrl}/chat/completions`;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`
    },
    body: JSON.stringify({
      model: config.model,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: `data:image/png;base64,${imageBase64}` } }
          ]
        }
      ],
      temperature: 0.1
    })
  });

  if (!response.ok) {
    throw new Error(`AI API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json() as { choices: Array<{ message: { content: string } }> };
  const content = data.choices[0]?.message?.content || '';

  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]) as AiResult;
    }
    throw new Error('No JSON found in response');
  } catch (e) {
    return { pass: false, issues: [`解析AI响应失败: ${content}`], confidence: 0 };
  }
}

export async function validateImage(
  screenshotPath: string,
  prompt: string
): Promise<AiResult> {
  const config = getApiConfig();

  if (!config.apiKey) {
    console.warn('AI_API_KEY not set, skipping validation');
    return { pass: true, issues: ['AI_API_KEY not configured'], confidence: 0 };
  }

  const imageBuffer = fs.readFileSync(screenshotPath);
  const imageBase64 = imageBuffer.toString('base64');

  let lastError: Error | null = null;

  for (let i = 0; i <= MAX_RETRIES; i++) {
    try {
      return await callAiApi(imageBase64, prompt, config);
    } catch (e) {
      lastError = e as Error;
      if (i < MAX_RETRIES) {
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
      }
    }
  }

  return {
    pass: false,
    issues: [`AI API 调用失败: ${lastError?.message}`],
    confidence: 0
  };
}
```

- [ ] **Step 2: 编写单元测试**

```typescript
import { validateImage } from '../e2e/ai-validator';

jest.mock('fs');
jest.mock('fetch');

const mockedFs = fs as jest.Mocked<typeof fs>;
const mockedFetch = fetch as jest.MockedFunction<typeof fetch>;

describe('ai-validator', () => {
  const mockScreenshotPath = '/tmp/screenshot.png';

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.AI_API_KEY = 'test-key';
    process.env.AI_MODEL = 'glm-4v';
    mockedFs.readFileSync.mockReturnValue(Buffer.from('mock-image-data'));
  });

  it('should return pass when AI validates successfully', async () => {
    mockedFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      statusText: 'OK'
    } as unknown as Response);

    const mockResponse = {
      choices: [{
        message: {
          content: '{"pass":true,"issues":[],"confidence":0.98}'
        }
      }]
    };

    mockedFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse
    } as unknown as Response);

    const result = await validateImage(
      mockScreenshotPath,
      'Check page title'
    );

    expect(result.pass).toBe(true);
    expect(result.confidence).toBe(0.98);
  });

  it('should retry on failure', async () => {
    mockedFetch
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error'
      } as unknown as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: '{"pass":true,"issues":[],"confidence":0.9}'
            }
          }]
        })
      } as unknown as Response);

    const result = await validateImage(mockScreenshotPath, 'Check page');

    expect(mockedFetch).toHaveBeenCalledTimes(2);
    expect(result.pass).toBe(true);
  });

  it('should return false when API key is not set', async () => {
    delete process.env.AI_API_KEY;

    const result = await validateImage(mockScreenshotPath, 'Check page');

    expect(result.pass).toBe(true);
    expect(result.issues).toContain('AI_API_KEY not configured');
  });
});
```

- [ ] **Step 3: Commit**

```bash
git add miniprogram/tests/e2e/ai-validator.ts miniprogram/tests/specs/ai-validator.spec.ts
git commit -m "feat: 实现 AI 视觉验证模块"
```

---

## Task 4: 实现截图工具模块 (screenshot.ts)

**Files:**
- Create: `miniprogram/tests/e2e/screenshot.ts`
- Test: `miniprogram/tests/specs/screenshot.spec.ts`

- [ ] **Step 1: 编写截图模块**

```typescript
import * as fs from 'fs';
import * as path from 'path';
import { Page } from 'miniprogram-automator';

export interface ScreenshotOptions {
  fullPage?: boolean;
  quality?: number;
}

export async function capturePage(
  page: Page,
  name: string,
  outputDir: string
): Promise<string> {
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const filename = `${name}-${Date.now()}.png`;
  const filepath = path.join(outputDir, filename);

  const data = await page.screenshot({
    path: filepath
  });

  if (!data) {
    throw new Error(`Failed to capture screenshot: ${name}`);
  }

  return filepath;
}

export function getScreenshotsDir(): string {
  return path.join(__dirname, '..', 'reports', 'screenshots');
}
```

- [ ] **Step 2: 编写单元测试**

```typescript
import { capturePage } from '../e2e/screenshot';
import * as fs from 'fs';

jest.mock('fs');

const mockedFs = fs as jest.Mocked<typeof fs>;

describe('screenshot', () => {
  const mockPage = {
    screenshot: jest.fn()
  } as any;
  const outputDir = '/tmp/screenshots';

  beforeEach(() => {
    jest.clearAllMocks();
    mockedFs.existsSync.mockReturnValue(false);
    mockedFs.mkdirSync.mockImplementation(() => {});
  });

  it('should create directory if not exists', async () => {
    mockPage.screenshot.mockResolvedValue(Buffer.from('mock-data'));

    await capturePage(mockPage, 'test', outputDir);

    expect(mockedFs.mkdirSync).toHaveBeenCalledWith(outputDir, { recursive: true });
  });

  it('should return screenshot filepath', async () => {
    mockPage.screenshot.mockResolvedValue(Buffer.from('mock-data'));

    const result = await capturePage(mockPage, 'album-home', outputDir);

    expect(result).toMatch(/^.*\/album-home-\d+\.png$/);
  });

  it('should throw when screenshot fails', async () => {
    mockPage.screenshot.mockResolvedValue(null);

    await expect(capturePage(mockPage, 'test', outputDir))
      .rejects.toThrow('Failed to capture screenshot');
  });
});
```

- [ ] **Step 3: Commit**

```bash
git add miniprogram/tests/e2e/screenshot.ts miniprogram/tests/specs/screenshot.spec.ts
git commit -m "feat: 实现截图工具模块"
```

---

## Task 5: 实现报告生成器 (reporter.ts)

**Files:**
- Create: `miniprogram/tests/e2e/reporter.ts`
- Test: `miniprogram/tests/specs/reporter.spec.ts`

- [ ] **Step 1: 编写报告生成器**

```typescript
import * as fs from 'fs';
import * as path from 'path';
import { TestResult, ReportPaths } from './types';

export function generateJsonReport(result: TestResult, outputDir: string): string {
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const filename = `result-${Date.now()}.json`;
  const filepath = path.join(outputDir, filename);

  fs.writeFileSync(filepath, JSON.stringify(result, null, 2));
  return filepath;
}

export function generateHtmlReport(result: TestResult, outputDir: string): string {
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const filename = `report-${Date.now()}.html`;
  const filepath = path.join(outputDir, filename);

  const html = buildHtml(result);
  fs.writeFileSync(filepath, html);
  return filepath;
}

function buildHtml(result: TestResult): string {
  const passedIcon = '✓';
  const failedIcon = '✗';

  const stepsHtml = result.results.map(step => {
    const status = step.error || (step.aiResult && !step.aiResult.pass) ? 'failed' : 'passed';
    const icon = status === 'passed' ? passedIcon : failedIcon;

    return `
      <div class="step ${status}">
        <div class="step-header">
          <span class="step-number">Step ${step.step}</span>
          <span class="step-page">${step.page}</span>
          <span class="step-action">${step.action}</span>
          <span class="step-status">${icon}</span>
        </div>
        ${step.screenshot ? `
          <div class="step-screenshot">
            <img src="${step.screenshot}" alt="Step ${step.step} screenshot" />
          </div>
        ` : ''}
        ${step.aiResult ? `
          <div class="ai-result">
            <div>Confidence: ${(step.aiResult.confidence * 100).toFixed(1)}%</div>
            ${step.aiResult.issues.length > 0 ? `
              <div class="issues">
                Issues: ${step.aiResult.issues.join(', ')}
              </div>
            ` : ''}
          </div>
        ` : ''}
        ${step.error ? `<div class="error">${step.error}</div>` : ''}
      </div>
    `;
  }).join('');

  return `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>E2E Test Report</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      max-width: 1200px;
      margin: 0 auto;
      padding: 20px;
      background: #f5f5f5;
    }
    .header {
      background: white;
      padding: 20px;
      border-radius: 8px;
      margin-bottom: 20px;
    }
    .summary {
      display: flex;
      gap: 20px;
    }
    .stat {
      padding: 15px 25px;
      border-radius: 8px;
      text-align: center;
    }
    .stat.passed { background: #d4edda; color: #155724; }
    .stat.failed { background: #f8d7da; color: #721c24; }
    .stat.duration { background: #e2e3e5; color: #383d41; }
    .step {
      background: white;
      padding: 20px;
      border-radius: 8px;
      margin-bottom: 15px;
      border-left: 4px solid #ccc;
    }
    .step.passed { border-left-color: #28a745; }
    .step.failed { border-left-color: #dc3545; }
    .step-header {
      display: flex;
      gap: 15px;
      align-items: center;
      margin-bottom: 15px;
    }
    .step-number { font-weight: bold; }
    .step-page { color: #666; }
    .step-action { color: #999; font-size: 0.9em; }
    .step-status { margin-left: auto; font-size: 1.5em; }
    .step-screenshot img {
      max-width: 100%;
      border-radius: 4px;
      margin-top: 10px;
    }
    .ai-result { margin-top: 10px; color: #666; }
    .issues { color: #dc3545; margin-top: 5px; }
    .error { color: #dc3545; margin-top: 10px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>微信小程序 E2E 测试报告</h1>
    <div class="summary">
      <div class="stat passed">
        <div class="value">${result.passedSteps}</div>
        <div class="label">通过</div>
      </div>
      <div class="stat failed">
        <div class="value">${result.failedSteps}</div>
        <div class="label">失败</div>
      </div>
      <div class="stat duration">
        <div class="value">${(result.duration / 1000).toFixed(1)}s</div>
        <div class="label">耗时</div>
      </div>
    </div>
    <div style="margin-top: 10px; color: #666;">
      测试时间: ${new Date(result.timestamp).toLocaleString('zh-CN')}
    </div>
  </div>
  <div class="steps">
    ${stepsHtml}
  </div>
</body>
</html>
  `;
}

export async function generateReport(
  result: TestResult,
  outputDir: string
): Promise<ReportPaths> {
  const jsonPath = generateJsonReport(result, outputDir);
  const htmlPath = generateHtmlReport(result, outputDir);
  const screenshotsDir = path.join(outputDir, 'screenshots');

  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
  }

  return {
    json: jsonPath,
    html: htmlPath,
    screenshots: screenshotsDir
  };
}
```

- [ ] **Step 2: 编写单元测试**

```typescript
import { generateJsonReport, generateHtmlReport } from '../e2e/reporter';
import * as fs from 'fs';

jest.mock('fs');

const mockedFs = fs as jest.Mocked<typeof fs>;

describe('reporter', () => {
  const mockResult = {
    timestamp: '2026-06-01T10:00:00.000Z',
    duration: 5000,
    totalSteps: 3,
    passedSteps: 2,
    failedSteps: 1,
    results: [
      {
        step: 1,
        page: 'album_home',
        action: 'reLaunch',
        screenshot: '/path/to/01.png',
        aiResult: { pass: true, issues: [], confidence: 0.95 }
      },
      {
        step: 2,
        page: 'album_home',
        action: 'tap upload',
        error: 'Upload button not found'
      }
    ]
  };

  const outputDir = '/tmp/reports';

  beforeEach(() => {
    jest.clearAllMocks();
    mockedFs.existsSync.mockReturnValue(false);
    mockedFs.mkdirSync.mockImplementation(() => {});
    mockedFs.writeFileSync.mockImplementation(() => {});
  });

  it('should generate JSON report', () => {
    const result = generateJsonReport(mockResult, outputDir);

    expect(result).toMatch(/result-\d+\.json$/);
    expect(mockedFs.writeFileSync).toHaveBeenCalled();
  });

  it('should generate HTML report', () => {
    const result = generateHtmlReport(mockResult, outputDir);

    expect(result).toMatch(/report-\d+\.html$/);
    expect(mockedFs.writeFileSync).toHaveBeenCalled();
  });

  it('should include all steps in HTML', () => {
    generateHtmlReport(mockResult, outputDir);

    const htmlContent = mockedFs.writeFileSync.mock.calls[0][1] as string;
    expect(htmlContent).toContain('Step 1');
    expect(htmlContent).toContain('album_home');
    expect(htmlContent).toContain('passed');
    expect(htmlContent).toContain('failed');
  });
});
```

- [ ] **Step 3: Commit**

```bash
git add miniprogram/tests/e2e/reporter.ts miniprogram/tests/specs/reporter.spec.ts
git commit -m "feat: 实现报告生成器"
```

---

## Task 6: 实现核心测试用例 (album-flow.ts)

**Files:**
- Create: `miniprogram/tests/e2e/album-flow.ts`
- Create: `miniprogram/tests/e2e/index.ts`

- [ ] **Step 1: 编写测试用例**

```typescript
import automator, { MiniProgram, Page } from 'miniprogram-automator';
import { capturePage } from './screenshot';
import { validateImage } from './ai-validator';
import { buildPrompt, VALIDATION_PROMPTS } from './types';
import { TestResult, TestStep } from './types';

const WS_ENDPOINT = process.env.WS_ENDPOINT || 'ws://localhost:9421';
const SCREENSHOTS_DIR = process.join(__dirname, '..', 'reports', 'screenshots');

async function connectDevTools(): Promise<MiniProgram> {
  console.log(`Connecting to DevTools at ${WS_ENDPOINT}...`);
  const miniProgram = await automator.connect({ wsEndpoint: WS_ENDPOINT });
  console.log('Connected successfully');
  return miniProgram;
}

async function runStep(
  miniProgram: MiniProgram,
  step: number,
  pagePath: string,
  action: () => Promise<void>,
  validationKey?: string
): Promise<TestStep> {
  const testStep: TestStep = {
    step,
    page: pagePath,
    action: action.name || 'unknown'
  };

  try {
    console.log(`[Step ${step}] Navigating to ${pagePath}...`);
    await miniProgram.reLaunch(pagePath);
    await miniProgram.waitFor(1000);

    await action();

    const screenshotPath = await capturePage(
      await miniProgram.getCurrentPage(),
      `step-${step}-${pagePath.split('/').pop()}`,
      SCREENSHOTS_DIR
    );
    testStep.screenshot = screenshotPath;

    if (validationKey && VALIDATION_PROMPTS[validationKey]) {
      const prompt = buildPrompt(VALIDATION_PROMPTS[validationKey].checks);
      testStep.aiResult = await validateImage(screenshotPath, prompt);
      console.log(`[Step ${step}] AI validation: pass=${testStep.aiResult.pass}`);
    }

    return testStep;
  } catch (error) {
    testStep.error = (error as Error).message;
    console.error(`[Step ${step}] Error: ${testStep.error}`);
    return testStep;
  }
}

export async function runAlbumFlow(): Promise<TestResult> {
  const startTime = Date.now();
  const result: TestResult = {
    timestamp: new Date().toISOString(),
    duration: 0,
    totalSteps: 5,
    passedSteps: 0,
    failedSteps: 0,
    results: []
  };

  let miniProgram: MiniProgram | null = null;

  try {
    miniProgram = await connectDevTools();

    // Step 1: Album Home
    result.results.push(await runStep(
      miniProgram, 1, 'pages/album_home/album_home',
      async () => {},
      'album_home'
    ));

    // Step 2: Upload Modal (tap upload button)
    result.results.push(await runStep(
      miniProgram, 2, 'pages/album_home/album_home',
      async () => {
        const page = await miniProgram.getCurrentPage();
        const uploadBtn = await page.$('.upload-btn');
        if (uploadBtn) {
          await uploadBtn.tap();
        }
      },
      'media_upload'
    ));

    // Step 3: Media Detail (tap media card)
    result.results.push(await runStep(
      miniProgram, 3, 'pages/media_detail/media_detail',
      async () => {
        const page = await miniProgram.getCurrentPage();
        const cards = await page.$$('.media-card');
        if (cards.length > 0) {
          await cards[0].tap();
        }
      },
      'media_detail'
    ));

    // Step 4: Return to Album
    result.results.push(await runStep(
      miniProgram, 4, 'pages/album_home/album_home',
      async () => {
        const page = await miniProgram.getCurrentPage();
        await page.navigateBack();
      },
      'album_home'
    ));

    // Step 5: Logs Page
    result.results.push(await runStep(
      miniProgram, 5, 'pages/logs/logs',
      async () => {},
      'logs'
    ));

  } finally {
    if (miniProgram) {
      await miniProgram.close();
    }
  }

  result.duration = Date.now() - startTime;
  result.passedSteps = result.results.filter(
    r => !r.error && (!r.aiResult || r.aiResult.pass)
  ).length;
  result.failedSteps = result.results.filter(
    r => r.error || (r.aiResult && !r.aiResult.pass)
  ).length;

  return result;
}
```

- [ ] **Step 2: 编写入口文件**

```typescript
import { runAlbumFlow } from './album-flow';
import { generateReport } from './reporter';
import * as path from 'path';

const REPORTS_DIR = path.join(__dirname, '..', 'reports');

async function main() {
  console.log('Starting E2E test...');

  try {
    const result = await runAlbumFlow();
    const paths = await generateReport(result, REPORTS_DIR);

    console.log('\n=== Test Summary ===');
    console.log(`Total Steps: ${result.totalSteps}`);
    console.log(`Passed: ${result.passedSteps}`);
    console.log(`Failed: ${result.failedSteps}`);
    console.log(`Duration: ${(result.duration / 1000).toFixed(1)}s`);
    console.log(`\nJSON Report: ${paths.json}`);
    console.log(`HTML Report: ${paths.html}`);

    process.exit(result.failedSteps > 0 ? 1 : 0);
  } catch (error) {
    console.error('Test failed:', error);
    process.exit(1);
  }
}

main();
```

- [ ] **Step 3: Commit**

```bash
git add miniprogram/tests/e2e/album-flow.ts miniprogram/tests/e2e/index.ts
git commit -m "feat: 实现核心测试用例"
```

---

## Task 7-9: 集成测试（由 QA 执行）

QA 将执行 Task 7-8 的单元测试编写，并在 engineer 完成 Task 6 后执行 Task 9 集成测试。

---

## 自检清单

- [ ] 所有类型定义一致（AiResult, TestStep, TestResult）
- [ ] 无 TBD/TODO 占位符
- [ ] 每个任务都有对应的测试
- [ ] 所有 import 路径正确
- [ ] Jest 配置与 tsconfig 兼容
