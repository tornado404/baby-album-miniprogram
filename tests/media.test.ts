/**
 * media.ts 类型守卫函数单元测试
 * 纯函数测试，无需 wx 模拟
 */

var path = require('path');

describe('media - 媒体数据模型类型守卫', function () {
  var media: any;

  beforeAll(function () {
    media = require(path.resolve(__dirname, '../typings/models/media.js'));
  });

  // ==================== isMedia ====================

  describe('isMedia', function () {
    test('有效 Media 对象应返回 true', function () {
      var result = media.isMedia({ id: '1', babyId: 'b1' });
      expect(result).toBe(true);
    });

    test('null 应返回 false', function () {
      expect(media.isMedia(null)).toBe(false);
    });

    test('非对象应返回 false', function () {
      expect(media.isMedia('string')).toBe(false);
      expect(media.isMedia(123)).toBe(false);
      expect(media.isMedia(undefined)).toBe(false);
    });

    test('缺少 id 应返回 false', function () {
      expect(media.isMedia({ babyId: 'b1' })).toBe(false);
    });

    test('缺少 babyId 应返回 false', function () {
      expect(media.isMedia({ id: '1' })).toBe(false);
    });
  });

  // ==================== isMediaQuery ====================

  describe('isMediaQuery', function () {
    test('null 应返回 false', function () {
      expect(media.isMediaQuery(null)).toBe(false);
    });

    test('非对象应返回 false', function () {
      expect(media.isMediaQuery('query')).toBe(false);
      expect(media.isMediaQuery(42)).toBe(false);
      expect(media.isMediaQuery(undefined)).toBe(false);
    });

    test('空对象应返回 true', function () {
      expect(media.isMediaQuery({})).toBe(true);
    });

    test('有效 MediaQuery 应返回 true', function () {
      var q = { babyId: 'b1', type: 'photo', page: 1, pageSize: 20 };
      expect(media.isMediaQuery(q)).toBe(true);
    });

    test('page 为 0 应返回 false', function () {
      expect(media.isMediaQuery({ page: 0 })).toBe(false);
    });

    test('page 为负数应返回 false', function () {
      expect(media.isMediaQuery({ page: -1 })).toBe(false);
    });

    test('page 为非整数应返回 false', function () {
      expect(media.isMediaQuery({ page: 1.5 })).toBe(false);
    });

    test('pageSize 为 0 应返回 false', function () {
      expect(media.isMediaQuery({ pageSize: 0 })).toBe(false);
    });

    test('pageSize 为负数应返回 false', function () {
      expect(media.isMediaQuery({ pageSize: -5 })).toBe(false);
    });

    test('pageSize 为非整数应返回 false', function () {
      expect(media.isMediaQuery({ pageSize: 2.5 })).toBe(false);
    });
  });

  // ==================== isValidMediaQuery ====================

  describe('isValidMediaQuery', function () {
    test('应委托给 isMediaQuery', function () {
      expect(media.isValidMediaQuery(null)).toBe(false);
      expect(media.isValidMediaQuery({})).toBe(true);
    });
  });
});