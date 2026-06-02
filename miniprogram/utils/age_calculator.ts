// age_calculator.ts - 月龄计算工具

export interface BabyAge {
  years: number;
  months: number;
  days: number;
}

/**
 * 计算宝宝月龄
 * @param birthDate 出生日期 YYYY-MM-DD
 * @param targetDate 目标日期 YYYY-MM-DD，默认为今天
 * @returns 宝宝月龄信息
 */
export function calculateBabyAge(birthDate: string, targetDate?: string): BabyAge {
  const birth = new Date(birthDate);
  const target = targetDate ? new Date(targetDate) : new Date();

  const diffTime = target.getTime() - birth.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  const years = Math.floor(diffDays / 365);
  const remainingDays = diffDays % 365;
  const months = Math.floor(remainingDays / 30);
  const days = remainingDays % 30;

  return { years, months, days };
}

/**
 * 格式化月龄为字符串
 * @param age 月龄信息
 * @returns 格式化的月龄字符串
 */
export function formatAge(age: BabyAge): string {
  if (age.years > 0) {
    return `${age.years}岁${age.months}月`;
  }
  if (age.months > 0) {
    return `${age.months}月${age.days}天`;
  }
  return `${age.days}天`;
}

/**
 * 计算总月龄（月）
 * @param age 月龄信息
 * @returns 总月龄
 */
export function toTotalMonths(age: BabyAge): number {
  return age.years * 12 + age.months;
}

/**
 * 判断是否在指定月龄范围内
 * @param age 月龄信息
 * @param minAge 最小月龄
 * @param maxAge 最大月龄
 * @returns 是否在范围内
 */
export function isInAgeRange(age: BabyAge, minAge: number, maxAge: number): boolean {
  const totalMonths = toTotalMonths(age);
  return totalMonths >= minAge && totalMonths <= maxAge;
}