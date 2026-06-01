/**
 * AI 视觉验证 - 类模式
 *
 * 按 architect §2.2.3：AIValidator 类
 *  - validate()        单个请求
 *  - validateBatch()   批量（p-limit 并发 ≤ concurrency）
 *  - clearCache()      清空 SHA-256 缓存
 *
 * 设计要点（§1.3.2）：
 *  - OpenAI 兼容协议 + response_format: json_object
 *  - 指数退避重试：1s → 2s → 4s，最多 maxRetries 次
 *  - 仅在 HTTP 429/5xx 或 JSON 解析失败时重试，pass=false 不重试
 *  - 缓存：sha256(screenshot) + sha256(prompt) 作为 key
 *  - 降级：CI 环境无 AI_API_KEY 时，validate() 返回 cached: false, pass: true, issues: ['AI 已跳过']
 */

import { createHash } from 'crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, unlinkSync } from 'fs';
import { join } from 'path';
import {
  AIValidationRequest,
  AIValidationResult,
  ScreenshotMeta
} from './types';

/* ==================== 配置 ==================== */

export interface AIValidatorOptions {
  apiKey?: string;
  /** 默认 https://open.bigmodel.cn/api/paas/v4 */
  baseUrl?: string;
  /** 默认 glm-4v */
  model?: string;
  /** 默认 tests/.ai-cache */
  cacheDir?: string;
  /** 默认 2 */
  maxRetries?: number;
  /** 默认 30000 */
  timeoutMs?: number;
  /** 默认 2 */
  concurrency?: number;
}

/* ==================== 工具函数（导出便于测试） ==================== */

export function detectProvider(baseUrl?: string): 'glm' | 'deepseek' | 'openai' {
  if (!baseUrl) return 'glm';
  if (baseUrl.indexOf('deepseek') !== -1) return 'deepseek';
  if (baseUrl.indexOf('openai') !== -1) return 'openai';
  return 'glm';
}

/**
 * 构造结构化 prompt（按 §3.3 模板）
 */
export function buildPrompt(
  expectations: string[],
  context?: { page?: string; data?: Record<string, unknown> }
): string {
  const page = (context && context.page) || 'unknown';
  const expList = expectations
    .map((e, i) => '  ' + (i + 1) + '. ' + e)
    .join('\n');
  return [
    '你是一个严格的小程序 UI 自动化测试工程师。',
    '你的任务：判断【截图】是否同时满足【期望列表】中的所有条件。',
    '',
    '【当前上下文】',
    '- 页面: ' + page,
    '',
    '【期望列表】',
    expList,
    '',
    '【输出要求】',
    '- 仅返回合法 JSON，不要任何额外文字、Markdown 代码块或解释。',
    '- 严格使用以下 schema：',
    '  {',
    '    "pass": boolean,',
    '    "issues": string[],        // 不通过时填写具体问题，通过时为空数组',
    '    "confidence": number       // 0~1，表示判断信心',
    '  }',
    '- 信心低于 0.7 时，必须在 issues 中说明不确定点。',
    '',
    '【重要约束】',
    '- 只关注 UI 表现（颜色、布局、文案、组件是否可见），不评判后端逻辑。',
    '- 截图模糊、加载中、权限弹窗遮挡等非正常状态，应判定为 fail。',
    '- 不要因为截图分辨率低、字体模糊等次要问题判定 fail。'
  ].join('\n');
}

/**
 * 从模型返回文本中提取 JSON（容错：可能含 ```json 包裹）
 */
export function extractJson(text: string): AIValidationResult {
  const trimmed = (text || '').trim();
  let body = trimmed;
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence && fence[1]) {
    body = fence[1].trim();
  }
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
      raw: text,
      latencyMs: 0,
      cached: false
    };
  } catch {
    return {
      pass: false,
      issues: ['AI 返回无法解析的 JSON'],
      confidence: 0,
      raw: text,
      latencyMs: 0,
      cached: false
    };
  }
}

/**
 * 简易 p-limit 实现（避免新依赖）
 */
