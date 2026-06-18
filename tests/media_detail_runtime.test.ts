/**
 * media_detail_runtime.test.ts - 媒体详情页运行时测试
 *
 * 覆盖：
 * - 页面创建与初始数据
 * - onLoad（有/无 id 参数）
 * - loadMedia（成功、API 错误→降级、网络错误→降级）
 * - loadFallback
 * - goBack
 * - onActionsTap / onActionsCancel
 * - onActionsSelect（各 Action 分发）
 * - onEditTap
 * - onDownloadTap
 * - onShareTap
 * - onDeleteTap
 */

var mockStorage: Record<string, any> = {};

function clearMockStorage(): void {
  for (var key in mockStorage) {
    if (mockStorage.hasOwnProperty(key)) {
      delete mockStorage[key];
    }
  }
}

var mockPageConfig: Record<string, any> = {};
var mockRequests: Array<{ url: string; method: string }> = [];
var mockShowToastCalls: Array<{ title: string; icon?: string }> = [];
var mockShowModalCalls: Array<{ title: string; content?: string; editable?: boolean }> = [];
var mockNavigateBackCalled = false;
var mockShowShareMenuCalled = false;

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
      mockRequests.push({ url: opts.url, method: opts.method });
      if (typeof mockRequestHandler === 'function') { mockRequestHandler(opts); }
      else { opts.success({ statusCode: 200, data: {} }); }
    },
    showToast: function (opts: any) { mockShowToastCalls.push({ title: opts.title, icon: opts.icon }); },
    showModal: function (opts: any) {
      mockShowModalCalls.push({ title: opts.title, content: opts.content, editable: opts.editable });
      if (typeof mockModalHandler === 'function') { mockModalHandler(opts); }
    },
    navigateBack: function () { mockNavigateBackCalled = true; },
    showShareMenu: function () { mockShowShareMenuCalled = true; },
    showLoading: function () {},
    hideLoading: function () {},
  };
}

var mockRequestHandler: ((opts: any) => void) | null = null;
var mockModalHandler: ((opts: any) => void) | null = null;
var mediaDetailInstance: any = null;
var initialDataSnapshot: Record<string, any>;

