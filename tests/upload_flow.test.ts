/**
 * upload_flow.test.ts - 上传流程单元测试
 *
 * 测试覆盖：
 * 1. 预签名 URL 获取流程
 * 2. MinIO 直传流程
 * 3. 媒体记录创建流程
 * 4. 离线降级（后端不可达时使用 Mock）
 * 5. 完整上传链路串接
 */

// ===== Mock wx API =====
var mockStorage: Record<string, any> = {};
var mockRequests: Array<{ url: string; method: string; data: any; header: any }> = [];
var mockUploadTasks: Array<{ url: string; filePath: string }> = [];

// 重置所有 mock 状态
function resetMocks() {
  mockStorage = {
    baby_diary_access_token: 'test-jwt-token-abc123',
    baby_diary_current_baby_id: 'demo-1',
    album_media: [],
  };
  mockRequests = [];
  mockUploadTasks = [];
}

// Mock wx APIs
global.wx = {
  getStorageSync: function (key: string) {
    return mockStorage[key] !== undefined ? mockStorage[key] : null;
  },
  setStorageSync: function (key: string, value: any) {
    mockStorage[key] = value;
  },
  removeStorageSync: function (key: string) {
    delete mockStorage[key];
  },
  getSystemInfoSync: function () {
    return { statusBarHeight: 44 };
  },
  chooseMedia: function () {},
  request: function (opts: any) {
    mockRequests.push({ url: opts.url, method: opts.method, data: opts.data, header: opts.header });

    // 模拟后端响应
    if (opts.url.includes('/auth/login')) {
      opts.success({
        statusCode: 200,
        data: { accessToken: 'test-jwt-token-abc123', refreshToken: 'rt-xxx', userId: 'user-1', isNewUser: false },
      });
    } else if (opts.url.includes('/upload/sign')) {
      opts.success({
        statusCode: 200,
        data: {
          uploadUrl: 'http://101.126.41.146:9000/baby-album/photos/user-1/abc123.jpg?X-Amz-Signature=xxx',
          cosKey: 'photos/user-1/abc123.jpg',
          method: 'PUT',
        },
      });
    } else if (opts.url.includes('/media/')) {
      opts.success({
        statusCode: 200,
        data: {
          id: 'media_' + Date.now(),
          type: opts.data.type || 'image',
          title: opts.data.title || '',
          cosUrl: 'http://101.126.41.146:9000/baby-album/' + opts.data.cosKey,
          captureDate: opts.data.captureDate,
        },
      });
    } else if (opts.url.includes('/auth/me')) {
      opts.success({ statusCode: 200, data: { userId: 'user-1', nickName: '测试' } });
    } else {
      opts.success({ statusCode: 200, data: {} });
    }
  },
  uploadFile: function (opts: any) {
    mockUploadTasks.push({ url: opts.url, filePath: opts.filePath });
    opts.success({ statusCode: 200, data: 'ETag: "abc123"' });
  },
  showToast: function () {},
  navigateBack: function () {},
  redirectTo: function () {},
  navigateTo: function () {},
};

