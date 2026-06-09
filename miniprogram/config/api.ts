// config/api.ts - API 环境配置中心
// 支持编译时注入 + 运行时切换的混合方案
// 优先级: 编译常量 DEFAULT_ENV > 持久化存储 > 默认值 'testing'

interface ApiConfig {
  baseURL: string;
  timeout: number;
  name: string;
  desc: string;
}

interface EnvConfig {
  env: string;
  timestamp: number;
}

type Env = 'development' | 'testing' | 'production';

const CONFIGS: Record<Env, ApiConfig> = {
  development: {
    baseURL: 'http://localhost:8000/api/v1',
    timeout: 15000,
    name: '本地开发',
    desc: '本地 Docker Compose 环境',
  },
  testing: {
    baseURL: 'http://101.126.41.146:8000/api/v1',
    timeout: 15000,
    name: '测试服务器',
    desc: '云服务器测试环境',
  },
  production: {
    baseURL: 'https://api.baby-album.com/api/v1',
    timeout: 20000,
    name: '生产环境',
    desc: '正式上线环境',
  },
};

/**
 * 编译时默认环境常量
 * 由构建脚本注入 (scripts/build.js)
 * 未定义时由运行时逻辑决定
 */
declare var DEFAULT_ENV: Env | undefined;

/** 存储配置持久化键名 */
var ENV_STORAGE_KEY = 'baby_diary_env_config';

/**
 * 获取当前生效的环境 key
 * 优先级：
 *   1. 编译常量 DEFAULT_ENV（CI/CD 构建时注入）
 *   2. wx.getStorageSync 持久化配置（开发调试时切换）
 *   3. 默认值 'testing'
 */
function getCurrentEnv(): Env {
  // 1. 优先编译常量（CI/CD 构建时注入）
  if (typeof DEFAULT_ENV !== 'undefined' && CONFIGS[DEFAULT_ENV]) {
    return DEFAULT_ENV;
  }

  // 2. 读取运行时持久化配置（开发调试时使用）
  try {
    var saved: EnvConfig = wx.getStorageSync(ENV_STORAGE_KEY);
    var savedEnv: Env = saved && saved.env ? saved.env as Env : undefined as any;
    if (savedEnv && CONFIGS[savedEnv]) {
      return savedEnv;
    }
  } catch (e) {
    // storage 读取失败，忽略
  }

  // 3. 回退默认值
  return 'testing';
}

/**
 * 判断当前构建是否允许运行时切换环境
 * 仅在 development 编译模式或无编译常量时允许
 */
function isEnvSwitchable(): boolean {
  if (typeof DEFAULT_ENV !== 'undefined' && DEFAULT_ENV !== 'development') {
    return false;
  }
  return true;
}

var ENV = getCurrentEnv();
export const API_CONFIG = CONFIGS[ENV];
export const CURRENT_ENV = ENV;
/** 所有环境配置映射（供 config_service 使用） */
export const CONFIGS_MAP = CONFIGS;
/** 存储键名（供 config_service 使用） */
export { ENV_STORAGE_KEY };
export { isEnvSwitchable };