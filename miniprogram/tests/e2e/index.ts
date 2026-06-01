/**
 * E2E 测试入口 - 流程编排器
 *
 * 职责：
 *  1. 启动 miniprogram-automator 连接微信开发者工具
 *  2. 顺序执行测试步骤（navigate / tap / wait）
 *  3. 每个步骤截图、调用 AI 视觉验证
 *  4. 生成 JSON + HTML 报告
 *
 * 使用：
 *   import { runE2E } from './e2e';
 *   import { albumFlowSteps } from '../specs/album-flow';
 *
 *   const { report, paths } = await runE2E({
 *     wsEndpoint: 'ws://127.0.0.1:9421',
 *     projectPath: '/abs/path/to/miniprogram',
 *     steps: albumFlowSteps
 *   });
 */

import * as fs from 'fs';
import * as path from 'path';
import { TestStep, TestResult, ReportPaths, E2EReport } from './types';
import {
  captureScreenshot,
  AutomatorPage,
  makeScreenshotDir
} from './screenshot';
import { AiValidator } from './ai-validator';
import {
  createReportPaths,
  writeJsonReport,
  writeHtmlReport,
  buildReport,
  updateLatestSymlink
} from './reporter';

/* ==================== 配置选项 ==================== */

export interface RunE2EOptions {
  /** miniprogram-automator websocket endpoint（如 ws://127.0.0.1:9421） */
  wsEndpoint: string;
  /** 小程序项目根路径（用于 connect 时定位） */
  projectPath?: string;
  /** 测试步骤 */
  steps: TestStep[];
  /** 报告根目录（默认 miniprogram/tests/reports/） */
  reportsRoot?: string;
  /** 时间戳子目录（默认自动生成） */
  timestamp?: string;
  /** 步骤间稳定等待（ms）默认 500 */
  settleMs?: number;
  /** 启动后稳定等待（ms），默认 1500 */
  startupSettleMs?: number;
  /** AI 校验失败是否中断流程（默认 false，继续执行） */
  failFast?: boolean;
}

export interface RunE2EResult {
  report: E2EReport;
  paths: ReportPaths;
}

/* ==================== 工具函数 ==================== */

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 把 selector 解析为完整页面路径（导出以便测试）
 *  - 已经是 /pages/... 形式则原样返回
 *  - 否则按 page 名拼装
 */
export function selectorToPagePath(
  selector: string | undefined,
  page: string
): string {
  if (!selector) {
    return '/pages/' + page + '/index';
  }
  if (selector.startsWith('/pages/')) {
    return selector;
  }
  if (selector.startsWith('pages/')) {
    return '/' + selector;
  }
  // 简短 id
  if (selector.indexOf('/') === -1) {
    return '/pages/' + page + '/' + selector;
  }
  return selector;
}

function resolveReportsRoot(given?: string): string {
  if (given && fs.existsSync(given)) return given;
  // 默认：本文件位于 miniprogram/tests/e2e/index.ts
  //       reports 位于 miniprogram/tests/reports/
  const candidate = path.join(__dirname, '..', 'reports');
  if (!fs.existsSync(candidate)) {
    fs.mkdirSync(candidate, { recursive: true });
  }
  return candidate;
}

/* ==================== 步骤执行器 ==================== */

interface AutomatorClient {
  /** 获取当前 page */
  page: AutomatorPage | null;
  /** 重新启动到某个页面路径（pages/index） */
  reLaunch(pagePath: string): Promise<AutomatorPage>;
  /** 跳转到新页面（保留当前页） */
  navigateTo(pagePath: string): Promise<AutomatorPage>;
  /** 替换当前页 */
  redirectTo(pagePath: string): Promise<AutomatorPage>;
  /** 返回上一页 */
  navigateBack(): Promise<AutomatorPage>;
  /** 等待 */
  wait(ms: number): Promise<void>;
  /** 关闭连接 */
  close(): Promise<void>;
}

interface StepContext {
  page: AutomatorPage | null;
  client: AutomatorClient;
  screenshotsDir: string;
  validator: AiValidator;
  settleMs: number;
  failFast: boolean;
}

/**
 * 执行单个步骤并返回 TestResult
 */
