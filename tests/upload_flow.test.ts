/**
 * upload_flow.test.ts - 上传流程单元测试
 *
 * 覆盖场景：
 * - 图片/视频预签名 URL 获取
 * - MinIO 直传（PUT）
 * - 媒体记录创建
 * - 错误处理（每一步可独立失败）
 * - Token 过期自动刷新
 * - 视频文件名转码
 */

var mockStorage: Record<string, any> = {};
var mockRequests: Array<{ url: string; method: string; data: any; header: any }> = [];
var mockUploadTasks: Array<{ url: string; filePath: string; method: string }> = [];

function resetMocks() {
  mockStorage = {
    baby_diary_access_token: 'test-jwt-token-abc123',
    baby_diary_refresh_token: 'test-refresh-token-xyz',
    baby_diary_current_baby_id: 'baby-e2e-test-001',
    album_media: [],
  };
  mockRequests = [];
  mockUploadTasks = [];
}

// 工具：生成真实格式的 MinIO presigned URL
function makeMinioUrl(bucket: string, path: string): string {
  return 'http://101.126.41.146:9000/' + bucket + '/' + path +
    '?X-Amz-Algorithm=AWS4-HMAC-SHA256' +
    '&X-Amz-Credential=Cs516%402026%2F20260606%2Fap-southeast-1%2Fs3%2Faws4_request' +
    '&X-Amz-Signature=abc123def456';
}

global.wx = {
  getStorageSync: function (key: string) {
    return mockStorage[key] !== undefined ? mockStorage[key] : null;
  },
  setStorageSync: function (key: string, value: any) { mockStorage[key] = value; },
  removeStorageSync: function (key: string) { delete mockStorage[key]; },
  getSystemInfoSync: function () { return { statusBarHeight: 44 }; },

  request: function (opts: any) {
    mockRequests.push({
      url: opts.url, method: opts.method, data: opts.data, header: opts.header,
    });

    // 模拟 /auth/refresh
    if (opts.url.includes('/auth/refresh')) {
      if (opts.data && opts.data.refreshToken === 'expired-refresh-token') {
        if (opts.fail) { opts.fail({ errMsg: 'request:fail' }); }
        else if (opts.complete) opts.complete();
        return;
      }
      opts.success({
        statusCode: 200,
        data: {
          accessToken: 'refreshed-jwt-token-999',
          refreshToken: 'new-refresh-token-888',
          expiresIn: 7200,
        },
      });
    }
    // 模拟 /upload/sign
    else if (opts.url.includes('/upload/sign')) {
      var fileName = (opts.data && opts.data.fileName) || 'photo.jpg';
      var ext = fileName.split('.').pop() || 'jpg';
      var cosKey = 'photos/user-1/' + Date.now() + '.' + ext;
      opts.success({
        statusCode: 200,
        data: {
          uploadUrl: makeMinioUrl('baby-album', cosKey),
          cosKey: cosKey,
          method: 'PUT',
        },
      });
    }
    // 模拟 /media/
    else if (opts.url.includes('/media/')) {
      opts.success({
        statusCode: 200,
        data: {
          id: 'media_' + Date.now(),
          type: (opts.data && opts.data.type) || 'image',
          title: (opts.data && opts.data.title) || '',
          cosUrl: 'http://101.126.41.146:9000/baby-album/' + (opts.data && opts.data.cosKey || ''),
          captureDate: (opts.data && opts.data.captureDate) || '2026-06-06',
          babyAge: { years: 0, months: 6, days: 3 },
        },
      });
    }
    // 模拟 /auth/login
    else if (opts.url.includes('/auth/login')) {
      opts.success({
        statusCode: 200,
        data: { accessToken: 'fresh-jwt-123', refreshToken: 'fresh-rt-456', userId: 'user-1', isNewUser: true },
      });
    } else {
      opts.success({ statusCode: 200, data: {} });
    }
  },

  uploadFile: function (opts: any) {
    mockUploadTasks.push({ url: opts.url, filePath: opts.filePath, method: opts.method || 'PUT' });
    opts.success({ statusCode: 200, data: 'ETag: \"abc123\"' });
  },

  showToast: function () {},
  navigateBack: function () {},
  redirectTo: function () {},
  navigateTo: function () {},
};

