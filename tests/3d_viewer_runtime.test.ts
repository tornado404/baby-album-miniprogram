/**
 * 3d_viewer_runtime.test.ts - 3D查看页运行时测试
 */

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

var mockNavigateBackCalled = false;
var mockShowToastCalls: Array<{ title: string }> = [];

(global as any).wx = {
  getWindowInfo: function () { return { statusBarHeight: 50 }; },
  navigateBack: function () { mockNavigateBackCalled = true; },
  showToast: function (opts: any) { mockShowToastCalls.push({ title: opts.title }); },
};

var viewerInstance: any;

describe('3D查看页运行时测试', function () {
  beforeAll(function () {
    require('../miniprogram/pages/3d_viewer/3d_viewer.js');
    viewerInstance = mockPageConfig;
  });

  beforeEach(function () {
    mockNavigateBackCalled = false;
    mockShowToastCalls = [];
  });

  test('应包含初始 data', function () {
    expect(viewerInstance.data.safeTop).toBe(44);
  });

  test('onLoad 应设置 safeTop', function () {
    viewerInstance.onLoad();
    expect(viewerInstance.data.safeTop).toBe(50);
  });

  test('statusBarHeight 为 0 时应使用默认值 44', function () {
    (global as any).wx.getWindowInfo = function () { return { statusBarHeight: 0 }; };
    viewerInstance.onLoad();
    expect(viewerInstance.data.safeTop).toBe(44);
  });

  test('statusBarHeight 为 undefined 时应使用默认值 44', function () {
    (global as any).wx.getWindowInfo = function () { return {}; };
    viewerInstance.onLoad();
    expect(viewerInstance.data.safeTop).toBe(44);
  });

  test('onBack 应调用 navigateBack', function () {
    viewerInstance.onBack();
    expect(mockNavigateBackCalled).toBe(true);
  });

  test('onShare 应显示 toast', function () {
    viewerInstance.onShare();
    expect(mockShowToastCalls[0].title).toBe('分享功能开发中');
  });
});

export {};