/**
 * auth_api.ts 单元测试
 * 测试认证 API 调用封装，验证对 request 模块的调用和 token 处理
 */

var path = require('path');

function setupMockWx(): void {
  var store: Record<string, any> = {};
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
    request: function (opts: any): void {
      // Default: 200 OK with empty data
      opts.success({ statusCode: 200, data: {} });
    },
    redirectTo: function (): void {},
  };
}

function cleanupWx(): void {
  delete (global as any).wx;
}

describe('auth_api - 认证 API 服务', function () {
  var authApi: any;

  beforeEach(function () {
    jest.resetModules();
    setupMockWx();
    authApi = require(path.resolve(__dirname, '../miniprogram/services/auth_api.js')).authApi;
  });

  afterEach(function () {
    cleanupWx();
  });

  // ==================== login ====================

  describe('login', function () {
    test('应 POST /auth/login 并保存 token', function () {
      (global as any).wx.request = function (opts: any) {
        expect(opts.method).toBe('POST');
        expect(opts.url).toContain('/auth/login');
        expect(opts.data.code).toBe('wx-code-123');
        opts.success({
          statusCode: 200,
          data: { accessToken: 'at-1', refreshToken: 'rt-1', userId: 'u1' },
        });
      };
      return authApi.login('wx-code-123').then(function (res: any) {
        // Token should have been saved by auth_api.login
        expect((global as any).wx.getStorageSync('baby_diary_access_token')).toBe('at-1');
        expect((global as any).wx.getStorageSync('baby_diary_refresh_token')).toBe('rt-1');
        expect((global as any).wx.getStorageSync('baby_diary_user_id')).toBe('u1');
        expect(res.accessToken).toBe('at-1');
      });
    });

    test('响应无 accessToken 时不保存 token', function () {
      (global as any).wx.request = function (opts: any) {
        opts.success({ statusCode: 200, data: { message: 'ok' } });
      };
      return authApi.login('code').then(function (res: any) {
        expect((global as any).wx.getStorageSync('baby_diary_access_token')).toBe('');
        expect(res.message).toBe('ok');
      });
    });

    test('网络失败应拒绝', function () {
      (global as any).wx.request = function (opts: any) {
        opts.fail({ errMsg: 'request fail' });
      };
      return authApi.login('code').catch(function (err: any) {
        expect(err).toBeDefined();
      });
    });

    test('非 200 状态码应拒绝', function () {
      (global as any).wx.request = function (opts: any) {
        opts.success({ statusCode: 400, data: { error: 'bad request' } });
      };
      return authApi.login('code').catch(function (err: any) {
        expect(err.status).toBe(400);
      });
    });
  });

  // ==================== refresh ====================

  describe('refresh', function () {
    test('应调用 tokenManager.refresh', function () {
      var refreshCalled = false;
      // Override tokenManager.refresh by re-mocking to verify delegation
      // We can intercept via wx.request since refreshAccessToken calls it
      (global as any).wx.request = function (opts: any) {
        if (opts.url && opts.url.indexOf('/auth/refresh') !== -1) {
          refreshCalled = true;
          opts.success({ statusCode: 200, data: { accessToken: 'new-token' } });
        }
      };
      // Need a stored refresh token for refreshAccessToken to proceed
      (global as any).wx.setStorageSync('baby_diary_refresh_token', 'old-refresh');
      return authApi.refresh().then(function (token: string) {
        expect(refreshCalled).toBe(true);
        expect(token).toBe('new-token');
      });
    });
  });

  // ==================== getProfile ====================

  describe('getProfile', function () {
    test('应 GET /auth/me', function () {
      (global as any).wx.request = function (opts: any) {
        expect(opts.method).toBe('GET');
        expect(opts.url).toContain('/auth/me');
        opts.success({ statusCode: 200, data: { id: 'u1', name: 'Test' } });
      };
      return authApi.getProfile().then(function (data: any) {
        expect(data.name).toBe('Test');
      });
    });

    test('失败应拒绝', function () {
      (global as any).wx.request = function (opts: any) {
        opts.fail({ errMsg: 'network error' });
      };
      return authApi.getProfile().catch(function (err: any) {
        expect(err.message).toBe('Network error');
      });
    });
  });

  // ==================== isLoggedIn ====================

  describe('isLoggedIn', function () {
    test('有 accessToken 时返回 true', function () {
      (global as any).wx.setStorageSync('baby_diary_access_token', 'my-token');
      expect(authApi.isLoggedIn()).toBe(true);
    });

    test('无 accessToken 时返回 false', function () {
      expect(authApi.isLoggedIn()).toBe(false);
    });

    test('accessToken 为空字符串时返回 false', function () {
      (global as any).wx.setStorageSync('baby_diary_access_token', '');
      expect(authApi.isLoggedIn()).toBe(false);
    });
  });
});
export {};
