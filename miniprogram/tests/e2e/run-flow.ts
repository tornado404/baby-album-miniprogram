/**
 * Flow 执行器
 *
 * 提供 runFlow() 入口：接受 FlowStep[]，顺序执行每个步骤的 action，
 * 在每个步骤后截图、调用 AI 校验、写入 Reporter。
 *
 * 这是 album-flow.spec.ts 与 index.ts 之间的中间层。
 */

import { join } from 'path';
import { FlowContext, FlowStep, MiniProgramAutomator } from './album-flow-types';
import { ScreenshotTaker, AutomatorPage } from './screenshot';
import { AIValidator } from './ai-validator';
import { Reporter } from './reporter';
import { StepResult, AIValidationRequest } from './types';

/* ==================== 配置 ==================== */

export interface RunFlowOptions {
  automator: MiniProgramAutomator;
  steps: FlowStep[];
  /** 报告根目录，默认 miniprogram/tests/reports/ */
  reportsRoot?: string;
  /** runId，默认时间戳 */
  runId?: string;
  /** 每步稳定等待 ms（覆盖 ScreenshotTaker 默认值） */
  stableMs?: number;
  /** 任意步骤失败时是否中断，默认 false */
  failFast?: boolean;
}

export interface RunFlowResult {
  report: import('./types').E2EReport;
  paths: { json: string; html: string; dir: string; screenshots: string };
}

/* ==================== 工具函数 ==================== */

function defaultTimestamp(): string {
  const d = new Date();
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

function resolveReportsRoot(given?: string): string {
  const candidate = given || join(process.cwd(), 'miniprogram', 'tests', 'reports');
  return candidate;
}

/* ==================== runFlow ==================== */

export async function runFlow(opts: RunFlowOptions): Promise<RunFlowResult> {
  if (!opts.automator) throw new Error('runFlow: automator is required');
  if (!opts.steps || opts.steps.length === 0) {
    throw new Error('runFlow: steps must be a non-empty array');
  }

  const reportsRoot = resolveReportsRoot(opts.reportsRoot);
  const runId = opts.runId || defaultTimestamp();
  const reporter = new Reporter({
    outputDir: reportsRoot,
    runId: runId
  });
  const screenshot = new ScreenshotTaker(opts.automator);
  const validator = new AIValidator();

  const ctx: FlowContext = {
    automator: opts.automator,
    screenshot: screenshot,
    validator: validator,
    reporter: reporter,
    page: opts.automator.page
  };

  for (let i = 0; i < opts.steps.length; i++) {
    const step = opts.steps[i];
    const stepNum = step.step || i + 1;
    const stepStart = Date.now();
    let status: StepResult['status'] = 'pass';
    let errorMsg: string | undefined;

    // 1) 执行 action
    try {
      await step.action(ctx);
    } catch (err) {
      status = 'error';
      errorMsg = (err as Error).message || String(err);
      if (opts.failFast) {
        // 构造一个失败 step 记录并立即 finalize
        const result: StepResult = {
          step: stepNum,
          page: step.page,
          action: 'action',
          status: 'error',
          name: step.name,
          error: errorMsg,
          durationMs: Date.now() - stepStart
        };
        reporter.addResult(result);
        break;
      }
    }

    // 2) 截图
    let shot: import('./screenshot').ScreenshotResult | null = null;
    try {
      shot = await screenshot.take({
        step: stepNum,
        page: step.page,
        action: 'screenshot',
        outputDir: join(reportsRoot, runId, 'screenshots'),
        waitForStable: opts.stableMs
      });
      // 收集 base64 用于 HTML 内嵌
      reporter.addScreenshotBase64(stepNum, shot.buffer.toString('base64'));
    } catch (err) {
      status = 'error';
      errorMsg = (err as Error).message || String(err);
    }

    // 3) AI 校验
    let aiResult: StepResult['aiResult'];
    if (status === 'pass' && !step.skipAI && shot) {
      const aiReq: AIValidationRequest = {
        screenshot: shot.meta,
        expectations: step.expectations,
        context: { page: step.page }
      };
      try {
        aiResult = await validator.validate(aiReq);
        if (!aiResult.pass) {
          status = 'fail';
        }
      } catch (err) {
        // 校验抛错也算 fail
        aiResult = {
          pass: false,
          issues: ['AI 校验异常: ' + ((err as Error).message || String(err))],
          confidence: 0,
          latencyMs: 0,
          cached: false
        };
        status = 'error';
      }
    } else if (step.skipAI) {
      status = 'skip';
    }

    // 4) 累积结果
    const result: StepResult = {
      step: stepNum,
      page: step.page,
      action: 'screenshot',
      status: status,
      name: step.name,
      screenshot: shot ? shot.meta : undefined,
      aiResult: aiResult,
      error: errorMsg,
      durationMs: Date.now() - stepStart
    };
    reporter.addResult(result);

    if ((status === 'error' || status === 'fail') && opts.failFast) {
      break;
    }
  }

  // 5) finalize
  const { report, jsonPath, htmlPath } = await reporter.finalize();
  return {
    report: report,
    paths: reporter.getPaths()
  };
}
