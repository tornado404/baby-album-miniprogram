/**
 * services/config_service.ts 单元测试
 *
 * 测试覆盖：环境列表查询、环境切换、生产构建禁用、重置、提示文字
 * 注意：config_service.ts 依赖 config/api.ts 的模块级导出，
 * 使用 jest.mock 模拟 config/api.ts 的返回值。
 */

// ==================== Mock config/api.ts ====================

var mockCurrentEnv: string = 'testing';
var mockSwitchable: boolean = true;

jest.mock('../miniprogram/config/api', () => {
  var CONFIGS_MAP: Record<string, any> = {
    development: {
      baseURL: 'http://localhost:8000/api/v1',
      timeout: 15000,
      name: '本地开发',
      desc: '本地 Docker Compose 环境',
    },
    testing: {
      baseURL: 'http://101.126.41.146:8000/api/v1',
      timeout: 15000,
      name: '测试服务器',
      desc: '云服务器测试环境',
    },
    production: {
      baseURL: 'https://api.baby-album.com/api/v1',
      timeout: 20000,
      name: '生产环境',
      desc: '正式上线环境',
    },
  };
  return {
    CONFIGS_MAP: CONFIGS_MAP,
    CURRENT_ENV: mockCurrentEnv,
    isEnvSwitchable: function () { return mockSwitchable; },
    ENV_STORAGE_KEY: 'baby_diary_env_config',
  };
});

// ==================== Mock wx API ====================

var mockStorage: Record<string, any> = {};

function setupMockWx(): void {
  mockStorage = {};
  (global as any).wx = {
    getStorageSync: function (key: string): any {
      return mockStorage[key] !== undefined ? mockStorage[key] : '';
    },
    setStorageSync: function (key: string, value: any): void {
      mockStorage[key] = value;
    },
    removeStorageSync: function (key: string): void {
      delete mockStorage[key];
    },
  };
}

function clearMocks(): void {
  (global as any).wx = undefined;
}

// ==================== Tests ====================

describe('config_service.ts - 运行时配置切换服务', () => {
  var configService: any;

  beforeAll(() => {
    // 重置环境
    mockCurrentEnv = 'testing';
    mockSwitchable = true;
  });

  beforeEach(() => {
    jest.resetModules();
    setupMockWx();
    configService = require('../miniprogram/services/config_service').configService;
  });

  afterEach(() => {
    clearMocks();
  });

  // ==================================================================
  // getAvailableEnvs
  // ==================================================================

  describe('getAvailableEnvs - 获取可用环境列表', () => {
    test('应返回 3 个环境', () => {
      var envs = configService.getAvailableEnvs();
      expect(envs.length).toBe(3);
    });

    test('每个环境应包含 key/name/desc 字段', () => {
      var envs = configService.getAvailableEnvs();
      for (var i = 0; i < envs.length; i++) {
        expect(envs[i].key).toBeTruthy();
        expect(envs[i].name).toBeTruthy();
        expect(envs[i].desc).toBeTruthy();
      }
    });

    test('development 环境信息正确', () => {
      var envs = configService.getAvailableEnvs();
      var dev = envs.filter(function (e: any) { return e.key === 'development'; });
      expect(dev.length).toBe(1);
      expect(dev[0].name).toBe('本地开发');
    });
  });

  // ==================================================================
  // getCurrentEnv / getCurrentEnvName
  // ==================================================================

  describe('getCurrentEnv - 获取当前环境', () => {
    test('默认返回 testing', () => {
      expect(configService.getCurrentEnv()).toBe('testing');
    });

    test('getCurrentEnvName 返回显示名称', () => {
      expect(configService.getCurrentEnvName()).toBe('测试服务器');
    });
  });

  // ==================================================================
  // switchTo - 切换环境
  // ==================================================================

  describe('switchTo - 切换环境', () => {
    test('切换到合法环境返回 true 且写入 storage', () => {
      var result = configService.switchTo('development');
      expect(result).toBe(true);
      expect(mockStorage['baby_diary_env_config']).toBeDefined();
      expect(mockStorage['baby_diary_env_config'].env).toBe('development');
    });

    test('切换到非法环境返回 false 且不写入 storage', () => {
      var result = configService.switchTo('invalid');
      expect(result).toBe(false);
      expect(mockStorage['baby_diary_env_config']).toBeUndefined();
    });

    test('生产构建下禁用切换', () => {
      mockSwitchable = false;
      // 重新加载模块（mock 已更新）
      jest.resetModules();
      configService = require('../miniprogram/services/config_service').configService;
      var result = configService.switchTo('development');
      expect(result).toBe(false);
      expect(mockStorage['baby_diary_env_config']).toBeUndefined();
    });
  });

  // ==================================================================
  // resetToDefault - 重置到默认
  // ==================================================================

  describe('resetToDefault - 重置到默认环境', () => {
    test('有 storage 配置时重置成功', () => {
      // 预设 storage
      mockStorage['baby_diary_env_config'] = { env: 'development', timestamp: Date.now() };
      var result = configService.resetToDefault();
      expect(result).toBe(true);
      expect(mockStorage['baby_diary_env_config']).toBeUndefined();
    });

    test('无 storage 配置时重置返回 true', () => {
      var result = configService.resetToDefault();
      expect(result).toBe(true);
    });
  });

  // ==================================================================
  // getSwitchTip - 切换提示文字
  // ==================================================================

  describe('getSwitchTip - 切换提示文字', () => {
    test('返回非空字符串', () => {
      var tip = configService.getSwitchTip();
      expect(tip).toBeTruthy();
      expect(typeof tip).toBe('string');
      expect(tip.length).toBeGreaterThan(0);
    });

    test('包含重启提示', () => {
      var tip = configService.getSwitchTip();
      expect(tip).toContain('重启');
    });
  });
});

export {};