// config_service.ts - 运行时环境配置切换服务
// 提供环境查询、切换、重置等编程接口
// 开发调试模式可用，生产构建禁用

import { CONFIGS_MAP, CURRENT_ENV, isEnvSwitchable, ENV_STORAGE_KEY } from '../config/api';

type Env = 'development' | 'testing' | 'production';

interface EnvConfig {
  env: string;
  timestamp: number;
}

interface EnvOption {
  key: Env;
  name: string;
  desc: string;
}

/**
 * 运行时配置切换服务
 */
class ConfigService {

  /**
   * 获取所有可用环境列表（供切换 UI 使用）
   */
  getAvailableEnvs(): EnvOption[] {
    var envs: EnvOption[] = [];
    var keys = Object.keys(CONFIGS_MAP);
    for (var i = 0; i < keys.length; i++) {
      var key = keys[i] as Env;
      envs.push({
        key: key,
        name: CONFIGS_MAP[key].name,
        desc: CONFIGS_MAP[key].desc,
      });
    }
    return envs;
  }

  /**
   * 获取当前环境名（如 'testing'）
   */
  getCurrentEnv(): string {
    return CURRENT_ENV;
  }

  /**
   * 获取当前环境的显示名称
   */
  getCurrentEnvName(): string {
    return CONFIGS_MAP[CURRENT_ENV as Env]
      ? CONFIGS_MAP[CURRENT_ENV as Env].name
      : CURRENT_ENV;
  }

  /**
   * 切换环境（仅开发调试模式可用）
   * 切换后需重启小程序生效
   * @returns 是否切换成功
   */
  switchTo(env: Env): boolean {
    if (!isEnvSwitchable()) {
      console.warn('[config] 生产环境禁止运行时切换');
      return false;
    }
    if (!CONFIGS_MAP[env]) {
      console.warn('[config] 无效环境:', env);
      return false;
    }
    try {
      wx.setStorageSync(ENV_STORAGE_KEY, {
        env: env,
        timestamp: Date.now(),
      });
      console.log('[config] 环境已切换至:', env, CONFIGS_MAP[env].name);
      return true;
    } catch (e) {
      console.error('[config] 环境切换失败:', e);
      return false;
    }
  }

  /**
   * 清除本地配置，回退到编译时默认
   */
  resetToDefault(): boolean {
    try {
      wx.removeStorageSync(ENV_STORAGE_KEY);
      console.log('[config] 已重置为默认环境');
      return true;
    } catch (e) {
      console.error('[config] 重置失败:', e);
      return false;
    }
  }

  /**
   * 获取切换后的提示文字
   */
  getSwitchTip(): string {
    return '环境切换成功，请重启小程序后生效';
  }
}

var configService = new ConfigService();

export { configService, ConfigService };
export default configService;