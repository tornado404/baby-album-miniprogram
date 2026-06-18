/**
 * request_refresh.test.ts - tokenManager.refresh 独立测试
 *
 * 单独文件以避免模块级 isRefreshing 状态在多测试间污染。
 */

var mockStorage: Record<string, any> = {};
var mockRequests: Array<{ url: string; method: string; data: any; header: any }> = [];
var mockRequestHandler: ((opts: any) => void) | null = null;

function clearMockStorage(): void {
  for (var key in mockStorage) {
    if (mockStorage.hasOwnProperty(key)) {
      delete mockStorage[key];
    }
  }
}

(global as any).wx = {
  getStorageSync: function (key: string) {
    return mockStorage[key] !== undefined ? mockStorage[key] : '';
  },
  setStorageSync: function (key: string, value: any) { mockStorage[key] = value; },
  removeStorageSync: function (key: string) { delete mockStorage[key]; },
  getSystemInfoSync: function () { return { language: 'zh_CN' }; },
  getWindowInfo: function () { return { statusBarHeight: 44 }; },
  request: function (opts: any) {
    mockRequests.push({ url: opts.url, method: opts.method, data: opts.data, header: opts.header });
    if (typeof mockRequestHandler === 'function') {
      mockRequestHandler(opts);
    } else {
      opts.success({ statusCode: 200, data: {} });
    }
  },
  showToast: function () {},
  redirectTo: function () {},
  navigateTo: function () {},
};

var requestModule: any;
var tokenManager: any;

beforeAll(function () {
  requestModule = require('../miniprogram/services/request');
  tokenManager = requestModule.tokenManager;
});

beforeEach(function () {
  clearMockStorage();
  mockRequests = [];
  mockRequestHandler = null;
  mockStorage['baby_diary_access_token'] = 'test-access-token';
  mockStorage['baby_diary_refresh_token'] = 'test-refresh-token';
});

describe('tokenManager.refresh', function () {
  test('成功应返回新 accessToken', function () {
    mockRequestHandler = function (opts: any) {
      opts.success({
        statusCode: 200,
        data: { accessToken: 'refreshed-token', refreshToken: 'new-refresh-token' },
      });
    };
    return tokenManager.refresh().then(function (token: string) {
      expect(token).toBe('refreshed-token');
      expect(mockStorage['baby_diary_access_token']).toBe('refreshed-token');
      expect(mockStorage['baby_diary_refresh_token']).toBe('new-refresh-token');
    });
  });

  test('无 refreshToken 应拒绝并清除 tokens', function () {
    mockStorage['baby_diary_refresh_token'] = '';
    return tokenManager.refresh().catch(function (err: Error) {
      expect(err.message).toBe('No refresh token');
      expect(mockStorage['baby_diary_access_token']).toBeUndefined();
    });
  });

  test('API 返回错误应拒绝', function () {
    mockRequestHandler = function (opts: any) {
      opts.success({ statusCode: 400, data: {} });
    };
    return tokenManager.refresh().catch(function (err: Error) {
      expect(err.message).toBe('Refresh failed');
    });
  });

  test('网络失败应拒绝', function () {
    mockRequestHandler = function (opts: any) {
      if (opts.fail) { opts.fail({ errMsg: 'timeout' }); }
    };
    return tokenManager.refresh().catch(function (err: Error) {
      expect(err.message).toBe('Network error');
    });
  });

  test('并发刷新应排队等待', function () {
    var pendingOps: any[] = [];
    mockRequestHandler = function (opts: any) {
      pendingOps.push(opts);
    };

    var p1 = tokenManager.refresh();
    var p2 = tokenManager.refresh();

    pendingOps[0].success({
      statusCode: 200,
      data: { accessToken: 'token-1' },
    });

    return p1.then(function (t: string) {
      expect(t).toBe('token-1');
      return p2;
    }).then(function (t: string) {
      expect(t).toBe('token-1');
    });
  });
});

export {};