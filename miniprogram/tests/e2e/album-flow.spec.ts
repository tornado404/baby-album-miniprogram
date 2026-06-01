/**
 * E2E 测试 Jest 入口
 *
 * 通过 npm run test:e2e 触发。
 * 要求：
 *  1. 已启动微信开发者工具，开启服务端口（默认 9421）
 *  2. 环境变量 AI_API_KEY（智谱/DeepSeek）
 *  3. 可选：E2E_WS_ENDPOINT（默认 ws://127.0.0.1:9421）
 *         E2E_PROJECT_PATH（小程序项目根目录）
 *
 * 完整用户旅程见 specs/album-flow.ts
 */

import * as path from 'path';
import { runE2E } from './index';
import { albumFlowSteps } from '../specs/album-flow';

describe('E2E 用户旅程 - 宝宝成长相册', () => {
  const wsEndpoint = process.env.E2E_WS_ENDPOINT || 'ws://127.0.0.1:9421';
  const projectPath =
    process.env.E2E_PROJECT_PATH ||
    path.resolve(__dirname, '..', '..', '..');

  // 给整个套件一个 3 分钟超时（DevTools 冷启动 + 多步截图）
  jest.setTimeout(180000);

  it('完整用户旅程通过率应 >= 80%', async () => {
    const { report } = await runE2E({
      wsEndpoint,
      projectPath,
      steps: albumFlowSteps,
      settleMs: 500
    });

    // 打印摘要便于 CI 日志查看
    // eslint-disable-next-line no-console
    console.log(
      '[E2E] total=' +
        report.totalSteps +
        ' pass=' +
        report.passedSteps +
        ' fail=' +
        report.failedSteps
    );

    // 允许少量 AI 抖动（设计文档第 10 节：失败重试一次仍可能误判）
    const minPassRate = 0.8;
    const actualRate =
      report.totalSteps > 0 ? report.passedSteps / report.totalSteps : 0;
    expect(actualRate).toBeGreaterThanOrEqual(minPassRate);
  });
});
