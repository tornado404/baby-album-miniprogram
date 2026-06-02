"use strict";
// storage_keys.ts - 存储键名常量
Object.defineProperty(exports, "__esModule", { value: true });
exports.STORAGE_VERSION = exports.STORAGE_KEYS = exports.STORAGE_PREFIX = void 0;
/**
 * 存储键名前缀
 */
exports.STORAGE_PREFIX = 'album_';
/**
 * 存储键名定义
 */
exports.STORAGE_KEYS = {
    /** 宝宝数据 */
    babies: "".concat(exports.STORAGE_PREFIX, "babies"),
    /** 媒体数据 */
    media: "".concat(exports.STORAGE_PREFIX, "media"),
    /** 设置数据 */
    settings: "".concat(exports.STORAGE_PREFIX, "settings"),
    /** 存储版本 */
    version: "".concat(exports.STORAGE_PREFIX, "version"),
    /** 当前宝宝ID */
    currentBabyId: "".concat(exports.STORAGE_PREFIX, "current_baby_id"),
    /** 用户偏好设置 */
    userPreferences: "".concat(exports.STORAGE_PREFIX, "user_preferences")
};
/**
 * 存储版本号
 */
exports.STORAGE_VERSION = 'v1';
