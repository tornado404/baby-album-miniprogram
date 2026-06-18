/**
 * request.ts 基础功能运行时测试
 * 测试 tokenManager 的基本方法
 */

var path = require('path');

var mockStorage: any = {};

(global as any).wx = {
  getStorageSync: function (key: string) {
    return mockStorage[key] !== undefined ? mockStorage[key] : '';
  },
  setStorageSync: function (key: string, value: any) {
    mockStorage[key] = value;
  },
  removeStorageSync: function (key: string) {
    delete mockStorage[key];
  },
  request: function () {},
  redirectTo: function () {},
};

describe('services/request - tokenManager 基础功能', function () {
  var request: any;
  var tokenManager: any;

  beforeAll(function () {
    mockStorage = {};
    var requestModule = require(path.resolve(__dirname, '../miniprogram/services/request.js'));
    request = requestModule.request;
    tokenManager = requestModule.tokenManager;
  });

  beforeEach(function () {
    mockStorage = {};
    (global as any).wx.getStorageSync = function (key: string) {
      return mockStorage[key] !== undefined ? mockStorage[key] : '';
    };
    (global as any).wx.setStorageSync = function (key: string, value: any) {
      mockStorage[key] = value;
    };
    (global as any).wx.removeStorageSync = function (key: string) {
      delete mockStorage[key];
    };
    (global as any).wx.request = function () {};
    (global as any).wx.redirectTo = function () {};
  });

  test('tokenManager 应定义', function () {
    expect(tokenManager).toBeDefined();
  });

  test('getAccessToken 默认返回空字符串', function () {
    expect(tokenManager.getAccessToken()).toBe('');
  });

  test('getAccessToken 应返回存储的值', function () {
    mockStorage['baby_diary_access_token'] = 'test-token-123';
    expect(tokenManager.getAccessToken()).toBe('test-token-123');
  });

  test('getAccessToken 存储异常应返回空字符串', function () {
    (global as any).wx.getStorageSync = function () { throw new Error('fail'); };
    expect(tokenManager.getAccessToken()).toBe('');
  });

  test('getRefreshToken 默认返回空字符串', function () {
    expect(tokenManager.getRefreshToken()).toBe('');
  });

  test('getRefreshToken 应返回存储的值', function () {
    mockStorage['baby_diary_refresh_token'] = 'refresh-token-456';
    expect(tokenManager.getRefreshToken()).toBe('refresh-token-456');
  });

  test('getRefreshToken 存储异常应返回空字符串', function () {
    (global as any).wx.getStorageSync = function () { throw new Error('fail'); };
    expect(tokenManager.getRefreshToken()).toBe('');
  });

  test('saveTokens 应保存 accessToken 和 refreshToken', function () {
    tokenManager.saveTokens('new-access', 'new-refresh');
    expect(mockStorage['baby_diary_access_token']).toBe('new-access');
    expect(mockStorage['baby_diary_refresh_token']).toBe('new-refresh');
  });

  test('saveTokens 应保存 userId', function () {
    tokenManager.saveTokens('access', 'refresh', 'user-1');
    expect(mockStorage['baby_diary_user_id']).toBe('user-1');
  });

  test('saveTokens 存储异常应不抛出', function () {
    (global as any).wx.setStorageSync = function () { throw new Error('fail'); };
    expect(function () { tokenManager.saveTokens('a', 'b'); }).not.toThrow();
  });

  test('clearTokens 应清除所有 token 和用户数据', function () {
    mockStorage['baby_diary_access_token'] = 'token';
    mockStorage['baby_diary_refresh_token'] = 'refresh';
    mockStorage['baby_diary_user_id'] = 'user-1';
    mockStorage['baby_diary_authed'] = 'true';
    mockStorage['baby_diary_baby_profile'] = '...';
    mockStorage['album_babies'] = '...';
    mockStorage['baby_diary_current_baby_id'] = 'b1';

    tokenManager.clearTokens();

    expect(mockStorage['baby_diary_access_token']).toBeUndefined();
    expect(mockStorage['baby_diary_refresh_token']).toBeUndefined();
    expect(mockStorage['baby_diary_user_id']).toBeUndefined();
    expect(mockStorage['baby_diary_authed']).toBeUndefined();
    expect(mockStorage['baby_diary_baby_profile']).toBeUndefined();
    expect(mockStorage['album_babies']).toBeUndefined();
    expect(mockStorage['baby_diary_current_baby_id']).toBeUndefined();
  });

  test('clearTokens 存储异常应不抛出', function () {
    (global as any).wx.removeStorageSync = function () { throw new Error('fail'); };
    expect(function () { tokenManager.clearTokens(); }).not.toThrow();
  });

  // ==================== request HTTP 方法 ====================

  test('request.get 应发起 GET 请求并返回数据', function (done) {
    (global as any).wx.request = function (opts: any) {
      expect(opts.method).toBe('GET');
      expect(opts.url).toContain('/test');
      opts.success({ statusCode: 200, data: { result: 'ok' } });
    };
    request.get('/test').then(function (data: any) {
      expect(data.result).toBe('ok');
      done();
    });
  });

  test('request.get 带查询参数应拼接到 URL', function (done) {
    (global as any).wx.request = function (opts: any) {
      expect(opts.url).toContain('key1=value1');
      expect(opts.url).toContain('key2=value2');
      opts.success({ statusCode: 200, data: {} });
    };
    request.get('/test', { key1: 'value1', key2: 'value2' }).then(function () { done(); });
  });

  test('request.get 有 token 时应携带 Authorization 头', function (done) {
    mockStorage['baby_diary_access_token'] = 'my-token';
    (global as any).wx.getStorageSync = function (key: string) {
      return mockStorage[key] !== undefined ? mockStorage[key] : '';
    };
    (global as any).wx.request = function (opts: any) {
      expect(opts.header.Authorization).toBe('Bearer my-token');
      opts.success({ statusCode: 200, data: {} });
    };
    request.get('/test').then(function () { done(); });
  });

  test('request.get 绝对 URL 应直接使用', function (done) {
    (global as any).wx.request = function (opts: any) {
      expect(opts.url).toBe('https://api.example.com/data');
      opts.success({ statusCode: 200, data: {} });
    };
    request.get('https://api.example.com/data').then(function () { done(); });
  });

  test('request.get params 无自有属性应不拼接', function (done) {
    var params = Object.create({ inherited: 'should-not-appear' });
    (global as any).wx.request = function (opts: any) {
      expect(opts.url).not.toContain('inherited');
      expect(opts.url).toContain('/test');
      opts.success({ statusCode: 200, data: {} });
    };
    request.get('/test', params).then(function () { done(); });
  });

  test('request.get URL 已含参数时应使用 & 拼接', function (done) {
    (global as any).wx.request = function (opts: any) {
      expect(opts.url).toContain('?existing=1&new=2');
      opts.success({ statusCode: 200, data: {} });
    };
    request.get('/test?existing=1', { new: 2 }).then(function () { done(); });
  });

  test('request.post 应发起 POST 请求', function (done) {
    (global as any).wx.request = function (opts: any) {
      expect(opts.method).toBe('POST');
      expect(opts.data.name).toBe('test');
      opts.success({ statusCode: 200, data: { id: 1 } });
    };
    request.post('/test', { name: 'test' }).then(function (data: any) {
      expect(data.id).toBe(1);
      done();
    });
  });

  test('request.put 应发起 PUT 请求', function (done) {
    (global as any).wx.request = function (opts: any) {
      expect(opts.method).toBe('PUT');
      opts.success({ statusCode: 200, data: {} });
    };
    request.put('/test', { name: 'updated' }).then(function () { done(); });
  });

  test('request.delete 应发起 DELETE 请求', function (done) {
    (global as any).wx.request = function (opts: any) {
      expect(opts.method).toBe('DELETE');
      opts.success({ statusCode: 200, data: {} });
    };
    request.delete('/test').then(function () { done(); });
  });

  test('apiCall 非 200 状态码应拒绝', function (done) {
    (global as any).wx.request = function (opts: any) {
      opts.success({ statusCode: 400, data: { error: 'bad' } });
    };
    request.get('/test').catch(function (err: any) {
      expect(err.status).toBe(400);
      done();
    });
  });

  test('apiCall 网络错误应拒绝', function (done) {
    (global as any).wx.request = function (opts: any) {
      opts.fail({ errMsg: 'timeout' });
    };
    request.get('/test').catch(function (err: any) {
      expect(err.status).toBe(0);
      expect(err.message).toBe('Network error');
      done();
    });
  });

  // ==================== token 刷新流程 ====================

  test('401 应触发 token 刷新', function (done) {
    var refreshCalled = false;
    mockStorage['baby_diary_access_token'] = 'expired-token';
    mockStorage['baby_diary_refresh_token'] = 'valid-refresh';
    (global as any).wx.getStorageSync = function (key: string) {
      return mockStorage[key] !== undefined ? mockStorage[key] : '';
    };
    // First request returns 401, refresh endpoint succeeds, retry succeeds
    var callCount = 0;
    (global as any).wx.request = function (opts: any) {
      callCount++;
      if (callCount === 1) {
        // First call is the original request → 401
        expect(opts.url).toContain('/test');
        opts.success({ statusCode: 401 });
      } else if (callCount === 2) {
        // Second call is the refresh request
        expect(opts.url).toContain('/auth/refresh');
        opts.success({ statusCode: 200, data: { accessToken: 'new-token', refreshToken: 'new-refresh' } });
      } else if (callCount === 3) {
        // Third call is the retry of the original request
        expect(opts.url).toContain('/test');
        expect(opts.header.Authorization).toBe('Bearer new-token');
        opts.success({ statusCode: 200, data: { result: 'retried' } });
      }
    };
    request.get('/test').then(function (data: any) {
      expect(data.result).toBe('retried');
      expect(callCount).toBe(3);
      done();
    });
  });

  test('token 刷新失败应跳转登录', function (done) {
    var redirectUrl = '';
    mockStorage['baby_diary_access_token'] = 'expired-token';
    mockStorage['baby_diary_refresh_token'] = 'invalid-refresh';
    (global as any).wx.getStorageSync = function (key: string) {
      return mockStorage[key] !== undefined ? mockStorage[key] : '';
    };
    (global as any).wx.redirectTo = function (opts: any) { redirectUrl = opts.url; };
    var callCount = 0;
    (global as any).wx.request = function (opts: any) {
      callCount++;
      if (callCount === 1) {
        opts.success({ statusCode: 401 });
      } else if (callCount === 2) {
        // Refresh endpoint returns non-200
        opts.success({ statusCode: 400, data: {} });
      }
    };
    request.get('/test').catch(function (err: any) {
      expect(err.message).toBe('Session expired');
      expect(redirectUrl).toContain('/pages/index/index');
      done();
    });
  });

  test('无 refreshToken 时 401 直接报错', function (done) {
    // Only set access token but no refresh token
    mockStorage['baby_diary_access_token'] = 'expired-token';
    delete mockStorage['baby_diary_refresh_token'];
    (global as any).wx.getStorageSync = function (key: string) {
      return mockStorage[key] !== undefined ? mockStorage[key] : '';
    };
    (global as any).wx.redirectTo = function (opts: any) { redirectUrl = opts.url; };
    var redirectUrl = '';
    (global as any).wx.request = function (opts: any) {
      opts.success({ statusCode: 401 });
    };
    request.get('/test').catch(function (err: any) {
      expect(err).toBeDefined();
      done();
    });
  });

  test('token 刷新网络错误应拒绝', function (done) {
    mockStorage['baby_diary_access_token'] = 'expired-token';
    mockStorage['baby_diary_refresh_token'] = 'valid-refresh';
    (global as any).wx.getStorageSync = function (key: string) {
      return mockStorage[key] !== undefined ? mockStorage[key] : '';
    };
    var callCount = 0;
    (global as any).wx.request = function (opts: any) {
      callCount++;
      if (callCount === 1) {
        opts.success({ statusCode: 401 });
      } else if (callCount === 2) {
        opts.fail({ errMsg: 'network error' });
      }
    };
    request.get('/test').catch(function () {
      done();
    });
  });

  test('刷新后重试仍然失败应拒绝', function (done) {
    mockStorage['baby_diary_access_token'] = 'expired-token';
    mockStorage['baby_diary_refresh_token'] = 'valid-refresh';
    (global as any).wx.getStorageSync = function (key: string) {
      return mockStorage[key] !== undefined ? mockStorage[key] : '';
    };
    var callCount = 0;
    (global as any).wx.request = function (opts: any) {
      callCount++;
      if (callCount === 1) {
        opts.success({ statusCode: 401 });
      } else if (callCount === 2) {
        opts.success({ statusCode: 200, data: { accessToken: 'new-token' } });
      } else if (callCount === 3) {
        opts.success({ statusCode: 500, data: { error: 'server error' } });
      }
    };
    request.get('/test').catch(function (err: any) {
      expect(err.status).toBe(500);
      done();
    });
  });

  test('刷新后重试网络失败应拒绝', function (done) {
    mockStorage['baby_diary_access_token'] = 'expired-token';
    mockStorage['baby_diary_refresh_token'] = 'valid-refresh';
    (global as any).wx.getStorageSync = function (key: string) {
      return mockStorage[key] !== undefined ? mockStorage[key] : '';
    };
    var callCount = 0;
    (global as any).wx.request = function (opts: any) {
      callCount++;
      if (callCount === 1) {
        opts.success({ statusCode: 401 });
      } else if (callCount === 2) {
        opts.success({ statusCode: 200, data: { accessToken: 'new-token' } });
      } else if (callCount === 3) {
        opts.fail({ errMsg: 'retry network error' });
      }
    };
    request.get('/test').catch(function (err: any) {
      expect(err.errMsg).toBe('retry network error');
      done();
    });
  });

  test('并发 401 请求应排队等待刷新', function (done) {
    mockStorage['baby_diary_access_token'] = 'expired-token';
    mockStorage['baby_diary_refresh_token'] = 'valid-refresh';
    (global as any).wx.getStorageSync = function (key: string) {
      return mockStorage[key] !== undefined ? mockStorage[key] : '';
    };
    var requestCount = 0;
    var refreshResolve: Function | null = null;
    (global as any).wx.request = function (opts: any) {
      if (opts.url && opts.url.indexOf('/auth/refresh') !== -1) {
        refreshResolve = function () {
          opts.success({ statusCode: 200, data: { accessToken: 'new-token' } });
        };
        return;
      }
      requestCount++;
      // First 2 requests: 401.  Retries: success.
      if (requestCount <= 2) {
        opts.success({ statusCode: 401 });
      } else {
        opts.success({ statusCode: 200, data: { result: 'ok' } });
      }
    };
    Promise.all([
      request.get('/test1'),
      request.get('/test2'),
    ]).then(function (results: any[]) {
      expect(results.length).toBe(2);
      expect(results[0].result).toBe('ok');
      expect(results[1].result).toBe('ok');
      done();
    });
    // Trigger refresh resolve after both requests have queued
    setTimeout(function () {
      if (refreshResolve) refreshResolve();
    }, 100);
  });

  test('并发请求刷新 token 网络失败应全部拒绝', function (done) {
    var redirectUrl = '';
    mockStorage['baby_diary_access_token'] = 'expired-token';
    mockStorage['baby_diary_refresh_token'] = 'valid-refresh';
    (global as any).wx.getStorageSync = function (key: string) {
      return mockStorage[key] !== undefined ? mockStorage[key] : '';
    };
    (global as any).wx.redirectTo = function (opts: any) { redirectUrl = opts.url; };
    var requestCount = 0;
    var refreshFail: Function | null = null;
    (global as any).wx.request = function (opts: any) {
      if (opts.url && opts.url.indexOf('/auth/refresh') !== -1) {
        refreshFail = function () {
          opts.fail({ errMsg: 'timeout' });
        };
        return;
      }
      requestCount++;
      if (requestCount <= 2) {
        opts.success({ statusCode: 401 });
      }
    };
    Promise.all([
      request.get('/test1'),
      request.get('/test2'),
    ]).catch(function () {
      expect(redirectUrl).toContain('/pages/index/index');
      done();
    });
    setTimeout(function () {
      if (refreshFail) refreshFail();
    }, 100);
  });

  test('并发请求刷新 token 返回非 200 应全部拒绝', function (done) {
    var redirectUrl = '';
    mockStorage['baby_diary_access_token'] = 'expired-token';
    mockStorage['baby_diary_refresh_token'] = 'valid-refresh';
    (global as any).wx.getStorageSync = function (key: string) {
      return mockStorage[key] !== undefined ? mockStorage[key] : '';
    };
    (global as any).wx.redirectTo = function (opts: any) { redirectUrl = opts.url; };
    var requestCount = 0;
    var refreshRespond: Function | null = null;
    (global as any).wx.request = function (opts: any) {
      if (opts.url && opts.url.indexOf('/auth/refresh') !== -1) {
        refreshRespond = function () {
          opts.success({ statusCode: 400, data: {} });
        };
        return;
      }
      requestCount++;
      if (requestCount <= 2) {
        opts.success({ statusCode: 401 });
      }
    };
    Promise.all([
      request.get('/test1'),
      request.get('/test2'),
    ]).catch(function () {
      expect(redirectUrl).toContain('/pages/index/index');
      done();
    });
    setTimeout(function () {
      if (refreshRespond) refreshRespond();
    }, 100);
  });
});
