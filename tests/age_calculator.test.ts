/**
 * age_calculator.ts 单元测试
 * 纯函数测试，无需 wx 模拟
 */

var path = require('path');

describe('age_calculator - 月龄计算', function () {
  var ageCalc: any;

  beforeAll(function () {
    ageCalc = require(path.resolve(__dirname, '../miniprogram/utils/age_calculator.js'));
  });

  // ==================== calculateBabyAge ====================

  test('calculateBabyAge 应计算出生后的天数', function () {
    var age = ageCalc.calculateBabyAge('2026-06-01', '2026-06-18');
    expect(age.days).toBe(17);
    expect(age.months).toBe(0);
    expect(age.years).toBe(0);
  });

  test('calculateBabyAge 满月应计算为 1 个月', function () {
    var age = ageCalc.calculateBabyAge('2026-05-19', '2026-06-18');
    expect(age.months).toBe(1);
    expect(age.days).toBe(0);
  });

  test('calculateBabyAge 跨年应计算年龄', function () {
    var age = ageCalc.calculateBabyAge('2025-06-18', '2026-06-18');
    expect(age.years).toBe(1);
    expect(age.months).toBe(0);
  });

  test('calculateBabyAge 多个月跨年应正确', function () {
    var age = ageCalc.calculateBabyAge('2025-01-15', '2026-06-18');
    expect(age.years).toBe(1);
    expect(age.months).toBe(5);
  });

  test('calculateBabyAge 无 targetDate 应使用当前日期', function () {
    var age = ageCalc.calculateBabyAge('2026-01-01');
    expect(age.years).toBe(0);
    expect(typeof age.months).toBe('number');
    expect(typeof age.days).toBe('number');
  });

  // ==================== formatAge ====================

  test('formatAge 1 岁以上应显示 X 岁 Y 月', function () {
    var text = ageCalc.formatAge({ years: 1, months: 3, days: 0 });
    expect(text).toBe('1岁3月');
  });

  test('formatAge 1 个月以上应显示 X 月 Y 天', function () {
    var text = ageCalc.formatAge({ years: 0, months: 2, days: 15 });
    expect(text).toBe('2月15天');
  });

  test('formatAge 不满 1 个月应显示 X 天', function () {
    var text = ageCalc.formatAge({ years: 0, months: 0, days: 25 });
    expect(text).toBe('25天');
  });

  test('formatAge 0 天应显示 0 天', function () {
    var text = ageCalc.formatAge({ years: 0, months: 0, days: 0 });
    expect(text).toBe('0天');
  });

  // ==================== toTotalMonths ====================

  test('toTotalMonths 应计算总月数', function () {
    var months = ageCalc.toTotalMonths({ years: 1, months: 6, days: 0 });
    expect(months).toBe(18);
  });

  test('toTotalMonths 不满 1 岁', function () {
    var months = ageCalc.toTotalMonths({ years: 0, months: 3, days: 10 });
    expect(months).toBe(3);
  });

  // ==================== isInAgeRange ====================

  test('isInAgeRange 在范围内应返回 true', function () {
    var result = ageCalc.isInAgeRange({ years: 0, months: 6, days: 0 }, 0, 12);
    expect(result).toBe(true);
  });

  test('isInAgeRange 超出最大月龄应返回 false', function () {
    var result = ageCalc.isInAgeRange({ years: 2, months: 0, days: 0 }, 0, 12);
    expect(result).toBe(false);
  });

  test('isInAgeRange 小于最小月龄应返回 false', function () {
    var result = ageCalc.isInAgeRange({ years: 0, months: 1, days: 0 }, 3, 6);
    expect(result).toBe(false);
  });
});