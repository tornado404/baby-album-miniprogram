// date_utils.ts - 日期工具函数

/**
 * 格式化日期为 YYYY-MM-DD 格式
 * @param date Date 对象或日期字符串
 * @returns 格式化后的日期字符串
 */
export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * 解析 YYYY-MM-DD 格式的日期字符串
 * @param dateStr 日期字符串
 * @returns Date 对象
 */
export function parseDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
}

/**
 * 计算两个日期之间的天数差
 * @param startDate 开始日期
 * @param endDate 结束日期
 * @returns 天数差
 */
export function daysBetween(startDate: Date | string, endDate: Date | string): number {
  const start = typeof startDate === 'string' ? parseDate(startDate) : startDate;
  const end = typeof endDate === 'string' ? parseDate(endDate) : endDate;
  const diffTime = end.getTime() - start.getTime();
  return Math.floor(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * 判断是否为今天
 * @param dateStr 日期字符串
 * @returns 是否为今天
 */
export function isToday(dateStr: string): boolean {
  return formatDate(new Date()) === dateStr;
}

/**
 * 获取日期所在月份的第一天
 * @param dateStr 日期字符串
 * @returns 月份第一天 YYYY-MM-DD
 */
export function getMonthStart(dateStr: string): string {
  const d = parseDate(dateStr);
  return formatDate(new Date(d.getFullYear(), d.getMonth(), 1));
}

/**
 * 获取日期所在月份的最后一天
 * @param dateStr 日期字符串
 * @returns 月份最后一天 YYYY-MM-DD
 */
export function getMonthEnd(dateStr: string): string {
  const d = parseDate(dateStr);
  return formatDate(new Date(d.getFullYear(), d.getMonth() + 1, 0));
}