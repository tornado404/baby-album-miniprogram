"use strict";
// age_calculator.ts - 月龄计算工具
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateBabyAge = calculateBabyAge;
exports.formatAge = formatAge;
exports.toTotalMonths = toTotalMonths;
exports.isInAgeRange = isInAgeRange;
/**
 * 计算宝宝月龄
 * @param birthDate 出生日期 YYYY-MM-DD
 * @param targetDate 目标日期 YYYY-MM-DD，默认为今天
 * @returns 宝宝月龄信息
 */
function calculateBabyAge(birthDate, targetDate) {
    var birth = new Date(birthDate);
    var target = targetDate ? new Date(targetDate) : new Date();
    var diffTime = target.getTime() - birth.getTime();
    var diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    var years = Math.floor(diffDays / 365);
    var remainingDays = diffDays % 365;
    var months = Math.floor(remainingDays / 30);
    var days = remainingDays % 30;
    return { years: years, months: months, days: days };
}
/**
 * 格式化月龄为字符串
 * @param age 月龄信息
 * @returns 格式化的月龄字符串
 */
function formatAge(age) {
    if (age.years > 0) {
        return "".concat(age.years, "\u5C81").concat(age.months, "\u6708");
    }
    if (age.months > 0) {
        return "".concat(age.months, "\u6708").concat(age.days, "\u5929");
    }
    return "".concat(age.days, "\u5929");
}
/**
 * 计算总月龄（月）
 * @param age 月龄信息
 * @returns 总月龄
 */
function toTotalMonths(age) {
    return age.years * 12 + age.months;
}
/**
 * 判断是否在指定月龄范围内
 * @param age 月龄信息
 * @param minAge 最小月龄
 * @param maxAge 最大月龄
 * @returns 是否在范围内
 */
function isInAgeRange(age, minAge, maxAge) {
    var totalMonths = toTotalMonths(age);
    return totalMonths >= minAge && totalMonths <= maxAge;
}
