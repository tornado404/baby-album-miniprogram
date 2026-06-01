/**
 * 快速截图脚本
 *
 * 目标：用最少的代码连接微信开发者工具，对当前页面截图。
 * 截图保存到 miniprogram/tests/reports/screenshots/ 下。
 *
 * 假设：DevTools 启动时已加载本项目（miniprogram 目录），当前页面就是
 *   pages/album_home/album_home（IDE 默认打开的"首页"）。
 *
 * 运行步骤：
 *   1. 启动 Windows 微信开发者工具，打开本项目（miniprogram 目录）
 *   2. 微信开发者工具 → 设置 → 安全设置 → 服务端口 → 开启
 *   3. 在 WSL 中执行：
 *        npm run test:e2e -- quick-screenshot
 *
 * 历史问题记录（已解决）：
 *   - automator.reLaunch({url}) 在 0.12.1 有序列化 bug（url 被包成 {url: x}）
 *   - automator.screenshot() 在 IDE 多次重启后会卡住（IDE 进入坏状态）
 *   - 解决方案：IDE 守护进程 + 不调用 reLaunch，直接截当前页
 */

import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

const SCREENSHOT_DIR = join(process.cwd(), 'miniprogram', 'tests', 'reports', 'screenshots');

function timestamp(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    d.getFullYear() +
    pad(d.getMonth() + 1) +
    pad(d.getDate()) +
    '_' +
    pad(d.getHours()) +
    pad(d.getMinutes()) +
    pad(d.getSeconds())
  );
}

describe('快速截图 - 当前页面', () => {
  jest.setTimeout(60000);

  it('连接开发者工具并截图当前页面', async () => {
    const automator = (global as any).__AUTOMATOR__ as {
      send: (method: string, params?: Record<string, unknown>) => Promise<any>;
    };
    if (!automator) {
      throw new Error(
        '未建立 automator 连接。\n' +
          '请确认：\n' +
          '  1. 微信开发者工具已启动并打开了本项目（监听 9421/9420）\n' +
          '  2. 守护进程：nohup bash scripts/keep-devtools.sh > /tmp/devtools-keep.log 2>&1 &'
      );
    }

    if (!existsSync(SCREENSHOT_DIR)) {
      mkdirSync(SCREENSHOT_DIR, { recursive: true });
    }

    // 等待 IDE 内部项目/页面初始化
    await new Promise(r => setTimeout(r, 2000));

    // 1) 确认当前页面（不跳转，依赖 IDE 打开项目时默认进入的首页）
    const current = await automator.send('App.getCurrentPage', {});
    // eslint-disable-next-line no-console
    console.log('[quick-screenshot] current page:', current.path);

    // 2) 截图
    const ss = await automator.send('App.captureScreenshot', {});
    const buffer: Buffer = Buffer.from(ss.data, 'base64');

    // 3) 保存
    const filename = 'screenshot_' + timestamp() + '.png';
    const filepath = join(SCREENSHOT_DIR, filename);
    writeFileSync(filepath, buffer);

    // eslint-disable-next-line no-console
    console.log('\n========================================');
    // eslint-disable-next-line no-console
    console.log('✅ 截图成功！');
    // eslint-disable-next-line no-console
    console.log('📁 WSL 路径:', filepath);
    // eslint-disable-next-line no-console
    console.log('📐 尺寸:', buffer.readUInt32BE(16), 'x', buffer.readUInt32BE(20));
    // eslint-disable-next-line no-console
    console.log('💾 大小:', (buffer.length / 1024).toFixed(1) + ' KB');
    // eslint-disable-next-line no-console
    console.log(
      '💡 Windows 路径:',
      filepath.replace('/mnt/d/', 'D:\\').replace(/\//g, '\\')
    );
    // eslint-disable-next-line no-console
    console.log('========================================\n');

    expect(buffer.length).toBeGreaterThan(1024);
  });
});