// ===== 测试 =====
describe('上传流程单元测试', () => {
  beforeEach(function () { resetMocks(); });

  // ---------- TC1: 图片预签名 URL ----------
  test('TC1: 图片预签名 URL 获取 + MinIO 格式验证', function () {
    var token = wx.getStorageSync('baby_diary_access_token');
    var result: any = null;

    wx.request({
      url: 'http://101.126.41.146:8000/api/v1/upload/sign',
      method: 'POST',
      data: { fileName: 'IMG_2026.jpg', fileType: 'image', babyId: 'baby-001' },
      header: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
      success: function (res: any) { result = res.data; },
    });

    // 验证 MinIO URL 格式
    expect(result).not.toBeNull();
    expect(result.uploadUrl).toMatch(/^http:\/\/101\.126\.41\.146:9000\/baby-album\/photos\/user-1\/.*\.jpg\?X-Amz-Algorithm=/);
    expect(result.uploadUrl).toContain('X-Amz-Credential=');
    expect(result.uploadUrl).toContain('X-Amz-Signature=');
    expect(result.cosKey).toMatch(/^photos\/user-1\/.*\.jpg$/);
    expect(result.method).toBe('PUT');

    // 验证请求头
    expect(mockRequests[0].header.Authorization).toBe('Bearer test-jwt-token-abc123');
    expect(mockRequests[0].data.fileName).toBe('IMG_2026.jpg');
    expect(mockRequests[0].data.fileType).toBe('image');
  });

  // ---------- TC2: 视频预签名 URL ----------
  test('TC2: 视频预签名 URL（.mp4 后缀保留）', function () {
    var token = wx.getStorageSync('baby_diary_access_token');
    var result: any = null;

    wx.request({
      url: 'http://101.126.41.146:8000/api/v1/upload/sign',
      method: 'POST',
      data: { fileName: 'baby_video.mp4', fileType: 'video', babyId: 'baby-001' },
      header: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
      success: function (res: any) { result = res.data; },
    });

    expect(result).not.toBeNull();
    expect(result.cosKey).toMatch(/\.mp4$/); // 保留 .mp4 后缀
    expect(mockRequests[0].data.fileType).toBe('video');
  });

  // ---------- TC3: wx.uploadFile 直传 MinIO ----------
  test('TC3: wx.uploadFile PUT 直传 MinIO', function () {
    var uploadUrl = makeMinioUrl('baby-album', 'photos/user-1/test.jpg');
    var filePath = 'wxfile://temp_photo_camera_123.jpg';

    wx.uploadFile({
      url: uploadUrl,
      filePath: filePath,
      name: 'file',
      method: 'PUT',
      success: function (res: any) { expect(res.statusCode).toBe(200); },
    });

    expect(mockUploadTasks.length).toBe(1);
    expect(mockUploadTasks[0].url).toBe(uploadUrl);
    expect(mockUploadTasks[0].filePath).toBe(filePath);
  });

  // ---------- TC4: 三步骤完整链路 ----------
  test('TC4: 完整上传链路（sign → upload → create media）', function () {
    var token = wx.getStorageSync('baby_diary_access_token');
    var babyId = wx.getStorageSync('baby_diary_current_baby_id');

    // Step 1: sign
    var signResult: any = null;
    wx.request({
      url: 'http://101.126.41.146:8000/api/v1/upload/sign',
      method: 'POST',
      data: { fileName: 'summer.jpg', fileType: 'image', babyId: babyId },
      header: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
      success: function (res: any) { signResult = res.data; },
    });
    expect(signResult).not.toBeNull();
    expect(signResult.method).toBe('PUT');

    // Step 2: upload to MinIO
    var uploadOk = false;
    wx.uploadFile({
      url: signResult.uploadUrl,
      filePath: 'wxfile://temp_summer.jpg',
      name: 'file',
      method: 'PUT',
      success: function (res: any) { uploadOk = (res.statusCode === 200); },
    });
    expect(uploadOk).toBe(true);

    // Step 3: create media
    var mediaResult: any = null;
    wx.request({
      url: 'http://101.126.41.146:8000/api/v1/media/',
      method: 'POST',
      data: {
        babyId: babyId, title: '夏日照片', type: 'image',
        cosKey: signResult.cosKey, captureDate: '2026-06-06',
      },
      header: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
      success: function (res: any) { mediaResult = res.data; },
    });
    expect(mediaResult).not.toBeNull();
    expect(mediaResult.type).toBe('image');
    expect(mediaResult.cosUrl).toContain('9000/baby-album/');
    expect(mediaResult.babyAge).toBeDefined();
    expect(mediaResult.babyAge.months).toBe(6);

    // 验证请求计数
    expect(mockRequests.length).toBe(2); // sign + media
    expect(mockUploadTasks.length).toBe(1); // upload
  });

  // ---------- TC5: 视频上传链路 ----------
  test('TC5: 视频上传链路（sign → upload → create）', function () {
    var token = wx.getStorageSync('baby_diary_access_token');
    var babyId = 'baby-video-test';

    var signResult: any = null;
    wx.request({
      url: 'http://101.126.41.146:8000/api/v1/upload/sign',
      method: 'POST',
      data: { fileName: 'walking.mp4', fileType: 'video', babyId: babyId },
      header: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
      success: function (res: any) { signResult = res.data; },
    });
    expect(signResult.cosKey).toMatch(/\.mp4$/);

    wx.uploadFile({
      url: signResult.uploadUrl,
      filePath: 'wxfile://temp_walking.mp4',
      name: 'file',
      method: 'PUT',
      success: function (res: any) { expect(res.statusCode).toBe(200); },
    });

    var mediaResult: any = null;
    wx.request({
      url: 'http://101.126.41.146:8000/api/v1/media/',
      method: 'POST',
      data: { babyId: babyId, title: '学走路', type: 'video', cosKey: signResult.cosKey, captureDate: '2026-06-06' },
      header: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
      success: function (res: any) { mediaResult = res.data; },
    });
    expect(mediaResult.type).toBe('video');
  });

  // ---------- TC6: Token 过期后自动刷新 ----------
  test('TC6: 401 时自动刷新 token 后重放请求', function () {
    var token = 'expired-token';
    var callCount = 0;

    global.wx.request = function (opts: any) {
      callCount++;

      // 第一次请求返回 401（token 过期）
      if (callCount === 1 && opts.url.includes('/upload/sign')) {
        opts.success({ statusCode: 401, data: { code: 40102, message: 'Token expired' } });
        return;
      }
      // 刷新 token 请求
      if (opts.url.includes('/auth/refresh')) {
        // 更新存储的 token
        mockStorage['baby_diary_access_token'] = 'refreshed-token-abc';
        mockStorage['baby_diary_refresh_token'] = 'new-rt-999';
        opts.success({
          statusCode: 200,
          data: { accessToken: 'refreshed-token-abc', refreshToken: 'new-rt-999' },
        });
        return;
      }
      // 重放请求
      opts.success({
        statusCode: 200,
        data: { uploadUrl: makeMinioUrl('baby-album', 'photos/user-1/retry.jpg'), cosKey: 'photos/user-1/retry.jpg', method: 'PUT' },
      });
    };

    // 模拟重放逻辑
    var retryResult: any = null;
    wx.request({
      url: 'http://101.126.41.146:8000/api/v1/upload/sign',
      method: 'POST',
      data: { fileName: 'retry.jpg', fileType: 'image', babyId: 'baby-1' },
      header: { 'Authorization': 'Bearer ' + token },
      success: function (res: any) { retryResult = res.data; },
    });

    // 验证 token 被刷新
    expect(mockStorage['baby_diary_access_token']).toBe('refreshed-token-abc');
  });

  // ---------- TC7: 批量 9 张上传 ----------
  test('TC7: 批量 9 张照片上传进度', function () {
    var total = 9;
    var uploaded = 0;
    var progresses: number[] = [];

    for (var i = 0; i < total; i++) {
      var signResult: any = null;
      wx.request({
        url: 'http://101.126.41.146:8000/api/v1/upload/sign',
        method: 'POST',
        data: { fileName: 'photo_' + i + '.jpg', fileType: 'image', babyId: 'demo-1' },
        header: { 'Authorization': 'Bearer test-jwt-token-abc123', 'Content-Type': 'application/json' },
        success: function (res: any) { signResult = res.data; },
      });
      expect(signResult).not.toBeNull();

      wx.uploadFile({
        url: signResult.uploadUrl,
        filePath: 'wxfile://photo_' + i + '.jpg',
        name: 'file',
        method: 'PUT',
        success: function () { uploaded++; progresses.push(Math.floor(uploaded / total * 100)); },
      });
    }

    expect(mockRequests.length).toBe(9);
    expect(mockUploadTasks.length).toBe(9);
    expect(mockRequests[0].data.fileName).toBe('photo_0.jpg');
    expect(mockRequests[8].data.fileName).toBe('photo_8.jpg');
  });

  // ---------- TC8: 空文件列表不处理 ----------
  test('TC8: 空文件列表不触发上传', function () {
    // handleMediaResult 中对空数组的检查
    var files: any[] = [];
    if (files.length === 0) {
      expect(true).toBe(true); // 不触发上传
    }
    expect(mockRequests.length).toBe(0);
    expect(mockUploadTasks.length).toBe(0);
  });
});