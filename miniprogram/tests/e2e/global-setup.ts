/**
 * Jest globalSetup：建立 miniprogram-automator 共享连接
 *
 * 微信开发者工具启动后开启两个端口：
 *   - 9421: HTTP 服务端口（绑定 127.0.0.1），用于 IDE 控制
 *   - 9420: WebSocket 端口（绑定 0.0.0.0），用于 automator 控制
 *
 * WSL 2 关键点：
 *   - WSL 的 localhost 直通 Windows localhost（mirrored 模式）
 *   - WebSocket 必须在 9420 上（9421 上没有 WS 路径）
 *
 * 启动 DevTools 的命令（推荐在 Windows 终端执行一次）：
 *   "E:\ProgramData\Tencent\微信web开发者工具\cli.bat" auto \
 *     --port 9421 --auto-port 9420 \
 *     --project D:\code\yuanBabyGrowthDiary\miniprogram
 *
 * 也可以在 WSL 中通过 WECHAT_AUTOMATOR_LAUNCH=1 让本脚本自动启动 IDE，
 * 但 WSL 中 spawn .bat 会失败，所以推荐先在 Windows 终端启动。
 */

import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';

interface SetupGlobal {
  __AUTOMATOR__?: unknown;
  __AUTOMATOR_ERROR__?: string;
  __AI_VALIDATOR__?: unknown;
  __REPORTER__?: unknown;
}

const globalAny = globalThis as unknown as SetupGlobal;

export default async function globalSetup(): Promise<void> {
  // 预创建 reports 目录
  const reportsRoot = join(process.cwd(), 'miniprogram', 'tests', 'reports');
  if (!existsSync(reportsRoot)) {
    mkdirSync(reportsRoot, { recursive: true });
  }

  const projectPath =
    process.env.E2E_PROJECT_PATH || join(process.cwd(), 'miniprogram');
  const wsPort = Number(process.env.WECHAT_AUTOMATOR_WS_PORT || 9420);
  const wsEndpoint = process.env.E2E_WS_ENDPOINT || 'ws://localhost:' + wsPort;

  // 尝试连接；失败不抛错（避免 listTests 失败）
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const automatorPkg: any = require('miniprogram-automator');
    // connect() 只需要 wsEndpoint；projectPath 由 IDE 启动时已指定
    const automator = await automatorPkg.connect({
      wsEndpoint: wsEndpoint
    });
    globalAny.__AUTOMATOR__ = automator;
    // eslint-disable-next-line no-console
    console.log('[global-setup] ✓ 已连接 miniprogram-automator @ ' + wsEndpoint);
  } catch (err) {
    globalAny.__AUTOMATOR_ERROR__ =
      'globalSetup: miniprogram-automator 连接失败（' +
      wsEndpoint +
      '）：' +
      ((err as Error).message || String(err));
    // eslint-disable-next-line no-console
    console.warn('[global-setup] ' + globalAny.__AUTOMATOR_ERROR__);
    // eslint-disable-next-line no-console
    console.warn(
      '[global-setup] 提示：在 Windows 终端执行 ' +
        '"E:\\ProgramData\\Tencent\\微信web开发者工具\\cli.bat" auto ' +
        '--port 9421 --auto-port 9420 ' +
        '--project D:\\code\\yuanBabyGrowthDiary\\miniprogram'
    );
    // 不抛错：留给 spec 文件运行时处理
  }
}
