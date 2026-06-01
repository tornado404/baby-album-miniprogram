/**
 * Jest globalSetup：建立 miniprogram-automator 共享连接
 *
 * 按 architect §3.1.1：
 *   automator = await launch({ cliPath, projectPath, port: 9421 });
 *   (global as any).__AUTOMATOR__ = automator;
 *
 * 在 spec 文件中通过 (global as any).__AUTOMATOR__ 获取。
 *
 * 行为约定：
 *  - 若 WECHAT_DEVTOOLS_PORT 未开启（DevTools 未运行），setup 不抛错，
 *    仅在 globalThis.__AUTOMATOR_ERROR__ 写入原因；spec 仍可加载，
 *    测试运行时会收到清晰错误。
 *  - 这样在 CI / 本地无 DevTools 环境下也不会让 `jest --listTests` 失败。
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

  const port = Number(process.env.WECHAT_DEVTOOLS_PORT || 9421);
  const wsEndpoint = process.env.E2E_WS_ENDPOINT || 'ws://127.0.0.1:' + port;
  const projectPath = process.env.E2E_PROJECT_PATH || join(process.cwd(), 'miniprogram');

  // 尝试连接；失败不抛错（避免 listTests 失败）
  try {
    // 动态 require，避免未安装时阻塞
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const automatorPkg: any = require('miniprogram-automator');
    const automator = await automatorPkg.connect({
      wsEndpoint: wsEndpoint,
      projectPath: projectPath
    });
    globalAny.__AUTOMATOR__ = automator;
  } catch (err) {
    globalAny.__AUTOMATOR_ERROR__ =
      'globalSetup: miniprogram-automator 连接失败（' +
      wsEndpoint +
      '）：' +
      ((err as Error).message || String(err));
    // eslint-disable-next-line no-console
    console.warn('[global-setup] ' + globalAny.__AUTOMATOR_ERROR__);
    // 不抛错：留给 spec 文件运行时处理
  }
}
