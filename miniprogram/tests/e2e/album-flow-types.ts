/**
 * FlowStep / FlowContext 共享类型
 *
 * 按 architect §2.2.5：
 *   export interface FlowContext {
 *     automator: MiniProgramAutomator;
 *     screenshot: ScreenshotTaker;
 *     validator: AIValidator;
 *     reporter: Reporter;
 *     page: MiniProgramAutomator['page'];
 *   }
 *
 *   export interface FlowStep {
 *     name: string;
 *     page: string;
 *     action: (ctx: FlowContext) => Promise<void>;
 *     expectations: string[];
 *     skipAI?: boolean;
 *     step?: number;
 *   }
 */

import { ScreenshotTaker } from './screenshot';
import { AIValidator } from './ai-validator';
import { Reporter } from './reporter';

/* miniprogram-automator 的精简类型（避免硬依赖） */
export interface MiniProgramAutomatorPage {
  path: string;
  screenshot(options?: { type?: 'png' | 'jpeg' }): Promise<Buffer>;
  waitFor(selector: string, timeout?: number): Promise<unknown>;
  data(): Promise<Record<string, unknown>>;
  $?(selector: string): Promise<{ tap(): Promise<void> } | null>;
  $$(selector: string): Promise<Array<{ tap(): Promise<void> }>>;
}

export interface MiniProgramAutomator {
  page: MiniProgramAutomatorPage;
  close(): Promise<void>;
  reLaunch?(opt: { url: string }): Promise<MiniProgramAutomatorPage>;
  navigateTo?(opt: { url: string }): Promise<MiniProgramAutomatorPage>;
  redirectTo?(opt: { url: string }): Promise<MiniProgramAutomatorPage>;
  navigateBack?(): Promise<MiniProgramAutomatorPage>;
  currentPage?(): Promise<MiniProgramAutomatorPage>;
}

/**
 * Flow 上下文：每个步骤 action 都能访问的所有工具
 */
export interface FlowContext {
  automator: MiniProgramAutomator;
  screenshot: ScreenshotTaker;
  validator: AIValidator;
  reporter: Reporter;
  page: MiniProgramAutomatorPage;
}

/**
 * Flow 单步
 */
export interface FlowStep {
  /** 步骤名称（人工阅读） */
  name: string;
  /** 目标页面名 */
  page: string;
  /** 步骤编号（可选，未指定时由 runFlow 按数组下标 +1 推断） */
  step?: number;
  /** 步骤动作：执行页面切换 / 点击 / 等待 */
  action: (ctx: FlowContext) => Promise<void>;
  /** AI 验证点列表 */
  expectations: string[];
  /** 跳过 AI 校验 */
  skipAI?: boolean;
}
