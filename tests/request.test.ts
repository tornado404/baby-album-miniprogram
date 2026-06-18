/**
 * request.test.ts - request.ts 核心 HTTP 请求封装单元测试
 *
 * 覆盖：
 * - getAccessToken / getRefreshToken（正常 + 异常）
 * - saveTokens（含/不含 userId）
 * - clearTokens
 * - apiCall（GET/POST/PUT/DELETE、2xx、4xx、401→刷新→重放、401→刷新→失败→跳转）
 * - request.get 含 params 拼接
 *
 * 注意：tokenManager.refresh 的详细测试见 request_refresh.test.ts
 */

var mockStorage: Record<string, any> = {};

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

var mockRequests: Array<{ url: string; method: string; data: any; header: any }> = [];
var mockRequestHandler: ((opts: any) => void) | null = null;

var requestModule: any;
var request: any;
var tokenManager: any;

describe('request.ts - HTTP 请求封装', function () {
  beforeAll(function () {
    requestModule = require('../miniprogram/services/request');
    request = requestModule.request;
    tokenManager = requestModule.tokenManager;
  });

  beforeEach(function () {
    clearMockStorage();
    mockRequests = [];
    mockRequestHandler = null;
    mockStorage['baby_diary_access_token'] = 'test-access-token';
    mockStorage['baby_diary_refresh_token'] = 'test-refresh-token';
    // 恢复可能被测试覆盖的 wx 函数
    (global as any).wx.getStorageSync = function (key: string) {
      return mockStorage[key] !== undefined ? mockStorage[key] : '';
    };
    (global as any).wx.setStorageSync = function (key: string, value: any) { mockStorage[key] = value; };
    (global as any).wx.removeStorageSync = function (key: string) { delete mockStorage[key]; };
  });

  // ==================== getAccessToken ====================

  describe('getAccessToken', function () {
    test('有 token 应返回 accessToken', function () {
      expect(tokenManager.getAccessToken()).toBe('test-access-token');
    });

    test('无 token 应返回空字符串', function () {
      clearMockStorage();
      expect(tokenManager.getAccessToken()).toBe('');
    });

    test('存储异常应返回空字符串', function () {
      (global as any).wx.getStorageSync = function () { throw new Error('fail'); };
      expect(tokenManager.getAccessToken()).toBe('');
    });
  });

  // ==================== getRefreshToken ====================

  describe('getRefreshToken', function () {
    test('有 token 应返回 refreshToken', function () {
      expect(tokenManager.getRefreshToken()).toBe('test-refresh-token');
    });

    test('存储异常应返回空字符串', function () {
      (global as any).wx.getStorageSync = function () { throw new Error('fail'); };
      expect(tokenManager.getRefreshToken()).toBe('');
    });
  });

  // ==================== saveTokens ====================

  describe('saveTokens', function () {
    test('应保存 accessToken 和 refreshToken', function () {
      tokenManager.saveTokens('new-access', 'new-refresh');
      expect(mockStorage['baby_diary_access_token']).toBe('new-access');
      expect(mockStorage['baby_diary_refresh_token']).toBe('new-refresh');
    });

    test('含 userId 应一并保存', function () {
      tokenManager.saveTokens('a', 'r', 'user-42');
      expect(mockStorage['baby_diary_user_id']).toBe('user-42');
    });

    test('不含 userId 不应保存', function () {
      tokenManager.saveTokens('a', 'r');
      expect(mockStorage['baby_diary_user_id']).toBeUndefined();
    });
  });

  // ==================== clearTokens ====================

  describe('clearTokens', function () {
    test('应清除所有认证相关存储', function () {
      mockStorage['baby_diary_authed'] = true;
      mockStorage['album_babies'] = [{ id: 'b1' }];
      tokenManager.clearTokens();
      expect(mockStorage['baby_diary_access_token']).toBeUndefined();
      expect(mockStorage['baby_diary_refresh_token']).toBeUndefined();
      expect(mockStorage['baby_diary_user_id']).toBeUndefined();
      expect(mockStorage['baby_diary_authed']).toBeUndefined();
      expect(mockStorage['baby_diary_baby_profile']).toBeUndefined();
      expect(mockStorage['album_babies']).toBeUndefined();
      expect(mockStorage['baby_diary_current_baby_id']).toBeUndefined();
    });
  });

  // ==================== apiCall ====================

  describe('apiCall', function () {
    test('GET 请求应正确构建', function () {
      mockRequestHandler = function (opts: any) {
        expect(opts.method).toBe('GET');
        expect(opts.header.Authorization).toBe('Bearer test-access-token');
        opts.success({ statusCode: 200, data: { items: [] } });
      };
      return request.get('/media/list').then(function (data: any) {
        expect(data.items).toBeDefined();
      });
    });

    test('POST 请求应带 data', function () {
      mockRequestHandler = function (opts: any) {
        expect(opts.method).toBe('POST');
        expect(opts.data.name).toBe('test');
        opts.success({ statusCode: 200, data: { id: 1 } });
      };
      return request.post('/media/create', { name: 'test' }).then(function (data: any) {
        expect(data.id).toBe(1);
      });
    });

    test('PUT 请求应带 data', function () {
      mockRequestHandler = function (opts: any) {
        expect(opts.method).toBe('PUT');
        expect(opts.data.title).toBe('updated');
        opts.success({ statusCode: 200, data: { success: true } });
      };
      return request.put('/media/1', { title: 'updated' }).then(function (data: any) {
        expect(data.success).toBe(true);
      });
    });

    test('DELETE 请求', function () {
      mockRequestHandler = function (opts: any) {
        expect(opts.method).toBe('DELETE');
        opts.success({ statusCode: 200, data: { deleted: true } });
      };
      return request.delete('/media/1').then(function (data: any) {
        expect(data.deleted).toBe(true);
      });
    });

    test('2xx 应 resolve data', function () {
      mockRequestHandler = function (opts: any) { opts.success({ statusCode: 201, data: { created: true } }); };
      return request.get('/test').then(function (data: any) { expect(data.created).toBe(true); });
    });

    test('4xx 应 reject', function () {
      mockRequestHandler = function (opts: any) { opts.success({ statusCode: 403, data: { message: 'Forbidden' } }); };
      return request.get('/test').catch(function (err: any) { expect(err.status).toBe(403); });
    });

    test('网络失败应 reject', function () {
      mockRequestHandler = function (opts: any) { if (opts.fail) { opts.fail({ errMsg: 'timeout' }); } };
      return request.get('/test').catch(function (err: any) {
        expect(err.status).toBe(0);
        expect(err.message).toBe('Network error');
      });
    });

    test('无 token 时不添加 Authorization 头', function () {
      clearMockStorage();
      mockRequestHandler = function (opts: any) {
        expect(opts.header.Authorization).toBeUndefined();
        opts.success({ statusCode: 200, data: {} });
      };
      return request.get('/test');
    });

    test('完整 URL 直接使用，不拼接 baseURL', function () {
      mockRequestHandler = function (opts: any) {
        expect(opts.url).toBe('http://external.com/api');
        opts.success({ statusCode: 200, data: {} });
      };
      return request.get('http://external.com/api');
    });
  });

  // ==================== 401 → 自动刷新 ====================

  describe('401 自动刷新', function () {
    test('401 后刷新 token 成功应重放请求', function () {
      var callCount = 0;
      mockRequestHandler = function (opts: any) {
        if (opts.url.indexOf('/auth/refresh') >= 0) {
          opts.success({ statusCode: 200, data: { accessToken: 'refreshed-token' } });
          return;
        }
        callCount++;
        // 第一次返回 401，重放时返回 200
        if (callCount === 1) {
          opts.success({ statusCode: 401, data: {} });
        } else {
          opts.success({ statusCode: 200, data: { retried: true } });
        }
      };
      return request.get('/media/list').then(function (data: any) {
        expect(data.retried).toBe(true);
      });
    });

    test('401 重放仍返回非 2xx 应 reject', function () {
      var callCount = 0;
      mockRequestHandler = function (opts: any) {
        if (opts.url.indexOf('/auth/refresh') >= 0) {
          opts.success({ statusCode: 200, data: { accessToken: 'refreshed-token' } });
          return;
        }
        callCount++;
        if (callCount === 1) {
          opts.success({ statusCode: 401, data: {} });
        } else {
          opts.success({ statusCode: 403, data: { message: 'Forbidden' } });
        }
      };
      return request.get('/media/list').catch(function (err: any) {
        expect(err.status).toBe(403);
        expect(err.data.message).toBe('Forbidden');
      });
    });

    test('401 后刷新失败应跳转登录页', function () {
      mockRequestHandler = function (opts: any) {
        if (opts.url.indexOf('/auth/refresh') >= 0) {
          opts.success({ statusCode: 400, data: {} });
          return;
        }
        opts.success({ statusCode: 401, data: {} });
      };
      var redirectUrl = '';
      (global as any).wx.redirectTo = function (opts: any) { redirectUrl = opts.url; };
      return request.get('/media/list').catch(function (err: Error) {
        expect(err.message).toBe('Session expired');
        expect(redirectUrl).toBe('/pages/index/index');
      });
    });

    test('无 refreshToken 时 401 拒绝并跳转', function () {
      mockStorage['baby_diary_refresh_token'] = '';
      mockRequestHandler = function (opts: any) {
        opts.success({ statusCode: 401, data: {} });
      };
      var redirectUrl = '';
      (global as any).wx.redirectTo = function (opts: any) { redirectUrl = opts.url; };
      return request.get('/media/list').catch(function (err: Error) {
        expect(err.message).toBe('Session expired');
        expect(redirectUrl).toBe('/pages/index/index');
      });
    });
  });

  // ==================== request.get with params ====================

  describe('request.get 参数拼接', function () {
    test('含 params 应拼接到 URL', function () {
      mockRequestHandler = function (opts: any) {
        expect(opts.url).toContain('babyId=b1');
        expect(opts.url).toContain('page=2');
        opts.success({ statusCode: 200, data: {} });
      };
      return request.get('/media/list', { babyId: 'b1', page: 2 });
    });

    test('params 为空不应加 ?', function () {
      mockRequestHandler = function (opts: any) {
        expect(opts.url).not.toContain('?');
        opts.success({ statusCode: 200, data: {} });
      };
      return request.get('/media/list');
    });

    test('URL 已含 ? 应使用 & 拼接', function () {
      mockRequestHandler = function (opts: any) {
        expect(opts.url).toContain('&new=2');
        opts.success({ statusCode: 200, data: {} });
      };
      return request.get('/path?existing=1', { new: '2' });
    });

    test('参数值应 encodeURIComponent', function () {
      mockRequestHandler = function (opts: any) {
        expect(opts.url).toContain(encodeURIComponent('测试'));
        opts.success({ statusCode: 200, data: {} });
      };
      return request.get('/search', { q: '测试' });
    });
  });
});

export {};