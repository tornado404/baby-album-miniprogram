/**
 * AI 验证模块单元测试
 *
 * 覆盖：
 *  - buildPrompt  格式构造
 *  - detectProvider  baseUrl 启发式
 *  - extractJson    各种 JSON 边界
 *  - AiValidator    重试、超时、缺失 Key
 *
 * 这些测试在 unit Jest project 中运行（不依赖真实 API Key / 网络）。
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  AiValidator,
  buildPrompt,
  detectProvider,
  extractJson
} from './ai-validator';

describe('ai-validator: 工具函数', () => {
  describe('buildPrompt', () => {
    it('应包含期望 UI 描述与 JSON 格式要求', () => {
      const p = buildPrompt('页面标题为 X');
      expect(p).toContain('页面标题为 X');
      expect(p).toContain('UI 测试工程师');
      expect(p).toContain('"pass"');
      expect(p).toContain('"issues"');
      expect(p).toContain('"confidence"');
    });
  });

  describe('detectProvider', () => {
    it('baseUrl 含 bigmodel 时返回 glm', () => {
      expect(detectProvider('sk-x', 'https://open.bigmodel.cn/api/paas/v4')).toBe(
        'glm'
      );
    });

    it('baseUrl 含 deepseek 时返回 deepseek', () => {
      expect(
        detectProvider('sk-x', 'https://api.deepseek.com/v1')
      ).toBe('deepseek');
    });

    it('baseUrl 不明时默认 glm', () => {
      expect(detectProvider('sk-x', 'https://example.com/v1')).toBe('glm');
    });
  });

  describe('extractJson', () => {
    it('解析纯 JSON', () => {
      const r = extractJson('{"pass":true,"issues":[],"confidence":0.9}');
      expect(r.pass).toBe(true);
      expect(r.issues).toEqual([]);
      expect(r.confidence).toBe(0.9);
    });

    it('解析 ```json``` 包裹的 JSON', () => {
      const r = extractJson('```json\n{"pass":false,"issues":["x"],"confidence":0.1}\n```');
      expect(r.pass).toBe(false);
      expect(r.issues).toEqual(['x']);
    });

    it('从包含前后文字的响应中提取 JSON', () => {
      const r = extractJson('好的，结果如下：{"pass":true,"issues":[],"confidence":0.7} 完');
      expect(r.pass).toBe(true);
      expect(r.confidence).toBe(0.7);
    });

    it('非法 JSON 时返回 pass=false 与错误信息', () => {
      const r = extractJson('not json at all');
      expect(r.pass).toBe(false);
      expect(r.issues.length).toBe(1);
      expect(r.issues[0]).toMatch(/无法解析/);
    });

    it('缺失字段时 issues 默认空数组，confidence 默认 0.5', () => {
      const r = extractJson('{"pass":true}');
      expect(r.pass).toBe(true);
      expect(r.issues).toEqual([]);
      expect(r.confidence).toBe(0.5);
    });

    it('confidence 限制在 0-1', () => {
      const r1 = extractJson('{"pass":true,"issues":[],"confidence":2.5}');
      expect(r1.confidence).toBe(1);
      const r2 = extractJson('{"pass":true,"issues":[],"confidence":-0.3}');
      expect(r2.confidence).toBe(0);
    });

    it('issues 非数组时降级为空数组', () => {
      const r = extractJson('{"pass":true,"issues":"oops","confidence":0.5}');
      expect(r.issues).toEqual([]);
    });

    it('保留 raw 原始文本', () => {
      const r = extractJson('{"pass":true,"issues":[],"confidence":0.5}');
      expect(r.raw).toBe('{"pass":true,"issues":[],"confidence":0.5}');
    });
  });
});

describe('ai-validator: AiValidator 行为', () => {
  const origFetch = (global as any).fetch;
  const origApiKey = process.env.AI_API_KEY;

  afterEach(() => {
    (global as any).fetch = origFetch;
    if (origApiKey === undefined) {
      delete process.env.AI_API_KEY;
    } else {
      process.env.AI_API_KEY = origApiKey;
    }
    jest.restoreAllMocks();
  });

  it('未配置 API Key 时直接返回 pass=false', async () => {
    delete process.env.AI_API_KEY;
    const v = new AiValidator({ apiKey: '' });
    const r = await v.validate('/tmp/nonexistent.png', 'x');
    expect(r.pass).toBe(false);
    expect(r.issues[0]).toMatch(/AI_API_KEY/);
  });

  it('截图不存在时返回 pass=false 且包含路径', async () => {
    const v = new AiValidator({ apiKey: 'sk-test' });
    const r = await v.validate('/tmp/definitely-not-exist.png', 'x');
    expect(r.pass).toBe(false);
    expect(r.issues[0]).toMatch(/不存在/);
  });

  it('网络成功时返回解析后的 AiResult', async () => {
    const tmp = makeFakePng();
    try {
      (global as any).fetch = jest.fn(async () =>
        okResponse(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: '{"pass":true,"issues":[],"confidence":0.88}'
                }
              }
            ]
          })
        )
      );
      const v = new AiValidator({
        apiKey: 'sk-test',
        baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
        retries: 0,
        timeoutMs: 5000
      });
      const r = await v.validate(tmp, '标题为 X');
      expect(r.pass).toBe(true);
      expect(r.confidence).toBe(0.88);
      // 验证请求
      const fetchMock = (global as any).fetch as jest.Mock;
      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toContain('chat/completions');
      const body = JSON.parse(init.body);
      expect(body.model).toBe('glm-4v');
      expect(body.messages[0].content[0].text).toContain('标题为 X');
      // 图片以 base64 data URL 形式传入
      expect(body.messages[0].content[1].image_url.url).toMatch(/^data:image\/png;base64,/);
    } finally {
      fs.unlinkSync(tmp);
    }
  });

  it('失败时按 retries 次数重试', async () => {
    const tmp = makeFakePng();
    try {
      let calls = 0;
      (global as any).fetch = jest.fn(async () => {
        calls++;
        if (calls < 3) {
          return new Response('boom', { status: 500 });
        }
        return okResponse(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: '{"pass":true,"issues":[],"confidence":0.9}'
                }
              }
            ]
          })
        );
      });
      const v = new AiValidator({
        apiKey: 'sk-test',
        baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
        retries: 2,
        timeoutMs: 2000
      });
      const r = await v.validate(tmp, 'x');
      expect(r.pass).toBe(true);
      expect(calls).toBe(3);
    } finally {
      fs.unlinkSync(tmp);
    }
  });

  it('重试全部失败后返回最后错误', async () => {
    const tmp = makeFakePng();
    try {
      (global as any).fetch = jest.fn(async () =>
        new Response('bad', { status: 500 })
      );
      const v = new AiValidator({
        apiKey: 'sk-test',
        baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
        retries: 1,
        timeoutMs: 2000
      });
      const r = await v.validate(tmp, 'x');
      expect(r.pass).toBe(false);
      expect(r.issues[0]).toMatch(/AI 请求失败/);
    } finally {
      fs.unlinkSync(tmp);
    }
  });

  it('空响应（无 content 字段）视为失败', async () => {
    const tmp = makeFakePng();
    try {
      (global as any).fetch = jest.fn(async () => okResponse(JSON.stringify({ choices: [] })));
      const v = new AiValidator({
        apiKey: 'sk-test',
        baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
        retries: 0,
        timeoutMs: 2000
      });
      const r = await v.validate(tmp, 'x');
      expect(r.pass).toBe(false);
    } finally {
      fs.unlinkSync(tmp);
    }
  });

  it('getConfig 返回 provider / model / baseUrl / hasKey', () => {
    const v = new AiValidator({
      apiKey: 'sk-x',
      baseUrl: 'https://open.bigmodel.cn/api/paas/v4'
    });
    const c = v.getConfig();
    expect(c.provider).toBe('glm');
    expect(c.model).toBe('glm-4v');
    expect(c.hasKey).toBe(true);
  });
});

/* ==================== helpers ==================== */

function makeFakePng(): string {
  // 最小合法 PNG (1x1 transparent) 的 base64
  const pngBase64 =
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-'));
  const p = path.join(dir, 'fake.png');
  fs.writeFileSync(p, Buffer.from(pngBase64, 'base64'));
  return p;
}

function okResponse(body: string): Response {
  return new Response(body, {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
}
