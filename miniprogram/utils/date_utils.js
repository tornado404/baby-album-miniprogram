"use strict";
// date_utils.ts - 日期工具函数
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatDate = formatDate;
exports.parseDate = parseDate;
exports.daysBetween = daysBetween;
exports.isToday = isToday;
exports.getMonthStart = getMonthStart;
exports.getMonthEnd = getMonthEnd;
/**
 * 格式化日期为 YYYY-MM-DD 格式
 * @param date Date 对象或日期字符串
 * @returns 格式化后的日期字符串
 */
function formatDate(date) {
    var d = typeof date === 'string' ? new Date(date) : date;
    var year = d.getFullYear();
    var month = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    return "".concat(year, "-").concat(month, "-").concat(day);
}
/**
 * 解析 YYYY-MM-DD 格式的日期字符串
 * @param dateStr 日期字符串
 * @returns Date 对象
 */
function parseDate(dateStr) {
    var _a = dateStr.split('-').map(Number), year = _a[0], month = _a[1], day = _a[2];
    return new Date(year, month - 1, day);
}
/**
 * 计算两个日期之间的天数差
 * @param startDate 开始日期
 * @param endDate 结束日期
 * @returns 天数差
 */
function daysBetween(startDate, endDate) {
    var start = typeof startDate === 'string' ? parseDate(startDate) : startDate;
    var end = typeof endDate === 'string' ? parseDate(endDate) : endDate;
    var diffTime = end.getTime() - start.getTime();
    return Math.floor(diffTime / (1000 * 60 * 60 * 24));
}
/**
 * 判断是否为今天
 * @param dateStr 日期字符串
 * @returns 是否为今天
 */
function isToday(dateStr) {
    return formatDate(new Date()) === dateStr;
}
/**
 * 获取日期所在月份的第一天
 * @param dateStr 日期字符串
 * @returns 月份第一天 YYYY-MM-DD
 */
function getMonthStart(dateStr) {
    var d = parseDate(dateStr);
    return formatDate(new Date(d.getFullYear(), d.getMonth(), 1));
}
/**
 * 获取日期所在月份的最后一天
 * @param dateStr 日期字符串
 * @returns 月份最后一天 YYYY-MM-DD
 */
function getMonthEnd(dateStr) {
    var d = parseDate(dateStr);
    return formatDate(new Date(d.getFullYear(), d.getMonth() + 1, 0));
}
