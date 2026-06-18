/**
 * date_utils.ts 单元测试
 * 纯函数测试，无需 wx 模拟
 */

var path = require('path');

describe('date_utils - 日期工具函数', function () {
  var dateUtils: any;

  beforeAll(function () {
    dateUtils = require(path.resolve(__dirname, '../miniprogram/utils/date_utils.js'));
  });

  // ==================== formatDate ====================

  test('formatDate 应格式化 Date 对象为 YYYY-MM-DD', function () {
    var d = new Date(2026, 5, 18); // June 18, 2026
    expect(dateUtils.formatDate(d)).toBe('2026-06-18');
  });

  test('formatDate 应格式化日期字符串', function () {
    expect(dateUtils.formatDate('2026-01-05')).toBe('2026-01-05');
  });

  test('formatDate 月份和日期应补零', function () {
    var d = new Date(2026, 0, 5);
    expect(dateUtils.formatDate(d)).toBe('2026-01-05');
  });

  // ==================== parseDate ====================

  test('parseDate 应解析 YYYY-MM-DD', function () {
    var d = dateUtils.parseDate('2026-06-18');
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(5); // 0-indexed
    expect(d.getDate()).toBe(18);
  });

  test('parseDate 应处理单月单日', function () {
    var d = dateUtils.parseDate('2026-01-05');
    expect(d.getMonth()).toBe(0);
    expect(d.getDate()).toBe(5);
  });

  // ==================== daysBetween ====================

  test('daysBetween 应计算字符串日期差', function () {
    var days = dateUtils.daysBetween('2026-06-01', '2026-06-18');
    expect(days).toBe(17);
  });

  test('daysBetween 应计算 Date 对象差', function () {
    var start = new Date(2026, 5, 1);
    var end = new Date(2026, 5, 18);
    expect(dateUtils.daysBetween(start, end)).toBe(17);
  });

  test('daysBetween 同一天应返回 0', function () {
    expect(dateUtils.daysBetween('2026-06-18', '2026-06-18')).toBe(0);
  });

  // ==================== isToday ====================

  test('isToday 今天应返回 true', function () {
    var today = dateUtils.formatDate(new Date());
    expect(dateUtils.isToday(today)).toBe(true);
  });

  test('isToday 非今天应返回 false', function () {
    expect(dateUtils.isToday('2026-01-01')).toBe(false);
  });

  // ==================== getMonthStart ====================

  test('getMonthStart 应返回本月第一天', function () {
    expect(dateUtils.getMonthStart('2026-06-18')).toBe('2026-06-01');
  });

  test('getMonthStart 跨年', function () {
    expect(dateUtils.getMonthStart('2026-01-15')).toBe('2026-01-01');
  });

  // ==================== getMonthEnd ====================

  test('getMonthEnd 应返回本月最后一天', function () {
    expect(dateUtils.getMonthEnd('2026-06-18')).toBe('2026-06-30');
  });

  test('getMonthEnd 2 月', function () {
    expect(dateUtils.getMonthEnd('2026-02-10')).toBe('2026-02-28');
  });

  test('getMonthEnd 31 日月份', function () {
    expect(dateUtils.getMonthEnd('2026-01-15')).toBe('2026-01-31');
  });
});