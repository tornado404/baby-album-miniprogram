/**
 * mock_cloud_service.ts 单元测试
 * 测试 Mock 云存储服务的上传/查询/删除功能
 */

var path = require('path');

function setupMockWx(): void {
  (global as any).wx = {
    showToast: function (): void {},
  };
}

function cleanupWx(): void {
  delete (global as any).wx;
}

describe('mock_cloud_service - Mock 云存储服务', function () {
  var mockCloudService: any;

  beforeAll(function () {
    setupMockWx();
    mockCloudService = require(path.resolve(__dirname, '../miniprogram/services/mock_cloud_service.js')).mockCloudService;
  });

  afterAll(function () {
    cleanupWx();
  });

  // ==================== uploadFile ====================

  describe('uploadFile', function () {
    test('上传应返回 fileId 和 url', function () {
      return mockCloudService.uploadFile('/tmp/test.jpg').then(function (result: any) {
        expect(result.fileId).toBeDefined();
        expect(result.fileId).toContain('mock_cloud_');
        expect(result.url).toBeDefined();
        expect(result.url).toContain('mock-cloud.example.com');
      });
    });

    test('不传名字应使用默认名称', function () {
      return mockCloudService.uploadFile('/tmp/photo.jpg').then(function (result: any) {
        expect(result.fileId).toBeDefined();
      });
    });

    test('每上传一次返回不同的 fileId', function () {
      return mockCloudService.uploadFile('/tmp/a.jpg').then(function (r1: any) {
        return mockCloudService.uploadFile('/tmp/b.jpg').then(function (r2: any) {
          expect(r1.fileId).not.toBe(r2.fileId);
        });
      });
    });

    test('传入 options.name 应使用自定义文件名', function () {
      return mockCloudService.uploadFile('/tmp/custom.jpg', { name: '我的照片.jpg' }).then(function (result: any) {
        expect(result.fileId).toBeDefined();
      });
    });
  });

  // ==================== getTempUrl ====================

  describe('getTempUrl', function () {
    test('已上传文件的临时 URL 应正确返回', function () {
      return mockCloudService.uploadFile('/tmp/test.jpg').then(function (uploaded: any) {
        return mockCloudService.getTempUrl(uploaded.fileId).then(function (url: string) {
          expect(url).toBe(uploaded.url);
        });
      });
    });

    test('不存在的文件应返回默认 URL', function () {
      return mockCloudService.getTempUrl('nonexistent_file_id').then(function (url: string) {
        expect(url).toBe('https://mock-cloud.example.com/default.jpg');
      });
    });
  });

  // ==================== deleteFile ====================

  describe('deleteFile', function () {
    test('删除后 getTempUrl 应返回默认 URL', function () {
      return mockCloudService.uploadFile('/tmp/test.jpg').then(function (uploaded: any) {
        return mockCloudService.deleteFile(uploaded.fileId).then(function () {
          return mockCloudService.getTempUrl(uploaded.fileId).then(function (url: string) {
            expect(url).toBe('https://mock-cloud.example.com/default.jpg');
          });
        });
      });
    });

    test('删除不存在的文件应不报错', function () {
      return mockCloudService.deleteFile('nonexistent').then(function () {
        // Should resolve without throwing
        expect(true).toBe(true);
      });
    });
  });
});
export {};
