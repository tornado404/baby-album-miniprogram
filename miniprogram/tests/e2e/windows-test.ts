/**
 * Windows 纯环境 miniprogram-automator 测试脚本
 *
 * 此脚本直接在 Windows 环境下运行，不依赖 WSL
 * 用于验证 miniprogram-automator 的基本连接和功能
 */

import { connect, Automator } from 'miniprogram-automator';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, resolve } from 'path';

// 配置
const PROJECT_PATH = 'D:\\code\\yuanBabyGrowthDiary\\miniprogram'; // miniprogram 目录（Windows 路径）
const DEVTOOLS_PATH = 'E:\\ProgramData\\Tencent\\微信web开发者工具\\cli.bat';
const WS_PORT = 9420;
const WS_ENDPOINT = `ws://127.0.0.1:${WS_PORT}`;
const SCREENSHOT_DIR = join(__dirname, '../reports/screenshots');

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

async function main() {
  console.log('========================================');
  console.log('Windows 纯环境 miniprogram-automator 测试');
  console.log('========================================\n');

  console.log('项目路径:', PROJECT_PATH);
  console.log('WebSocket 端点:', WS_ENDPOINT);
  console.log('');

  let automator: Automator | null = null;

  try {
    // 步骤 1: 连接自动化端口
    console.log('[1/5] 正在连接微信开发者工具...');
    console.log('      请确保：');
    console.log('      1. 微信开发者工具已启动');
    console.log('      2. 设置 → 安全设置 → 服务端口 已开启');
    console.log('      3. 项目已加载（miniprogram 目录）');
    console.log('');

    automator = await connect({
      wsEndpoint: WS_ENDPOINT,
    });

    console.log('✅ 连接成功！\n');

    // 步骤 2: 获取当前页面信息
    console.log('[2/5] 获取当前页面信息...');
    const currentPage = await automator.send('App.getCurrentPage', {});
    console.log('    当前页面路径:', currentPage.path);
    console.log('    页面参数:', JSON.stringify(currentPage.query || {}));
    console.log('');

    // 步骤 3: 获取页面栈
    console.log('[3/5] 获取页面栈...');
    const pageStack = await automator.send('App.getPageStack', {});
    console.log('    页面栈深度:', pageStack.length);
    pageStack.forEach((page: any, index: number) => {
      console.log(`    [${index}] ${page.path}`);
    });
    console.log('');

    // 步骤 4: 调用页面方法（如果有）
    console.log('[4/5] 测试页面方法调用...');
    try {
      // 尝试获取页面数据
      const pageData = await automator.send('App.callFunction', {
        functionDeclaration: `() => {
          const pages = getCurrentPages();
          if (pages.length > 0) {
            const page = pages[pages.length - 1];
            return {
              data: page.data,
              route: page.route
            };
          }
          return null;
        }`,
        args: []
      });
      console.log('    页面数据获取成功');
      console.log('    数据键:', pageData ? Object.keys(pageData).join(', ') : 'null');
    } catch (err) {
      console.log('    ⚠️ 页面方法调用失败（可能页面未完全加载）:', (err as Error).message);
    }
    console.log('');

    // 步骤 5: 截图
    console.log('[5/5] 截图...');
    if (!existsSync(SCREENSHOT_DIR)) {
      mkdirSync(SCREENSHOT_DIR, { recursive: true });
    }

    const screenshot = await automator.send('App.captureScreenshot', {});
    const buffer: Buffer = Buffer.from(screenshot.data, 'base64');

    const filename = `windows_test_${timestamp()}.png`;
    const filepath = join(SCREENSHOT_DIR, filename);
    writeFileSync(filepath, buffer);

    console.log('✅ 截图成功！');
    console.log('    文件:', filepath);
    console.log('    大小:', (buffer.length / 1024).toFixed(1), 'KB');
    console.log('');

    // 总结
    console.log('========================================');
    console.log('✅ 所有测试通过！');
    console.log('miniprogram-automator 在 Windows 环境下工作正常');
    console.log('========================================');

  } catch (error) {
    console.error('\n❌ 测试失败:', (error as Error).message);
    console.error('\n可能的解决方案:');
    console.error('1. 确保微信开发者工具已启动');
    console.error('2. 确保 设置 → 安全设置 → 服务端口 已开启');
    console.error('3. 尝试手动启动自动化端口:');
    console.error(`   "C:\\Program Files (x86)\\Tencent\\微信web开发者工具\\cli.bat" auto --port 9421 --auto-port 9420 --project "${PROJECT_PATH}"`);
    console.error('');
    process.exit(1);
  } finally {
    if (automator) {
      console.log('\n正在关闭连接...');
      await automator.close();
      console.log('连接已关闭');
    }
  }
}

// 运行测试
main();
