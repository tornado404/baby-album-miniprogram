/**
 * E2E + AI 视觉测试框架 - 基础类型定义
 *
 * 按 architect docs/plan/2026-06-01-architecture-analysis.md §2.2.1
 * 约束：types.ts 不得引用任何其他模块（保持纯类型）。
 *
 * 注意：微信小程序运行时不支持 ES2020+ 语法，但此文件仅在 Node.js 测试环境编译。
 */

/* ==================== 状态枚举 ==================== */

/**
 * 单个测试步骤的最终状态
 *  - pass : 步骤成功（含 AI 通过 / 跳过 AI 也视为通过）
 *  - fail : 步骤未通过（AI 判断 issues 非空或截图与预期不符）
 *  - skip : 步骤被跳过（skipAI=true 或配置跳过）
 *  - error: 步骤执行异常（页面崩溃、元素未找到、网络失败等）
 */
export type StepStatus = 'pass' | 'fail' | 'skip' | 'error';

/* ==================== 截图元数据 ==================== */

export interface ScreenshotMeta {
  step: number;
  page: string;
  action: string;
  /** 相对路径，如 screenshots/01-album-home.png */
  filePath: string;
  /** SHA-256 哈希，用于 AI 缓存去重 */
  sha256: string;
  /** 截图时间戳 (ms since epoch) */
  takenAt: number;
  width: number;
  height: number;
}

/* ==================== AI 验证 ==================== */

/**
 * AI 校验请求
 */
export interface AIValidationRequest {
  screenshot: ScreenshotMeta;
  /** 期望列表，如 ['页面标题为"宝宝相册"', '存在媒体卡片'] */
  expectations: string[];
  /** 上下文（页面路径、data 等），用于 prompt 拼装 */
  context?: {
    page: string;
    data?: Record<string, unknown>;
  };
}

/**
 * AI 校验结果
 */
export interface AIValidationResult {
  pass: boolean;
  issues: string[];
  /** [0, 1] */
  confidence: number;
  /** 原始模型输出（调试用） */
  raw?: string;
  /** 单次调用耗时（含网络） */
  latencyMs: number;
  /** 是否命中缓存 */
  cached: boolean;
}

/* ==================== 步骤结果 ==================== */

/**
 * 单个步骤的执行结果
 */
export interface StepResult {
  step: number;
  page: string;
  action: string;
  status: StepStatus;
  /** 步骤名称（人工阅读用） */
  name: string;
  screenshot?: ScreenshotMeta;
  aiResult?: AIValidationResult;
  /** 步骤执行错误（无错误时为 undefined） */
  error?: string;
  /** 步骤耗时（ms） */
  durationMs: number;
}

/* ==================== 报告 ==================== */

/**
 * AI 调用模式
 *  - real  : 实际调用 AI
 *  - cached: 全部命中缓存
 *  - skipped: 未配置 API Key 或环境禁用
 */
export type AIMode = 'real' | 'cached' | 'skipped';

/**
 * 完整 E2E 测试报告
 */
export interface E2EReport {
  /** ISO 8601 时间戳 */
  timestamp: string;
  /** 总耗时（ms） */
  duration: number;
  totalSteps: number;
  passedSteps: number;
  failedSteps: number;
  skippedSteps: number;
  results: StepResult[];
  meta: {
    cliVersion: string;
    modelName: string;
    aiMode: AIMode;
  };
}

/* ==================== 向后兼容别名 ==================== */

/**
 * 旧版本接口的别名，供历史代码或报告模板使用
 * 新代码请直接使用 StepResult / E2EReport
 */

/** @deprecated use ScreenshotMeta */
export type LegacyScreenshot = ScreenshotMeta;

/** 报告路径集合（仍被 reporter 内部使用） */
export interface ReportPaths {
  dir: string;
  json: string;
  html: string;
  screenshots: string;
}