class Limiter {
  private queue: Array<() => void> = [];
  private active = 0;
  constructor(private max: number) {}
  async run<T>(fn: () => Promise<T>): Promise<T> {
    if (this.active >= this.max) {
      await new Promise<void>(resolve => this.queue.push(resolve));
    }
    this.active++;
    try {
      return await fn();
    } finally {
      this.active--;
      const next = this.queue.shift();
      if (next) next();
    }
  }
}

/* ==================== HTTP 调用 ==================== */

interface ProviderRequest {
  url: string;
  headers: Record<string, string>;
  body: Record<string, unknown>;
}

function buildRequest(
  baseUrl: string,
  apiKey: string,
  model: string,
  prompt: string,
  imageBase64: string
): ProviderRequest {
  const url = baseUrl.replace(/\/+$/, '') + '/chat/completions';
  const headers = {
    'Content-Type': 'application/json',
    Authorization: 'Bearer ' + apiKey
  };
  const userContent = [
    { type: 'text', text: prompt },
    {
      type: 'image_url',
      image_url: { url: 'data:image/png;base64,' + imageBase64 }
    }
  ];
  return {
    url: url,
    headers: headers,
    body: {
      model: model,
      messages: [{ role: 'user', content: userContent }],
      response_format: { type: 'json_object' },
      temperature: 0.0,
      max_tokens: 500
    }
  };
}

function readContentField(json: any): string {
  if (!json) return '';
  if (json.choices && json.choices[0]) {
    const c = json.choices[0].message || json.choices[0].delta || {};
    if (typeof c.content === 'string') return c.content;
  }
  if (typeof json.data === 'string') return json.data;
  return '';
}

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

/* ==================== AIValidator ==================== */

export class AIValidator {
  private apiKey: string;
  private baseUrl: string;
  private model: string;
  private cacheDir: string;
  private maxRetries: number;
  private timeoutMs: number;
  private concurrency: number;
  private limiter: Limiter;
  private enabled: boolean;

  constructor(options: AIValidatorOptions = {}) {
    this.apiKey = options.apiKey || process.env.AI_API_KEY || '';
    this.baseUrl =
      options.baseUrl ||
      process.env.AI_BASE_URL ||
      'https://open.bigmodel.cn/api/paas/v4';
    this.model = options.model || process.env.AI_MODEL || 'glm-4v';
    this.cacheDir =
      options.cacheDir ||
      process.env.AI_CACHE_DIR ||
      join(process.cwd(), 'miniprogram', 'tests', '.ai-cache');
    this.maxRetries = options.maxRetries === undefined ? 2 : options.maxRetries;
    this.timeoutMs = options.timeoutMs || 30000;
    this.concurrency = options.concurrency === undefined ? 2 : options.concurrency;
    this.limiter = new Limiter(this.concurrency);
    this.enabled = Boolean(this.apiKey);
  }

  /** 用于测试或调试 */
  public getConfig() {
    return {
      provider: detectProvider(this.baseUrl),
      model: this.model,
      baseUrl: this.baseUrl,
      hasKey: this.enabled,
      cacheDir: this.cacheDir
    };
  }

  /** 是否启用（有无 API Key） */
  public isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * 单个验证
   */
  public async validate(req: AIValidationRequest): Promise<AIValidationResult> {
    if (!this.enabled) {
      return this.skippedResult('AI_API_KEY 未配置，AI 验证已跳过');
    }
    return this.limiter.run(() => this.validateUnlocked(req));
  }

  /**
   * 批量验证（并发控制 ≤ concurrency）
   */
  public async validateBatch(
    reqs: AIValidationRequest[]
  ): Promise<AIValidationResult[]> {
    return Promise.all(reqs.map(r => this.validate(r)));
  }

  /**
   * 清空缓存目录
   */
  public async clearCache(): Promise<void> {
    if (!existsSync(this.cacheDir)) return;
    for (const f of readdirSync(this.cacheDir)) {
      try {
        unlinkSync(join(this.cacheDir, f));
      } catch {
        // ignore
      }
    }
  }

  /* ==================== 内部方法 ==================== */

  private skippedResult(reason: string): AIValidationResult {
    return {
      pass: true,
      issues: [reason],
      confidence: 0,
      raw: reason,
      latencyMs: 0,
      cached: false
    };
  }

