/**
 * config/api.ts 环境配置中心单元测试
 *
 * 测试目标：FR-01 多环境配置定义、配置读取优先级、非法值处理、isEnvSwitchable
 *
 * 注意：config/api.ts 有模块级副作用（getCurrentEnv() 在 import 时执行），
 * 每个测试用例依赖不同的全局状态（DEFAULT_ENV / wx storage），
 * 因此使用 jest.resetModules() + 动态 require() 模拟不同场景。
 */

// ==================== 测试辅助函数 ====================

/**
 * 模拟微信 wx.getStorageSync / wx.setStorageSync / wx.removeStorageSync
 */
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
    removeStorageSync: function (key: string): void {
      delete store[key];
    },
  };
}

function clearGlobals(): void {
  delete (global as any).wx;
  delete (global as any).DEFAULT_ENV;
}

describe('config/api.ts - API 环境配置中心', () => {
  var ENV_STORAGE_KEY = 'baby_diary_env_config';

  beforeEach(() => {
    jest.resetModules();
    clearGlobals();
  });

  // ==================================================================
  // FR-01: 多环境配置定义
  // ==================================================================

  describe('FR-01: 多环境配置定义', () => {
    test('development 环境应指向 localhost:8000', () => {
      setupMockWx();
      var api = require('../miniprogram/config/api');
      expect(api.CONFIGS_MAP.development.baseURL).toBe(
        'http://localhost:8000/api/v1'
      );
    });

    test('testing 环境应指向云服务器 IP', () => {
      setupMockWx();
      var api = require('../miniprogram/config/api');
      expect(api.CONFIGS_MAP.testing.baseURL).toBe(
        'http://101.126.41.146:8000/api/v1'
      );
    });

    test('production 环境应指向正式域名', () => {
      setupMockWx();
      var api = require('../miniprogram/config/api');
      expect(api.CONFIGS_MAP.production.baseURL).toBe(
        'https://api.baby-album.com/api/v1'
      );
    });

    test('每个环境应包含 name 和 desc 元信息字段', () => {
      setupMockWx();
      var api = require('../miniprogram/config/api');
      var envs: string[] = ['development', 'testing', 'production'];
      for (var i = 0; i < envs.length; i++) {
        expect(api.CONFIGS_MAP[envs[i]].name).toBeTruthy();
        expect(api.CONFIGS_MAP[envs[i]].desc).toBeTruthy();
      }
    });

    test('每个环境的 timeout 应为正数', () => {
      setupMockWx();
      var api = require('../miniprogram/config/api');
      var envs: string[] = ['development', 'testing', 'production'];
      for (var i = 0; i < envs.length; i++) {
        expect(api.CONFIGS_MAP[envs[i]].timeout).toBeGreaterThan(0);
      }
    });
  });

  // ==================================================================
  // 配置优先级 #1: 编译常量 DEFAULT_ENV 优先级最高
  // ==================================================================

  describe('配置优先级 - 编译常量优先', () => {
    test('DEFAULT_ENV=production 时读取 production 配置', () => {
      setupMockWx();
      (global as any).DEFAULT_ENV = 'production';
      jest.resetModules();
      var api = require('../miniprogram/config/api');
      expect(api.CURRENT_ENV).toBe('production');
      expect(api.API_CONFIG.baseURL).toBe(
        'https://api.baby-album.com/api/v1'
      );
    });

    test('DEFAULT_ENV 覆盖持久化存储中的值', () => {
      // 存储中保存的是 development
      setupMockWx({
        [ENV_STORAGE_KEY]: { env: 'development', timestamp: Date.now() },
      });
      // 编译常量指定 production
      (global as any).DEFAULT_ENV = 'production';
      jest.resetModules();
      var api = require('../miniprogram/config/api');
      // 编译常量应覆盖存储
      expect(api.CURRENT_ENV).toBe('production');
    });

    test('DEFAULT_ENV 为无效值时跳过编译常量分支', () => {
      setupMockWx({
        [ENV_STORAGE_KEY]: { env: 'development', timestamp: Date.now() },
      });
      (global as any).DEFAULT_ENV = 'invalid';
      jest.resetModules();
      var api = require('../miniprogram/config/api');
      // 无效的 DEFAULT_ENV 应降级到存储中的值
      expect(api.CURRENT_ENV).toBe('development');
    });
  });

  // ==================================================================
  // 配置优先级 #2: 持久化存储次优先
  // ==================================================================

  describe('配置优先级 - 持久化存储次优先', () => {
    test('无编译常量时持久化配置生效', () => {
      setupMockWx({
        [ENV_STORAGE_KEY]: { env: 'development', timestamp: Date.now() },
      });
      var api = require('../miniprogram/config/api');
      expect(api.CURRENT_ENV).toBe('development');
      expect(api.API_CONFIG.baseURL).toBe(
        'http://localhost:8000/api/v1'
      );
    });

    test('持久化存储中无效的环境值应回退到默认值', () => {
      setupMockWx({
        [ENV_STORAGE_KEY]: { env: 'nonexistent_env', timestamp: Date.now() },
      });
      var api = require('../miniprogram/config/api');
      expect(api.CURRENT_ENV).toBe('testing');
    });

    test('持久化存储值结构不完整应回退', () => {
      // 有 env 字段但 configs 中不存在
      setupMockWx({
        [ENV_STORAGE_KEY]: { timestamp: Date.now() },
      });
      var api = require('../miniprogram/config/api');
      expect(api.CURRENT_ENV).toBe('testing');
    });
  });

  // ==================================================================
  // 配置优先级 #3: 默认值回退
  // ==================================================================

  describe('配置优先级 - 默认值回退', () => {
    test('无任何配置时默认使用 testing 环境', () => {
      setupMockWx();
      var api = require('../miniprogram/config/api');
      expect(api.CURRENT_ENV).toBe('testing');
      expect(api.API_CONFIG.baseURL).toBe(
        'http://101.126.41.146:8000/api/v1'
      );
    });

    test('wx.getStorageSync 抛出异常时回退到默认值', () => {
      (global as any).wx = {
        getStorageSync: function (): any {
          throw new Error('模拟 storage 读取失败');
        },
      };
      var api = require('../miniprogram/config/api');
      expect(api.CURRENT_ENV).toBe('testing');
    });
  });

  // ==================================================================
  // isEnvSwitchable 运行时切换开关
  // ==================================================================

  describe('isEnvSwitchable 运行时切换开关', () => {
    test('DEFAULT_ENV=production 时禁用运行时切换', () => {
      (global as any).DEFAULT_ENV = 'production';
      jest.resetModules();
      var api = require('../miniprogram/config/api');
      expect(api.isEnvSwitchable()).toBe(false);
    });

    test('DEFAULT_ENV=testing 时禁用运行时切换', () => {
      (global as any).DEFAULT_ENV = 'testing';
      jest.resetModules();
      var api = require('../miniprogram/config/api');
      expect(api.isEnvSwitchable()).toBe(false);
    });

    test('DEFAULT_ENV=development 时允许运行时切换', () => {
      (global as any).DEFAULT_ENV = 'development';
      jest.resetModules();
      var api = require('../miniprogram/config/api');
      expect(api.isEnvSwitchable()).toBe(true);
    });

    test('无编译常量时允许运行时切换', () => {
      setupMockWx();
      var api = require('../miniprogram/config/api');
      expect(api.isEnvSwitchable()).toBe(true);
    });
  });

  // ==================================================================
  // 导出完整性
  // ==================================================================

  describe('导出完整性', () => {
    test('应导出 API_CONFIG / CURRENT_ENV / CONFIGS_MAP / ENV_STORAGE_KEY / isEnvSwitchable', () => {
      setupMockWx();
      var api = require('../miniprogram/config/api');
      expect(api.API_CONFIG).toBeDefined();
      expect(api.CURRENT_ENV).toBeDefined();
      expect(api.CONFIGS_MAP).toBeDefined();
      expect(api.ENV_STORAGE_KEY).toBeDefined();
      expect(api.isEnvSwitchable).toBeDefined();
    });

    test('ENV_STORAGE_KEY 应为 baby_diary_env_config', () => {
      setupMockWx();
      var api = require('../miniprogram/config/api');
      expect(api.ENV_STORAGE_KEY).toBe('baby_diary_env_config');
    });
  });
});

export {};