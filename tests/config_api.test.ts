/**
 * config/api.ts 环境配置中心单元测试
 *
 * 测试目标：FR-01 多环境配置定义、配置读取优先级、非法值处理、isEnvSwitchable
 *
 * 注意：config/api.ts 有模块级副作用（getCurrentEnv() 在 import 时执行），
 * 每个测试用例依赖不同的全局状态（wx storage），
 * 因此使用 jest.resetModules() + 动态 require() 模拟不同场景。
 *
 * 注意：DEFAULT_ENV 是 build-time 注入（declare var 被 TypeScript 擦除），
 * 但可通过 global.DEFAULT_ENV 在 Jest 环境中模拟注入，
 * 使 typeof DEFAULT_ENV 检查通过并执行相关代码路径。
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

    test('testing 环境应指向测试服务器', () => {
      setupMockWx();
      var api = require('../miniprogram/config/api');
      expect(api.CONFIGS_MAP.testing.baseURL).toBe(
        'http://192.168.50.126:8000/api/v1'
      );
    });

    test('production 环境应指向云服务器', () => {
      setupMockWx();
      var api = require('../miniprogram/config/api');
      expect(api.CONFIGS_MAP.production.baseURL).toBe(
        'http://101.126.41.146:8000/api/v1'
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
  // 配置优先级: 持久化存储 > 默认值 'testing'
  // (DEFAULT_ENV 编译常量由 CI/CD 构建时注入，Jest 环境不可模拟)
  // ==================================================================

  describe('配置优先级 - 持久化存储', () => {
    test('storage 有 development 配置时使用 development', () => {
      setupMockWx({
        [ENV_STORAGE_KEY]: { env: 'development', timestamp: Date.now() },
      });
      var api = require('../miniprogram/config/api');
      expect(api.CURRENT_ENV).toBe('development');
      expect(api.API_CONFIG.baseURL).toBe(
        'http://localhost:8000/api/v1'
      );
    });

    test('storage 有 production 配置时使用 production', () => {
      setupMockWx({
        [ENV_STORAGE_KEY]: { env: 'production', timestamp: Date.now() },
      });
      var api = require('../miniprogram/config/api');
      expect(api.CURRENT_ENV).toBe('production');
      expect(api.API_CONFIG.baseURL).toBe(
        'http://101.126.41.146:8000/api/v1'
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
        'http://192.168.50.126:8000/api/v1'
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

  // ==================================================================
  // DEFAULT_ENV 编译常量分支覆盖（global 注入模拟 CI/CD 构建）
  // ==================================================================

  describe('DEFAULT_ENV 编译常量 - getCurrentEnv', () => {
    test('DEFAULT_ENV=testing 时 CURRENT_ENV 应为 testing', () => {
      (global as any).DEFAULT_ENV = 'testing';
      setupMockWx();
      var api = require('../miniprogram/config/api');
      expect(api.CURRENT_ENV).toBe('testing');
      expect(api.API_CONFIG.baseURL).toBe('http://192.168.50.126:8000/api/v1');
    });

    test('DEFAULT_ENV=development 时 CURRENT_ENV 应为 development', () => {
      (global as any).DEFAULT_ENV = 'development';
      setupMockWx();
      var api = require('../miniprogram/config/api');
      expect(api.CURRENT_ENV).toBe('development');
      expect(api.API_CONFIG.baseURL).toBe('http://localhost:8000/api/v1');
    });
  });

  describe('DEFAULT_ENV 编译常量 - isEnvSwitchable', () => {
    test('DEFAULT_ENV=testing 时不允许运行时切换', () => {
      (global as any).DEFAULT_ENV = 'testing';
      setupMockWx();
      var api = require('../miniprogram/config/api');
      expect(api.isEnvSwitchable()).toBe(false);
    });

    test('DEFAULT_ENV=development 时允许运行时切换', () => {
      (global as any).DEFAULT_ENV = 'development';
      setupMockWx();
      var api = require('../miniprogram/config/api');
      expect(api.isEnvSwitchable()).toBe(true);
    });

    test('DEFAULT_ENV=production 时不允许运行时切换', () => {
      (global as any).DEFAULT_ENV = 'production';
      setupMockWx();
      var api = require('../miniprogram/config/api');
      expect(api.isEnvSwitchable()).toBe(false);
    });
  });

  describe('isEnvSwitchable 运行时切换开关（无编译常量）', () => {
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