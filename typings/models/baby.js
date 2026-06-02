"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BabyGender = void 0;
exports.isBaby = isBaby;
exports.isValidCreateBabyInput = isValidCreateBabyInput;
/**
 * 宝宝性别枚举
 */
var BabyGender;
(function (BabyGender) {
    BabyGender["Male"] = "male";
    BabyGender["Female"] = "female";
    BabyGender["Unknown"] = "unknown";
})(BabyGender || (exports.BabyGender = BabyGender = {}));
/**
 * 类型守卫函数 - 判断对象是否为Baby类型
 */
function isBaby(obj) {
    return obj !== null && typeof obj === 'object' && 'id' in obj && 'name' in obj;
}
/**
 * 验证Baby对象是否符合创建条件
 */
function isValidCreateBabyInput(input) {
    if (input === null || typeof input !== 'object') {
        return false;
    }
    var obj = input;
    return (typeof obj.name === 'string' && obj.name.length > 0 &&
        typeof obj.birthDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(obj.birthDate) &&
        Object.values(BabyGender).includes(obj.gender));
}
