/**
 * 截图工具单元测试
 *
 * 覆盖：
 *  - 目录自动创建
 *  - 文件名安全字符处理
 *  - waitForSelector 路径
 *  - settleMs 等待
 *  - 错误：缺少 step / page
 *  - cleanScreenshots 清理
 *  - makeScreenshotDir 创建子目录
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  captureScreenshot,
  cleanScreenshots,
  makeScreenshotDir,
  AutomatorPage
} from './screenshot';

describe('screenshot: captureScreenshot', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'shot-'));
  });
  afterEach(() => {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  function fakePage(buffer: Buffer, pagePath = '/pages/album_home/index'): AutomatorPage {
    return {
      path: pagePath,
      screenshot: jest.fn(async () => buffer),
      waitFor: jest.fn(async () => undefined),
      data: jest.fn(async () => ({}))
    };
  }

  it('写入 PNG 到指定目录，文件名包含步骤编号', async () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const page = fakePage(png);
    const result = await captureScreenshot(page, {
      outDir: tmpDir,
      step: 3,
      name: '加载相册首页'
    });
    expect(fs.existsSync(result.absolutePath)).toBe(true);
    expect(result.absolutePath).toMatch(/step-03-.*\.png$/);
    expect(result.size).toBe(png.length);
  });

  it('outDir 不存在时自动创建', async () => {
    const nested = path.join(tmpDir, 'a', 'b', 'c');
    const page = fakePage(Buffer.from('x'));
    const result = await captureScreenshot(page, {
      outDir: nested,
      step: 1,
      name: 'x'
    });
    expect(fs.existsSync(nested)).toBe(true);
    expect(fs.existsSync(result.absolutePath)).toBe(true);
  });

  it('waitForSelector 存在时调用 waitFor', async () => {
    const page = fakePage(Buffer.from('x'));
    const waitFor = page.waitFor as jest.Mock;
    await captureScreenshot(page, {
      outDir: tmpDir,
      step: 1,
      name: 'x',
      waitForSelector: '.foo',
      waitTimeoutMs: 100
    });
    expect(waitFor).toHaveBeenCalledWith('.foo', 100);
  });

  it('waitForSelector 抛错时将错误冒泡', async () => {
    const page: AutomatorPage = {
      path: 'x',
      screenshot: jest.fn(async () => Buffer.from('x')),
      waitFor: jest.fn(async () => {
        throw new Error('timeout');
      }),
      data: jest.fn(async () => ({}))
    };
    await expect(
      captureScreenshot(page, {
        outDir: tmpDir,
        step: 1,
        name: 'x',
        waitForSelector: '.foo',
        waitTimeoutMs: 50
      })
    ).rejects.toThrow(/等待元素 \.foo 超时/);
  });

  it('settleMs=0 时不等待', async () => {
    const page = fakePage(Buffer.from('x'));
    const start = Date.now();
    await captureScreenshot(page, {
      outDir: tmpDir,
      step: 1,
      name: 'x',
      settleMs: 0
    });
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(150);
  });

  it('step 缺失时抛错', async () => {
    const page = fakePage(Buffer.from('x'));
    await expect(
      captureScreenshot(page, {
        outDir: tmpDir,
        name: 'x'
      // step missing
      } as any)
    ).rejects.toThrow(/options\.step/);
  });

  it('page 为空时抛错', async () => {
    await expect(
      captureScreenshot(null as any, { outDir: tmpDir, step: 1, name: 'x' })
    ).rejects.toThrow(/page is required/);
  });

  it('relativePath 在 reports 下时使用相对路径', async () => {
    // 构造目录树：tmpDir/reports/run-1/screenshots
    const reportsDir = path.join(tmpDir, 'reports', 'run-1');
    const shotsDir = path.join(reportsDir, 'screenshots');
    fs.mkdirSync(shotsDir, { recursive: true });
    const page = fakePage(Buffer.from('x'));
    const r = await captureScreenshot(page, {
      outDir: shotsDir,
      step: 1,
      name: 'X'
    });
    // 相对路径以 reports/... 开头，包含 screenshots/ 段
    const rel = r.relativePath.replace(/\\/g, '/');
    expect(rel).toMatch(/^run-1\/screenshots\//);
    expect(rel).toMatch(/step-01-X\.png$/);
  });
});

describe('screenshot: 辅助函数', () => {
  it('cleanScreenshots 仅删除 png/jpg', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'clean-'));
    fs.writeFileSync(path.join(dir, 'a.png'), 'x');
    fs.writeFileSync(path.join(dir, 'b.jpg'), 'x');
    fs.writeFileSync(path.join(dir, 'c.txt'), 'x');
    cleanScreenshots(dir);
    expect(fs.existsSync(path.join(dir, 'a.png'))).toBe(false);
    expect(fs.existsSync(path.join(dir, 'b.jpg'))).toBe(false);
    expect(fs.existsSync(path.join(dir, 'c.txt'))).toBe(true);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('cleanScreenshots 目录不存在时静默', () => {
    expect(() =>
      cleanScreenshots(path.join(os.tmpdir(), 'never-exists-xyz'))
    ).not.toThrow();
  });

  it('makeScreenshotDir 创建子目录并返回路径', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mks-'));
    const out = makeScreenshotDir(dir);
    expect(out).toBe(path.join(dir, 'screenshots'));
    expect(fs.existsSync(out)).toBe(true);
    fs.rmSync(dir, { recursive: true, force: true });
  });
});
