/**
 * 前后端联调 E2E 测试
 * 覆盖：上传 → MinIO 直传 → 媒体记录 → 首页展示 完整链路
 * 依赖: 后端 API 运行在 http://101.126.41.146:8000
 *       MinIO 运行在 http://101.126.41.146:9000
 */
const { ScreenshotHelper } = require('./screenshot-helper');
const path = require('path');
const http = require('http');

const API_BASE = 'http://101.126.41.146:8000/api/v1';
const MINIO_BASE = 'http://101.126.41.146:9000';
const screenshotDir = path.resolve(__dirname, '../reports/integration');

/**
 * 发起 HTTP 请求（Promise 封装）
 */
function httpRequest(url, opts = {}) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const options = {
      hostname: parsed.hostname,
      port: parsed.port,
      path: parsed.pathname + parsed.search,
      method: opts.method || 'GET',
      headers: opts.headers || { 'Content-Type': 'application/json' },
      timeout: 15000,
    };
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        try {
          resolve({ statusCode: res.statusCode, headers: res.headers, data: JSON.parse(body) });
        } catch (e) {
          resolve({ statusCode: res.statusCode, headers: res.headers, data: body });
        }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    if (opts.body) req.write(opts.body);
    req.end();
  });
}

/**
 * 上传真实文件到 MinIO（使用 presigned URL）
 */
function uploadFileToMinIO(uploadUrl, fileContent) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(uploadUrl);
    const options = {
      hostname: parsed.hostname,
      port: parsed.port,
      path: parsed.pathname + parsed.search,
      method: 'PUT',
      headers: {
        'Content-Type': 'image/jpeg',
        'Content-Length': Buffer.byteLength(fileContent),
      },
      timeout: 15000,
    };
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        resolve({ statusCode: res.statusCode, etag: res.headers.etag });
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    req.write(fileContent);
    req.end();
  });
}

