/**
 * 截图工具 - 类模式
 *
 * 按 architect §2.2.2：ScreenshotTaker 类
 *  - take()        截图并返回 ScreenshotResult（含 buffer + meta）
 *  - waitForStable() 稳定判定（连续 2 帧 SHA-256 相同即稳定）
 *
 * 关键算法（§3.2.2）：
 *   while (Date.now() - start < timeoutMs) {
 *     const buf = await page.screenshot();
 *     const hash = sha256(buf);
 *     if (hash === lastHash) stableCount++; else stableCount = 0;
 *     if (stableCount >= 2) return;
 *     await sleep(200);
 *   }
 */

import { createHash } from 'crypto';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { ScreenshotMeta } from './types';

/* ==================== 接口 ==================== */

/**
 * miniprogram-automator Page 接口的最小子集
 * （避免直接 import 类型以减少耦合）
 */
export interface AutomatorPage {
  path: string;
  screenshot(options?: { type?: 'png' | 'jpeg' }): Promise<Buffer>;
  waitFor(selector: string, timeout?: number): Promise<unknown>;
  data(): Promise<Record<string, unknown>>;
}

/**
 * ScreenshotTaker 构造时使用的 automator 句柄
 * 实际是 miniprogram-automator 的 MiniProgramAutomator 实例
 * 这里只取需要的 page / close 部分
 */
export interface AutomatorLike {
  page: AutomatorPage;
  close?(): Promise<void>;
}

export interface ScreenshotOptions {
  step: number;
  page: string;
  action: string;
  /** 绝对路径 */
  outputDir: string;
  /** 稳定等待 ms，默认 600 */
  waitForStable?: number;
  /** 跨整页截图（仅记录，不强制支持） */
  fullPage?: boolean;
  /** 截图前等待的选择器（可选） */
  waitForSelector?: string;
  /** 选择器等待超时 ms，默认 5000 */
  selectorTimeoutMs?: number;
}

export interface ScreenshotResult {
  meta: ScreenshotMeta;
  buffer: Buffer;
}

/* ==================== 工具函数 ==================== */

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function sha256(buf: Buffer): string {
  return createHash('sha256').update(buf).digest('hex');
}

