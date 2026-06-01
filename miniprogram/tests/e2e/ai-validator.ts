/**
 * AI 视觉验证模块
 *
 * 调用 GLM5 (智谱) / DeepSeek V4 Flash 多模态 API 判断截图是否符合 UI 预期。
 *
 * 特性：
 *  - 自动从环境变量读取 API Key
 *  - 失败自动重试（设计文档第 10 节：网络波动容错）
 *  - 超时控制
 *  - 返回标准化 AiResult
 *
 * 注意：Node.js 测试环境使用，不受小程序 ES5 限制。
 */

import * as fs from 'fs';
import * as path from 'path';
import { AiResult, AiValidatorOptions, AiProvider } from './types';

/* ==================== 工具函数 ==================== */

/**
 * 检测 API Key 属于哪个 provider
 */
export function detectProvider(apiKey: string, baseUrl?: string): AiProvider {
  if (baseUrl && baseUrl.indexOf('deepseek') !== -1) {
    return 'deepseek';
  }
  // DeepSeek 官方 key 一般以 'sk-' 开头，长度 32+，且不含 bigmodel
  // 智谱 key 通常较长且 baseUrl 默认包含 'bigmodel'
  if (baseUrl && baseUrl.indexOf('bigmodel') !== -1) {
    return 'glm';
  }
  // 默认按 baseUrl 启发式
  return 'glm';
}

/**
 * 构造发给多模态模型的 Prompt
 * 参考设计文档第 6 节
 */
export function buildPrompt(expectedUi: string): string {
  return [
    '你是一个 UI 测试工程师。请判断截图中的小程序界面是否符合以下预期：',
    expectedUi,
    '',
    '回复格式（仅返回 JSON，不要包含其他文字、Markdown 代码块或解释）：',
    '{',
    '  "pass": true,   // 符合预期为 true，否则 false',
    '  "issues": [],   // 字符串数组，列出不符合预期的问题',
    '  "confidence": 0.95  // 0-1，越高越确定',
    '}'
  ].join('\n');
}

/**
 * 尝试从模型返回的文本中提取 JSON
 * 容错：可能含 ```json ... ``` 包裹
 */
export function extractJson(text: string): AiResult {
  const trimmed = (text || '').trim();

  // 去除 markdown 代码块
  let body = trimmed;
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence && fence[1]) {
    body = fence[1].trim();
  }

  // 找第一个 { 最后一个 } 之间的内容
  const firstBrace = body.indexOf('{');
  const lastBrace = body.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    body = body.substring(firstBrace, lastBrace + 1);
  }

  try {
    const obj = JSON.parse(body);
    return {
      pass: Boolean(obj.pass),
      issues: Array.isArray(obj.issues) ? obj.issues.map(String) : [],
      confidence:
        typeof obj.confidence === 'number'
          ? Math.max(0, Math.min(1, obj.confidence))
          : 0.5,
      raw: text
    };
  } catch (err) {
    return {
      pass: false,
      issues: ['AI 返回无法解析的 JSON: ' + ((err as Error).message || String(err))],
      confidence: 0,
      raw: text
    };
  }
}

/* ==================== Provider 适配 ==================== */

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | Array<Record<string, unknown>>;
}

interface ProviderRequest {
  url: string;
  headers: Record<string, string>;
  body: Record<string, unknown>;
}

function buildRequest(
  provider: AiProvider,
  baseUrl: string,
  apiKey: string,
  model: string,
  imageBase64: string,
  prompt: string,
  timeoutMs: number
): ProviderRequest {
  const userContent: Array<Record<string, unknown>> = [
    { type: 'text', text: prompt },
    {
      type: 'image_url',
      image_url: { url: 'data:image/png;base64,' + imageBase64 }
    }
  ];

  if (provider === 'glm') {
    return {
      url: baseUrl.replace(/\/+$/, '') + '/chat/completions',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + apiKey
      },
      body: {
        model: model,
        messages: [
          { role: 'user', content: userContent }
        ],
        temperature: 0.1,
        // GLM 多模态超时建议
        timeout: timeoutMs
      }
    };
  }

  // deepseek
  return {
    url: baseUrl.replace(/\/+$/, '') + '/chat/completions',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + apiKey
    },
    body: {
      model: model,
      messages: [
        { role: 'system', content: '你是 UI 测试工程师，只返回 JSON。' },
        { role: 'user', content: userContent }
      ],
      temperature: 0.1
    }
  };
}

