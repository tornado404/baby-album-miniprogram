/**
 * 截图工具模块
 *
 * 封装 miniprogram-automator 的截图能力。
 * 微信开发者工具自带截图 API（page.screenshot()），无需 Puppeteer。
 *
 * 特性：
 *  - 自动等待页面数据稳定后截图（设计文档第 10 节）
 *  - 输出文件名按步骤编号自动生成
 *  - 路径相对于 reports/screenshots/
 */

import * as fs from 'fs';
import * as path from 'path';

/* ==================== 截图接口 ==================== */

/**
 * miniprogram-automator 暴露的 Page 接口最小子集
 * 避免直接 import 类型以减少耦合
 */
export interface AutomatorPage {
  /** 当前页面路径 */
  path: string;
  /** 截图，返回 Buffer */
  screenshot(options?: { type?: 'png' | 'jpeg' }): Promise<Buffer>;
  /** 等待直到 selector 出现 */
  waitFor(selector: string, timeout?: number): Promise<unknown>;
  /** 获取页面数据 */
  data(): Promise<Record<string, unknown>>;
}

export interface ScreenshotOptions {
  /** 截图文件输出目录（默认 reports/screenshots/） */
  outDir: string;
  /** 文件名前缀（默认 'step'） */
  prefix?: string;
  /** 步骤序号（用于生成文件名） */
  step: number;
  /** 步骤名称（用于生成文件名） */
  name: string;
  /** 截图前等待元素出现（可选） */
  waitForSelector?: string;
  /** 截图前额外等待时间（ms），让数据稳定 */
  settleMs?: number;
  /** 等待元素超时（ms），默认 5000 */
  waitTimeoutMs?: number;
}

export interface ScreenshotResult {
  /** 截图文件绝对路径 */
  absolutePath: string;
  /** 相对于 reports/ 的路径（用于报告展示） */
  relativePath: string;
  /** 文件大小（bytes） */
  size: number;
}

/* ==================== 核心实现 ==================== */

/**
 * 等待指定毫秒
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 文件名安全字符替换
 */
function sanitize(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9_一-龥-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 60);
}

/**
 * 给定页面与选项，截图并保存到磁盘
 */
export async function captureScreenshot(
  page: AutomatorPage,
  options: ScreenshotOptions
): Promise<ScreenshotResult> {
  if (!page) {
    throw new Error('captureScreenshot: page is required');
  }
  if (!options || options.step === undefined) {
    throw new Error('captureScreenshot: options.step is required');
  }

  const outDir = options.outDir;
  // 确保目录存在
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const prefix = options.prefix || 'step';
  const stepStr = String(options.step).padStart(2, '0');
  const fileName =
    prefix +
    '-' +
    stepStr +
    '-' +
    sanitize(options.name || 'screenshot') +
    '.png';
  const absolutePath = path.join(outDir, fileName);

  // 1. 可选：等待元素出现
  if (options.waitForSelector) {
    const timeout = options.waitTimeoutMs || 5000;
    try {
      await page.waitFor(options.waitForSelector, timeout);
    } catch (err) {
      // 不抛错，继续截图，把错误记录到 reporter
      // 但需要让上层感知
      throw new Error(
        '等待元素 ' +
          options.waitForSelector +
          ' 超时: ' +
          ((err as Error).message || String(err))
      );
    }
  }

  // 2. 等待页面数据稳定（设计文档：避免加载中状态）
  const settleMs = options.settleMs === undefined ? 500 : options.settleMs;
  if (settleMs > 0) {
    await sleep(settleMs);
  }

  // 3. 截图
  const buffer = await page.screenshot({ type: 'png' });
  fs.writeFileSync(absolutePath, buffer);

  // 4. 计算相对于 reports/ 的路径
  const reportsRoot = findReportsRoot(outDir);
  const relativePath = reportsRoot
    ? path.relative(reportsRoot, absolutePath).split(path.sep).join('/')
    : fileName;

  return {
    absolutePath: absolutePath,
    relativePath: relativePath,
    size: buffer.length
  };
}

/**
 * 向上查找 reports 目录
 */
function findReportsRoot(start: string): string | null {
  let current = path.resolve(start);
  for (let i = 0; i < 6; i++) {
    if (path.basename(current) === 'reports') {
      return current;
    }
    const parent = path.dirname(current);
    if (parent === current) {
      return null;
    }
    current = parent;
  }
  return null;
}

/* ==================== 辅助函数 ==================== */

/**
 * 清理指定目录的所有 PNG 截图（用于新一轮测试前）
 */
export function cleanScreenshots(outDir: string): void {
  if (!fs.existsSync(outDir)) {
    return;
  }
  const files = fs.readdirSync(outDir);
  for (const f of files) {
    if (/\.(png|jpe?g)$/i.test(f)) {
      try {
        fs.unlinkSync(path.join(outDir, f));
      } catch {
        // 忽略
      }
    }
  }
}

/**
 * 在 miniprogram/tests/reports/<timestamp>/screenshots 下创建截图目录
 */
export function makeScreenshotDir(reportsDir: string): string {
  const dir = path.join(reportsDir, 'screenshots');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}
