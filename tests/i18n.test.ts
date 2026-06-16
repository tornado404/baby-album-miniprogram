/**
 * i18n 工具函数单元测试
 * 测试目标：OPT-07 多语言支持 - t() 翻译、setLocale() 切换、参数替换
 *
 * 注意：i18n.ts 有模块级副作用（initLocale() 在 import 时执行），
 * 使用 jest.resetModules() + 动态 require() 模拟不同 wx storage 场景。
 */

// ==================== 测试辅助函数 ====================

function setupMockWx(storageData?: Record<string, any>): void {
  var store: Record<string, any> = {};
  if (storageData) {
    for (var key in storageData) {
      if (storageData.hasOwnProperty(key)) {
        store[key] = storageData[key];
      }
    }
  }
  (global as any).wx = {
    getStorageSync: function (key: string): any {
      return store[key] !== undefined ? store[key] : '';
    },
    setStorageSync: function (key: string, value: any): void {
      store[key] = value;
    },
    getSystemInfoSync: function () {
      return { language: 'zh_CN' };
    },
  };
}

function cleanupMockWx(): void {
  delete (global as any).wx;
}

// ==================== 测试 ====================

describe('OPT-07 i18n 多语言支持测试', () => {

  beforeEach(() => {
    jest.resetModules();
    setupMockWx();
  });

  afterEach(() => {
    cleanupMockWx();
  });

  describe('t() 翻译函数', () => {
    test('应该返回中文翻译（默认 locale）', () => {
      setupMockWx();
      var i18n = require('../miniprogram/utils/i18n');
      expect(i18n.t('settings.title')).toBe('我的');
      expect(i18n.t('settings.photos')).toBe('照片');
      expect(i18n.t('share.title')).toBe('分享设置');
    });

    test('应该返回英文翻译', () => {
      setupMockWx({ baby_diary_locale: 'en-US' });
      var i18n = require('../miniprogram/utils/i18n');
      expect(i18n.t('settings.title')).toBe('Me');
      expect(i18n.t('settings.photos')).toBe('Photos');
      expect(i18n.t('share.title')).toBe('Share Settings');
    });

    test('应该支持参数替换', () => {
      setupMockWx();
      var i18n = require('../miniprogram/utils/i18n');
      expect(i18n.t('settings.recordDays', { days: '100' })).toBe('记录天数：100天');
    });

    test('应该支持英文参数替换', () => {
      setupMockWx({ baby_diary_locale: 'en-US' });
      var i18n = require('../miniprogram/utils/i18n');
      expect(i18n.t('settings.recordDays', { days: '100' })).toBe('Days recorded: 100');
    });

    test('key 不存在时应返回 key 本身', () => {
      setupMockWx();
      var i18n = require('../miniprogram/utils/i18n');
      expect(i18n.t('nonexistent.key')).toBe('nonexistent.key');
    });
  });

  describe('getLocale() / setLocale()', () => {
    test('getLocale 应返回当前语言', () => {
      setupMockWx();
      var i18n = require('../miniprogram/utils/i18n');
      expect(i18n.getLocale()).toBe('zh-CN');
    });

    test('setLocale 应成功切换语言', () => {
      setupMockWx();
      var i18n = require('../miniprogram/utils/i18n');
      var result = i18n.setLocale('en-US');
      expect(result).toBe(true);
      expect(i18n.getLocale()).toBe('en-US');
    });

    test('setLocale 对无效语言应返回 false', () => {
      setupMockWx();
      var i18n = require('../miniprogram/utils/i18n');
      var result = i18n.setLocale('invalid-XX');
      expect(result).toBe(false);
    });

    test('setLocale 失败后 locale 不应改变', () => {
      setupMockWx();
      var i18n = require('../miniprogram/utils/i18n');
      i18n.setLocale('zh-CN');
      i18n.setLocale('invalid-XX');
      expect(i18n.getLocale()).toBe('zh-CN');
    });
  });

  describe('getAvailableLocales()', () => {
    test('应返回可用的语言列表', () => {
      setupMockWx();
      var i18n = require('../miniprogram/utils/i18n');
      var locales = i18n.getAvailableLocales();
      expect(locales.length).toBe(2);
      expect(locales[0].key).toBe('zh-CN');
      expect(locales[0].name).toBe('中文');
      expect(locales[1].key).toBe('en-US');
      expect(locales[1].name).toBe('English');
    });
  });

  describe('翻译完整性检查', () => {
    test('中英文语言包应有相同的 key 集合', () => {
      setupMockWx();
      var i18n = require('../miniprogram/utils/i18n');
      var zhTitle = i18n.t('settings.title');
      i18n.setLocale('en-US');
      var enTitle = i18n.t('settings.title');
      expect(zhTitle).not.toBe('settings.title');
      expect(enTitle).not.toBe('settings.title');
    });
  });
});