describe('媒体详情页运行时测试', function () {
  beforeAll(function () {
    setupWxMock();
    mockStorage['baby_diary_access_token'] = 'test-token';
    require('../miniprogram/pages/media_detail/media_detail.js');
    mediaDetailInstance = mockPageConfig;
    initialDataSnapshot = JSON.parse(JSON.stringify(mediaDetailInstance.data));
  });

  beforeEach(function () {
    clearMockStorage();
    mockStorage['baby_diary_access_token'] = 'test-token';
    mockRequests = [];
    mockShowToastCalls = [];
    mockShowModalCalls = [];
    mockNavigateBackCalled = false;
    mockShowShareMenuCalled = false;
    mockRequestHandler = null;
    mockModalHandler = null;
    // 重置 data
    if (initialDataSnapshot) {
      var keys = Object.keys(mediaDetailInstance.data);
      for (var i = 0; i < keys.length; i++) { delete mediaDetailInstance.data[keys[i]]; }
      Object.assign(mediaDetailInstance.data, JSON.parse(JSON.stringify(initialDataSnapshot)));
    }
    (global as any).wx.getStorageSync = function (key: string) {
      return mockStorage[key] !== undefined ? mockStorage[key] : '';
    };
  });

  afterAll(function () {
    delete (global as any).Page;
    // 保留 wx 避免 pending setTimeout 回调报错
    (global as any).wx = {
      getStorageSync: function () { return ''; },
      setStorageSync: function () {},
      removeStorageSync: function () {},
      getWindowInfo: function () { return { statusBarHeight: 44 }; },
      getSystemInfoSync: function () { return { language: 'zh_CN' }; },
      request: function () {},
      showToast: function () {},
      showModal: function () {},
      navigateBack: function () {},
      showShareMenu: function () {},
      showLoading: function () {},
      hideLoading: function () {},
    };
  });

  describe('页面创建', function () {
    test('应包含初始 data', function () {
      expect(mediaDetailInstance.data.safeTop).toBe(44);
      expect(mediaDetailInstance.data.media).toBeNull();
      expect(mediaDetailInstance.data.isLoading).toBe(false);
      expect(mediaDetailInstance.data.showActions).toBe(false);
      expect(mediaDetailInstance.data.actions.length).toBe(4);
    });

    test('应有所有方法', function () {
      expect(typeof mediaDetailInstance.onLoad).toBe('function');
      expect(typeof mediaDetailInstance.loadMedia).toBe('function');
      expect(typeof mediaDetailInstance.loadFallback).toBe('function');
      expect(typeof mediaDetailInstance.goBack).toBe('function');
      expect(typeof mediaDetailInstance.onActionsTap).toBe('function');
      expect(typeof mediaDetailInstance.onActionsCancel).toBe('function');
      expect(typeof mediaDetailInstance.onActionsSelect).toBe('function');
      expect(typeof mediaDetailInstance.onEditTap).toBe('function');
      expect(typeof mediaDetailInstance.onDownloadTap).toBe('function');
      expect(typeof mediaDetailInstance.onShareTap).toBe('function');
      expect(typeof mediaDetailInstance.onDeleteTap).toBe('function');
    });
  });

  describe('onLoad', function () {
    test('有 id 应加载媒体', function () {
      mockRequestHandler = function (opts: any) {
        opts.success({ statusCode: 200, data: { id: 'm1', title: 'Test', babyAge: { years: 0, months: 6, days: 3 } } });
      };
      mediaDetailInstance.onLoad({ id: 'media-123' });
      expect(mockRequests.length).toBe(1);
      expect(mediaDetailInstance.data.media).toBeDefined();
      expect(mediaDetailInstance.data.isLoading).toBe(false);
    });

    test('无 id 不应加载', function () {
      mediaDetailInstance.onLoad({});
      expect(mockRequests.length).toBe(0);
    });

    test('无 options 不应加载', function () {
      mediaDetailInstance.onLoad();
      expect(mockRequests.length).toBe(0);
    });

    test('getWindowInfo 异常应使用默认 safeTop', function () {
      (global as any).wx.getWindowInfo = function () { throw new Error('fail'); };
      mediaDetailInstance.onLoad({});
      expect(mediaDetailInstance.data.safeTop).toBe(44);
    });

    test('statusBarHeight 为 0 时应使用默认值 44', function () {
      (global as any).wx.getWindowInfo = function () { return { statusBarHeight: 0 }; };
      mediaDetailInstance.onLoad({});
      expect(mediaDetailInstance.data.safeTop).toBe(44);
      (global as any).wx.getWindowInfo = function () { return { statusBarHeight: 44 }; };
    });
  });

  describe('loadMedia', function () {
    test('成功应设置 media 和 babyAgeText', function () {
      mockRequestHandler = function (opts: any) {
        opts.success({
          statusCode: 200,
          data: { id: 'm1', title: '翻身', babyAge: { years: 0, months: 5, days: 14 } },
        });
      };
      mediaDetailInstance.loadMedia('m1');
      expect(mediaDetailInstance.data.media.title).toBe('翻身');
      expect(mediaDetailInstance.data.babyAgeText).toBe('5个月14天');
      expect(mediaDetailInstance.data.isLoading).toBe(false);
    });

    test('非 200 应调用 loadFallback', function () {
      mockRequestHandler = function (opts: any) { opts.success({ statusCode: 500, data: {} }); };
      mediaDetailInstance.loadMedia('m1');
      expect(mediaDetailInstance.data.media.title).toBe('第一次翻身 🎉');
      expect(mediaDetailInstance.data.isLoading).toBe(false);
    });

    test('网络错误应调用 loadFallback', function () {
      mockRequestHandler = function (opts: any) { if (opts.fail) { opts.fail({ errMsg: 'timeout' }); } };
      mediaDetailInstance.loadMedia('m1');
      expect(mediaDetailInstance.data.media).toBeDefined();
      expect(mediaDetailInstance.data.isLoading).toBe(false);
    });
  });

  describe('babyAgeText 格式化', function () {
    test('有 years 应显示岁', function () {
      mockRequestHandler = function (opts: any) {
        opts.success({ statusCode: 200, data: { id: 'm1', babyAge: { years: 1, months: 2, days: 5 } } });
      };
      mediaDetailInstance.loadMedia('m1');
      expect(mediaDetailInstance.data.babyAgeText).toBe('1岁2个月');
    });

    test('years = 0 且 days > 0 应显示天', function () {
      mockRequestHandler = function (opts: any) {
        opts.success({ statusCode: 200, data: { id: 'm1', babyAge: { years: 0, months: 0, days: 10 } } });
      };
      mediaDetailInstance.loadMedia('m1');
      expect(mediaDetailInstance.data.babyAgeText).toBe('10天');
    });

    test('所有值为 0 应空字符串', function () {
      mockRequestHandler = function (opts: any) {
        opts.success({ statusCode: 200, data: { id: 'm1', babyAge: { years: 0, months: 0, days: 0 } } });
      };
      mediaDetailInstance.loadMedia('m1');
      expect(mediaDetailInstance.data.babyAgeText).toBe('');
    });

    test('无 babyAge 字段也应正确加载', function () {
      mockRequestHandler = function (opts: any) {
        opts.success({ statusCode: 200, data: { id: 'm1', title: '无年龄' } });
      };
      mediaDetailInstance.loadMedia('m1');
      expect(mediaDetailInstance.data.media).toBeDefined();
      expect(mediaDetailInstance.data.media.id).toBe('m1');
      expect(mediaDetailInstance.data.babyAgeText).toBe('');
    });
  });

  describe('导航', function () {
    test('goBack 应调用 navigateBack', function () {
      mediaDetailInstance.goBack();
      expect(mockNavigateBackCalled).toBe(true);
    });
  });

  describe('操作面板', function () {
    test('onActionsTap 应显示面板', function () {
      mediaDetailInstance.onActionsTap();
      expect(mediaDetailInstance.data.showActions).toBe(true);
    });

    test('onActionsCancel 应隐藏面板', function () {
      mediaDetailInstance.data.showActions = true;
      mediaDetailInstance.onActionsCancel();
      expect(mediaDetailInstance.data.showActions).toBe(false);
    });
  });

  describe('onActionsSelect', function () {
    test('编辑动作应调用 onEditTap', function () {
      var called = false;
      var orig = mediaDetailInstance.onEditTap;
      mediaDetailInstance.onEditTap = function () { called = true; };
      mediaDetailInstance.onActionsSelect({ currentTarget: { dataset: { index: 0 } } });
      expect(called).toBe(true);
      expect(mediaDetailInstance.data.showActions).toBe(false);
      mediaDetailInstance.onEditTap = orig;
    });

    test('保存动作应调用 onDownloadTap', function () {
      var called = false;
      var orig = mediaDetailInstance.onDownloadTap;
      mediaDetailInstance.onDownloadTap = function () { called = true; };
      mediaDetailInstance.onActionsSelect({ currentTarget: { dataset: { index: 1 } } });
      expect(called).toBe(true);
      mediaDetailInstance.onDownloadTap = orig;
    });

    test('分享动作应调用 onShareTap', function () {
      var called = false;
      var orig = mediaDetailInstance.onShareTap;
      mediaDetailInstance.onShareTap = function () { called = true; };
      mediaDetailInstance.onActionsSelect({ currentTarget: { dataset: { index: 2 } } });
      expect(called).toBe(true);
      mediaDetailInstance.onShareTap = orig;
    });

    test('删除动作应调用 onDeleteTap', function () {
      var called = false;
      var orig = mediaDetailInstance.onDeleteTap;
      mediaDetailInstance.onDeleteTap = function () { called = true; };
      mediaDetailInstance.onActionsSelect({ currentTarget: { dataset: { index: 3 } } });
      expect(called).toBe(true);
      mediaDetailInstance.onDeleteTap = orig;
    });
  });

  describe('onEditTap', function () {
    test('应显示编辑模态框', function () {
      mediaDetailInstance.data.media = { id: 'm1', title: '旧标题' };
      mediaDetailInstance.onEditTap();
      expect(mockShowModalCalls.length).toBe(1);
      expect(mockShowModalCalls[0].title).toBe('编辑描述');
      expect(mockShowModalCalls[0].editable).toBe(true);
    });

    test('确认编辑应更新标题', function () {
      mediaDetailInstance.data.media = { id: 'm1', title: '旧标题' };
      mockModalHandler = function (opts: any) {
        opts.success({ confirm: true, content: '新标题' });
      };
      mediaDetailInstance.onEditTap();
      expect(mediaDetailInstance.data.media.title).toBe('新标题');
      expect(mockShowToastCalls.length).toBeGreaterThan(0);
    });

    test('取消不应更新标题', function () {
      mediaDetailInstance.data.media = { id: 'm1', title: '旧标题' };
      mockModalHandler = function (opts: any) {
        opts.success({ confirm: false, content: '新标题' });
      };
      mediaDetailInstance.onEditTap();
      expect(mediaDetailInstance.data.media.title).toBe('旧标题');
    });
  });

  describe('onDownloadTap', function () {
    test('应显示保存成功', function () {
      mediaDetailInstance.onDownloadTap();
      expect(mockShowToastCalls[0].title).toBe('保存成功');
    });
  });

  describe('onShareTap', function () {
    test('应调用 showShareMenu', function () {
      mediaDetailInstance.onShareTap();
      expect(mockShowShareMenuCalled).toBe(true);
    });
  });

  describe('onDeleteTap', function () {
    test('确认删除应显示 toast 并返回', function () {
      mockModalHandler = function (opts: any) {
        opts.success({ confirm: true });
      };
      mediaDetailInstance.onDeleteTap();
      expect(mockShowToastCalls.length).toBeGreaterThan(0);
      expect(mockShowToastCalls[0].title).toBe('已删除');
    });

    test('取消删除不操作', function () {
      mockModalHandler = function (opts: any) {
        opts.success({ confirm: false });
      };
      mediaDetailInstance.onDeleteTap();
      expect(mockShowToastCalls.length).toBe(0);
    });
  });
});

export {};