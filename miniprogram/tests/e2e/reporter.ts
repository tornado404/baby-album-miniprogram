/**
 * 测试报告生成器
 *
 * 遵循设计文档第 7 节：
 *  - JSON 报告（机器可读）
 *  - HTML 报告（人工审查）
 *
 * HTML 报告特性：
 *  - 概览（通过/失败数、耗时）
 *  - 每个步骤：截图 + AI 判断 + 问题列表
 *  - 失败步骤高亮
 *  - 截图点击放大
 */

import * as fs from 'fs';
import * as path from 'path';
import { E2EReport, ReportPaths, TestResult } from './types';

/* ==================== 路径生成 ==================== */

/**
 * 创建报告目录结构，返回关键路径
 */
export function createReportPaths(
  reportsRoot: string,
  timestamp: string
): ReportPaths {
  const dir = path.join(reportsRoot, timestamp);
  const screenshots = path.join(dir, 'screenshots');
  for (const p of [dir, screenshots]) {
    if (!fs.existsSync(p)) {
      fs.mkdirSync(p, { recursive: true });
    }
  }
  return {
    dir: dir,
    json: path.join(dir, 'report.json'),
    html: path.join(dir, 'report.html'),
    screenshots: screenshots
  };
}

/**
 * 写一个 'latest' 软链接/副本，方便最近报告查看
 */
export function updateLatestSymlink(reportsRoot: string, targetDir: string): void {
  const latest = path.join(reportsRoot, 'latest');
  // Windows 下 fs.symlinkSync 需要管理员权限；改为复制 index.html/json 兜底
  if (fs.existsSync(latest)) {
    try {
      const stat = fs.lstatSync(latest);
      if (stat.isSymbolicLink() || stat.isDirectory()) {
        fs.rmSync(latest, { recursive: true, force: true });
      }
    } catch {
      // 忽略
    }
  }
  try {
    fs.symlinkSync(targetDir, latest, 'dir');
  } catch {
    // 在 Windows 无权限时降级为目录副本
    copyDirRecursive(targetDir, latest);
  }
}

function copyDirRecursive(src: string, dst: string): void {
  if (!fs.existsSync(src)) return;
  if (!fs.existsSync(dst)) fs.mkdirSync(dst, { recursive: true });
  for (const name of fs.readdirSync(src)) {
    const s = path.join(src, name);
    const d = path.join(dst, name);
    const stat = fs.statSync(s);
    if (stat.isDirectory()) {
      copyDirRecursive(s, d);
    } else {
      fs.copyFileSync(s, d);
    }
  }
}

/* ==================== JSON 报告 ==================== */

export function writeJsonReport(
  report: E2EReport,
  paths: ReportPaths
): void {
  fs.writeFileSync(paths.json, JSON.stringify(report, null, 2), 'utf-8');
}

export function readJsonReport(jsonPath: string): E2EReport {
  const raw = fs.readFileSync(jsonPath, 'utf-8');
  return JSON.parse(raw) as E2EReport;
}

/* ==================== HTML 报告 ==================== */

