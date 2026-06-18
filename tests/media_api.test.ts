/**
 * media_api.ts 单元测试
 * 测试媒体 API 调用封装，验证对 request 模块的委托调用
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

describe('media_api - 媒体 API 服务', function () {
  var mediaApi: any;

  beforeEach(function () {
    jest.resetModules();
    setupMockWx();
    mediaApi = require(path.resolve(__dirname, '../miniprogram/services/media_api.js')).mediaApi;
  });

  afterEach(function () {
    cleanupWx();
  });

  // ==================== list ====================

  describe('list', function () {
    test('应 GET /media/ 并传递 babyId 和默认 page', function () {
      (global as any).wx.request = function (opts: any) {
        expect(opts.method).toBe('GET');
        expect(opts.url).toContain('/media/');
        expect(opts.url).toContain('babyId=b1');
        expect(opts.url).toContain('page=1');
        opts.success({ statusCode: 200, data: { items: [], total: 0 } });
      };
      return mediaApi.list('b1').then(function (data: any) {
        expect(data.total).toBe(0);
      });
    });

    test('应传递自定义 page 参数', function () {
      (global as any).wx.request = function (opts: any) {
        expect(opts.url).toContain('page=3');
        opts.success({ statusCode: 200, data: { items: [] } });
      };
      return mediaApi.list('b1', 3);
    });

    test('page 为 0 时默认使用 1', function () {
      (global as any).wx.request = function (opts: any) {
        expect(opts.url).toContain('page=1');
        opts.success({ statusCode: 200, data: { items: [] } });
      };
      return mediaApi.list('b1', 0);
    });

    test('失败应拒绝', function () {
      (global as any).wx.request = function (opts: any) {
        opts.fail({ errMsg: 'timeout' });
      };
      return mediaApi.list('b1').catch(function (err: any) {
        expect(err).toBeDefined();
      });
    });
  });

  // ==================== create ====================

  describe('create', function () {
    test('应 POST /media/ 并传递数据', function () {
      var payload = { babyId: 'b1', title: 'Photo', type: 'photo', cosKey: 'key', captureDate: '2026-06-01' };
      (global as any).wx.request = function (opts: any) {
        expect(opts.method).toBe('POST');
        expect(opts.url).toContain('/media/');
        expect(opts.data.title).toBe('Photo');
        expect(opts.data.babyId).toBe('b1');
        opts.success({ statusCode: 200, data: { id: 'm1' } });
      };
      return mediaApi.create(payload).then(function (data: any) {
        expect(data.id).toBe('m1');
      });
    });
  });

  // ==================== delete ====================

  describe('delete', function () {
    test('应 DELETE /media/:id', function () {
      (global as any).wx.request = function (opts: any) {
        expect(opts.method).toBe('DELETE');
        expect(opts.url).toContain('/media/m1');
        opts.success({ statusCode: 200, data: { success: true } });
      };
      return mediaApi.delete('m1').then(function (data: any) {
        expect(data.success).toBe(true);
      });
    });
  });

  // ==================== getUploadSign ====================

  describe('getUploadSign', function () {
    test('应 POST /upload/sign 并传递参数', function () {
      (global as any).wx.request = function (opts: any) {
        expect(opts.method).toBe('POST');
        expect(opts.url).toContain('/upload/sign');
        expect(opts.data.fileName).toBe('test.jpg');
        expect(opts.data.fileType).toBe('image/jpeg');
        expect(opts.data.babyId).toBe('b1');
        opts.success({ statusCode: 200, data: { secretId: 'sid', secretKey: 'sk', token: 't' } });
      };
      return mediaApi.getUploadSign('test.jpg', 'image/jpeg', 'b1').then(function (data: any) {
        expect(data.secretId).toBe('sid');
      });
    });

    test('失败应拒绝', function () {
      (global as any).wx.request = function (opts: any) {
        opts.fail({ errMsg: 'upload sign fail' });
      };
      return mediaApi.getUploadSign('f.jpg', 'image/png', 'b1').catch(function (err: any) {
        expect(err).toBeDefined();
      });
    });
  });
});
export {};
