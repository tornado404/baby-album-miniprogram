/**
 * 截图工具单元测试
 *
 * 覆盖：
 *  - ScreenshotTaker.take() 元数据 + 文件落盘
 *  - SHA-256 计算
 *  - waitForStable() 双帧相同算法
 *  - 错误路径
 *  - 便捷函数 captureScreenshot
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  ScreenshotTaker,
  captureScreenshot,
  cleanScreenshots,
  makeScreenshotDir,
  AutomatorPage
} from './screenshot';

const PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

describe('screenshot: ScreenshotTaker', () => {
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

  function fakePage(buf: Buffer, pagePath = '/pages/album_home/index'): AutomatorPage {
    return {
      path: pagePath,
      screenshot: jest.fn(async () => buf),
      waitFor: jest.fn(async () => undefined),
      data: jest.fn(async () => ({}))
    };
  }

  it('take() 写入 PNG 并返回 meta + buffer', async () => {
    const buf = Buffer.from(PNG_BASE64, 'base64');
    const taker = new ScreenshotTaker({ page: fakePage(buf) });
    const r = await taker.take({
      step: 1,
      page: 'album_home',
      action: 'reLaunch',
      outputDir: tmpDir,
      waitForStable: 0
    });
    expect(r.buffer.length).toBe(buf.length);
    expect(r.meta.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(r.meta.filePath).toMatch(/^01-album_home-reLaunch\.png$/);
    expect(r.meta.takenAt).toBeGreaterThan(0);
    const written = path.join(tmpDir, r.meta.filePath);
    expect(fs.existsSync(written)).toBe(true);
  });

  it('take() outputDir 不存在时自动创建', async () => {
    const nested = path.join(tmpDir, 'a', 'b');
    const taker = new ScreenshotTaker({
      page: fakePage(Buffer.from(PNG_BASE64, 'base64'))
    });
    const r = await taker.take({
      step: 1,
      page: 'p',
      action: 'tap',
      outputDir: nested,
      waitForStable: 0
    });
    expect(fs.existsSync(nested)).toBe(true);
    expect(fs.existsSync(path.join(nested, r.meta.filePath))).toBe(true);
  });

  it('take() waitForSelector 抛错时冒泡', async () => {
    const page: AutomatorPage = {
      path: 'x',
      screenshot: jest.fn(async () => Buffer.from(PNG_BASE64, 'base64')),
      waitFor: jest.fn(async () => {
        throw new Error('timeout');
      }),
      data: jest.fn(async () => ({}))
    };
    const taker = new ScreenshotTaker({ page: page });
    await expect(
      taker.take({
        step: 1,
        page: 'p',
        action: 'tap',
        outputDir: tmpDir,
        waitForStable: 0,
        waitForSelector: '.foo',
        selectorTimeoutMs: 50
      })
    ).rejects.toThrow(/等待元素 \.foo 超时/);
  });

  it('take() 缺 step 抛错', async () => {
    const taker = new ScreenshotTaker({
      page: fakePage(Buffer.from(PNG_BASE64, 'base64'))
    });
    await expect(
      taker.take({
        page: 'p',
        action: 'tap',
        outputDir: tmpDir
      // step missing
      } as any)
    ).rejects.toThrow(/step/);
  });

  it('take() page 不可用抛错', async () => {
    const taker = new ScreenshotTaker({ page: null as any });
    await expect(
      taker.take({ step: 1, page: 'p', action: 'tap', outputDir: tmpDir })
    ).rejects.toThrow(/page/);
  });

  it('waitForStable 连续两帧相同时立即返回', async () => {
    const sameBuf = Buffer.from(PNG_BASE64, 'base64');
    const page: AutomatorPage = {
      path: 'x',
      screenshot: jest.fn(async () => sameBuf),
      waitFor: jest.fn(),
      data: jest.fn()
    };
    const taker = new ScreenshotTaker({ page: page });
    const start = Date.now();
    await taker.waitForStable(page, 3000, 100);
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(1000);
  });

  it('waitForStable 超时仅警告不报错', async () => {
    let i = 0;
    const page: AutomatorPage = {
      path: 'x',
      screenshot: jest.fn(async () => {
        // 每次返回不同 buffer
        i++;
        return Buffer.from('frame' + i);
      }),
      waitFor: jest.fn(),
      data: jest.fn()
    };
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const taker = new ScreenshotTaker({ page: page });
    // 用非常短的超时
    await taker.waitForStable(page, 300, 80);
    warn.mockRestore();
    // 不应抛错
  });
});

describe('screenshot: 辅助函数', () => {
  it('cleanScreenshots 仅删除图片', () => {
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

  it('makeScreenshotDir 创建子目录', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mks-'));
    const out = makeScreenshotDir(dir);
    expect(out).toBe(path.join(dir, 'screenshots'));
    expect(fs.existsSync(out)).toBe(true);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('captureScreenshot 便捷函数返回正确字段', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cap-'));
    const page: AutomatorPage = {
      path: 'x',
      screenshot: jest.fn(async () => Buffer.from(PNG_BASE64, 'base64')),
      waitFor: jest.fn(),
      data: jest.fn()
    };
    const r = await captureScreenshot(page, {
      outDir: dir,
      step: 1,
      name: '测试'
    });
    expect(r.relativePath).toMatch(/^01-.*\.png$/);
    expect(fs.existsSync(r.absolutePath)).toBe(true);
    fs.rmSync(dir, { recursive: true, force: true });
  });
});
