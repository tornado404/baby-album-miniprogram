/**
 * image_utils.ts 单元测试
 * 测试图片处理工具函数，需要 wx API 模拟
 */

var path = require('path');

function setupMockWx(overrides?: Record<string, any>): void {
  var wxMock: Record<string, any> = {
    compressImage: function () {},
    chooseMedia: function () {},
    getImageInfo: function () {},
    previewImage: function () {},
    saveImageToPhotosAlbum: function () {},
  };
  if (overrides) {
    for (var key in overrides) {
      if (overrides.hasOwnProperty(key)) {
        wxMock[key] = overrides[key];
      }
    }
  }
  (global as any).wx = wxMock;
}

function cleanupWx(): void {
  delete (global as any).wx;
}

describe('image_utils - 图片处理工具函数', function () {
  var imgUtils: any;

  beforeAll(function () {
    imgUtils = require(path.resolve(__dirname, '../miniprogram/utils/image_utils.js'));
  });

  beforeEach(function () {
    setupMockWx();
  });

  afterEach(function () {
    cleanupWx();
  });

  // ==================== compressImage ====================

  describe('compressImage', function () {
    test('成功应返回压缩后的临时路径', function () {
      (global as any).wx.compressImage = function (opts: any) {
        opts.success({ tempFilePath: '/tmp/compressed.jpg' });
      };
      return imgUtils.compressImage('/tmp/original.jpg', 80, 1920).then(function (result: string) {
        expect(result).toBe('/tmp/compressed.jpg');
      });
    });

    test('失败应拒绝', function () {
      (global as any).wx.compressImage = function (opts: any) {
        opts.fail({ errMsg: 'compress fail' });
      };
      return imgUtils.compressImage('/tmp/original.jpg').catch(function (err: any) {
        expect(err.errMsg).toBe('compress fail');
      });
    });
  });

  // ==================== chooseMedia ====================

  describe('chooseMedia', function () {
    test('成功应返回选中文件列表', function () {
      var fakeFiles = [{ tempFilePath: '/tmp/photo.jpg' }];
      (global as any).wx.chooseMedia = function (opts: any) {
        expect(opts.count).toBe(3);
        expect(opts.mediaType).toEqual(['image']);
        opts.success({ tempFiles: fakeFiles });
      };
      return imgUtils.chooseMedia(3, 'image').then(function (files: any[]) {
        expect(files).toBe(fakeFiles);
      });
    });

    test('失败应拒绝', function () {
      (global as any).wx.chooseMedia = function (opts: any) {
        opts.fail({ errMsg: 'cancel' });
      };
      return imgUtils.chooseMedia().catch(function (err: any) {
        expect(err.errMsg).toBe('cancel');
      });
    });
  });

  // ==================== getImageInfo ====================

  describe('getImageInfo', function () {
    test('成功应返回图片信息', function () {
      (global as any).wx.getImageInfo = function (opts: any) {
        opts.success({ width: 800, height: 600, path: '/tmp/photo.jpg' });
      };
      return imgUtils.getImageInfo('/tmp/photo.jpg').then(function (info: any) {
        expect(info.width).toBe(800);
        expect(info.height).toBe(600);
        expect(info.path).toBe('/tmp/photo.jpg');
        expect(info.size).toBe(0);
      });
    });

    test('失败应拒绝', function () {
      (global as any).wx.getImageInfo = function (opts: any) {
        opts.fail({ errMsg: 'getInfo fail' });
      };
      return imgUtils.getImageInfo('/tmp/bad.jpg').catch(function (err: any) {
        expect(err.errMsg).toBe('getInfo fail');
      });
    });
  });

  // ==================== previewImage ====================

  describe('previewImage', function () {
    test('应调用 wx.previewImage', function () {
      var previewCalled = false;
      (global as any).wx.previewImage = function (opts: any) {
        previewCalled = true;
        expect(opts.urls).toEqual(['a.jpg', 'b.jpg']);
        expect(opts.current).toBe('a.jpg');
      };
      imgUtils.previewImage(['a.jpg', 'b.jpg'], 0);
      expect(previewCalled).toBe(true);
    });

    test('不传 current 默认预览第一张', function () {
      (global as any).wx.previewImage = function (opts: any) {
        expect(opts.current).toBe('first.jpg');
      };
      imgUtils.previewImage(['first.jpg', 'second.jpg']);
    });
  });

  // ==================== saveImageToAlbum ====================

  describe('saveImageToAlbum', function () {
    test('成功应 resolve', function () {
      var saved = false;
      (global as any).wx.saveImageToPhotosAlbum = function (opts: any) {
        opts.success();
      };
      return imgUtils.saveImageToAlbum('/tmp/photo.jpg').then(function () {
        saved = true;
        expect(saved).toBe(true);
      });
    });

    test('失败应拒绝', function () {
      (global as any).wx.saveImageToPhotosAlbum = function (opts: any) {
        opts.fail({ errMsg: 'save fail' });
      };
      return imgUtils.saveImageToAlbum('/tmp/photo.jpg').catch(function (err: any) {
        expect(err.errMsg).toBe('save fail');
      });
    });
  });
});

export {};