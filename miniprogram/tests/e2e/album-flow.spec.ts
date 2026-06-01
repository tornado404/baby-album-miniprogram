/**
 * E2E 测试 Jest 入口
 *
 * 通过 npm run test:e2e 触发。
 * 依赖 globalSetup 建立的 (global as any).__AUTOMATOR__ 连接。
 *
 * 完整用户旅程见 specs/album-flow.ts
 */

import { ALBUM_FLOW } from '../specs/album-flow';
import { runFlow } from './run-flow';
import { MiniProgramAutomator } from './album-flow-types';

interface SpecGlobal {
  __AUTOMATOR__?: MiniProgramAutomator;
  __AUTOMATOR_ERROR__?: string;
}

const g = globalThis as unknown as SpecGlobal;

describe('E2E 用户旅程 - 宝宝成长相册', () => {
  jest.setTimeout(180000);

  it('完整用户旅程通过率应 >= 80%', async () => {
    if (g.__AUTOMATOR_ERROR__) {
      throw new Error(
        'globalSetup 未建立 automator 连接：' + g.__AUTOMATOR_ERROR__
      );
    }
    if (!g.__AUTOMATOR__) {
      throw new Error(
        'globalSetup 未建立 automator 连接，请先启动微信开发者工具并开启服务端口 ' +
          '(默认 9421)'
      );
    }

    const { report } = await runFlow({
      automator: g.__AUTOMATOR__,
      steps: ALBUM_FLOW,
      stableMs: 600
    });

    // eslint-disable-next-line no-console
    console.log(
      '[E2E] total=' +
        report.totalSteps +
        ' pass=' +
        report.passedSteps +
        ' fail=' +
        report.failedSteps +
        ' skip=' +
        report.skippedSteps
    );

    const minPassRate = 0.8;
    const actualRate =
      report.totalSteps > 0 ? report.passedSteps / report.totalSteps : 0;
    expect(actualRate).toBeGreaterThanOrEqual(minPassRate);
  });
});
