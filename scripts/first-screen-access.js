/**
 * 首屏访问与内容读取 - Windows 全自动脚本
 *
 * 不依赖 Jest，可直接用 Node.js 执行。
 * 自动检测并启动微信开发者工具 → 访问首屏 → 读取内容 → 生成报告。
 *
 * ===== miniprogram-automator API 说明 =====
 * MiniProgram 类（connect() 返回值）：
 *   - reLaunch(url) / navigateTo(url) → Promise<Page | undefined>
 *   - currentPage() → Promise<Page | undefined>
 *   - screenshot() → Promise<string> (base64)
 *   - close() → Promise<void>
 *   - pageStack() → Promise<Page[]>
 *   - callWxMethod(method, ...args) → Promise<any>
 *   注意：MiniProgram 没有 .page 属性
 *
 * Page 类：
 *   - data(path?) → Promise<any>  （获取页面 data）
 *   - $(selector) → Promise<Element | null>
 *   - $$(selector) → Promise<Element[]>
 *   - waitFor(condition, timeout?) → Promise<void>
 *   - setData(data) → Promise<void>
 *   注意：Page 没有 .screenshot() 方法
 *
 * Element 类：
 *   - text() → Promise<string>
 *   - attr(name) → Promise<string>
 *   - data() → Promise<any>
 *   - tap() → Promise<void>
 *   - children() → Promise<Element[]>
 */

const miniProgramAutomator = require('miniprogram-automator');
const { writeFileSync, mkdirSync, existsSync } = require('fs');
const { join, resolve } = require('path');
const { spawn, execSync } = require('child_process');
const { createConnection } = require('net');

/* ==================== 配置 ==================== */

const CONFIG = {
  wsEndpoint: process.env.E2E_WS_ENDPOINT || 'ws://127.0.0.1:9420',
  wsPort: parseInt(process.env.WECHAT_AUTOMATOR_WS_PORT || '9420', 10),
  targetPage: '/pages/album_home/album_home',
  outputRoot: join(__dirname, '..', 'miniprogram', 'tests', 'reports', 'first-screen'),
  navWaitMs: 1500,
  stableWaitMs: 500,

  devToolsPaths: [
    'E:\\ProgramData\\Tencent\\微信web开发者工具\\cli.bat',
    'C:\\Program Files (x86)\\Tencent\\微信web开发者工具\\cli.bat',
    'D:\\Program Files (x86)\\Tencent\\微信web开发者工具\\cli.bat',
    'C:\\Program Files\\Tencent\\微信web开发者工具\\cli.bat',
    'D:\\Program Files\\Tencent\\微信web开发者工具\\cli.bat',
  ]
};

/* ==================== 工具函数 ==================== */

function timestamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return '' + d.getFullYear() +
    pad(d.getMonth() + 1) +
    pad(d.getDate()) + '_' +
    pad(d.getHours()) +
    pad(d.getMinutes()) +
    pad(d.getSeconds());
}

function log(level, msg, data) {
  const prefix = '[first-screen]';
  const ts = new Date().toISOString().substring(11, 19);
  if (data !== undefined) {
    console.log(prefix, ts, level, msg, JSON.stringify(data));
  } else {
    console.log(prefix, ts, level, msg);
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/** 给 Promise 添加超时，超时时抛错 */
function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error((label || '操作') + ' 超时 ' + ms + 'ms')), ms)
    )
  ]);
}