function safeFileName(name: string): string {
  return (
    (name || 'screenshot')
      .replace(/[^a-zA-Z0-9_一-龥-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .substring(0, 60) || 'screenshot'
  );
}

/**
 * 简单解析 PNG 的宽高（取 IHDR 头 16-23 字节）。
 * 注：miniprogram-automator screenshot 默认 1170×2532（iPhone 14 Pro 模拟器）。
 * 这里仅做 best-effort 解析，失败返回 0×0。
 */
function parsePngSize(buf: Buffer): { width: number; height: number } {
  // PNG signature: 89 50 4E 47 0D 0A 1A 0A
  if (buf.length < 24) return { width: 0, height: 0 };
  if (
    buf[0] !== 0x89 ||
    buf[1] !== 0x50 ||
    buf[2] !== 0x4e ||
    buf[3] !== 0x47
  ) {
    return { width: 0, height: 0 };
  }
  // IHDR: width(4) + height(4) at offset 16
  const width = buf.readUInt32BE(16);
  const height = buf.readUInt32BE(20);
  return { width, height };
}

/* ==================== ScreenshotTaker ==================== */

export class ScreenshotTaker {
  constructor(private automator: AutomatorLike) {}

  /**
   * 主动作：截图并落盘，返回 meta + buffer
   */
  public async take(opts: ScreenshotOptions): Promise<ScreenshotResult> {
    if (!opts || opts.step === undefined) {
      throw new Error('ScreenshotTaker.take: opts.step is required');
    }
    const page = this.automator.page;
    if (!page) {
      throw new Error('ScreenshotTaker.take: automator.page is not available');
    }

    // 1) 等待稳定
    const stableMs = opts.waitForStable === undefined ? 600 : opts.waitForStable;
    if (stableMs > 0) {
      await this.waitForStable(page, stableMs);
    }

    // 2) 可选：等待元素
    if (opts.waitForSelector) {
      const timeout = opts.selectorTimeoutMs || 5000;
      try {
        await page.waitFor(opts.waitForSelector, timeout);
      } catch (err) {
        throw new Error(
          '等待元素 ' +
            opts.waitForSelector +
            ' 超时: ' +
            ((err as Error).message || String(err))
        );
      }
    }

    // 3) 截图
    const buffer = await page.screenshot({ type: 'png' });

    // 4) 元数据
    const { width, height } = parsePngSize(buffer);
    const hash = sha256(buffer);
    const fileName =
      String(opts.step).padStart(2, '0') +
      '-' +
      safeFileName(opts.page) +
      '-' +
      safeFileName(opts.action) +
      '.png';
    // outputDir 指向 screenshots 子目录（run-flow.ts 传 join(reportsRoot, runId, 'screenshots')）
    // 因此 filePath 仅含文件名，HTML 通过 addScreenshotBase64(step, base64) 内嵌图片
    const filePath = fileName;
    const absPath = join(opts.outputDir, fileName);

    // 5) 落盘
    await mkdir(opts.outputDir, { recursive: true });
    await writeFile(absPath, buffer);

    const meta: ScreenshotMeta = {
      step: opts.step,
      page: opts.page,
      action: opts.action,
      filePath: filePath,
      sha256: hash,
      takenAt: Date.now(),
      width: width,
      height: height
    };

    return { meta, buffer };
  }

  /**
   * 稳定判定：连续 2 帧 SHA-256 相同即认为稳定
   * 超时不报错，仅记录 warning（实现为 console.warn，不影响测试结果）
   */
  public async waitForStable(
    page: AutomatorPage,
    timeoutMs = 5000,
    intervalMs = 200
  ): Promise<void> {
    const start = Date.now();
    let lastHash = '';
    let stableCount = 0;

    while (Date.now() - start < timeoutMs) {
      let hash = '';
      try {
        const buf = await page.screenshot({ type: 'png' });
        hash = sha256(buf);
      } catch (err) {
        // 截图本身失败时不阻塞流程
        if (typeof console !== 'undefined' && console.warn) {
          console.warn('[ScreenshotTaker] waitForStable: 截图失败', err);
        }
        await sleep(intervalMs);
        continue;
      }

      if (hash && hash === lastHash) {
        stableCount++;
        if (stableCount >= 2) {
          return;
        }
      } else {
        stableCount = 0;
        lastHash = hash;
      }
      await sleep(intervalMs);
    }
    // 超时：警告但不抛错
    if (typeof console !== 'undefined' && console.warn) {
      console.warn(
        '[ScreenshotTaker] waitForStable: 超时 ' + timeoutMs + 'ms 后页面仍未稳定'
      );
    }
  }

  /** 关闭底层 automator 句柄（如有） */
  public async close(): Promise<void> {
    if (this.automator && typeof this.automator.close === 'function') {
      await this.automator.close();
    }
  }
}

/* ==================== 便捷函数（向后兼容） ==================== */

export async function captureScreenshot(
  page: AutomatorPage,
  options: {
    outDir: string;
    prefix?: string;
    step: number;
    name: string;
    waitForSelector?: string;
    settleMs?: number;
    waitTimeoutMs?: number;
  }
): Promise<{
  absolutePath: string;
  relativePath: string;
  size: number;
}> {
  const taker = new ScreenshotTaker({ page: page });
  const r = await taker.take({
    step: options.step,
    page: options.prefix || 'unknown',
    action: options.name,
    outputDir: options.outDir,
    waitForStable: options.settleMs
  });
  return {
    absolutePath: join(options.outDir, r.meta.filePath),
    relativePath: r.meta.filePath,
    size: r.buffer.length
  };
}

export function makeScreenshotDir(reportsDir: string): string {
  const dir = join(reportsDir, 'screenshots');
  // 同步版本，避免 import 循环
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const fsSync = require('fs');
  if (!fsSync.existsSync(dir)) {
    fsSync.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

export function cleanScreenshots(outDir: string): void {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const fsSync = require('fs');
  if (!fsSync.existsSync(outDir)) return;
  for (const f of fsSync.readdirSync(outDir)) {
    if (/\.(png|jpe?g)$/i.test(f)) {
      try {
        fsSync.unlinkSync(join(outDir, f));
      } catch {
        // ignore
      }
    }
  }
}
