/**
 * 首屏截图 - 手动启动 DevTools 后运行
 *
 * 使用前提：微信开发者工具已手动启动，且窗口可见。
 * 连接 automation 端口 → 导航到首屏 → 截图保存。
 *
 * 运行方式：
 *   npm run capture:first-screen
 *   或
 *   node scripts/capture-first-screen.js
 *
 * 输出目录：miniprogram/tests/reports/first-screen/<runId>/
 */

const m = require('miniprogram-automator');
const { writeFileSync, mkdirSync, existsSync } = require('fs');
const { join } = require('path');
const { createConnection } = require('net');

const CONFIG = {
  wsEndpoint: process.env.E2E_WS_ENDPOINT || 'ws://127.0.0.1:9420',
  wsPort: parseInt(process.env.WECHAT_AUTOMATOR_WS_PORT || '9420', 10),
  targetPage: '/pages/album_home/album_home',
  outputRoot: join(__dirname, '..', 'miniprogram', 'tests', 'reports', 'first-screen'),
};

function ts() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return '' + d.getFullYear() + p(d.getMonth()+1) + p(d.getDate()) + '_' + p(d.getHours()) + p(d.getMinutes()) + p(d.getSeconds());
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error((label||'')+'超时'+ms+'ms')), ms))
  ]);
}

async function main() {
  console.log('');
  console.log('╔══════════════════════════════════════════╗');
  console.log('║  首屏截图                                ║');
  console.log('║  前提: 开发者工具已手动启动且窗口可见     ║');
  console.log('╚══════════════════════════════════════════╝');
  console.log('');

  // 检查端口
  const portOpen = await new Promise(r => {
    const s = createConnection(CONFIG.wsPort, '127.0.0.1', () => { s.destroy(); r(true); });
    s.setTimeout(1500);
    s.on('error', () => { s.destroy(); r(false); });
    s.on('timeout', () => { s.destroy(); r(false); });
  });

  if (!portOpen) {
    console.error('❌ 端口 ' + CONFIG.wsPort + ' 未监听');
    console.error('');
    console.error('请确保：');
    console.error('  1. 微信开发者工具已启动');
    console.error('  2. 已打开本项目 (miniprogram 目录)');
    console.error('  3. 服务端口已开启 (设置 → 安全 → 服务端口)');
    return 1;
  }

  const runId = 'capture_' + ts();
  const outDir = join(CONFIG.outputRoot, runId);
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
  console.log('  输出: ' + outDir);
  console.log('');

  let mp = null;
  try {
    // 1. 连接
    console.log('[1/4] 连接开发者工具...');
    mp = await m.connect({ wsEndpoint: CONFIG.wsEndpoint });
    console.log('  ✓ 连接成功');

    // 2. 导航
    console.log('[2/4] 导航到首屏...');
    const page = await mp.reLaunch(CONFIG.targetPage);
    await sleep(2000);
    const path = page ? page.path : (await mp.currentPage()).path;
    console.log('  ✓ 已到达: ' + path);

    // 3. 截图
    console.log('[3/4] 截图（窗口可见时应正常返回）...');
    const ss1 = await withTimeout(mp.screenshot(), 20000, '截图');
    const buf1 = Buffer.from(ss1, 'base64');
    const f1 = join(outDir, '01-album-home.png');
    writeFileSync(f1, buf1);
    console.log('  ✓ 截图 1: ' + (buf1.length / 1024).toFixed(1) + ' KB');

    await sleep(500);
    const ss2 = await withTimeout(mp.screenshot(), 20000, '截图');
    const buf2 = Buffer.from(ss2, 'base64');
    const f2 = join(outDir, '02-album-home-stable.png');
    writeFileSync(f2, buf2);
    console.log('  ✓ 截图 2: ' + (buf2.length / 1024).toFixed(1) + ' KB');

    // 4. 页面数据（附带输出）
    console.log('[4/4] 页面摘要...');
    try {
      const data = (page || await mp.currentPage()).data();
      if (data) {
        const d = await data;
        console.log('  视图: ' + (d.viewMode || '-') + '  媒体: ' +
          (Array.isArray(d.mediaList) ? d.mediaList.length : 0) + ' 条' +
          '  宝宝: ' + (d.currentBaby ? d.currentBaby.name : '未选择'));
      }
    } catch { /* ignore */ }

    console.log('');
    console.log('╔══════════════════════════════════════════╗');
    console.log('║  ✅  截图完成                           ║');
    console.log('╚══════════════════════════════════════════╝');
    console.log('');
    console.log('  ' + f1);
    console.log('  ' + f2);
    console.log('');
    return 0;
  } catch (err) {
    console.error('❌ 失败:', err.message);
    return 1;
  } finally {
    if (mp && typeof mp.close === 'function') {
      try { await mp.close(); console.log('  连接已关闭'); } catch { /* ignore */ }
    }
  }
}

if (require.main === module) { main().then(c => process.exit(c)); }
module.exports = { main, CONFIG };