function readContentField(json: any): string {
  if (!json) return '';
  // 兼容 OpenAI / GLM 格式
  if (json.choices && json.choices[0]) {
    const c = json.choices[0].message || json.choices[0].delta || {};
    if (typeof c.content === 'string') return c.content;
  }
  // 智谱部分版本 data 字段
  if (typeof json.data === 'string') return json.data;
  return '';
}

/* ==================== AI Validator ==================== */

export class AiValidator {
  private apiKey: string;
  private model: string;
  private baseUrl: string;
  private provider: AiProvider;
  private retries: number;
  private timeoutMs: number;

  constructor(options: AiValidatorOptions = {}) {
    this.apiKey = options.apiKey || process.env.AI_API_KEY || '';
    this.model = options.model || process.env.AI_MODEL || 'glm-4v';
    this.baseUrl =
      options.baseUrl ||
      process.env.AI_BASE_URL ||
      'https://open.bigmodel.cn/api/paas/v4';
    this.provider = detectProvider(this.apiKey, this.baseUrl);
    this.retries = options.retries === undefined ? 1 : options.retries;
    this.timeoutMs = options.timeoutMs || 30000;
  }

  /** 用于测试或调试 */
  public getConfig(): {
    provider: AiProvider;
    model: string;
    baseUrl: string;
    hasKey: boolean;
  } {
    return {
      provider: this.provider,
      model: this.model,
      baseUrl: this.baseUrl,
      hasKey: Boolean(this.apiKey)
    };
  }

  /**
   * 用一张截图和期望 UI 描述调用 AI，返回 AiResult
   * @param screenshotPath  PNG 文件绝对路径
   * @param expectedUi       期望 UI 的自然语言描述
   */
  public async validate(
    screenshotPath: string,
    expectedUi: string
  ): Promise<AiResult> {
    if (!this.apiKey) {
      return {
        pass: false,
        issues: [
          'AI_API_KEY 未配置。请设置环境变量 AI_API_KEY 或在 options.apiKey 传入。'
        ],
        confidence: 0
      };
    }

    if (!fs.existsSync(screenshotPath)) {
      return {
        pass: false,
        issues: ['截图文件不存在: ' + screenshotPath],
        confidence: 0
      };
    }

    const imageBase64 = fs.readFileSync(screenshotPath).toString('base64');
    const prompt = buildPrompt(expectedUi);

    let lastError = '';
    for (let attempt = 0; attempt <= this.retries; attempt++) {
      try {
        const result = await this.callOnce(imageBase64, prompt);
        // 解析成功就直接返回
        if (result.raw && result.raw.length > 0) {
          return result;
        }
        lastError = '空响应';
      } catch (err) {
        lastError = (err as Error).message || String(err);
        // 等待一段时间再重试
        if (attempt < this.retries) {
          await sleep(800 * (attempt + 1));
        }
      }
    }

    return {
      pass: false,
      issues: ['AI 请求失败: ' + lastError],
      confidence: 0
    };
  }

  private async callOnce(
    imageBase64: string,
    prompt: string
  ): Promise<AiResult> {
    const req = buildRequest(
      this.provider,
      this.baseUrl,
      this.apiKey,
      this.model,
      imageBase64,
      prompt,
      this.timeoutMs
    );

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    let response: Response;
    try {
      response = await fetch(req.url, {
        method: 'POST',
        headers: req.headers,
        body: JSON.stringify(req.body),
        signal: controller.signal
      });
    } finally {
      clearTimeout(timer);
    }

    if (!response.ok) {
      const errText = await safeReadText(response);
      throw new Error(
        'HTTP ' + response.status + ' ' + response.statusText + ': ' + errText
      );
    }

    const json = (await response.json()) as Record<string, unknown>;
    const content = readContentField(json);
    if (!content) {
      throw new Error('响应中无 content 字段');
    }
    return extractJson(content);
  }
}

async function safeReadText(resp: Response): Promise<string> {
  try {
    return (await resp.text()).slice(0, 500);
  } catch {
    return '';
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/* ==================== 工具导出 ==================== */

/**
 * 便捷函数：使用全局环境变量创建 validator 并校验
 */
export async function validateScreenshot(
  screenshotPath: string,
  expectedUi: string
): Promise<AiResult> {
  const validator = new AiValidator();
  return validator.validate(screenshotPath, expectedUi);
}

/**
 * 重新导出路径工具（用于 reports 模块）
 */
export { path };
