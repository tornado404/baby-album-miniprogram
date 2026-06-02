// storage_keys.ts - 存储键名常量

/**
 * 存储键名前缀
 */
export const STORAGE_PREFIX = 'album_';

/**
 * 存储键名定义
 */
export const STORAGE_KEYS = {
  /** 宝宝数据 */
  babies: `${STORAGE_PREFIX}babies`,
  /** 媒体数据 */
  media: `${STORAGE_PREFIX}media`,
  /** 设置数据 */
  settings: `${STORAGE_PREFIX}settings`,
  /** 存储版本 */
  version: `${STORAGE_PREFIX}version`,
  /** 当前宝宝ID */
  currentBabyId: `${STORAGE_PREFIX}current_baby_id`,
  /** 用户偏好设置 */
  userPreferences: `${STORAGE_PREFIX}user_preferences`
} as const;

/**
 * 存储版本号
 */
export const STORAGE_VERSION = 'v1';