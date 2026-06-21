"use strict";
// config/api.ts - API 环境配置中心
// 支持编译时注入 + 运行时切换的混合方案
// 优先级: 编译常量 DEFAULT_ENV > 持久化存储 > 默认值 'testing'
Object.defineProperty(exports, "__esModule", { value: true });
exports.ENV_STORAGE_KEY = exports.CONFIGS_MAP = exports.CURRENT_ENV = exports.API_CONFIG = void 0;
exports.isEnvSwitchable = isEnvSwitchable;
var CONFIGS = {
    development: {
        baseURL: 'http://localhost:8000/api/v1',
        minioURL: 'http://localhost:9000',
        timeout: 15000,
        name: '本地开发',
        desc: '本地 Docker Compose 环境',
    },
    testing: {
        baseURL: 'http://192.168.50.126:8000/api/v1',
        minioURL: 'http://192.168.50.126:9000',
        timeout: 15000,
        name: '测试服务器',
        desc: 'ARM 局域网测试环境',
    },
    production: {
        baseURL: 'https://api.qzjlyouhua.fun/api/v1',
        minioURL: 'https://oss.qzjlyouhua.fun',
        timeout: 20000,
        name: '生产环境',
        desc: '云服务器正式环境（Cloudflare HTTPS）',
    },
};
/** 存储配置持久化键名 */
var ENV_STORAGE_KEY = 'baby_diary_env_config';
exports.ENV_STORAGE_KEY = ENV_STORAGE_KEY;
/**
 * 获取当前生效的环境 key
 * 优先级：
 *   1. 编译常量 DEFAULT_ENV（CI/CD 构建时注入）
 *   2. wx.getStorageSync 持久化配置（开发调试时切换）
 *   3. 默认值 'testing'
 */
function getCurrentEnv() {
    // 1. 优先编译常量（CI/CD 构建时注入）
    if (typeof DEFAULT_ENV !== 'undefined' && CONFIGS[DEFAULT_ENV]) {
        return DEFAULT_ENV;
    }
    // 2. 读取运行时持久化配置（开发调试时使用）
    try {
        var saved = wx.getStorageSync(ENV_STORAGE_KEY);
        var savedEnv = saved && saved.env ? saved.env : undefined;
        if (savedEnv && CONFIGS[savedEnv]) {
            return savedEnv;
        }
    }
    catch (e) {
        // storage 读取失败，忽略
    }
    // 3. 回退默认值
    return 'production';
}
/**
 * 判断当前构建是否允许运行时切换环境
 * 仅在 development 编译模式或无编译常量时允许
 */
function isEnvSwitchable() {
    if (typeof DEFAULT_ENV !== 'undefined' && DEFAULT_ENV !== 'development') {
        return false;
    }
    return true;
}
var ENV = getCurrentEnv();
exports.API_CONFIG = CONFIGS[ENV];
exports.CURRENT_ENV = ENV;
/** 所有环境配置映射（供 config_service 使用） */
exports.CONFIGS_MAP = CONFIGS;
