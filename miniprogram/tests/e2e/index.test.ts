/**
 * 编排器单元测试
 *
 * 覆盖：
 *  - selectorToPagePath 路径解析
 *  - runE2E 错误参数校验
 *
 * 端到端的"真实 client 调用"放在 e2e/*.spec.ts 中，需要 DevTools 端口。
 */

import { selectorToPagePath, runE2E } from './index';

describe('orchestrator: selectorToPagePath', () => {
  it('selector 为空时使用 page 名拼接', () => {
    expect(selectorToPagePath(undefined, 'album_home')).toBe(
      '/pages/album_home/index'
    );
    expect(selectorToPagePath('', 'logs')).toBe('/pages/logs/index');
  });

  it('已经是 /pages/... 形式时原样返回', () => {
    expect(selectorToPagePath('/pages/foo/bar', 'album_home')).toBe(
      '/pages/foo/bar'
    );
  });

  it('pages/ 形式自动补 /', () => {
    expect(selectorToPagePath('pages/foo/bar', 'album_home')).toBe(
      '/pages/foo/bar'
    );
  });

  it('短 id 形式拼接 page 名', () => {
    expect(selectorToPagePath('test', 'media_detail')).toBe(
      '/pages/media_detail/test'
    );
  });

  it('含 / 的其他路径原样返回', () => {
    expect(selectorToPagePath('other/path', 'album_home')).toBe(
      'other/path'
    );
  });
});

describe('orchestrator: runE2E 参数校验', () => {
  it('缺少 wsEndpoint 抛错', async () => {
    await expect(
      runE2E({ wsEndpoint: '', steps: [] } as any)
    ).rejects.toThrow(/wsEndpoint/);
  });

  it('steps 为空抛错', async () => {
    await expect(
      runE2E({ wsEndpoint: 'ws://x', steps: [] })
    ).rejects.toThrow(/non-empty/);
  });

  it('未安装 miniprogram-automator 或连接失败时给出友好错误', async () => {
    // 这里不依赖真实安装：如果模块存在，错误信息会包含 connect 相关
    // 如果不存在，会明确提示安装
    // 真实 connect 失败可能耗时数秒，单独延长该测试超时
    let err: Error | null = null;
    try {
      await runE2E({
        wsEndpoint: 'ws://127.0.0.1:1',
        steps: [
          {
            step: 1,
            page: 'album_home',
            action: 'reLaunch',
            name: 's',
            aiPrompt: 'p'
          }
        ]
      });
    } catch (e) {
      err = e as Error;
    }
    expect(err).not.toBeNull();
    // 错误可能来自 connect 失败或模块缺失，两种都视为通过校验
    expect(err && (err.message.includes('miniprogram-automator') || err.message.includes('connect') || err.message.includes('ECONNREFUSED') || err.message.includes('ws://'))).toBeTruthy();
  }, 30000);
});
