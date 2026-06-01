/**
 * Flow 编排单元测试
 *
 * 覆盖：
 *  - runFlow 参数校验
 *  - 步骤执行顺序（mock automator）
 *  - 失败时 failFast 行为
 *  - skipAI 行为
 *
 * 真实的 runFlow（带 DevTools 连接）放在 album-flow.spec.ts 中跑 E2E project。
 */

import { join } from 'path';
import { runFlow } from './run-flow';
import { MiniProgramAutomator } from './album-flow-types';

describe('run-flow: 参数校验', () => {
  it('缺 automator 抛错', async () => {
    await expect(
      runFlow({ automator: null as any, steps: [] })
    ).rejects.toThrow(/automator/);
  });

  it('steps 为空抛错', async () => {
    await expect(
      runFlow({ automator: {} as any, steps: [] })
    ).rejects.toThrow(/non-empty/);
  });
});

describe('run-flow: 步骤执行（mock automator）', () => {
  // 构造一个最小 automator 替身
  function makeFakeAutomator(): MiniProgramAutomator & {
    reLaunchCalls: string[];
    navigateToCalls: string[];
    screenshotCalls: number;
  } {
    const fake: any = {
      reLaunchCalls: [],
      navigateToCalls: [],
      screenshotCalls: 0,
      page: {
        path: '/pages/album_home/index',
        screenshot: async () => Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13]),
        waitFor: async () => undefined,
        data: async () => ({})
      },
      close: async () => undefined,
      reLaunch: async (opt: { url: string }) => {
        fake.reLaunchCalls.push(opt.url);
        return fake.page;
      },
      navigateTo: async (opt: { url: string }) => {
        fake.navigateToCalls.push(opt.url);
        return fake.page;
      },
      navigateBack: async () => fake.page
    };
    return fake;
  }

  it('顺序执行 3 步并写报告', async () => {
    const automator = makeFakeAutomator();
    const tmp = (global as any).process
      ? (await import('os')).tmpdir()
      : '/tmp';

    // 强制使用临时目录作为 reportsRoot
    const os = await import('os');
    const fs = await import('fs');
    const reportsRoot = fs.mkdtempSync(join(os.tmpdir(), 'rf-'));

    const { report, paths } = await runFlow({
      automator: automator as any,
      steps: [
        {
          name: 's1',
          page: 'album_home',
          step: 1,
          action: async ctx => {
            await (ctx.automator as any).reLaunch({ url: '/pages/album_home/index' });
          },
          expectations: ['标题为 X']
        },
        {
          name: 's2',
          page: 'album_home',
          step: 2,
          action: async () => undefined,
          expectations: ['按钮存在'],
          skipAI: true
        },
        {
          name: 's3',
          page: 'logs',
          step: 3,
          action: async ctx => {
            await (ctx.automator as any).navigateTo({ url: '/pages/logs/index' });
          },
          expectations: ['日志列表存在']
        }
      ],
      reportsRoot: reportsRoot,
      runId: 'unit-rf',
      stableMs: 0
    });

    expect(report.totalSteps).toBe(3);
    expect(automator.reLaunchCalls).toEqual(['/pages/album_home/index']);
    expect(automator.navigateToCalls).toEqual(['/pages/logs/index']);
    expect(fs.existsSync(paths.json)).toBe(true);
    expect(fs.existsSync(paths.html)).toBe(true);

    // 第二步 skipAI → status=skip
    expect(report.results[1].status).toBe('skip');
    expect(report.skippedSteps).toBe(1);

    // 第一步和第三步 AI skipped（无 API Key）→ status=pass
    expect(report.results[0].status).toBe('pass');
    expect(report.results[2].status).toBe('pass');

    // 清理
    fs.rmSync(reportsRoot, { recursive: true, force: true });
  });

  it('failFast=true：第 1 步 action 抛错后停止', async () => {
    const automator = makeFakeAutomator();
    const os = await import('os');
    const fs = await import('fs');
    const reportsRoot = fs.mkdtempSync(join(os.tmpdir(), 'rff-'));

    const { report } = await runFlow({
      automator: automator as any,
      failFast: true,
      steps: [
        {
          name: 'crash',
          page: 'album_home',
          step: 1,
          action: async () => {
            throw new Error('boom');
          },
          expectations: []
        },
        {
          name: 's2',
          page: 'album_home',
          step: 2,
          action: async () => undefined,
          expectations: []
        }
      ],
      reportsRoot: reportsRoot,
      runId: 'unit-rf-ff',
      stableMs: 0
    });

    expect(report.totalSteps).toBe(1);
    expect(report.results[0].status).toBe('error');
    expect(report.results[0].error).toMatch(/boom/);
    fs.rmSync(reportsRoot, { recursive: true, force: true });
  });
});
