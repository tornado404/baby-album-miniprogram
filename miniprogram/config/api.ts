// config/api.ts - API 环境配置

interface ApiConfig {
  baseURL: string;
  timeout: number;
}

type Env = 'development' | 'testing' | 'production';

const CONFIGS: Record<Env, ApiConfig> = {
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
const CURRENT_ENV: Env = 'testing';

export const API_CONFIG = CONFIGS[CURRENT_ENV];