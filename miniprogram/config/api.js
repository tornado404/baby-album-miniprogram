"use strict";
// config/api.ts - API 环境配置
Object.defineProperty(exports, "__esModule", { value: true });
exports.API_CONFIG = void 0;
var CONFIGS = {
    development: {
        baseURL: 'http://localhost:8000/api/v1',
        timeout: 15000,
    },
    testing: {
        baseURL: 'http://101.126.41.146:8000/api/v1',
        timeout: 15000,
    },
    production: {
        baseURL: 'https://api.baby-album.com/api/v1',
        timeout: 20000,
    },
};
// 当前环境（可手动切换）
var CURRENT_ENV = 'testing';
exports.API_CONFIG = CONFIGS[CURRENT_ENV];
