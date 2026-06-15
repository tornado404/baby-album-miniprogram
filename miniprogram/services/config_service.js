"use strict";
// config_service.ts - 运行时环境配置切换服务
// 提供环境查询、切换、重置等编程接口
// 开发调试模式可用，生产构建禁用
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConfigService = exports.configService = void 0;
var api_1 = require("../config/api");
/**
 * 运行时配置切换服务
 */
var ConfigService = /** @class */ (function () {
    function ConfigService() {
    }
    /**
     * 获取所有可用环境列表（供切换 UI 使用）
     */
    ConfigService.prototype.getAvailableEnvs = function () {
        var envs = [];
        var keys = Object.keys(api_1.CONFIGS_MAP);
        for (var i = 0; i < keys.length; i++) {
            var key = keys[i];
            envs.push({
                key: key,
                name: api_1.CONFIGS_MAP[key].name,
                desc: api_1.CONFIGS_MAP[key].desc,
            });
        }
        return envs;
    };
    /**
     * 获取当前环境名（如 'testing'）
     */
    ConfigService.prototype.getCurrentEnv = function () {
        return api_1.CURRENT_ENV;
    };
    /**
     * 获取当前环境的显示名称
     */
    ConfigService.prototype.getCurrentEnvName = function () {
        return api_1.CONFIGS_MAP[api_1.CURRENT_ENV]
            ? api_1.CONFIGS_MAP[api_1.CURRENT_ENV].name
            : api_1.CURRENT_ENV;
    };
    /**
     * 切换环境（仅开发调试模式可用）
     * 切换后需重启小程序生效
     * @returns 是否切换成功
     */
    ConfigService.prototype.switchTo = function (env) {
        if (!(0, api_1.isEnvSwitchable)()) {
            console.warn('[config] 生产环境禁止运行时切换');
            return false;
        }
        if (!api_1.CONFIGS_MAP[env]) {
            console.warn('[config] 无效环境:', env);
            return false;
        }
        try {
            wx.setStorageSync(api_1.ENV_STORAGE_KEY, {
                env: env,
                timestamp: Date.now(),
            });
            console.log('[config] 环境已切换至:', env, api_1.CONFIGS_MAP[env].name);
            return true;
        }
        catch (e) {
            console.error('[config] 环境切换失败:', e);
            return false;
        }
    };
    /**
     * 清除本地配置，回退到编译时默认
     */
    ConfigService.prototype.resetToDefault = function () {
        try {
            wx.removeStorageSync(api_1.ENV_STORAGE_KEY);
            console.log('[config] 已重置为默认环境');
            return true;
        }
        catch (e) {
            console.error('[config] 重置失败:', e);
            return false;
        }
    };
    /**
     * 获取切换后的提示文字
     */
    ConfigService.prototype.getSwitchTip = function () {
        return '环境切换成功，请重启小程序后生效';
    };
    return ConfigService;
}());
exports.ConfigService = ConfigService;
var configService = new ConfigService();
exports.configService = configService;
exports.default = configService;
