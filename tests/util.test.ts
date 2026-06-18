/**
 * util.ts 工具函数单元测试
 * 纯函数测试，无需 wx 模拟
 */

var path = require('path');

describe('util - 工具函数', function () {
  var util: any;

  beforeAll(function () {
    util = require(path.resolve(__dirname, '../miniprogram/utils/util.js'));
  });

  describe('formatTime', function () {
    test('应格式化 Date 对象为 YYYY/MM/DD HH:mm:ss', function () {
      var d = new Date(2026, 5, 18, 14, 30, 45);
      expect(util.formatTime(d)).toBe('2026/06/18 14:30:45');
    });

    test('月份和日期应补零', function () {
      var d = new Date(2026, 0, 5, 9, 5, 3);
      expect(util.formatTime(d)).toBe('2026/01/05 09:05:03');
    });

    test('跨年应正确', function () {
      var d = new Date(2025, 11, 31, 23, 59, 59);
      expect(util.formatTime(d)).toBe('2025/12/31 23:59:59');
    });
  });
});