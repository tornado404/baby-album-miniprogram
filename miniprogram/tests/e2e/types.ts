/**
 * E2E + AI 视觉测试框架 - 类型定义
 *
 * 遵循设计文档 docs/plan/2026-06-01-miniprogram-e2e-ai-design.md
 *
 * 注意：微信小程序运行时不支持 ES2020+ 语法（?? ?. ??= ?.()）
 * 此文件用于 Node.js 测试环境（Jest），不受该限制影响，但保持代码风格一致。
 */

/* ==================== AI 验证结果 ==================== */

/**
 * AI 视觉模型对一张截图的判断结果
 */
export interface AiResult {
  /** 是否通过校验 */
  pass: boolean;
  /** 识别到的问题列表（pass=true 时通常为空数组） */
  issues: string[];
  /** AI 置信度 0-1 */
  confidence: number;
  /** AI 模型原始输出（用于调试） */
  raw?: string;
}

/* ==================== 测试步骤 ==================== */

/**
 * 一个小程序页面名称（与 app.json pages 中注册的路径对应）
 * 限制为字符串字面量类型以便 IDE 自动补全
 */
export type PageName =
  | 'index'
  | 'logs'
  | 'album_home'
  | 'media_detail'
  | 'tech_validate';

/**
 * 测试步骤支持的操作
 *  - reLaunch  : 启动/重新启动到某个页面
 *  - navigateTo: 跳转到新页面（保留当前页）
 *  - redirectTo: 替换当前页
 *  - navigateBack: 返回上一页
 *  - tap       : 点击元素
 *  - waitFor   : 等待一段时间（ms）
 *  - screenshot: 单独截图（不切换页面）
 */
export type TestAction =
  | 'reLaunch'
  | 'navigateTo'
  | 'redirectTo'
  | 'navigateBack'
  | 'tap'
  | 'waitFor'
  | 'screenshot';

/**
 * 单个测试步骤的描述
 */
export interface TestStep {
  /** 步骤序号（从 1 开始），由编排器在执行时填充 */
  step: number;
  /** 目标页面 */
  page: PageName;
  /** 步骤操作 */
  action: TestAction;
  /** 元素选择器（tap 时必填，reLaunch/navigateTo 时为页面路径） */
  selector?: string;
  /** 等待时长（ms），waitFor / navigateTo 后稳定等待使用 */
  waitMs?: number;
  /** AI 验证提示词，描述本步骤期望的 UI */
  aiPrompt: string;
  /** 步骤名称（用于报告展示） */
  name: string;
  /** 是否跳过 AI 校验（默认 false） */
  skipAi?: boolean;
}

/* ==================== 测试结果 ==================== */

/**
 * 单个步骤的执行结果
 */
export interface TestResult {
  /** 步骤序号 */
  step: number;
  /** 目标页面 */
  page: PageName;
  /** 操作 */
  action: TestAction;
  /** 步骤名称 */
  name: string;
  /** 截图文件相对路径（reports/screenshots/xxx.png） */
  screenshot: string;
  /** AI 判断结果（skipAi=true 时为 null） */
  aiResult: AiResult | null;
  /** 步骤耗时（ms） */
  duration: number;
  /** 步骤执行错误（无错误时为 null） */
  error: string | null;
}

/* ==================== 报告路径 ==================== */

/**
 * 测试报告的输出路径集合
 */
export interface ReportPaths {
  /** 报告根目录（miniprogram/tests/reports/<timestamp>） */
  dir: string;
  /** JSON 报告路径 */
  json: string;
  /** HTML 报告路径 */
  html: string;
  /** 截图目录 */
  screenshots: string;
}

/* ==================== 测试套件 ==================== */

/**
 * AI 校验模块的输入选项
 */
export interface AiValidatorOptions {
  /** API Key（默认从 process.env.AI_API_KEY 读取） */
  apiKey?: string;
  /** 模型名，默认 'glm-4v' */
  model?: string;
  /** API base URL，默认智谱 'https://open.bigmodel.cn/api/paas/v4' */
  baseUrl?: string;
  /** 失败重试次数，默认 1（设计文档第 10 节） */
  retries?: number;
  /** 单次请求超时（ms），默认 30000 */
  timeoutMs?: number;
}

/**
 * AI Provider 信息
 */
export type AiProvider = 'glm' | 'deepseek';

/**
 * 完整测试报告 JSON
 */
export interface E2EReport {
  /** ISO 时间戳 */
  timestamp: string;
  /** 总耗时（ms） */
  duration: number;
  /** 总步骤数 */
  totalSteps: number;
  /** 通过的步骤数 */
  passedSteps: number;
  /** 失败的步骤数 */
  failedSteps: number;
  /** 全部步骤结果 */
  results: TestResult[];
}
