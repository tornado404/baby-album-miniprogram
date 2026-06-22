/**
 * Jest globalTeardown：关闭 miniprogram-automator 共享连接
 *
 * 与 global-setup.ts 配对使用。
 */

interface TeardownGlobal {
  __AUTOMATOR__?: { close?: () => Promise<void>; disconnect?: () => void };
}

const globalAny = globalThis as unknown as TeardownGlobal;

export default async function globalTeardown(): Promise<void> {
  const automator = globalAny.__AUTOMATOR__;
  if (automator) {
    try {
      // 只断开连接，不发送 Tool.close（避免关闭整个 DevTools）
      if (typeof automator.disconnect === 'function') {
        automator.disconnect();
      } else if (typeof automator.close === 'function') {
        await automator.close();
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn(
        '[global-teardown] 关闭 automator 失败：' +
          ((err as Error).message || String(err))
      );
    }
  }
  globalAny.__AUTOMATOR__ = undefined;
}