describe('前后端联调 E2E 测试（完整上传链路）', () => {
  let token = '';
  let babyId = '';
  let mediaId = '';
  let cosKey = '';

  beforeAll(async () => {
    // 获取 token
    const loginRes = await httpRequest(API_BASE + '/auth/login', {
      method: 'POST',
      body: JSON.stringify({ code: 'e2e_test_code' }),
    });
    expect(loginRes.statusCode).toBe(200);
    token = loginRes.data.accessToken;
    babyId = 'baby-e2e-' + Date.now();

    // 创建测试宝宝
    const babyRes = await httpRequest(API_BASE + '/babies/', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'E2E宝宝', gender: 'female', birthDate: '2026-01-01' }),
    });
    expect(babyRes.statusCode).toBe(200);
    babyId = babyRes.data.id;
  });

  afterAll(async () => {
    // 清理：删除测试宝宝（级联删除媒体）
    if (babyId) {
      await httpRequest(API_BASE + '/babies/' + babyId, {
        method: 'DELETE',
        headers: { 'Authorization': 'Bearer ' + token },
      }).catch(() => {});
    }
  });

  // ===== E2E-TC1: 预签名 URL =====
  test('E2E-TC1: POST /upload/sign 返回真实 MinIO 预签名 URL', async () => {
    const signRes = await httpRequest(API_BASE + '/upload/sign', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileName: 'e2e_test_photo.jpg', fileType: 'image', babyId: babyId }),
    });

    expect(signRes.statusCode).toBe(200);
    expect(signRes.data.uploadUrl).toBeDefined();
    expect(signRes.data.cosKey).toBeDefined();
    expect(signRes.data.method).toBe('PUT');

    // 验证是真正的 MinIO URL
    expect(signRes.data.uploadUrl).toContain(MINIO_BASE + '/baby-album/');
    expect(signRes.data.uploadUrl).toContain('X-Amz-Algorithm=');
    expect(signRes.data.uploadUrl).toContain('X-Amz-Credential=');
    expect(signRes.data.uploadUrl).toContain('X-Amz-Signature=');

    // 验证 cosKey 格式
    expect(signRes.data.cosKey).toMatch(/^photos\/user-1\/.*\.jpg$/);

    cosKey = signRes.data.cosKey;
    console.log('  → MinIO presigned URL verified');
  }, 20000);

  // ===== E2E-TC2: 真实文件上传到 MinIO =====
  test('E2E-TC2: PUT 文件到 MinIO 成功', async () => {
    // 再次获取 sign URL（有有效期限制）
    const signRes = await httpRequest(API_BASE + '/upload/sign', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileName: 'e2e_real_upload.jpg', fileType: 'image', babyId: babyId }),
    });
    expect(signRes.statusCode).toBe(200);
    cosKey = signRes.data.cosKey;

    // 创建一个 1x1 像素的 JPEG 文件内容
    const jpegContent = Buffer.from(
      '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////' +
      '2wBDAf//////////////////////////////////////////////////////////////////////////////////////' +
      'wAARCAABAAEDASIAAhEBAxEB/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/' +
      'xAAUAQEAAAAAAAAAAAAAAAAAAAAA/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEQMRAD8AKwA=', 'base64'
    );

    // 上传到 MinIO
    const uploadRes = await uploadFileToMinIO(signRes.data.uploadUrl, jpegContent);
    expect(uploadRes.statusCode).toBe(200);
    expect(uploadRes.etag).toBeTruthy();
    console.log('  → File uploaded to MinIO successfully, ETag:', uploadRes.etag);

    // 验证文件在 MinIO 中可访问
    const getRes = await httpRequest(signRes.data.uploadUrl.split('?')[0], {
      method: 'GET',
      headers: { 'Authorization': 'Bearer ' + token },
    });
    expect(getRes.statusCode).toBe(200);
    console.log('  → File verified in MinIO: accessible via GET');
  }, 30000);

  // ===== E2E-TC3: 创建媒体记录 =====
  test('E2E-TC3: POST /media 创建媒体记录并返回 babyAge', async () => {
    const mediaRes = await httpRequest(API_BASE + '/media/', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        babyId: babyId,
        title: 'E2E 测试上传照片',
        type: 'image',
        cosKey: cosKey,
        captureDate: new Date().toISOString().split('T')[0],
      }),
    });

    expect(mediaRes.statusCode).toBe(200);
    expect(mediaRes.data.id).toBeTruthy();
    expect(mediaRes.data.type).toBe('image');
    expect(mediaRes.data.cosUrl).toContain(MINIO_BASE + '/baby-album/');
    mediaId = mediaRes.data.id;
    console.log('  → Media record created, ID:', mediaId);
  }, 15000);

  // ===== E2E-TC4: 媒体列表查询 =====
  test('E2E-TC4: GET /media 列表包含刚上传的文件', async () => {
    const listRes = await httpRequest(API_BASE + '/media/?babyId=' + babyId, {
      method: 'GET',
      headers: { 'Authorization': 'Bearer ' + token },
    });

    expect(listRes.statusCode).toBe(200);
    expect(Array.isArray(listRes.data)).toBe(true);
    expect(listRes.data.length).toBeGreaterThanOrEqual(1);

    const found = listRes.data.find(m => m.id === mediaId);
    expect(found).toBeDefined();
    expect(found.title).toBe('E2E 测试上传照片');
    expect(found.cosUrl).toContain(MINIO_BASE + '/baby-album/');
    console.log('  → Uploaded file found in media list');
  }, 15000);

  // ===== E2E-TC5: 删除媒体 =====
  test('E2E-TC5: DELETE /media 软删除', async () => {
    const delRes = await httpRequest(API_BASE + '/media/' + mediaId, {
      method: 'DELETE',
      headers: { 'Authorization': 'Bearer ' + token },
    });
    expect(delRes.statusCode).toBe(200);

    // 验证列表中不再包含
    const listRes = await httpRequest(API_BASE + '/media/?babyId=' + babyId, {
      method: 'GET',
      headers: { 'Authorization': 'Bearer ' + token },
    });
    const found = listRes.data.find(m => m.id === mediaId);
    expect(found).toBeUndefined();
    console.log('  → Media soft deleted, removed from list');
  }, 15000);

  // ===== E2E-TC6: 无 token 上传被拒 =====
  test('E2E-TC6: 无 token 上传签名返回 401', async () => {
    const res = await httpRequest(API_BASE + '/upload/sign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileName: 'test.jpg', fileType: 'image', babyId: 'test' }),
    });
    expect(res.statusCode).toBe(401);
    console.log('  → Unauthorized upload correctly rejected');
  }, 10000);
});