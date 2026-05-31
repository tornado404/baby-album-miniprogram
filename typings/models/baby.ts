/**
 * 宝宝性别枚举
 */
export enum BabyGender {
  Male = 'male',
  Female = 'female',
  Unknown = 'unknown'
}

/**
 * 宝宝月龄信息
 */
export interface BabyAge {
  years: number;                 // 年龄（岁）
  months: number;                // 月龄（月）
  days: number;                  // 天龄（日）
}

/**
 * 宝宝数据模型
 */
export interface Baby {
  id: string;                    // 唯一标识符
  name: string;                  // 宝宝姓名
  birthDate: string;            // 出生日期 (YYYY-MM-DD)
  gender: BabyGender;            // 性别
  avatar?: string;              // 头像URL
  createdAt: string;            // 创建时间 ISO8601
  updatedAt: string;             // 更新时间 ISO8601
}

/**
 * 创建宝宝的输入参数
 */
export interface CreateBabyInput {
  name: string;
  birthDate: string;
  gender: BabyGender;
  avatar?: string;
}

/**
 * 更新宝宝的输入参数
 */
export interface UpdateBabyInput {
  name?: string;
  birthDate?: string;
  gender?: BabyGender;
  avatar?: string;
}

/**
 * 类型守卫函数 - 判断对象是否为Baby类型
 */
export function isBaby(obj: unknown): obj is Baby {
  return obj !== null && typeof obj === 'object' && 'id' in obj && 'name' in obj;
}

/**
 * 验证Baby对象是否符合创建条件
 */
export function isValidCreateBabyInput(input: unknown): input is CreateBabyInput {
  if (input === null || typeof input !== 'object') {
    return false;
  }
  const obj = input as Record<string, unknown>;
  return (
    typeof obj.name === 'string' && obj.name.length > 0 &&
    typeof obj.birthDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(obj.birthDate) &&
    Object.values(BabyGender).includes(obj.gender as BabyGender)
  );
}