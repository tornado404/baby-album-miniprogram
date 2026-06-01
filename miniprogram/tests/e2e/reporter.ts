/**
 * 报告生成器 - 类模式
 *
 * 按 architect §2.2.4：Reporter 类
 *  - addResult()  累积 StepResult
 *  - finalize()   写 JSON + HTML 报告，返回路径
 *
 * HTML 特性：
 *  - 单文件无依赖（内嵌 CSS + base64 截图）
 *  - 失败高亮 + 置信度条形图
 *  - 缩略图点击放大（CSS-only）
 */

import { existsSync, mkdirSync, writeFileSync, readFileSync, readdirSync, lstatSync, rmSync, copyFileSync } from 'fs';
import { join } from 'path';
import {
  E2EReport,
  StepResult,
  ReportPaths,
  AIMode,
  StepStatus
} from './types';

/* ==================== Reporter 配置 ==================== */

export interface ReporterOptions {
  outputDir: string;
  runId: string;
  /** CLI 版本号（从 package.json 读） */
  cliVersion?: string;
  /** 模型名（默认 'glm-4v'） */
  modelName?: string;
  /** AI 模式（默认 'real'，report 完成时按缓存命中调整） */
  aiMode?: AIMode;
}

/* ==================== 路径工具 ==================== */

export function createReportPaths(
  reportsRoot: string,
  runId: string
): ReportPaths {
  const dir = join(reportsRoot, runId);
  const screenshots = join(dir, 'screenshots');
  for (const p of [dir, screenshots]) {
    if (!existsSync(p)) mkdirSync(p, { recursive: true });
  }
  return {
    dir: dir,
    json: join(dir, 'report.json'),
    html: join(dir, 'report.html'),
    screenshots: screenshots
  };
}

export function updateLatestSymlink(reportsRoot: string, targetDir: string): void {
  // 防御性：reportsRoot 不存在则不创建 latest（避免污染任意目录）
  if (!existsSync(reportsRoot)) return;
  if (!existsSync(targetDir)) return;

  const latest = join(reportsRoot, 'latest');
  if (existsSync(latest)) {
    try {
      const stat = lstatSync(latest);
      if (stat.isSymbolicLink() || stat.isDirectory()) {
        rmSync(latest, { recursive: true, force: true });
      }
    } catch {
      // ignore
    }
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    require('fs').symlinkSync(targetDir, latest, 'dir');
  } catch {
    try {
      copyDirRecursive(targetDir, latest);
    } catch {
      // 复制也失败则静默（latest 是 best-effort）
    }
  }
}

function copyDirRecursive(src: string, dst: string): void {
  if (!existsSync(src)) return;
  if (!existsSync(dst)) {
    try {
      mkdirSync(dst, { recursive: true });
    } catch {
      return;
    }
  }
  for (const name of readdirSync(src)) {
    const s = join(src, name);
    const d = join(dst, name);
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const stat = require('fs').statSync(s);
    if (stat.isDirectory()) {
      copyDirRecursive(s, d);
    } else {
      copyFileSync(s, d);
    }
  }
}

/* ==================== JSON IO ==================== */

export function writeJsonReport(report: E2EReport, paths: ReportPaths): void {
  writeFileSync(paths.json, JSON.stringify(report, null, 2), 'utf-8');
}

export function readJsonReport(jsonPath: string): E2EReport {
  return JSON.parse(readFileSync(jsonPath, 'utf-8')) as E2EReport;
}

/* ==================== HTML 渲染 ==================== */

