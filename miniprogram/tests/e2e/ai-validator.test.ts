/**
 * AI 验证模块单元测试
 *
 * 覆盖：
 *  - buildPrompt  模板构造
 *  - detectProvider  baseUrl 启发式
 *  - extractJson    各种 JSON 边界
 *  - AIValidator    缓存、重试、skip、超时
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  AIValidator,
  buildPrompt,
  detectProvider,
  extractJson
} from './ai-validator';
import { AIValidationRequest } from './types';

describe('ai-validator: 工具函数', () => {
  describe('buildPrompt', () => {
    it('应包含期望列表与 JSON schema 说明', () => {
      const p = buildPrompt(['标题为 X', '按钮存在'], { page: 'album_home' });
      expect(p).toContain('UI 自动化测试工程师');
      expect(p).toContain('1. 标题为 X');
      expect(p).toContain('2. 按钮存在');
      expect(p).toContain('"pass"');
      expect(p).toContain('"issues"');
      expect(p).toContain('"confidence"');
      expect(p).toContain('album_home');
    });
  });

  describe('detectProvider', () => {
    it('baseUrl 含 bigmodel 时返回 glm', () => {
      expect(detectProvider('https://open.bigmodel.cn/api/paas/v4')).toBe('glm');
    });
    it('baseUrl 含 deepseek 时返回 deepseek', () => {
      expect(detectProvider('https://api.deepseek.com/v1')).toBe('deepseek');
    });
    it('baseUrl 含 openai 时返回 openai', () => {
      expect(detectProvider('https://api.openai.com/v1')).toBe('openai');
    });
    it('baseUrl 不明时默认 glm', () => {
      expect(detectProvider('https://example.com/v1')).toBe('glm');
    });
    it('baseUrl 为空时默认 glm', () => {
      expect(detectProvider()).toBe('glm');
    });
  });

  describe('extractJson', () => {
    it('解析纯 JSON', () => {
      const r = extractJson('{"pass":true,"issues":[],"confidence":0.9}');
      expect(r.pass).toBe(true);
      expect(r.issues).toEqual([]);
      expect(r.confidence).toBe(0.9);
      expect(r.cached).toBe(false);
    });

    it('解析 ```json``` 包裹的 JSON', () => {
      const r = extractJson(
        '```json\n{"pass":false,"issues":["x"],"confidence":0.1}\n```'
      );
      expect(r.pass).toBe(false);
      expect(r.issues).toEqual(['x']);
    });

    it('从包含前后文字的响应中提取 JSON', () => {
      const r = extractJson('结果：{"pass":true,"issues":[],"confidence":0.7} 完');
      expect(r.pass).toBe(true);
    });

    it('非法 JSON 时返回 pass=false 与错误信息', () => {
      const r = extractJson('not json');
      expect(r.pass).toBe(false);
      expect(r.issues[0]).toMatch(/无法解析/);
    });

    it('confidence 限制在 0-1', () => {
      const r1 = extractJson('{"pass":true,"issues":[],"confidence":2.5}');
      expect(r1.confidence).toBe(1);
      const r2 = extractJson('{"pass":true,"issues":[],"confidence":-0.3}');
      expect(r2.confidence).toBe(0);
    });
  });
});

describe('ai-validator: AIValidator 行为', () => {
  const origFetch = (global as any).fetch;
  const origApiKey = process.env.AI_API_KEY;
  let cacheDir: string;

  beforeEach(() => {
    cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-cache-'));
  });
  afterEach(() => {
    (global as any).fetch = origFetch;
    if (origApiKey === undefined) {
      delete process.env.AI_API_KEY;
    } else {
      process.env.AI_API_KEY = origApiKey;
    }
    if (cacheDir && fs.existsSync(cacheDir)) {
      fs.rmSync(cacheDir, { recursive: true, force: true });
    }
  });

  function fakePngFile(): string {
    const pngBase64 =
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
    const p = path.join(cacheDir, 'fake.png');
    fs.writeFileSync(p, Buffer.from(pngBase64, 'base64'));
    return p;
  }

  function fakeRequest(meta: { filePath: string; sha256: string }): AIValidationRequest {
    return {
      screenshot: {
        step: 1,
        page: 'album_home',
        action: 'screenshot',
        filePath: meta.filePath,
        sha256: meta.sha256,
        takenAt: Date.now(),
        width: 1,
        height: 1
      },
      expectations: ['标题为 X'],
      context: { page: 'album_home' }
    };
  }

  function aiResponseContent(text: string): Response {
    return new Response(
      JSON.stringify({ choices: [{ message: { content: text } }] }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  it('未配置 API Key 时直接返回 skipped 结果', async () => {
    delete process.env.AI_API_KEY;
    const v = new AIValidator({ apiKey: '', cacheDir: cacheDir });
    expect(v.isEnabled()).toBe(false);
    const r = await v.validate(fakeRequest({ filePath: 'x.png', sha256: 'a' }));
    expect(r.pass).toBe(true);
    expect(r.issues[0]).toMatch(/跳过/);
  });

  it('截图不存在时返回 pass=false 且包含路径', async () => {
    const v = new AIValidator({ apiKey: 'sk-test', cacheDir: cacheDir });
    const r = await v.validate(
      fakeRequest({ filePath: '/no/such/file.png', sha256: 'a' })
    );
    expect(r.pass).toBe(false);
    expect(r.issues[0]).toMatch(/不存在/);
  });

  it('网络成功时返回解析后的结果并写入缓存', async () => {
    const png = fakePngFile();
    (global as any).fetch = jest.fn(async () =>
      aiResponseContent('{"pass":true,"issues":[],"confidence":0.88}')
    );
    const v = new AIValidator({
      apiKey: 'sk-test',
      baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
      cacheDir: cacheDir,
      maxRetries: 0,
      timeoutMs: 5000
    });
    const r = await v.validate(fakeRequest({ filePath: png, sha256: 'h1' }));
    expect(r.pass).toBe(true);
    expect(r.confidence).toBe(0.88);
    expect(r.cached).toBe(false);

    // 验证 HTTP 请求
    const fetchMock = (global as any).fetch as jest.Mock;
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain('chat/completions');
    const body = JSON.parse(init.body);
    expect(body.model).toBe('glm-4v');
    expect(body.response_format).toEqual({ type: 'json_object' });
    expect(body.messages[0].content[1].image_url.url).toMatch(
      /^data:image\/png;base64,/
    );

    // 验证缓存被写入
    const files = fs.readdirSync(cacheDir).filter(f => f.endsWith('.json'));
    expect(files.length).toBe(1);
  });

  it('相同请求第二次命中缓存', async () => {
    const png = fakePngFile();
    (global as any).fetch = jest.fn(async () =>
      aiResponseContent('{"pass":true,"issues":[],"confidence":0.88}')
    );
    const v = new AIValidator({
      apiKey: 'sk-test',
      baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
      cacheDir: cacheDir,
      maxRetries: 0
    });
    const req = fakeRequest({ filePath: png, sha256: 'h1' });
    const r1 = await v.validate(req);
    expect(r1.cached).toBe(false);
    const r2 = await v.validate(req);
    expect(r2.cached).toBe(true);
    // fetch 仅调用一次
    expect((global as any).fetch).toHaveBeenCalledTimes(1);
  });

  it('失败时按 maxRetries 次数指数退避重试', async () => {
    const png = fakePngFile();
    let calls = 0;
    (global as any).fetch = jest.fn(async () => {
      calls++;
      if (calls < 3) return new Response('boom', { status: 500 });
      return aiResponseContent('{"pass":true,"issues":[],"confidence":0.9}');
    });
    const v = new AIValidator({
      apiKey: 'sk-test',
      baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
      cacheDir: cacheDir,
      maxRetries: 2,
      timeoutMs: 2000
    });
    const r = await v.validate(fakeRequest({ filePath: png, sha256: 'h1' }));
    expect(r.pass).toBe(true);
    expect(calls).toBe(3);
  });

  it('重试全部失败后返回最后错误', async () => {
    const png = fakePngFile();
    (global as any).fetch = jest.fn(async () => new Response('bad', { status: 500 }));
    const v = new AIValidator({
      apiKey: 'sk-test',
      baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
      cacheDir: cacheDir,
      maxRetries: 1,
      timeoutMs: 2000
    });
    const r = await v.validate(fakeRequest({ filePath: png, sha256: 'h1' }));
    expect(r.pass).toBe(false);
    expect(r.issues[0]).toMatch(/AI 请求失败/);
  });

  it('validateBatch 并发调度', async () => {
    const png = fakePngFile();
    (global as any).fetch = jest.fn(async () =>
      aiResponseContent('{"pass":true,"issues":[],"confidence":0.9}')
    );
    const v = new AIValidator({
      apiKey: 'sk-test',
      baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
      cacheDir: cacheDir,
      maxRetries: 0,
      concurrency: 2
    });
    const reqs = [
      fakeRequest({ filePath: png, sha256: 'a1' }),
      fakeRequest({ filePath: png, sha256: 'a2' }),
      fakeRequest({ filePath: png, sha256: 'a3' }),
      fakeRequest({ filePath: png, sha256: 'a4' })
    ];
    const results = await v.validateBatch(reqs);
    expect(results.length).toBe(4);
    expect(results.every(r => r.pass)).toBe(true);
  });

  it('clearCache 清空缓存目录', async () => {
    const png = fakePngFile();
    (global as any).fetch = jest.fn(async () =>
      aiResponseContent('{"pass":true,"issues":[],"confidence":0.9}')
    );
    const v = new AIValidator({
      apiKey: 'sk-test',
      baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
      cacheDir: cacheDir,
      maxRetries: 0
    });
    await v.validate(fakeRequest({ filePath: png, sha256: 'h1' }));
    expect(fs.readdirSync(cacheDir).filter(f => f.endsWith('.json')).length).toBe(1);
    await v.clearCache();
    expect(fs.readdirSync(cacheDir).filter(f => f.endsWith('.json')).length).toBe(0);
  });

  it('getConfig 返回 model / baseUrl / hasKey', () => {
    const v = new AIValidator({
      apiKey: 'sk-x',
      baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
      cacheDir: cacheDir
    });
    const c = v.getConfig();
    expect(c.provider).toBe('glm');
    expect(c.model).toBe('glm-4v');
    expect(c.hasKey).toBe(true);
  });
});