  private cacheKey(req: AIValidationRequest): string {
    const prompt = buildPrompt(req.expectations, req.context);
    const promptHash = createHash('sha256')
      .update(prompt)
      .digest('hex')
      .substring(0, 16);
    const imgHash = req.screenshot.sha256.substring(0, 32);
    return imgHash + '-' + promptHash;
  }

  private readCache(key: string): AIValidationResult | null {
    const file = join(this.cacheDir, key + '.json');
    if (!existsSync(file)) return null;
    try {
      const raw = readFileSync(file, 'utf-8');
      const obj = JSON.parse(raw) as AIValidationResult;
      return { ...obj, cached: true, latencyMs: 0 };
    } catch {
      return null;
    }
  }

  private writeCache(key: string, result: AIValidationResult): void {
    try {
      if (!existsSync(this.cacheDir)) {
        mkdirSync(this.cacheDir, { recursive: true });
      }
      writeFileSync(join(this.cacheDir, key + '.json'), JSON.stringify(result), 'utf-8');
    } catch {
      // 缓存失败不影响主流程
    }
  }

  private async validateUnlocked(
    req: AIValidationRequest
  ): Promise<AIValidationResult> {
    // 1) 缓存
    const key = this.cacheKey(req);
    const cached = this.readCache(key);
    if (cached) return cached;

    // 2) 读取图片 base64
    //    screenshot.filePath 可能是相对路径或绝对路径，这里从 working dir 解析
    const imageBase64 = this.readScreenshotBase64(req.screenshot);
    if (!imageBase64) {
      return {
        pass: false,
        issues: ['截图文件不存在: ' + req.screenshot.filePath],
        confidence: 0,
        latencyMs: 0,
        cached: false
      };
    }

    // 3) 构造请求
    const prompt = buildPrompt(req.expectations, req.context);
    const httpReq = buildRequest(this.baseUrl, this.apiKey, this.model, prompt, imageBase64);

    // 4) 指数退避重试
    let lastErr = '';
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      const start = Date.now();
      try {
        const text = await this.callOnce(httpReq);
        const parsed = extractJson(text);
        const result: AIValidationResult = {
          ...parsed,
          latencyMs: Date.now() - start,
          cached: false
        };
        this.writeCache(key, result);
        return result;
      } catch (err) {
        lastErr = (err as Error).message || String(err);
        if (attempt < this.maxRetries) {
          await sleep(1000 * Math.pow(2, attempt));
        }
      }
    }
    return {
      pass: false,
      issues: ['AI 请求失败: ' + lastErr],
      confidence: 0,
      raw: lastErr,
      latencyMs: 0,
      cached: false
    };
  }

  private readScreenshotBase64(meta: ScreenshotMeta): string | null {
    const candidates = [
      meta.filePath,
      join(process.cwd(), meta.filePath),
      join(process.cwd(), 'miniprogram', 'tests', 'reports', meta.filePath)
    ];
    for (const p of candidates) {
      if (existsSync(p)) {
        try {
          return readFileSync(p).toString('base64');
        } catch {
          continue;
        }
      }
    }
    return null;
  }

  private async callOnce(req: ProviderRequest): Promise<string> {
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
      const t = await safeReadText(response);
      throw new Error('HTTP ' + response.status + ' ' + response.statusText + ': ' + t);
    }
    const json = (await response.json()) as Record<string, unknown>;
    const content = readContentField(json);
    if (!content) throw new Error('响应中无 content 字段');
    return content;
  }
}

async function safeReadText(r: Response): Promise<string> {
  try {
    return (await r.text()).slice(0, 500);
  } catch {
    return '';
  }
}

/* ==================== 向后兼容函数 ==================== */

export async function validateScreenshot(
  screenshotPath: string,
  expectedUi: string
): Promise<AIValidationResult> {
  const v = new AIValidator();
  return v.validate({
    screenshot: {
      step: 0,
      page: 'unknown',
      action: 'screenshot',
      filePath: screenshotPath,
      sha256: '',
      takenAt: Date.now(),
      width: 0,
      height: 0
    },
    expectations: [expectedUi]
  });
}