/** Git Bash 路径转 Windows 路径 */
function toWindowsPath(p) {
  if (/^\/[a-zA-Z]\//.test(p)) {
    return p[1].toUpperCase() + ':\\' + p.substring(3).replace(/\//g, '\\');
  }
  return p.replace(/\//g, '\\');
}

/* ==================== DevTools 自动启动 ==================== */

function findCli() {
  for (const p of CONFIG.devToolsPaths) {
    if (existsSync(p)) return p;
  }
  return null;
}

function isPortOpen(host, port, timeoutMs) {
  return new Promise(resolve => {
    const sock = createConnection(port, host, () => {
      sock.destroy();
      resolve(true);
    });
    sock.setTimeout(timeoutMs || 1500);
    sock.on('error', () => { sock.destroy(); resolve(false); });
    sock.on('timeout', () => { sock.destroy(); resolve(false); });
  });
}

async function waitForPort(host, port, maxAttempts, intervalMs) {
  maxAttempts = maxAttempts || 30;
  intervalMs = intervalMs || 2000;
  for (let i = 1; i <= maxAttempts; i++) {
    const open = await isPortOpen(host, port, 1500);
    if (open) return true;
    if (i === 1 || i % 5 === 0) {
      console.log('  [' + (i * intervalMs / 1000) + 's / ' + (maxAttempts * intervalMs / 1000) + 's] 等待开发者工具就绪...');
    }
    await sleep(intervalMs);
  }
  return false;
}

function isDevToolsRunning() {
  try {
    const result = execSync('tasklist /FI "IMAGENAME eq wechatdevtools.exe" /NH', {
      encoding: 'utf-8', timeout: 3000
    });
    return result.includes('wechatdevtools.exe');
  } catch { return false; }
}

async function launchDevTools() {
  const projectPath = toWindowsPath(join(__dirname, '..', 'miniprogram'));
  const wsPort = CONFIG.wsPort;
  const httpPort = wsPort + 1;

  const alreadyRunning = await isPortOpen('127.0.0.1', wsPort, 100);
  if (alreadyRunning) {
    log('INFO', '端口 ' + wsPort + ' 已监听，复用已有实例');
    return;
  }

  const cliPath = findCli();
  if (!cliPath) {
    throw new Error('未找到微信开发者工具 cli.bat。请手动启动后重试。');
  }

  log('INFO', '启动微信开发者工具...');
  log('INFO', 'cli: ' + cliPath + '  项目: ' + projectPath + '  WS端口: ' + wsPort);

  if (isDevToolsRunning()) {
    log('INFO', '关闭已有进程...');
    try {
      execSync('taskkill /F /IM wechatdevtools.exe', { stdio: 'ignore', timeout: 5000 });
      await sleep(2000);
    } catch { /* ignore */ }
  }

  return new Promise((resolve, reject) => {
    const args = ['auto', '--port', String(httpPort), '--auto-port', String(wsPort), '--project', projectPath];
    log('INFO', '执行: ' + cliPath + ' ' + args.join(' '));

    // windowsHide: false 确保 DevTools 窗口可见（截图需要可见窗口）
    const child = spawn(cliPath, args, {
      shell: true,
      windowsHide: false,
      stdio: ['ignore', 'pipe', 'pipe']
    });
    let settled = false;

    child.stdout.on('data', (data) => {
      const text = data.toString().trim();
      if (text) console.log('  [devtools]', text);
    });
    child.stderr.on('data', (data) => {
      const text = data.toString().trim();
      if (text && /error|fail|warn/i.test(text)) console.warn('  [devtools]', text);
    });
    child.on('error', (err) => { if (!settled) { settled = true; reject(new Error('启动失败: ' + err.message)); } });
    child.on('exit', (code) => { if (!settled && code !== null && code !== 0) { settled = true; reject(new Error('进程退出 code=' + code)); } });

    waitForPort('127.0.0.1', wsPort, 30, 2000).then(ok => {
      if (!settled) {
        settled = true;
        if (ok) { console.log('  [devtools] 就绪'); setTimeout(() => resolve(), 2000); }
        else { child.kill(); reject(new Error('启动超时（60s）')); }
      }
    });
  });
}

/* ==================== 主流程 ==================== */

async function main() {
  console.log('');
  console.log('╔══════════════════════════════════════════╗');
  console.log('║  首屏访问与内容读取                      ║');
  console.log('║  目标: ' + CONFIG.targetPage.padEnd(33) + '║');
  console.log('╚══════════════════════════════════════════╝');
  console.log('');

  const runId = 'first-screen_' + timestamp();
  const outputDir = join(CONFIG.outputRoot, runId);
  if (!existsSync(outputDir)) mkdirSync(outputDir, { recursive: true });
  log('INFO', '输出目录: ' + outputDir);

  const report = {
    timestamp: new Date().toISOString(),
    runId: runId,
    pagePath: '',
    data: {},
    elements: [],
    mediaCount: 0,
    screenshotPaths: [],
    errors: []
  };

  let mp = null;    // MiniProgram 实例
  let page = null;  // Page 实例（当前页面）

  try {
    /* ===== 0. 自动启动 DevTools ===== */
    const autoLaunch = process.env.E2E_AUTO_LAUNCH !== '0' && process.env.E2E_AUTO_LAUNCH !== 'false';
    if (autoLaunch) {
      await launchDevTools();
    } else {
      log('INFO', '跳过自动启动');
    }

    /* ===== 1. 连接 ===== */
    log('INFO', '连接微信开发者工具...');
    mp = await miniProgramAutomator.connect({ wsEndpoint: CONFIG.wsEndpoint });
    log('INFO', '✓ 连接成功');

    /* ===== 2. 导航到首屏 ===== */
    log('INFO', '导航到: ' + CONFIG.targetPage);
    try {
      page = await mp.reLaunch(CONFIG.targetPage);
      await sleep(CONFIG.navWaitMs);
      if (!page) page = await mp.currentPage();
      report.pagePath = page ? page.path : 'unknown';
      log('INFO', '当前页面: ' + report.pagePath);
      if (report.pagePath.includes('album_home')) {
        log('INFO', '✓ 已到达目标页面');
      }
    } catch (err) {
      report.errors.push('navigate: ' + err.message);
      log('ERROR', '导航失败: ' + err.message);
      page = await mp.currentPage();
    }

    /* ===== 3. 读取页面 data ===== */
    log('INFO', '读取页面数据...');
    try {
      if (page) {
        const raw = await page.data();
        log('INFO', '页面数据键: ' + Object.keys(raw).join(', '));

        const fields = ['currentBabyId', 'currentBaby', 'babies', 'mediaList',
          'viewMode', 'isLoading', 'isEmpty', 'isAuthorized',
          'hasMore', 'page', 'pageSize', 'uploaderVisible'];

        const data = {};
        for (const f of fields) {
          if (raw[f] !== undefined) data[f] = raw[f];
        }
        report.data = data;
        report.mediaCount = Array.isArray(data.mediaList) ? data.mediaList.length : 0;

        const d = data;
        console.log('');
        console.log('  [页面数据摘要]');
        console.log('    授权: ' + (d.isAuthorized === true ? '✓' : '✗'));
        console.log('    宝宝: ' + (d.currentBaby ? d.currentBaby.name : '未选择'));
        console.log('    视图: ' + (d.viewMode || '-'));
        console.log('    媒体: ' + report.mediaCount + ' 条' +
          (d.isEmpty ? ' (空状态)' : '') +
          (d.isLoading ? ' (加载中)' : ''));
        console.log('    分页: 第 ' + (d.page || 1) + ' 页' +
          (d.hasMore ? ' (有更多)' : ' (已全部)'));

        const mediaList = d.mediaList;
        if (Array.isArray(mediaList) && mediaList.length > 0) {
          console.log('');
          console.log('  [媒体列表]');
          const preview = mediaList.slice(0, 5);
          for (let i = 0; i < preview.length; i++) {
            const m = preview[i];
            console.log('    ' + (i + 1) + '. ' + (m.title || '无标题') +
              '  | 日期: ' + (m.captureDate || '-'));
          }
          if (mediaList.length > 5) {
            console.log('    ... 还有 ' + (mediaList.length - 5) + ' 条');
          }
        }
      } else {
        log('WARN', 'page 不可用，跳过数据读取');
      }
    } catch (err) {
      report.errors.push('readData: ' + err.message);
      log('ERROR', '读取数据失败: ' + err.message);
    }

    /* ===== 4. 探测 DOM 元素 ===== */
    log('INFO', '探测 DOM 元素...');
    const selectors = [
      { selector: '.nav-bar', desc: '导航栏' },
      { selector: '.nav-bar-title', desc: '导航栏标题' },
      { selector: '.baby-selector', desc: '宝宝选择器' },
      { selector: '.baby-selector-value', desc: '当前宝宝' },
      { selector: 'age-filter', desc: '月龄筛选' },
      { selector: '.media-content', desc: '内容区域' },
      { selector: '.masonry-view', desc: '瀑布流视图' },
      { selector: 'masonry-layout', desc: '瀑布流组件' },
      { selector: '.masonry-item', desc: '媒体卡片' },
      { selector: '.media-title', desc: '媒体标题' },
      { selector: '.media-date', desc: '媒体日期' },
      { selector: '.loading-container', desc: '加载状态' },
      { selector: '.empty-container', desc: '空状态' },
      { selector: '.upload-btn', desc: '上传按钮' },
      { selector: '.upload-btn-text', desc: '上传文字' },
      { selector: '.auth-tip', desc: '授权提示' },
      { selector: '.no-more', desc: '没有更多' },
    ];

    const elements = [];
    console.log('');
    for (const s of selectors) {
      const el = { selector: s.selector, desc: s.desc, exists: false, text: null };
      try {
        if (page) {
          const node = await page.$(s.selector);
          if (node) {
            el.exists = true;
            try { el.text = await node.text(); } catch { /* ignore */ }
          }
        }
      } catch { /* ignore */ }
      elements.push(el);
      const icon = el.exists ? '✓' : ' ';
      let line = '  ' + icon + ' ' + el.desc.padEnd(12) + ' (' + el.selector + ')';
      if (el.text) line += '  → "' + el.text.slice(0, 60) + '"';
      console.log(line);
    }
    report.elements = elements;
    const existCount = elements.filter(e => e.exists).length;
    console.log('  ---');
    console.log('  ' + existCount + '/' + elements.length + ' 存在');

    /* ===== 5. 截图 ===== */
    log('INFO', '截图（如果窗口不可见会超时，不影响数据读取）...');
    try {
      if (mp) {
        // 注意：App.captureScreenshot 在 DevTools 窗口不可见时会卡住
        // 这是微信开发者工具的限制，见 CLAUDE.md 已知问题
        // 加 10s 超时保护，失败时优雅跳过
        await sleep(500);
        const ss1 = await withTimeout(mp.screenshot(), 10000, '截图');
        const buf1 = Buffer.from(ss1, 'base64');
        const file1 = join(outputDir, '01-album-home.png');
        writeFileSync(file1, buf1);
        report.screenshotPaths.push(file1);
        console.log('  ✓ 截图已保存: ' + (buf1.length / 1024).toFixed(1) + ' KB');
      }
    } catch (err) {
      report.errors.push('screenshot: ' + err.message);
      log('INFO', '截图不可用（DevTools 后台模式无窗口），数据读取已完成');
      console.log('  ℹ 如需截图，请保持开发者工具窗口可见后再试');
    }

    /* ===== 6. 写报告 ===== */
    const reportOutput = JSON.parse(JSON.stringify(report));
    if (Array.isArray(reportOutput.data.mediaList)) {
      const c = reportOutput.data.mediaList.length;
      reportOutput.data.mediaList = { _count: c, _preview: c > 0 ? reportOutput.data.mediaList.slice(0, 3) : [] };
    }
    if (Array.isArray(reportOutput.data.babies)) {
      reportOutput.data.babies = reportOutput.data.babies.map(b => ({ id: b.id, name: b.name }));
    }
    const reportPath = join(outputDir, 'screen-report.json');
    writeFileSync(reportPath, JSON.stringify(reportOutput, null, 2), 'utf-8');

    /* ===== 总结 ===== */
    console.log('');
    console.log('╔══════════════════════════════════════════╗');
    console.log('║  ✅  首屏访问完成                        ║');
    console.log('║══════════════════════════════════════════║');
    console.log('║  页面: ' + (report.pagePath + '').padEnd(35) + '║');
    console.log('║  元素: ' + (existCount + '/' + elements.length + ' 存在').padEnd(35) + '║');
    console.log('║  媒体: ' + (report.mediaCount + ' 条').padEnd(35) + '║');
    console.log('║  截图: ' + (report.screenshotPaths.length + ' 张').padEnd(35) + '║');
    console.log('╚══════════════════════════════════════════╝');
    console.log('');
    console.log('报告: ' + reportPath);
    console.log('');

    return { success: true, report, outputDir };
  } catch (err) {
    log('ERROR', '执行失败: ' + err.message);
    console.log('');
    console.log('╔══════════════════════════════════════════╗');
    console.log('║  ❌  首屏访问失败                        ║');
    console.log('║══════════════════════════════════════════║');
    console.log('║  ' + (err.message + '').padEnd(36) + '║');
    console.log('╚══════════════════════════════════════════╝');
    return { success: false, error: err.message, report, outputDir };
  } finally {
    if (mp && typeof mp.close === 'function') {
      try { await mp.close(); log('INFO', '连接已关闭'); } catch { /* ignore */ }
    }
  }
}

if (require.main === module) {
  main().then(result => process.exit(result.success ? 0 : 1))
    .catch(err => { console.error('未捕获:', err); process.exit(1); });
}

module.exports = { main, CONFIG };