function escapeHtml(s: string): string {
  return (s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildSummary(report: E2EReport): string {
  const passRate =
    report.totalSteps > 0
      ? Math.round((report.passedSteps / report.totalSteps) * 100)
      : 0;
  const overallClass =
    report.failedSteps === 0 ? 'summary-pass' : 'summary-fail';
  const overallText = report.failedSteps === 0 ? '全部通过' : '存在失败';

  return [
    '<div class="summary ' + overallClass + '">',
    '  <div class="summary-row">',
    '    <div class="summary-cell">',
    '      <div class="big">' + escapeHtml(String(report.totalSteps)) + '</div>',
    '      <div class="label">总步骤</div>',
    '    </div>',
    '    <div class="summary-cell pass">',
    '      <div class="big">' + escapeHtml(String(report.passedSteps)) + '</div>',
    '      <div class="label">通过</div>',
    '    </div>',
    '    <div class="summary-cell fail">',
    '      <div class="big">' + escapeHtml(String(report.failedSteps)) + '</div>',
    '      <div class="label">失败</div>',
    '    </div>',
    '    <div class="summary-cell">',
    '      <div class="big">' + passRate + '%</div>',
    '      <div class="label">通过率</div>',
    '    </div>',
    '    <div class="summary-cell">',
    '      <div class="big">' + formatDuration(report.duration) + '</div>',
    '      <div class="label">总耗时</div>',
    '    </div>',
    '    <div class="summary-cell">',
    '      <div class="big">' + escapeHtml(overallText) + '</div>',
    '      <div class="label">总评</div>',
    '    </div>',
    '  </div>',
    '  <div class="summary-meta">',
    '    <span>时间：' + escapeHtml(report.timestamp) + '</span>',
    '  </div>',
    '</div>'
  ].join('\n');
}

function formatDuration(ms: number): string {
  if (ms < 1000) return ms + 'ms';
  const s = Math.floor(ms / 1000);
  if (s < 60) return s + 's';
  const m = Math.floor(s / 60);
  const rs = s % 60;
  return m + 'm' + rs + 's';
}

function buildStepCard(result: TestResult): string {
  const ai = result.aiResult;
  const pass =
    result.error === null && (ai === null || ai.pass === true);
  const cardClass = pass ? 'step-card step-pass' : 'step-card step-fail';
  const badge = pass
    ? '<span class="badge badge-pass">PASS</span>'
    : '<span class="badge badge-fail">FAIL</span>';

  const issuesHtml =
    ai && ai.issues && ai.issues.length > 0
      ? '<ul class="issues">' +
        ai.issues
          .map(s => '<li>' + escapeHtml(s) + '</li>')
          .join('') +
        '</ul>'
      : '<div class="issues-empty">无问题</div>';

  const errHtml = result.error
    ? '<div class="error">错误：' + escapeHtml(result.error) + '</div>'
    : '';

  const confidence =
    ai && typeof ai.confidence === 'number'
      ? (ai.confidence * 100).toFixed(0) + '%'
      : '-';

  return [
    '<div class="' + cardClass + '">',
    '  <div class="step-header">',
    '    <span class="step-num">#' + result.step + '</span>',
    '    ' + badge,
    '    <span class="step-name">' + escapeHtml(result.name) + '</span>',
    '    <span class="step-page">' + escapeHtml(result.page) + '</span>',
    '    <span class="step-action">' + escapeHtml(result.action) + '</span>',
    '    <span class="step-duration">' + formatDuration(result.duration) + '</span>',
    '  </div>',
    '  <div class="step-body">',
    '    <div class="step-screenshot">',
    '      <a href="' + escapeHtml(result.screenshot) + '" target="_blank">',
    '        <img src="' + escapeHtml(result.screenshot) + '" alt="screenshot" />',
    '      </a>',
    '    </div>',
    '    <div class="step-ai">',
    '      <div class="ai-row"><strong>AI 置信度：</strong>' + escapeHtml(confidence) + '</div>',
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
    '.summary-pass{border-left:4px solid #16a34a}',
    '.summary-fail{border-left:4px solid #dc2626}',
    '.summary-meta{margin-top:12px;font-size:12px;color:#666}',
    '.step-card{background:#fff;border-radius:10px;margin-bottom:16px;box-shadow:0 2px 6px rgba(0,0,0,.05);overflow:hidden}',
    '.step-pass{border-left:4px solid #16a34a}',
    '.step-fail{border-left:4px solid #dc2626;background:#fff7f7}',
    '.step-header{display:flex;align-items:center;gap:12px;padding:12px 16px;background:#fafafa;border-bottom:1px solid #eee;font-size:14px}',
    '.step-num{font-weight:700;color:#555;font-family:monospace}',
    '.step-name{font-weight:600;flex:1}',
    '.step-page{color:#666;font-size:12px;background:#eef;padding:2px 8px;border-radius:4px}',
    '.step-action{color:#666;font-size:12px;background:#efe;padding:2px 8px;border-radius:4px}',
    '.step-duration{color:#999;font-size:12px}',
    '.badge{display:inline-block;padding:2px 10px;border-radius:12px;font-size:12px;font-weight:700}',
    '.badge-pass{background:#dcfce7;color:#15803d}',
    '.badge-fail{background:#fee2e2;color:#b91c1c}',
    '.step-body{display:flex;gap:16px;padding:16px;flex-wrap:wrap}',
    '.step-screenshot{flex:0 0 360px;max-width:100%}',
    '.step-screenshot img{width:360px;max-width:100%;border:1px solid #eee;border-radius:6px;cursor:zoom-in;display:block}',
    '.step-ai{flex:1;min-width:280px;font-size:13px;line-height:1.6}',
    '.ai-row{margin-bottom:8px}',
    '.issues{margin:6px 0 0 20px;padding:0}',
    '.issues li{color:#b91c1c;margin-bottom:4px}',
    '.issues-empty{color:#999;font-style:italic;padding-left:4px}',
    '.error{color:#b91c1c;background:#fee2e2;padding:8px;border-radius:4px;margin-top:8px;font-family:monospace;font-size:12px}',
    'footer{padding:24px;text-align:center;color:#999;font-size:12px}'
  ].join('');
}

export function buildHtmlReport(report: E2EReport): string {
  const styles = buildStyles();
  const summary = buildSummary(report);
  const cards = report.results.map(buildStepCard).join('\n');
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
    '  <footer>Generated by miniprogram-e2e · 报告基于 AI 视觉判断</footer>',
    '</body>',
    '</html>'
  ].join('\n');
}

export function writeHtmlReport(
  report: E2EReport,
  paths: ReportPaths
): void {
  const html = buildHtmlReport(report);
  fs.writeFileSync(paths.html, html, 'utf-8');
}

/* ==================== 报告聚合 ==================== */

/**
 * 创建一个新的 report 对象，并按 results 累加 passed/failed
 */
export function buildReport(
  startedAt: number,
  results: TestResult[]
): E2EReport {
  const passed = results.filter(
    r => r.error === null && (r.aiResult === null || r.aiResult.pass)
  ).length;
  return {
    timestamp: new Date().toISOString(),
    duration: Date.now() - startedAt,
    totalSteps: results.length,
    passedSteps: passed,
    failedSteps: results.length - passed,
    results: results
  };
}