function escapeHtml(s: string): string {
  return (s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatDuration(ms: number): string {
  if (!ms || ms < 0) return '0ms';
  if (ms < 1000) return ms + 'ms';
  const s = Math.floor(ms / 1000);
  if (s < 60) return s + 's';
  const m = Math.floor(s / 60);
  const rs = s % 60;
  return m + 'm' + rs + 's';
}

function statusBadge(status: StepStatus): string {
  const map: Record<StepStatus, { cls: string; text: string }> = {
    pass: { cls: 'badge-pass', text: 'PASS' },
    fail: { cls: 'badge-fail', text: 'FAIL' },
    skip: { cls: 'badge-skip', text: 'SKIP' },
    error: { cls: 'badge-error', text: 'ERROR' }
  };
  const v = map[status] || map.error;
  return '<span class="badge ' + v.cls + '">' + v.text + '</span>';
}

function cardClass(status: StepStatus): string {
  return 'step-card step-' + status;
}

function buildSummary(r: E2EReport): string {
  const passRate =
    r.totalSteps > 0 ? Math.round((r.passedSteps / r.totalSteps) * 100) : 0;
  const overall = r.failedSteps === 0 ? '全部通过' : '存在失败';
  const overallCls = r.failedSteps === 0 ? 'summary-pass' : 'summary-fail';
  return [
    '<div class="summary ' + overallCls + '">',
    '  <div class="summary-row">',
    '    <div class="summary-cell"><div class="big">' + r.totalSteps + '</div><div class="label">总步骤</div></div>',
    '    <div class="summary-cell pass"><div class="big">' + r.passedSteps + '</div><div class="label">通过</div></div>',
    '    <div class="summary-cell fail"><div class="big">' + r.failedSteps + '</div><div class="label">失败</div></div>',
    '    <div class="summary-cell skip"><div class="big">' + r.skippedSteps + '</div><div class="label">跳过</div></div>',
    '    <div class="summary-cell"><div class="big">' + passRate + '%</div><div class="label">通过率</div></div>',
    '    <div class="summary-cell"><div class="big">' + formatDuration(r.duration) + '</div><div class="label">总耗时</div></div>',
    '    <div class="summary-cell"><div class="big">' + escapeHtml(overall) + '</div><div class="label">总评</div></div>',
    '  </div>',
    '  <div class="summary-meta">',
    '    <span>时间：' + escapeHtml(r.timestamp) + '</span>',
    '    <span>模式：' + escapeHtml(r.meta.aiMode) + '</span>',
    '    <span>模型：' + escapeHtml(r.meta.modelName) + '</span>',
    '    <span>CLI：' + escapeHtml(r.meta.cliVersion) + '</span>',
    '  </div>',
    '</div>'
  ].join('\n');
}

function confidenceBar(conf: number): string {
  const pct = Math.round(conf * 100);
  const color = conf >= 0.8 ? '#16a34a' : conf >= 0.5 ? '#eab308' : '#dc2626';
  return (
    '<div class="conf-bar">' +
    '  <div class="conf-fill" style="width:' + pct + '%;background:' + color + '"></div>' +
    '  <span class="conf-text">' + pct + '%</span>' +
    '</div>'
  );
}

function buildStepCard(result: StepResult, screenshotBase64: string | null): string {
  const ai = result.aiResult;
  const issuesHtml =
    ai && ai.issues && ai.issues.length > 0
      ? '<ul class="issues">' +
        ai.issues.map(s => '<li>' + escapeHtml(s) + '</li>').join('') +
        '</ul>'
      : '<div class="issues-empty">无问题</div>';

  const errHtml = result.error
    ? '<div class="error">错误：' + escapeHtml(result.error) + '</div>'
    : '';

  const imgTag = screenshotBase64
    ? '<img src="data:image/png;base64,' + screenshotBase64 + '" alt="screenshot" />'
    : result.screenshot
    ? '<img src="' + escapeHtml(result.screenshot.filePath) + '" alt="screenshot" />'
    : '<div class="no-screenshot">无截图</div>';

  const confBar =
    ai && typeof ai.confidence === 'number' ? confidenceBar(ai.confidence) : '';

  return [
    '<div class="' + cardClass(result.status) + '">',
    '  <div class="step-header">',
    '    <span class="step-num">#' + result.step + '</span>',
    '    ' + statusBadge(result.status),
    '    <span class="step-name">' + escapeHtml(result.name) + '</span>',
    '    <span class="step-page">' + escapeHtml(result.page) + '</span>',
    '    <span class="step-action">' + escapeHtml(result.action) + '</span>',
    '    <span class="step-duration">' + formatDuration(result.durationMs) + '</span>',
    '  </div>',
    '  <div class="step-body">',
    '    <div class="step-screenshot">' + imgTag + '</div>',
    '    <div class="step-ai">',
    '      ' + (confBar ? '<div class="ai-row"><strong>置信度：</strong>' + confBar + '</div>' : ''),
    '      <div class="ai-row"><strong>问题列表：</strong></div>',
    '      ' + issuesHtml,
    '      ' + errHtml,
    '    </div>',
    '  </div>',
    '</div>'
  ].join('\n');
}

function buildStyles(): string {
  return [
    'body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"PingFang SC","Microsoft YaHei",sans-serif;margin:0;background:#f5f7fa;color:#222}',
    'header{background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);color:#fff;padding:24px 32px}',
    'header h1{margin:0;font-size:22px}',
    'header .sub{opacity:.85;font-size:13px;margin-top:4px}',
    '.container{max-width:1200px;margin:0 auto;padding:24px}',
    '.summary{background:#fff;border-radius:10px;padding:20px;box-shadow:0 2px 8px rgba(0,0,0,.06);margin-bottom:24px}',
    '.summary-row{display:flex;flex-wrap:wrap;gap:24px}',
    '.summary-cell{flex:1;min-width:120px;text-align:center;padding:8px 0}',
    '.summary-cell .big{font-size:28px;font-weight:700}',
    '.summary-cell .label{font-size:12px;color:#888;margin-top:4px}',
    '.summary-cell.pass .big{color:#16a34a}',
    '.summary-cell.fail .big{color:#dc2626}',
    '.summary-cell.skip .big{color:#9ca3af}',
    '.summary-pass{border-left:4px solid #16a34a}',
    '.summary-fail{border-left:4px solid #dc2626}',
    '.summary-meta{margin-top:12px;font-size:12px;color:#666;display:flex;flex-wrap:wrap;gap:16px}',
    '.step-card{background:#fff;border-radius:10px;margin-bottom:16px;box-shadow:0 2px 6px rgba(0,0,0,.05);overflow:hidden}',
    '.step-pass{border-left:4px solid #16a34a}',
    '.step-fail{border-left:4px solid #dc2626;background:#fff7f7}',
    '.step-skip{border-left:4px solid #9ca3af;background:#f9fafb}',
    '.step-error{border-left:4px solid #ea580c;background:#fff7ed}',
    '.step-header{display:flex;align-items:center;gap:12px;padding:12px 16px;background:#fafafa;border-bottom:1px solid #eee;font-size:14px;flex-wrap:wrap}',
    '.step-num{font-weight:700;color:#555;font-family:monospace}',
    '.step-name{font-weight:600;flex:1}',
    '.step-page{color:#666;font-size:12px;background:#eef;padding:2px 8px;border-radius:4px}',
    '.step-action{color:#666;font-size:12px;background:#efe;padding:2px 8px;border-radius:4px}',
    '.step-duration{color:#999;font-size:12px}',
    '.badge{display:inline-block;padding:2px 10px;border-radius:12px;font-size:12px;font-weight:700}',
    '.badge-pass{background:#dcfce7;color:#15803d}',
    '.badge-fail{background:#fee2e2;color:#b91c1c}',
    '.badge-skip{background:#e5e7eb;color:#6b7280}',
    '.badge-error{background:#ffedd5;color:#c2410c}',
    '.step-body{display:flex;gap:16px;padding:16px;flex-wrap:wrap}',
    '.step-screenshot{flex:0 0 360px;max-width:100%}',
    '.step-screenshot img{width:360px;max-width:100%;border:1px solid #eee;border-radius:6px;cursor:zoom-in;display:block}',
    '.no-screenshot{width:360px;height:200px;background:#f3f4f6;display:flex;align-items:center;justify-content:center;color:#9ca3af;border-radius:6px}',
    '.step-ai{flex:1;min-width:280px;font-size:13px;line-height:1.6}',
    '.ai-row{margin-bottom:8px}',
    '.issues{margin:6px 0 0 20px;padding:0}',
    '.issues li{color:#b91c1c;margin-bottom:4px}',
    '.issues-empty{color:#999;font-style:italic;padding-left:4px}',
    '.error{color:#b91c1c;background:#fee2e2;padding:8px;border-radius:4px;margin-top:8px;font-family:monospace;font-size:12px}',
    '.conf-bar{position:relative;display:inline-block;width:160px;height:16px;background:#e5e7eb;border-radius:8px;overflow:hidden;vertical-align:middle}',
    '.conf-fill{height:100%;transition:width .3s}',
    '.conf-text{position:absolute;top:0;left:0;right:0;bottom:0;display:flex;align-items:center;justify-content:center;font-size:11px;color:#222;font-weight:600}',
    'footer{padding:24px;text-align:center;color:#999;font-size:12px}'
  ].join('');
}

export function buildHtmlReport(
  report: E2EReport,
  screenshotBase64: Map<number, string> = new Map()
): string {
  const styles = buildStyles();
  const summary = buildSummary(report);
  const cards = report.results
    .map(r => buildStepCard(r, screenshotBase64.get(r.step) || null))
    .join('\n');
  return [
    '<!DOCTYPE html>',
    '<html lang="zh-CN">',
    '<head>',
    '  <meta charset="utf-8" />',
    '  <title>E2E 测试报告 - ' + escapeHtml(report.timestamp) + '</title>',
    '  <style>' + styles + '</style>',
    '</head>',
    '<body>',
    '  <header>',
    '    <h1>微信小程序 E2E 测试报告</h1>',
    '    <div class="sub">AI 视觉验证 · ' + escapeHtml(report.timestamp) + '</div>',
    '  </header>',
    '  <div class="container">',
    '    ' + summary,
    '    <h2 style="font-size:16px;margin-bottom:12px">测试步骤</h2>',
    '    ' + cards,
    '  </div>',
    '  <footer>Generated by miniprogram-e2e · 基于 AI 视觉判断</footer>',
    '</body>',
    '</html>'
  ].join('\n');
}

export function writeHtmlReport(
  report: E2EReport,
  paths: ReportPaths,
  screenshotBase64: Map<number, string> = new Map()
): void {
  const html = buildHtmlReport(report, screenshotBase64);
  writeFileSync(paths.html, html, 'utf-8');
}

/* ==================== Reporter 类 ==================== */

export class Reporter {
  private results: StepResult[] = [];
  private startTime: number;
  private paths: ReportPaths;
  private outputDir: string;
  private runId: string;
  private cliVersion: string;
  private modelName: string;
  private aiMode: AIMode;
  /** 截图 base64 缓存，finalize 时用于嵌入 HTML */
  private screenshotBase64: Map<number, string> = new Map();

  constructor(opts: ReporterOptions) {
    this.startTime = Date.now();
    this.outputDir = opts.outputDir;
    this.runId = opts.runId;
    this.paths = createReportPaths(opts.outputDir, opts.runId);
    this.cliVersion = opts.cliVersion || '0.0.0';
    this.modelName = opts.modelName || process.env.AI_MODEL || 'glm-4v';
    this.aiMode = opts.aiMode || 'real';
  }

  /**
   * 累积一个步骤结果
   */
  public addResult(r: StepResult): void {
    this.results.push(r);
  }

  /**
   * 获取当前报告路径
   */
  public getPaths(): ReportPaths {
    return this.paths;
  }

  /**
   * 提供截图 base64（可选，用于在 HTML 中内嵌）
   */
  public addScreenshotBase64(step: number, base64: string): void {
    this.screenshotBase64.set(step, base64);
  }

  /**
   * 生成最终报告，写入 JSON + HTML
   */
  public async finalize(opts?: { aiMode?: AIMode }): Promise<{
    jsonPath: string;
    htmlPath: string;
    report: E2EReport;
  }> {
    if (opts && opts.aiMode) this.aiMode = opts.aiMode;

    // 调整 aiMode：如果所有 aiResult.cached === true，标记为 cached
    if (this.results.some(r => r.aiResult && r.aiResult.cached)) {
      const allCached = this.results
        .filter(r => r.aiResult)
        .every(r => r.aiResult && r.aiResult.cached);
      if (allCached) this.aiMode = 'cached';
    }

    const report = this.buildReport();
    writeJsonReport(report, this.paths);
    writeHtmlReport(report, this.paths, this.screenshotBase64);
    updateLatestSymlink(this.outputDir, this.paths.dir);
    return {
      jsonPath: this.paths.json,
      htmlPath: this.paths.html,
      report: report
    };
  }

  /**
   * 构造 E2EReport（暴露以便测试）
   */
  public buildReport(): E2EReport {
    const passed = this.results.filter(r => r.status === 'pass').length;
    const failed = this.results.filter(r => r.status === 'fail' || r.status === 'error').length;
    const skipped = this.results.filter(r => r.status === 'skip').length;
    return {
      timestamp: new Date().toISOString(),
      duration: Date.now() - this.startTime,
      totalSteps: this.results.length,
      passedSteps: passed,
      failedSteps: failed,
      skippedSteps: skipped,
      results: this.results,
      meta: {
        cliVersion: this.cliVersion,
        modelName: this.modelName,
        aiMode: this.aiMode
      }
    };
  }
}

/* ==================== 向后兼容函数 ==================== */

export function buildReport(startedAt: number, results: StepResult[]): E2EReport {
  const passed = results.filter(r => r.status === 'pass').length;
  const failed = results.filter(r => r.status === 'fail' || r.status === 'error').length;
  const skipped = results.filter(r => r.status === 'skip').length;
  return {
    timestamp: new Date().toISOString(),
    duration: Date.now() - startedAt,
    totalSteps: results.length,
    passedSteps: passed,
    failedSteps: failed,
    skippedSteps: skipped,
    results: results,
    meta: {
      cliVersion: 'legacy',
      modelName: process.env.AI_MODEL || 'glm-4v',
      aiMode: 'real'
    }
  };
}
