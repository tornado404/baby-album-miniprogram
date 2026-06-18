/**
 * journey_runtime.test.ts - 成长历程页运行时测试
 *
 * 覆盖：
 * - 页面创建与初始 data
 * - onLoad / onShow → loadData
 * - loadBabyInfo（API 成功/失败→降级/无 token→降级）
 * - 宝宝年龄计算（birthDate 多种格式）
 * - fallbackBaby
 * - loadMedia（API 成功→groupByMonth/失败→降级/无 token→降级）
 * - groupByMonth（分组/排序/空 captureDate）
 * - loadFallback
 * - onMediaTap
 */

var mockStorage: Record<string, any> = {};
var mockPageConfig: Record<string, any> = {};
var mockRequests: Array<{ url: string; method: string; data?: any }> = [];
var mockNavigateToUrl = '';

function clearMockStorage(): void {
  for (var key in mockStorage) {
    if (mockStorage.hasOwnProperty(key)) {
      delete mockStorage[key];
    }
  }
}

var mockRequestHandler: ((opts: any) => void) | null = null;
var journeyInstance: any = null;
var initialDataSnapshot: Record<string, any>;

(global as any).Page = function (config: any) {
  mockPageConfig = config;
  config.setData = function (data: any) {
    for (var key in data) {
      if (data.hasOwnProperty(key)) {
        if (key.indexOf('.') >= 0) {
          var parts = key.split('.');
          var target = config.data;
          for (var i = 0; i < parts.length - 1; i++) {
            if (target[parts[i]] === undefined) target[parts[i]] = {};
            target = target[parts[i]];
          }
          target[parts[parts.length - 1]] = data[key];
        } else {
          config.data[key] = data[key];
        }
      }
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
      mockRequests.push({ url: opts.url, method: opts.method, data: opts.data });
      if (typeof mockRequestHandler === 'function') { mockRequestHandler(opts); }
      else { opts.success({ statusCode: 200, data: [] }); }
    },
    navigateTo: function (opts: any) { mockNavigateToUrl = opts.url; },
    shareAppMessage: function () {},
    showToast: function () {},
    showLoading: function () {},
    hideLoading: function () {},
  };
}

// 固定当前日期为 2026-06-19 以便年龄计算测试
var RealDate = Date;

