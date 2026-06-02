/**
 * 首屏访问与内容读取 - 基础自动化测试
 *
 * 目标：
 *   1. 访问小程序首屏（album_home）
 *   2. 读取页面数据（data）
 *   3. 查询关键 DOM 元素并提取文本内容
 *   4. 获取媒体列表信息
 *   5. 截图保存
 *   6. 生成结构化报告（JSON）
 *
 * ===== miniprogram-automator API 使用说明 =====
 * MiniProgram (mp):
 *   - mp.reLaunch(url) → Page | undefined
 *   - mp.navigateTo(url) → Page | undefined
 *   - mp.currentPage() → Page | undefined
 *   - mp.screenshot() → string (base64)
 *   注意：MiniProgram 没有 .page 属性
 *
 * Page:
 *   - page.data() → any
 *   - page.$(selector) → Element | null
 *   - page.$$(selector) → Element[]
 *   注意：Page 没有 .screenshot() 方法
 *
 * 运行方式：
 *   npm run test:first-screen:auto
 *
 * 前置条件：
 *   微信开发者工具已安装，E2E_AUTO_LAUNCH=1 自动启动
 */

import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

/* ==================== 类型定义 ==================== */

interface AlbumHomeData {
  currentBabyId: string;
  currentBaby: { id: string; name: string; birthDate: string } | null;
  babies: Array<{ id: string; name: string; birthDate: string }>;
  mediaList: Array<{ id: string; title?: string; url?: string; thumbnailUrl?: string; captureDate?: string }>;
  viewMode: string;
  isLoading: boolean;
  isEmpty: boolean;
  isAuthorized: boolean;
  hasMore: boolean;
  page: number;
  pageSize: number;
  uploaderVisible: boolean;
  [key: string]: unknown;
}

interface ElementProbe {
  selector: string;
  description: string;
  exists: boolean;
  text?: string | null;
}

interface ScreenReport {
  timestamp: string;
  pagePath: string;
  data: Partial<AlbumHomeData>;
  elements: ElementProbe[];
  mediaCount: number;
  screenshotPaths: string[];
  summary: {
    hasBaby: boolean;
    hasMedia: boolean;
    isAuthorized: boolean;
    isEmpty: boolean;
    viewMode: string;
  };
}

/* ==================== 工具函数 ==================== */

const REPORTS_DIR = join(process.cwd(), 'miniprogram', 'tests', 'reports', 'first-screen');

function timestamp(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) +
    '_' + pad(d.getHours()) + '-' + pad(d.getMinutes()) + '-' + pad(d.getSeconds());
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function extractPageData(raw: Record<string, unknown>): Partial<AlbumHomeData> {
  const fields: Array<keyof AlbumHomeData> = [
    'currentBabyId', 'currentBaby', 'babies', 'mediaList',
    'viewMode', 'isLoading', 'isEmpty', 'isAuthorized',
    'hasMore', 'page', 'pageSize', 'uploaderVisible'
  ];
  const result: Partial<AlbumHomeData> = {};
  for (const f of fields) {
    if (raw[f] !== undefined) (result as any)[f] = raw[f];
  }
  return result;
}

/* ==================== 测试套件 ==================== */