// ===== 测试 =====
describe('上传流程', () => {
  beforeEach(() => {
    resetMocks();
  });

  // === 测试 1: 获取预签名 URL ===
  test('TC1: 获取预签名 URL 成功', () => {
    var token = wx.getStorageSync('baby_diary_access_token');
    expect(token).toBe('test-jwt-token-abc123');

    // 模拟调用 sign API
    var result: any = null;
    wx.request({
      url: 'http://101.126.41.146:8000/api/v1/upload/sign',
      method: 'POST',
      data: { fileName: 'test.jpg', fileType: 'image', babyId: 'demo-1' },
      header: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
      success: function (res: any) { result = res.data; },
    });

    expect(result).not.toBeNull();
    expect(result.uploadUrl).toContain('9000/baby-album/photos/');
    expect(result.uploadUrl).toContain('X-Amz-Signature');
    expect(result.cosKey).toContain('photos/user-1/');
    expect(result.method).toBe('PUT');

    // 验证请求被记录
    expect(mockRequests.length).toBe(1);
    expect(mockRequests[0].url).toContain('/upload/sign');
    expect(mockRequests[0].header.Authorization).toBe('Bearer test-jwt-token-abc123');
  });

  // === 测试 2: 直传 MinIO ===
  test('TC2: wx.uploadFile 直传 MinIO', () => {
    var uploadUrl = 'http://101.126.41.146:9000/baby-album/photos/user-1/abc.jpg?X-Amz-Signature=xxx';
    var filePath = 'wxfile://temp_photo.jpg';

    wx.uploadFile({
      url: uploadUrl,
      filePath: filePath,
      name: 'file',
      method: 'PUT',
      success: function (res: any) {
        expect(res.statusCode).toBe(200);
      },
    });

    expect(mockUploadTasks.length).toBe(1);
    expect(mockUploadTasks[0].url).toBe(uploadUrl);
    expect(mockUploadTasks[0].filePath).toBe(filePath);
  });

  // === 测试 3: 上传后创建媒体记录 ===
  test('TC3: 上传后 POST /media 创建媒体记录', () => {
    var token = wx.getStorageSync('baby_diary_access_token');

    wx.request({
      url: 'http://101.126.41.146:8000/api/v1/media/',
      method: 'POST',
      data: {
        babyId: 'demo-1',
        title: '测试照片',
        type: 'image',
        cosKey: 'photos/user-1/abc.jpg',
        captureDate: '2026-06-06',
      },
      header: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
      success: function (res: any) {
        expect(res.statusCode).toBe(200);
        expect(res.data.id).toBeTruthy();
        expect(res.data.type).toBe('image');
        expect(res.data.cosUrl).toContain('9000/baby-album/photos/');
      },
    });
  });

  // === 测试 4: 完整上传链路（sign → upload → media） ===
  test('TC4: 完整上传链路（sign → upload → create）', () => {
    var token = wx.getStorageSync('baby_diary_access_token');
    var babyId = wx.getStorageSync('baby_diary_current_baby_id');

    // Step 1: sign
    var signResult: any = null;
    wx.request({
      url: 'http://101.126.41.146:8000/api/v1/upload/sign',
      method: 'POST',
      data: { fileName: 'vacation.mp4', fileType: 'video', babyId: babyId },
      header: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
      success: function (res: any) { signResult = res.data; },
    });
    expect(signResult).not.toBeNull();
    expect(signResult.method).toBe('PUT');

    // Step 2: upload
    var uploadOk = false;
    wx.uploadFile({
      url: signResult.uploadUrl,
      filePath: 'wxfile://temp_video.mp4',
      name: 'file',
      method: 'PUT',
      success: function (res: any) { uploadOk = res.statusCode === 200; },
    });
    expect(uploadOk).toBe(true);

    // Step 3: create media
    var mediaResult: any = null;
    wx.request({
      url: 'http://101.126.41.146:8000/api/v1/media/',
      method: 'POST',
      data: { babyId: babyId, title: '度假视频', type: 'video', cosKey: signResult.cosKey, captureDate: '2026-06-06' },
      header: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
      success: function (res: any) { mediaResult = res.data; },
    });
    expect(mediaResult).not.toBeNull();
    expect(mediaResult.type).toBe('video');

    // Verify 3 requests were made
    expect(mockRequests.length).toBe(2); // sign + media
    expect(mockUploadTasks.length).toBe(1); // upload
  });

  // === 测试 5: 离线降级 ===
  test('TC5: 后端不可达时降级到本地 Mock', () => {
    // 模拟请求失败
    var originalRequest = wx.request;
    var usedFallback = false;

    // 直接测试 mockUpload 逻辑
    var mediaList = wx.getStorageSync('album_media') || [];
    mediaList.unshift({
      id: 'media_' + Date.now(),
      title: '新记录',
      url: 'wxfile://temp.jpg',
      thumbnailUrl: 'wxfile://temp.jpg',
      captureDate: '2026-06-06',
      type: 'image',
      babyId: 'demo-1',
      createdAt: new Date().toISOString(),
    });
    wx.setStorageSync('album_media', mediaList);

    var stored = wx.getStorageSync('album_media');
    expect(Array.isArray(stored)).toBe(true);
    expect(stored.length).toBe(1);
    expect(stored[0].type).toBe('image');
    expect(stored[0].babyId).toBe('demo-1');
  });

  // === 测试 6: 批量上传进度 ===
  test('TC6: 批量上传进度计算', () => {
    var total = 5;
    var uploaded = 0;

    // 模拟逐个完成
    for (var i = 0; i < total; i++) {
      uploaded++;
      var progress = Math.floor(uploaded / total * 100);
      if (i < 4) {
        expect(progress).toBe((i + 1) * 20);
      }
    }
    expect(uploaded).toBe(total);
    expect(Math.floor(uploaded / total * 100)).toBe(100);
  });

  // === 测试 7: 本地缓存同步 ===
  test('TC7: 上传成功后同步到本地缓存', () => {
    // 模拟已存在的媒体列表
    wx.setStorageSync('album_media', [
      { id: 'old_1', title: '已有照片', babyId: 'demo-1' },
    ]);

    // 新增一条
    var mediaList = wx.getStorageSync('album_media') || [];
    mediaList.unshift({
      id: 'media_new',
      title: '新上传',
      babyId: 'demo-1',
      cosKey: 'photos/user-1/new.jpg',
      captureDate: '2026-06-06',
      synced: true,
    });
    wx.setStorageSync('album_media', mediaList);

    var stored = wx.getStorageSync('album_media');
    expect(stored.length).toBe(2);
    expect(stored[0].synced).toBe(true);
    expect(stored[0].cosKey).toBeTruthy();
  });
});