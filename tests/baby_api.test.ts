/**
 * baby_api.ts 单元测试
 * 测试宝宝 API 调用封装，验证对 request 模块的委托调用
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
      opts.success({ statusCode: 200, data: {} });
    },
    redirectTo: function (): void {},
  };
}

function cleanupWx(): void {
  delete (global as any).wx;
}

describe('baby_api - 宝宝 API 服务', function () {
  var babyApi: any;

  beforeEach(function () {
    jest.resetModules();
    setupMockWx();
    babyApi = require(path.resolve(__dirname, '../miniprogram/services/baby_api.js')).babyApi;
  });

  afterEach(function () {
    cleanupWx();
  });

  // ==================== list ====================

  describe('list', function () {
    test('应 GET /babies/ 返回列表', function () {
      (global as any).wx.request = function (opts: any) {
        expect(opts.method).toBe('GET');
        expect(opts.url).toContain('/babies/');
        opts.success({ statusCode: 200, data: [{ id: 'b1', name: 'Baby' }] });
      };
      return babyApi.list().then(function (data: any) {
        expect(data.length).toBe(1);
        expect(data[0].name).toBe('Baby');
      });
    });

    test('失败应拒绝', function () {
      (global as any).wx.request = function (opts: any) {
        opts.fail({ errMsg: 'network error' });
      };
      return babyApi.list().catch(function (err: any) {
        expect(err).toBeDefined();
      });
    });
  });

  // ==================== get ====================

  describe('get', function () {
    test('应 GET /babies/:id', function () {
      (global as any).wx.request = function (opts: any) {
        expect(opts.url).toContain('/babies/b1');
        opts.success({ statusCode: 200, data: { id: 'b1', name: 'Baby1' } });
      };
      return babyApi.get('b1').then(function (data: any) {
        expect(data.name).toBe('Baby1');
      });
    });
  });

  // ==================== create ====================

  describe('create', function () {
    test('应 POST /babies/ 并传递数据', function () {
      var payload = { name: 'New Baby', gender: 'male', birthDate: '2026-01-01' };
      (global as any).wx.request = function (opts: any) {
        expect(opts.method).toBe('POST');
        expect(opts.url).toContain('/babies/');
        expect(opts.data.name).toBe('New Baby');
        opts.success({ statusCode: 200, data: { id: 'b2', name: 'New Baby' } });
      };
      return babyApi.create(payload).then(function (data: any) {
        expect(data.id).toBe('b2');
      });
    });
  });

  // ==================== update ====================

  describe('update', function () {
    test('应 PUT /babies/:id 并传递数据', function () {
      var payload = { name: 'Updated' };
      (global as any).wx.request = function (opts: any) {
        expect(opts.method).toBe('PUT');
        expect(opts.url).toContain('/babies/b1');
        expect(opts.data.name).toBe('Updated');
        opts.success({ statusCode: 200, data: { id: 'b1', name: 'Updated' } });
      };
      return babyApi.update('b1', payload).then(function (data: any) {
        expect(data.name).toBe('Updated');
      });
    });
  });

  // ==================== delete ====================

  describe('delete', function () {
    test('应 DELETE /babies/:id', function () {
      (global as any).wx.request = function (opts: any) {
        expect(opts.method).toBe('DELETE');
        expect(opts.url).toContain('/babies/b1');
        opts.success({ statusCode: 200, data: { success: true } });
      };
      return babyApi.delete('b1').then(function (data: any) {
        expect(data.success).toBe(true);
      });
    });
  });
});
export {};