describe('首屏访问与内容读取', () => {
  jest.setTimeout(120000);

  let mp: any;       // MiniProgram 实例
  let page: any;     // Page 实例（当前页面）
  let report: ScreenReport;
  let outputDir: string;

  beforeAll(async () => {
    mp = (global as any).__AUTOMATOR__;
    if (!mp) {
      throw new Error(
        '未建立 automator 连接。请运行：npm run test:first-screen:auto\n' +
        '或确保：1) 开发者工具已启动 2) 服务端口已开启'
      );
    }

    const runId = 'first-screen_' + timestamp();
    outputDir = join(REPORTS_DIR, runId);
    if (!existsSync(outputDir)) mkdirSync(outputDir, { recursive: true });

    report = {
      timestamp: new Date().toISOString(),
      pagePath: '',
      data: {},
      elements: [],
      mediaCount: 0,
      screenshotPaths: [],
      summary: { hasBaby: false, hasMedia: false, isAuthorized: false, isEmpty: false, viewMode: 'unknown' }
    };
  });

  afterAll(() => {
    const reportPath = join(outputDir, 'screen-report.json');
    writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf-8');
    console.log('[first-screen] 报告已保存: ' + reportPath);
  });

  /* -------- 测试 1：导航 -------- */

  test('1. 导航到 album_home 首屏', async () => {
    page = await mp.reLaunch('/pages/album_home/album_home');
    await sleep(2000);
    if (!page) page = await mp.currentPage();

    report.pagePath = page ? page.path : 'unknown';
    console.log('[first-screen] 页面路径: ' + report.pagePath);
    expect(report.pagePath).toContain('album_home');
  });

  /* -------- 测试 2：读取页面数据 -------- */

  test('2. 读取页面数据', async () => {
    expect(page).toBeTruthy();

    const raw = await page.data();
    report.data = extractPageData(raw);

    const d = report.data;
    report.summary = {
      hasBaby: Boolean(d.currentBaby),
      hasMedia: Array.isArray(d.mediaList) && d.mediaList.length > 0,
      isAuthorized: d.isAuthorized === true,
      isEmpty: d.isEmpty === true,
      viewMode: d.viewMode || 'unknown'
    };
    report.mediaCount = Array.isArray(d.mediaList) ? d.mediaList.length : 0;

    // 基础断言
    expect(typeof d.isAuthorized).toBe('boolean');
    expect(typeof d.viewMode).toBe('string');
    expect(Array.isArray(d.mediaList)).toBe(true);

    // 控制台输出
    console.log('[first-screen] ===== 页面数据摘要 =====');
    console.log('[first-screen] 授权状态:', d.isAuthorized);
    console.log('[first-screen] 视图模式:', d.viewMode);
    console.log('[first-screen] 当前宝宝:', d.currentBaby?.name || '未选择');
    console.log('[first-screen] 媒体数量:', report.mediaCount);
    console.log('[first-screen] 空状态:', d.isEmpty);
    console.log('[first-screen] 更多:', d.hasMore);
  });

  /* -------- 测试 3：DOM 元素探测 -------- */

  test('3. 探测 DOM 元素', async () => {
    expect(page).toBeTruthy();

    const selectors: Array<{ selector: string; description: string }> = [
      { selector: '.nav-bar', description: '顶部导航栏' },
      { selector: '.nav-bar-title', description: '导航栏标题' },
      { selector: '.baby-selector', description: '宝宝选择器' },
      { selector: '.baby-selector-value', description: '当前宝宝名称' },
      { selector: 'age-filter', description: '月龄筛选组件' },
      { selector: '.media-content', description: '媒体内容区域' },
      { selector: '.masonry-view', description: '瀑布流视图' },
      { selector: 'masonry-layout', description: '瀑布流布局组件' },
      { selector: '.masonry-item', description: '瀑布流媒体卡片' },
      { selector: '.media-title', description: '媒体标题' },
      { selector: '.media-date', description: '媒体日期' },
      { selector: '.loading-container', description: '加载中状态' },
      { selector: '.empty-container', description: '空状态' },
      { selector: '.upload-btn', description: '上传按钮' },
      { selector: '.upload-btn-text', description: '上传按钮文字' },
      { selector: '.auth-tip', description: '授权提示' },
      { selector: '.no-more', description: '没有更多提示' },
    ];

    const probes: ElementProbe[] = [];
    for (const s of selectors) {
      const probe: ElementProbe = { selector: s.selector, description: s.description, exists: false };
      try {
        const el = await page.$(s.selector);
        if (el) {
          probe.exists = true;
          try { probe.text = await el.text(); } catch { /* ignore */ }
        }
      } catch { /* ignore */ }
      probes.push(probe);

      const icon = probe.exists ? '✓' : '✗';
      let info = '  ' + icon + ' ' + s.description + ' (' + s.selector + ')';
      if (probe.text) info += ' → "' + probe.text.slice(0, 50) + '"';
      console.log(info);
    }

    report.elements = probes;

    // 核心 UI 元素应存在
    const navBar = probes.find(e => e.selector === '.nav-bar');
    const uploadBtn = probes.find(e => e.selector === '.upload-btn');
    expect(navBar?.exists).toBe(true);
    expect(uploadBtn?.exists).toBe(true);
  });

  /* -------- 测试 4：媒体列表 -------- */

  test('4. 读取媒体列表内容', async () => {
    const mediaList = report.data.mediaList;
    if (Array.isArray(mediaList) && mediaList.length > 0) {
      console.log('[first-screen] 媒体列表共 ' + mediaList.length + ' 条');
      const preview = mediaList.slice(0, 3);
      for (let i = 0; i < preview.length; i++) {
        const m = preview[i];
        console.log('  [' + (i + 1) + '] id=' + m.id + ' title="' + (m.title || '无标题') + '" date=' + (m.captureDate || ''));
        expect(m.id).toBeTruthy();
      }
    } else {
      console.log('[first-screen] 媒体列表为空（正常状态）');
    }
  });

  /* -------- 测试 5：截图 -------- */

  test('5. 截图保存', async () => {
    // MiniProgram.screenshot() 返回 base64 字符串
    // 注意：如果 DevTools 窗口不可见可能挂起，用 Promise.race 超时
    console.log('[first-screen] 正在截图，请确保开发者工具窗口可见...');

    const timeout = (ms: number) => new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('截图超时 ' + ms + 'ms')), ms)
    );

    const ss1 = await Promise.race([mp.screenshot(), timeout(15000)]) as string;
    const buf1 = Buffer.from(ss1, 'base64');
    const file1 = join(outputDir, '01-album-home.png');
    writeFileSync(file1, buf1);
    report.screenshotPaths.push(file1);
    console.log('[first-screen] 截图 1: ' + (buf1.length / 1024).toFixed(1) + ' KB');

    await sleep(500);
    const ss2 = await Promise.race([mp.screenshot(), timeout(15000)]) as string;
    const buf2 = Buffer.from(ss2, 'base64');
    const file2 = join(outputDir, '02-album-home-stable.png');
    writeFileSync(file2, buf2);
    report.screenshotPaths.push(file2);
    console.log('[first-screen] 截图 2（稳定后）: ' + (buf2.length / 1024).toFixed(1) + ' KB');

    expect(report.screenshotPaths.length).toBe(2);
    expect(buf1.length).toBeGreaterThan(1024);
  });

  /* -------- 测试 6：报告完整性 -------- */

  test('6. 报告完整性检查', async () => {
    expect(report.pagePath).toBeTruthy();
    expect(report.elements.length).toBeGreaterThan(0);
    expect(report.timestamp).toBeTruthy();
    expect(report.mediaCount).toBeGreaterThanOrEqual(0);

    const existCount = report.elements.filter(e => e.exists).length;
    console.log('[first-screen] ===== 最终摘要 =====');
    console.log('[first-screen] 页面: ' + report.pagePath);
    console.log('[first-screen] 元素: ' + existCount + '/' + report.elements.length + ' 存在');
    console.log('[first-screen] 媒体: ' + report.mediaCount + ' 条');
    console.log('[first-screen] 截图: ' + report.screenshotPaths.length + ' 张');
    console.log('[first-screen] 报告: ' + join(outputDir, 'screen-report.json'));
  });
});