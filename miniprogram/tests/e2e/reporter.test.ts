/**
 * 报告生成器单元测试
 *
 * 覆盖：
 *  - Reporter.addResult / finalize
 *  - createReportPaths / writeJsonReport / readJsonReport
 *  - buildHtmlReport 基本结构 + status 渲染 + 转义
 *  - E2EReport meta 字段
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  Reporter,
  createReportPaths,
  readJsonReport,
  writeJsonReport,
  buildHtmlReport,
  buildReport
} from './reporter';
import { StepResult, E2EReport } from './types';

describe('reporter: Reporter 类', () => {
  let root: string;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'rep-'));
  });
  afterEach(() => {
    try {
      fs.rmSync(root, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it('addResult + finalize 写出 JSON + HTML', async () => {
    const r = new Reporter({ outputDir: root, runId: 'r1' });
    r.addResult(mkResult('pass'));
    r.addResult(mkResult('fail'));
    const { jsonPath, htmlPath, report } = await r.finalize();
    expect(fs.existsSync(jsonPath)).toBe(true);
    expect(fs.existsSync(htmlPath)).toBe(true);
    expect(report.totalSteps).toBe(2);
    expect(report.passedSteps).toBe(1);
    expect(report.failedSteps).toBe(1);
    expect(report.meta.modelName).toBeDefined();
    expect(report.meta.aiMode).toBeDefined();
    expect(report.meta.cliVersion).toBeDefined();
  });

  it('addScreenshotBase64 注入到 HTML', async () => {
    const r = new Reporter({ outputDir: root, runId: 'r2' });
    r.addResult(mkResult('pass'));
    r.addScreenshotBase64(1, 'AABBCC');
    const { htmlPath } = await r.finalize();
    const html = fs.readFileSync(htmlPath, 'utf-8');
    expect(html).toContain('data:image/png;base64,AABBCC');
  });

  it('buildReport 聚合 pass/fail/skip/error 数量', () => {
    const r = new Reporter({ outputDir: root, runId: 'r3' });
    r.addResult(mkResult('pass'));
    r.addResult(mkResult('pass'));
    r.addResult(mkResult('fail'));
    r.addResult(mkResult('skip'));
    r.addResult(mkResult('error'));
    const report = r.buildReport();
    expect(report.totalSteps).toBe(5);
    expect(report.passedSteps).toBe(2);
    expect(report.failedSteps).toBe(2); // fail + error
    expect(report.skippedSteps).toBe(1);
  });

  it('所有结果 cached 时 aiMode 调整为 cached', async () => {
    const r = new Reporter({ outputDir: root, runId: 'r4' });
    r.addResult(mkResult('pass', { cached: true }));
    r.addResult(mkResult('pass', { cached: true }));
    const { report } = await r.finalize();
    expect(report.meta.aiMode).toBe('cached');
  });

  it('finalize 自定义 aiMode 生效', async () => {
    const r = new Reporter({ outputDir: root, runId: 'r5' });
    r.addResult(mkResult('pass'));
    const { report } = await r.finalize({ aiMode: 'skipped' });
    expect(report.meta.aiMode).toBe('skipped');
  });

  it('getPaths 返回正确路径', () => {
    const r = new Reporter({ outputDir: root, runId: 'r6' });
    const p = r.getPaths();
    expect(p.dir).toBe(path.join(root, 'r6'));
    expect(p.json).toBe(path.join(root, 'r6', 'report.json'));
    expect(p.html).toBe(path.join(root, 'r6', 'report.html'));
    expect(p.screenshots).toBe(path.join(root, 'r6', 'screenshots'));
  });
});

describe('reporter: IO 函数', () => {
  let root: string;
  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'rep2-'));
  });
  afterEach(() => {
    try {
      fs.rmSync(root, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it('createReportPaths 创建目录', () => {
    const p = createReportPaths(root, '2026-06-01_10-00-00');
    expect(p.dir).toBe(path.join(root, '2026-06-01_10-00-00'));
    expect(fs.existsSync(p.dir)).toBe(true);
    expect(fs.existsSync(p.screenshots)).toBe(true);
  });

  it('writeJsonReport / readJsonReport 往返', () => {
    const p = createReportPaths(root, 't1');
    const r: E2EReport = {
      timestamp: '2026-06-01T10:00:00.000Z',
      duration: 1234,
      totalSteps: 1,
      passedSteps: 1,
      failedSteps: 0,
      skippedSteps: 0,
      results: [mkResult('pass')],
      meta: { cliVersion: '0.0.0', modelName: 'glm-4v', aiMode: 'real' }
    };
    writeJsonReport(r, p);
    const back = readJsonReport(p.json);
    expect(back.results[0].status).toBe('pass');
    expect(back.meta.modelName).toBe('glm-4v');
  });
});

describe('reporter: buildHtmlReport 渲染', () => {
  it('空报告也能渲染', () => {
    const r: E2EReport = {
      timestamp: '2026-06-01T10:00:00.000Z',
      duration: 0,
      totalSteps: 0,
      passedSteps: 0,
      failedSteps: 0,
      skippedSteps: 0,
      results: [],
      meta: { cliVersion: '0.0.0', modelName: 'glm-4v', aiMode: 'skipped' }
    };
    const html = buildHtmlReport(r);
    expect(html).toContain('总步骤');
    expect(html).toContain('0');
    expect(html).toContain('skipped');
  });

  it('失败步骤 step-fail，置信度条', () => {
    const r: E2EReport = {
      timestamp: '',
      duration: 0,
      totalSteps: 1,
      passedSteps: 0,
      failedSteps: 1,
      skippedSteps: 0,
      results: [mkResult('fail', { confidence: 0.3 }, ['标题缺失'])],
      meta: { cliVersion: '0.0.0', modelName: 'glm-4v', aiMode: 'real' }
    };
    const html = buildHtmlReport(r);
    expect(html).toContain('step-fail');
    expect(html).toContain('badge-fail');
    expect(html).toContain('conf-fill');
    expect(html).toContain('标题缺失');
  });

  it('通过步骤 step-pass + 置信度条', () => {
    const r: E2EReport = {
      timestamp: '',
      duration: 0,
      totalSteps: 1,
      passedSteps: 1,
      failedSteps: 0,
      skippedSteps: 0,
      results: [mkResult('pass', { confidence: 0.95 })],
      meta: { cliVersion: '0.0.0', modelName: 'glm-4v', aiMode: 'real' }
    };
    const html = buildHtmlReport(r);
    expect(html).toContain('step-pass');
    expect(html).toContain('badge-pass');
    expect(html).toContain('95%');
  });

  it('HTML 转义：脚本标签被转义', () => {
    const r: E2EReport = {
      timestamp: '',
      duration: 0,
      totalSteps: 1,
      passedSteps: 0,
      failedSteps: 1,
      skippedSteps: 0,
      results: [mkResult('fail', {}, ['<script>alert(1)</script>'])],
      meta: { cliVersion: '0.0.0', modelName: 'glm-4v', aiMode: 'real' }
    };
    const html = buildHtmlReport(r);
    expect(html).not.toContain('<script>alert');
    expect(html).toContain('&lt;script&gt;');
  });

  it('screenshotBase64 内嵌到 img src', () => {
    const r: E2EReport = {
      timestamp: '',
      duration: 0,
      totalSteps: 1,
      passedSteps: 1,
      failedSteps: 0,
      skippedSteps: 0,
      results: [mkResult('pass')],
      meta: { cliVersion: '0.0.0', modelName: 'glm-4v', aiMode: 'real' }
    };
    const m = new Map<number, string>();
    m.set(1, 'XYZ123');
    const html = buildHtmlReport(r, m);
    expect(html).toContain('data:image/png;base64,XYZ123');
  });
});

describe('reporter: buildReport 向后兼容', () => {
  it('空 results', () => {
    const r = buildReport(Date.now() - 100, []);
    expect(r.totalSteps).toBe(0);
    expect(r.passedSteps).toBe(0);
    expect(r.skippedSteps).toBe(0);
  });

  it('聚合 pass/fail/skip/error', () => {
    const r = buildReport(0, [
      mkResult('pass'),
      mkResult('fail'),
      mkResult('skip'),
      mkResult('error')
    ]);
    expect(r.totalSteps).toBe(4);
    expect(r.passedSteps).toBe(1);
    expect(r.failedSteps).toBe(2);
    expect(r.skippedSteps).toBe(1);
  });
});

/* ==================== helpers ==================== */

function mkResult(
  status: 'pass' | 'fail' | 'skip' | 'error',
  aiOpts: { confidence?: number; cached?: boolean } = { confidence: 0.5, cached: false },
  issues: string[] = []
): StepResult {
  return {
    step: 1,
    page: 'album_home',
    action: 'reLaunch',
    status: status,
    name: 's',
    screenshot: {
      step: 1,
      page: 'album_home',
      action: 'reLaunch',
      filePath: 'screenshots/01.png',
      sha256: 'a'.repeat(64),
      takenAt: Date.now(),
      width: 100,
      height: 200
    },
    aiResult:
      status === 'skip'
        ? undefined
        : {
            pass: status === 'pass',
            issues: issues,
            confidence: aiOpts.confidence || 0.5,
            latencyMs: 100,
            cached: aiOpts.cached || false
          },
    durationMs: 10
  };
}
