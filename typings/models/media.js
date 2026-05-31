"use strict";
// media.ts - 媒体数据模型
Object.defineProperty(exports, "__esModule", { value: true });
exports.MediaType = void 0;
exports.isMedia = isMedia;
exports.isMediaQuery = isMediaQuery;
exports.isValidMediaQuery = isValidMediaQuery;
/**
 * 媒体类型枚举
 */
var MediaType;
(function (MediaType) {
    MediaType["Photo"] = "photo";
    MediaType["Video"] = "video";
})(MediaType || (exports.MediaType = MediaType = {}));
/**
 * 类型守卫函数 - 判断对象是否为Media类型
 */
function isMedia(obj) {
    return obj !== null && typeof obj === 'object' && 'id' in obj && 'babyId' in obj;
}
/**
 * 类型守卫函数 - 判断对象是否为MediaQuery类型
 */
function isMediaQuery(obj) {
    if (obj === null || typeof obj !== 'object') {
        return false;
    }
    var q = obj;
    // page 和 pageSize 必须为正整数
    if (q.page !== undefined && (typeof q.page !== 'number' || q.page < 1 || !Number.isInteger(q.page))) {
        return false;
    }
    if (q.pageSize !== undefined && (typeof q.pageSize !== 'number' || q.pageSize < 1 || !Number.isInteger(q.pageSize))) {
        return false;
    }
    return true;
}
/**
 * 验证MediaQuery对象的基本有效字段（别名，保持向后兼容）
 */
function isValidMediaQuery(query) {
    return isMediaQuery(query);
}
