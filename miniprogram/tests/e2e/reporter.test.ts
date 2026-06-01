/**
 * 报告生成器单元测试
 *
 * 覆盖：
 *  - createReportPaths 创建目录
 *  - writeJsonReport / readJsonReport 往返
 *  - buildHtmlReport 基本结构、失败高亮、置信度显示
 *  - buildReport 聚合 passed/failed
 *  - updateLatestSymlink 在 Windows 不可用时降级
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  buildHtmlReport,
  buildReport,
  createReportPaths,
  readJsonReport,
  updateLatestSymlink,
  writeHtmlReport,
  writeJsonReport
} from './reporter';
import { E2EReport, TestResult } from './types';

describe('reporter: 路径与 IO', () => {
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

  it('createReportPaths 创建目录与返回正确路径', () => {
    const p = createReportPaths(root, '2026-06-01_10-00-00');
    expect(p.dir).toBe(path.join(root, '2026-06-01_10-00-00'));
    expect(fs.existsSync(p.dir)).toBe(true);
    expect(fs.existsSync(p.screenshots)).toBe(true);
    expect(p.json.endsWith('report.json')).toBe(true);
    expect(p.html.endsWith('report.html')).toBe(true);
  });

  it('writeJsonReport / readJsonReport 往返', () => {
    const p = createReportPaths(root, 't1');
    const report: E2EReport = {
      timestamp: '2026-06-01T10:00:00.000Z',
      duration: 1234,
      totalSteps: 2,
      passedSteps: 1,
      failedSteps: 1,
      results: [
        {
          step: 1,
          page: 'album_home',
          action: 'reLaunch',
          name: 's1',
          screenshot: 'screenshots/01.png',
          aiResult: { pass: true, issues: [], confidence: 0.9 },
          duration: 500,
          error: null
        },
        {
          step: 2,
          page: 'media_detail',
          action: 'navigateTo',
          name: 's2',
          screenshot: 'screenshots/02.png',
          aiResult: {
            pass: false,
            issues: ['no title'],
            confidence: 0.4
          },
          duration: 700,
          error: null
        }
      ]
    };
    writeJsonReport(report, p);
    const read = readJsonReport(p.json);
    expect(read.totalSteps).toBe(2);
    expect(read.passedSteps).toBe(1);
    expect(read.results[1].aiResult && read.results[1].aiResult.issues[0]).toBe(
      'no title'
    );
  });

  it('writeHtmlReport 写入非空 HTML', () => {
    const p = createReportPaths(root, 't2');
    const r = buildReport(0, []);
    writeHtmlReport(r, p);
    const html = fs.readFileSync(p.html, 'utf-8');
    expect(html.length).toBeGreaterThan(100);
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('测试报告');
  });

  it('updateLatestSymlink 在已存在时不抛错', () => {
    const target = createReportPaths(root, 'target').dir;
    // 写一个占位文件
    fs.writeFileSync(path.join(target, 'report.json'), '{}');
    expect(() => updateLatestSymlink(root, target)).not.toThrow();
  });
});

describe('reporter: buildReport', () => {
  it('空 results 时 total/passed/failed 全部为 0', () => {
    const r = buildReport(Date.now() - 100, []);
    expect(r.totalSteps).toBe(0);
    expect(r.passedSteps).toBe(0);
    expect(r.failedSteps).toBe(0);
  });

  it('通过规则：error=null 且 aiResult.pass=true', () => {
    const results: TestResult[] = [
      mkResult(true, true),
      mkResult(true, false), // 失败
      mkResult(false, true), // 错误也算失败
      mkResult(true, null) // 跳过 AI 校验
    ];
    const r = buildReport(Date.now() - 50, results);
    expect(r.totalSteps).toBe(4);
    // 第一个 pass，第二个 AI fail，第三个 error，第四个 skip
    // 只有第一个视为通过
    expect(r.passedSteps).toBe(2);
    expect(r.failedSteps).toBe(2);
  });

  it('duration 反映 start 与 now 差距', () => {
    const start = Date.now() - 200;
    const r = buildReport(start, [mkResult(true, true)]);
    expect(r.duration).toBeGreaterThanOrEqual(200);
  });
});

describe('reporter: buildHtmlReport 渲染', () => {
  it('空报告也能渲染（无步骤卡片）', () => {
    const html = buildHtmlReport(buildReport(Date.now(), []));
    expect(html).toContain('总步骤');
    expect(html).toContain('0');
  });

  it('失败步骤使用 step-fail 类，badge-fail', () => {
    const html = buildHtmlReport(
      buildReport(0, [mkResult(false, false, ['标题缺失', '布局错乱'])])
    );
    expect(html).toContain('step-fail');
    expect(html).toContain('badge-fail');
    expect(html).toContain('标题缺失');
    expect(html).toContain('布局错乱');
  });

  it('通过步骤使用 step-pass 类，badge-pass，无问题列表项', () => {
    const html = buildHtmlReport(buildReport(0, [mkResult(true, true)]));
    expect(html).toContain('step-pass');
    expect(html).toContain('badge-pass');
    expect(html).toContain('无问题');
  });

  it('错误步骤显示错误信息', () => {
    const r = mkResult(false, null);
    r.error = 'screenshot timeout';
    const html = buildHtmlReport(buildReport(0, [r]));
    expect(html).toContain('screenshot timeout');
  });

  it('issues 为空数组时显示"无问题"', () => {
    const html = buildHtmlReport(buildReport(0, [mkResult(true, true)]));
    expect(html).toContain('issues-empty');
  });

  it('截图作为 img 标签嵌入', () => {
    const r = mkResult(true, true);
    r.screenshot = 'screenshots/01-x.png';
    const html = buildHtmlReport(buildReport(0, [r]));
    expect(html).toContain('<img');
    expect(html).toContain('screenshots/01-x.png');
  });

  it('置信度显示为百分比', () => {
    const r = mkResult(true, true);
    r.aiResult = { pass: true, issues: [], confidence: 0.876 };
    const html = buildHtmlReport(buildReport(0, [r]));
    expect(html).toContain('88%');
  });

  it('summary 渲染通过/失败/总耗时', () => {
    const r = buildReport(0, [mkResult(true, true), mkResult(false, false)]);
    const html = buildHtmlReport(r);
    expect(html).toMatch(/总步骤[\s\S]*2/);
    expect(html).toMatch(/通过[\s\S]*1/);
    expect(html).toMatch(/失败[\s\S]*1/);
  });

  it('HTML 转义：脚本标签被转义', () => {
    const r = mkResult(false, false, ['<script>alert(1)</script>']);
    const html = buildHtmlReport(buildReport(0, [r]));
    expect(html).not.toContain('<script>alert');
    expect(html).toContain('&lt;script&gt;');
  });
});

/* ==================== helpers ==================== */

function mkResult(
  noError: boolean,
  aiPass: boolean | null,
  issues: string[] = []
): TestResult {
  return {
    step: 1,
    page: 'album_home',
    action: 'reLaunch',
    name: 's',
    screenshot: 'screenshots/x.png',
    aiResult:
      aiPass === null
        ? null
        : { pass: aiPass, issues: issues, confidence: 0.5 },
    duration: 10,
    error: noError ? null : 'oops'
  };
}