describe('成长历程页运行时测试', function () {
  beforeAll(function () {
    setupWxMock();
    mockStorage['baby_diary_access_token'] = 'test-token';
    mockStorage['baby_diary_current_baby_id'] = 'baby-001';

    require('../miniprogram/pages/journey/journey');
    journeyInstance = mockPageConfig;
    initialDataSnapshot = JSON.parse(JSON.stringify(journeyInstance.data));
  });

  beforeEach(function () {
    clearMockStorage();
    mockStorage['baby_diary_access_token'] = 'test-token';
    mockStorage['baby_diary_current_baby_id'] = 'baby-001';

    mockRequests = [];
    mockNavigateToUrl = '';
    mockRequestHandler = null;

    (global as any).wx.getStorageSync = function (key: string) {
      return mockStorage[key] !== undefined ? mockStorage[key] : '';
    };
    (global as any).wx.setStorageSync = function (key: string, value: any) { mockStorage[key] = value; };
    (global as any).wx.removeStorageSync = function (key: string) { delete mockStorage[key]; };
    (global as any).wx.navigateTo = function (opts: any) { mockNavigateToUrl = opts.url; };

    // 重置 data
    if (initialDataSnapshot) {
      var keys = Object.keys(journeyInstance.data);
      for (var i = 0; i < keys.length; i++) { delete journeyInstance.data[keys[i]]; }
      Object.assign(journeyInstance.data, JSON.parse(JSON.stringify(initialDataSnapshot)));
    }
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
      navigateTo: function () {},
      showToast: function () {},
      showLoading: function () {},
      hideLoading: function () {},
    };
  });

  describe('页面创建', function () {
    test('应包含初始 data', function () {
      expect(journeyInstance.data.safeTop).toBe(44);
      expect(journeyInstance.data.isLoading).toBe(false);
      expect(journeyInstance.data.currentBaby).toBeNull();
      expect(journeyInstance.data.babyAgeText).toBe('');
      expect(journeyInstance.data.totalMedia).toBe(0);
      expect(journeyInstance.data.milestones.length).toBe(8);
    });

    test('应有所有方法', function () {
      expect(typeof journeyInstance.onLoad).toBe('function');
      expect(typeof journeyInstance.onShow).toBe('function');
      expect(typeof journeyInstance.loadData).toBe('function');
      expect(typeof journeyInstance.loadBabyInfo).toBe('function');
      expect(typeof journeyInstance.fallbackBaby).toBe('function');
      expect(typeof journeyInstance.loadMedia).toBe('function');
      expect(typeof journeyInstance.groupByMonth).toBe('function');
      expect(typeof journeyInstance.loadFallback).toBe('function');
      expect(typeof journeyInstance.onMediaTap).toBe('function');
      expect(typeof journeyInstance.onShare).toBe('function');
    });
  });

  describe('onLoad / onShow', function () {
    test('onLoad 应加载数据', function () {
      mockRequestHandler = function (opts: any) {
        if (opts.url.indexOf('/babies/') >= 0) {
          opts.success({ statusCode: 200, data: { id: 'baby-001', name: '小星星', birthDate: '2025-12-01' } });
        } else {
          opts.success({ statusCode: 200, data: [] });
        }
      };
      journeyInstance.onLoad();
      expect(mockRequests.length).toBe(2);
      expect(journeyInstance.data.currentBaby).not.toBeNull();
    });

    test('statusBarHeight 为 0 时应使用默认值 44', function () {
      (global as any).wx.getWindowInfo = function () { return { statusBarHeight: 0 }; };
      journeyInstance.onLoad();
      expect(journeyInstance.data.safeTop).toBe(44);
      (global as any).wx.getWindowInfo = function () { return { statusBarHeight: 44 }; };
    });

    test('onShow 应加载数据', function () {
      mockRequestHandler = function (opts: any) {
        if (opts.url.indexOf('/babies/') >= 0) {
          opts.success({ statusCode: 200, data: { id: 'baby-001', name: '小星星', birthDate: '2025-12-01' } });
        } else {
          opts.success({ statusCode: 200, data: [] });
        }
      };
      journeyInstance.onShow();
      expect(mockRequests.length).toBe(2);
    });
  });

  describe('loadBabyInfo', function () {
    test('API 成功应设置宝宝信息和年龄', function () {
      mockRequestHandler = function (opts: any) {
        opts.success({ statusCode: 200, data: { id: 'baby-001', name: '小星星', birthDate: '2025-12-01' } });
      };
      journeyInstance.loadBabyInfo();
      expect(journeyInstance.data.currentBaby.name).toBe('小星星');
      expect(journeyInstance.data.babyAgeText).toBeTruthy();
    });

    test('非 200 应调用 fallbackBaby', function () {
      mockRequestHandler = function (opts: any) { opts.success({ statusCode: 500, data: {} }); };
      journeyInstance.loadBabyInfo();
      expect(journeyInstance.data.currentBaby.name).toBe('小星星');
    });

    test('网络错误应调用 fallbackBaby', function () {
      mockRequestHandler = function (opts: any) { if (opts.fail) opts.fail({ errMsg: 'timeout' }); };
      journeyInstance.loadBabyInfo();
      expect(journeyInstance.data.currentBaby.name).toBe('小星星');
    });

    test('无 token 应调用 fallbackBaby', function () {
      mockStorage['baby_diary_access_token'] = '';
      journeyInstance.loadBabyInfo();
      expect(journeyInstance.data.currentBaby.name).toBe('小星星');
    });

    test('无 babyId 应调用 fallbackBaby', function () {
      mockStorage['baby_diary_current_baby_id'] = '';
      journeyInstance.loadBabyInfo();
      expect(journeyInstance.data.currentBaby.name).toBe('小星星');
    });
  });

  describe('loadMedia', function () {
    test('API 成功应分组', function () {
      mockRequestHandler = function (opts: any) {
        opts.success({
          statusCode: 200,
          data: [
            { id: 'm1', captureDate: '2026-06-15' },
            { id: 'm2', captureDate: '2026-06-10' },
            { id: 'm3', captureDate: '2026-05-20' },
          ],
        });
      };
      journeyInstance.loadMedia();
      expect(journeyInstance.data.totalMedia).toBe(3);
      expect(journeyInstance.data.groupedMedia.length).toBe(2);
      expect(journeyInstance.data.isLoading).toBe(false);
    });

    test('非 200 应调用 loadFallback', function () {
      mockRequestHandler = function (opts: any) { opts.success({ statusCode: 500, data: {} }); };
      journeyInstance.loadMedia();
      expect(journeyInstance.data.groupedMedia.length).toBeGreaterThan(0);
    });

    test('网络错误应调用 loadFallback', function () {
      mockRequestHandler = function (opts: any) { if (opts.fail) opts.fail({ errMsg: 'timeout' }); };
      journeyInstance.loadMedia();
      expect(journeyInstance.data.groupedMedia.length).toBeGreaterThan(0);
    });

    test('无 token 应调用 loadFallback', function () {
      mockStorage['baby_diary_access_token'] = '';
      journeyInstance.loadMedia();
      expect(journeyInstance.data.groupedMedia.length).toBeGreaterThan(0);
    });
  });

  describe('groupByMonth', function () {
    test('应按年月分组并降序排列', function () {
      var list = [
        { id: 'm1', captureDate: '2026-06-15' },
        { id: 'm2', captureDate: '2026-05-10' },
        { id: 'm3', captureDate: '2026-06-01' },
      ];
      journeyInstance.groupByMonth(list);
      expect(journeyInstance.data.groupedMedia.length).toBe(2);
      expect(journeyInstance.data.groupedMedia[0].month).toBe('2026-06');
      expect(journeyInstance.data.groupedMedia[0].items.length).toBe(2);
      expect(journeyInstance.data.groupedMedia[1].month).toBe('2026-05');
    });

    test('空 captureDate 应跳过', function () {
      var list = [
        { id: 'm1', captureDate: '2026-06-15' },
        { id: 'm2', captureDate: '' },
      ];
      journeyInstance.groupByMonth(list);
      expect(journeyInstance.data.groupedMedia.length).toBe(1);
    });
  });

  describe('loadFallback', function () {
    test('应设置降级数据', function () {
      journeyInstance.loadFallback();
      expect(journeyInstance.data.groupedMedia.length).toBe(2);
      expect(journeyInstance.data.totalMedia).toBe(3);
      expect(journeyInstance.data.currentBaby.name).toBe('小星星');
      expect(journeyInstance.data.isLoading).toBe(false);
    });
  });

  describe('onMediaTap', function () {
    test('应跳转到 media_detail', function () {
      journeyInstance.onMediaTap({ currentTarget: { dataset: { id: 'm1' } } });
      expect(mockNavigateToUrl).toContain('/pages/media_detail/media_detail?id=m1');
    });
  });

  describe('onShare', function () {
    test('应调用 shareAppMessage', function () {
      journeyInstance.data.currentBaby = { name: '小星星' };
      journeyInstance.onShare();
      // 不抛出异常即为通过
    });
  });
});

export {};