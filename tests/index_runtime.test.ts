/**
 * index_runtime.test.ts - 入口路由页运行时测试
 *
 * 覆盖：
 * - onLoad: 始终跳 album_home（取消强制登录，浏览优先）
 */

var mockReLaunchUrl = '';
var mockPageConfig: Record<string, any> = {};

(global as any).Page = function (config: any) {
  mockPageConfig = config;
  return config;
};

function setupWxMock(): void {
  (global as any).wx = {
    getStorageSync: function (_key: string) { return ''; },
    reLaunch: function (opts: any) { mockReLaunchUrl = opts.url; },
  };
}

describe('入口路由页运行时测试', function () {
  beforeAll(function () {
    setupWxMock();
    require('../miniprogram/pages/index/index');
  });

  beforeEach(function () {
    mockReLaunchUrl = '';
    (global as any).wx.reLaunch = function (opts: any) { mockReLaunchUrl = opts.url; };
  });

  afterAll(function () {
    delete (global as any).Page;
    (global as any).wx = {
      getStorageSync: function () { return ''; },
      reLaunch: function () {},
    };
  });

  describe('onLoad', function () {
    test('始终跳 album_home（无论是否有 token）', function () {
      mockPageConfig.onLoad();
      expect(mockReLaunchUrl).toBe('/pages/album_home/album_home');
    });
  });
});

export {};
