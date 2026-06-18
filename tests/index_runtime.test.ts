/**
 * index_runtime.test.ts - 入口路由页运行时测试
 *
 * 覆盖：
 * - routeToTarget：有 token + 有宝宝缓存 → 跳 album_home
 * - routeToTarget：有 token + 无缓存 + API 返回宝宝 → 缓存并跳转
 * - routeToTarget：有 token + 无缓存 + API 无宝宝 → 跳 baby_onboarding
 * - routeToTarget：有 token + 无缓存 + 网络错误 → 跳 baby_onboarding
 * - routeToTarget：无 token → 跳 onboarding
 */

var mockStorage: Record<string, any> = {};
var mockRequests: Array<{ url: string; method: string }> = [];
var mockReLaunchUrl = '';

function clearMockStorage(): void {
  for (var key in mockStorage) {
    if (mockStorage.hasOwnProperty(key)) { delete mockStorage[key]; }
  }
}

var mockRequestHandler: ((opts: any) => void) | null = null;
var mockPageConfig: Record<string, any> = {};

(global as any).Page = function (config: any) {
  mockPageConfig = config;
  config.setData = function (data: any) {
    for (var key in data) {
      if (data.hasOwnProperty(key)) { config.data[key] = data[key]; }
    }
  };
  return config;
};

function setupWxMock(): void {
  (global as any).wx = {
    getStorageSync: function (key: string) { return mockStorage[key] !== undefined ? mockStorage[key] : ''; },
    setStorageSync: function (key: string, value: any) { mockStorage[key] = value; },
    removeStorageSync: function (key: string) { delete mockStorage[key]; },
    getWindowInfo: function () { return { statusBarHeight: 44 }; },
    getSystemInfoSync: function () { return { language: 'zh_CN' }; },
    request: function (opts: any) {
      mockRequests.push({ url: opts.url, method: opts.method });
      if (typeof mockRequestHandler === 'function') { mockRequestHandler(opts); }
      else { opts.success({ statusCode: 200, data: [] }); }
    },
    reLaunch: function (opts: any) { mockReLaunchUrl = opts.url; },
    showToast: function () {},
    showModal: function () {},
  };
}

describe('入口路由页运行时测试', function () {
  beforeAll(function () {
    setupWxMock();
    require('../miniprogram/pages/index/index');
  });

  beforeEach(function () {
    clearMockStorage();
    mockRequests = [];
    mockReLaunchUrl = '';
    mockRequestHandler = null;

    (global as any).wx.getStorageSync = function (key: string) {
      return mockStorage[key] !== undefined ? mockStorage[key] : '';
    };
    (global as any).wx.setStorageSync = function (key: string, value: any) { mockStorage[key] = value; };
    (global as any).wx.reLaunch = function (opts: any) { mockReLaunchUrl = opts.url; };
  });

  afterAll(function () {
    delete (global as any).Page;
    (global as any).wx = {
      getStorageSync: function () { return ''; },
      setStorageSync: function () {},
      removeStorageSync: function () {},
      getWindowInfo: function () { return { statusBarHeight: 44 }; },
      getSystemInfoSync: function () { return { language: 'zh_CN' }; },
      request: function () {},
      reLaunch: function () {},
      showToast: function () {},
      showModal: function () {},
    };
  });

  describe('routeToTarget', function () {
    test('有 token 且有宝宝缓存应跳 album_home', function () {
      mockStorage['baby_diary_access_token'] = 'test-token';
      mockStorage['baby_diary_baby_profile'] = { id: 'baby-001', name: '小星星' };
      mockPageConfig.routeToTarget();
      expect(mockReLaunchUrl).toBe('/pages/album_home/album_home');
    });

    test('有 token 无缓存且 API 返回宝宝应缓存并跳转', function () {
      mockStorage['baby_diary_access_token'] = 'test-token';
      mockRequestHandler = function (opts: any) {
        opts.success({ statusCode: 200, data: [{ id: 'baby-001', name: '小星星' }] });
      };
      mockPageConfig.routeToTarget();
      expect(mockReLaunchUrl).toBe('/pages/album_home/album_home');
      expect(mockStorage['album_babies']).toBeDefined();
      expect(mockStorage['baby_diary_baby_profile']).toBeDefined();
    });

    test('有 token 无缓存且 API 无宝宝应跳 baby_onboarding', function () {
      mockStorage['baby_diary_access_token'] = 'test-token';
      mockRequestHandler = function (opts: any) {
        opts.success({ statusCode: 200, data: [] });
      };
      mockPageConfig.routeToTarget();
      expect(mockReLaunchUrl).toBe('/pages/baby_onboarding/baby_onboarding');
    });

    test('有 token 无缓存且 API 错误应跳 baby_onboarding', function () {
      mockStorage['baby_diary_access_token'] = 'test-token';
      mockRequestHandler = function (opts: any) {
        opts.success({ statusCode: 500, data: {} });
      };
      mockPageConfig.routeToTarget();
      expect(mockReLaunchUrl).toBe('/pages/baby_onboarding/baby_onboarding');
    });

    test('有 token 无缓存且网络错误应跳 baby_onboarding', function () {
      mockStorage['baby_diary_access_token'] = 'test-token';
      mockRequestHandler = function (opts: any) {
        if (opts.fail) opts.fail({ errMsg: 'timeout' });
      };
      mockPageConfig.routeToTarget();
      expect(mockReLaunchUrl).toBe('/pages/baby_onboarding/baby_onboarding');
    });

    test('无 token 应跳 onboarding', function () {
      delete mockStorage['baby_diary_access_token'];
      mockPageConfig.routeToTarget();
      expect(mockReLaunchUrl).toBe('/pages/onboarding/onboarding');
    });
  });

  describe('onLoad', function () {
    test('应调用 routeToTarget', function () {
      var called = false;
      var orig = mockPageConfig.routeToTarget;
      mockPageConfig.routeToTarget = function () { called = true; };
      mockPageConfig.onLoad();
      expect(called).toBe(true);
      mockPageConfig.routeToTarget = orig;
    });
  });
});

export {};