async function executeStep(
  step: TestStep,
  ctx: StepContext
): Promise<TestResult> {
  const start = Date.now();
  let pageForShot: AutomatorPage | null = null;
  let errorMsg: string | null = null;

  try {
    // 1) 执行动作
    switch (step.action) {
      case 'reLaunch': {
        const pagePath = selectorToPagePath(step.selector, step.page);
        pageForShot = await ctx.client.reLaunch(pagePath);
        break;
      }
      case 'navigateTo': {
        const pagePath = selectorToPagePath(step.selector, step.page);
        pageForShot = await ctx.client.navigateTo(pagePath);
        break;
      }
      case 'redirectTo': {
        const pagePath = selectorToPagePath(step.selector, step.page);
        pageForShot = await ctx.client.redirectTo(pagePath);
        break;
      }
      case 'navigateBack': {
        pageForShot = await ctx.client.navigateBack();
        break;
      }
      case 'tap': {
        if (!ctx.page) {
          throw new Error('当前无活动页面，无法 tap');
        }
        // 简易实现：miniprogram-automator 提供 page.$().tap()
        const el = await (ctx.page as any).$?.(step.selector);
        if (!el) {
          throw new Error('未找到元素: ' + step.selector);
        }
        await el.tap();
        pageForShot = ctx.page;
        break;
      }
      case 'waitFor': {
        const ms = step.waitMs || 500;
        await ctx.client.wait(ms);
        pageForShot = ctx.page;
        break;
      }
      case 'screenshot': {
        pageForShot = ctx.page;
        break;
      }
      default:
        throw new Error('未实现的 action: ' + step.action);
    }

    // 2) 等待稳定
    const waitMs = step.waitMs || ctx.settleMs;
    if (waitMs > 0) {
      await sleep(waitMs);
    }

    if (!pageForShot) {
      throw new Error('步骤未产生可用 page 用于截图');
    }

    // 3) 截图
    const shot = await captureScreenshot(pageForShot, {
      outDir: ctx.screenshotsDir,
      step: step.step,
      name: step.name
    });

    // 4) AI 校验
    let aiResult: Awaited<ReturnType<AiValidator['validate']>> | null = null;
    if (!step.skipAi) {
      aiResult = await ctx.validator.validate(
        shot.absolutePath,
        step.aiPrompt
      );
      if (!aiResult.pass && ctx.failFast) {
        errorMsg =
          'AI 校验失败 (failFast=true): ' + aiResult.issues.join('; ');
      }
    }

    return {
      step: step.step,
      page: step.page,
      action: step.action,
      name: step.name,
      screenshot: shot.relativePath,
      aiResult: aiResult,
      duration: Date.now() - start,
      error: errorMsg
    };
  } catch (err) {
    const msg = (err as Error).message || String(err);
    return {
      step: step.step,
      page: step.page,
      action: step.action,
      name: step.name,
      screenshot: '',
      aiResult: null,
      duration: Date.now() - start,
      error: msg
    };
  }
}

/* helper is exported above as `selectorToPagePath` */

/* ==================== 客户端工厂 ==================== */

/**
 * 懒加载创建 miniprogram-automator 客户端
 * 避免在未安装依赖时（仅做类型引用）报错
 */
async function createClient(
  wsEndpoint: string,
  projectPath?: string
): Promise<AutomatorClient> {
  // 使用 require 让 jest 在缺包时不立即崩，便于报告错误
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const automatorPkg: any = (() => {
    try {
      return require('miniprogram-automator');
    } catch (e) {
      throw new Error(
        '未安装 miniprogram-automator，请先执行 npm install -D miniprogram-automator: ' +
          ((e as Error).message || String(e))
      );
    }
  })();

  const launchOptions: Record<string, unknown> = {
    wsEndpoint: wsEndpoint
  };
  if (projectPath) {
    launchOptions.projectPath = projectPath;
  }
  const mini = await automatorPkg.connect(launchOptions);

  let currentPage: AutomatorPage | null = null;
  const updateCurrent = async (): Promise<AutomatorPage> => {
    const p = await mini.currentPage();
    currentPage = p as AutomatorPage;
    return currentPage;
  };

  return {
    get page() {
      return currentPage;
    },
    reLaunch: async (pagePath: string) => {
      await mini.reLaunch({ url: pagePath });
      return updateCurrent();
    },
    navigateTo: async (pagePath: string) => {
      await mini.navigateTo({ url: pagePath });
      return updateCurrent();
    },
    redirectTo: async (pagePath: string) => {
      await mini.redirectTo({ url: pagePath });
      return updateCurrent();
    },
    navigateBack: async () => {
      await mini.navigateBack();
      return updateCurrent();
    },
    wait: (ms: number) => sleep(ms),
    close: () => mini.close()
  };
}

/* ==================== 主入口 ==================== */

export async function runE2E(options: RunE2EOptions): Promise<RunE2EResult> {
  if (!options.wsEndpoint) {
    throw new Error('runE2E: wsEndpoint is required');
  }
  if (!options.steps || options.steps.length === 0) {
    throw new Error('runE2E: steps must be a non-empty array');
  }

  const reportsRoot = resolveReportsRoot(options.reportsRoot);
  const timestamp =
    options.timestamp || formatTimestamp(new Date());
  const paths = createReportPaths(reportsRoot, timestamp);
  const screenshotsDir = makeScreenshotDir(paths.dir);

  // 启动
  const client = await createClient(
    options.wsEndpoint,
    options.projectPath
  );
  const validator = new AiValidator();
  const startedAt = Date.now();

  const results: TestResult[] = [];
  try {
    // 启动后整体稳定
    if (options.startupSettleMs && options.startupSettleMs > 0) {
      await sleep(options.startupSettleMs);
    }

    for (const step of options.steps) {
      const result = await executeStep(step, {
        page: client.page,
        client: client,
        screenshotsDir: screenshotsDir,
        validator: validator,
        settleMs: options.settleMs || 500,
        failFast: options.failFast || false
      });
      results.push(result);

      if (result.error && options.failFast) {
        break;
      }
    }
  } finally {
    try {
      await client.close();
    } catch {
      // 忽略关闭错误
    }
  }

  const report = buildReport(startedAt, results);
  writeJsonReport(report, paths);
  writeHtmlReport(report, paths);
  updateLatestSymlink(reportsRoot, paths.dir);

  return { report, paths };
}

function formatTimestamp(d: Date): string {
  // 2026-06-01T10-30-00
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    d.getFullYear() +
    '-' +
    pad(d.getMonth() + 1) +
    '-' +
    pad(d.getDate()) +
    '_' +
    pad(d.getHours()) +
    '-' +
    pad(d.getMinutes()) +
    '-' +
    pad(d.getSeconds())
  );
}

/* ==================== 导出 ==================== */

export { AiValidator } from './ai-validator';
export {
  captureScreenshot,
  makeScreenshotDir,
  AutomatorPage
} from './screenshot';
export {
  createReportPaths,
  writeJsonReport,
  writeHtmlReport,
  buildReport
} from './reporter';
export * from './types';
