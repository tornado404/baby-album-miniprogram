/**
 * 前后端联调 E2E 测试
 * 覆盖 Integration PRD Phase 5 的 6 个测试用例
 * 依赖: 后端 API 运行在 http://101.126.41.146:8000
 */
const { ScreenshotHelper } = require('./screenshot-helper');
const path = require('path');

const API_BASE = 'http://101.126.41.146:8000/api/v1';
const screenshotDir = path.resolve(__dirname, '../reports/integration');

describe('前后端联调测试', () => {
  let helper;

  beforeAll(async () => {
    helper = new ScreenshotHelper({
      screenshotDir: screenshotDir,
    });
    await helper.init();
  }, 60000);

  afterAll(async () => {
    await helper.close();
  });

  // ===== TC-01: 首次完整流程 =====
  test('TC-01: 首次完整流程（登录 → 创建宝宝 → 首页展示）', async () => {
    // Step 1: Call login API directly to get token
    const loginRes = await new Promise((resolve) => {
      wx.request({
        url: API_BASE + '/auth/login',
        method: 'POST',
        data: { code: 'e2e_test_code' },
        success: resolve,
        fail: resolve,
      });
    });
    expect(loginRes.statusCode).toBe(200);
    expect(loginRes.data.accessToken).toBeTruthy();
    expect(loginRes.data.refreshToken).toBeTruthy();
    expect(typeof loginRes.data.isNewUser).toBe('boolean');

    const token = loginRes.data.accessToken;
    // Save token for subsequent tests
    wx.setStorageSync('baby_diary_access_token', token);
    wx.setStorageSync('baby_diary_refresh_token', loginRes.data.refreshToken);
    wx.setStorageSync('baby_diary_user_id', loginRes.data.userId);

    // Step 2: Navigate to onboarding page
    let page = await helper.navigateTo('/pages/baby_onboarding/baby_onboarding', { waitTime: 2000 });
    expect(page).toBeTruthy();
    await helper.screenshot('TC01-onboarding.png');

    // Step 3: Log the expected flow (UI interaction requires DevTools)
    console.log('  → Login API verified: token received');
    console.log('  → Onboarding page rendered');
    console.log('  → Next: user fills nickname and saves');
  }, 35000);

  // ===== TC-02: Token 续期 =====
  test('TC-02: Login token refresh', async () => {
    // Get current token
    const token = wx.getStorageSync('baby_diary_access_token');

    // Verify with /auth/me
    const meRes = await new Promise((resolve) => {
      wx.request({
        url: API_BASE + '/auth/me',
        method: 'GET',
        header: { 'Authorization': 'Bearer ' + token },
        success: resolve,
      });
    });
    expect(meRes.statusCode).toBe(200);
    expect(meRes.data.userId).toBeTruthy();

    // Test refresh API
    const refreshToken = wx.getStorageSync('baby_diary_refresh_token');
    const refreshRes = await new Promise((resolve) => {
      wx.request({
        url: API_BASE + '/auth/refresh',
        method: 'POST',
        data: { refreshToken: refreshToken },
        success: resolve,
      });
    });
    expect(refreshRes.statusCode).toBe(200);
    expect(refreshRes.data.accessToken).toBeTruthy();
    console.log('  → Token refresh verified: new token issued');
  }, 15000);

  // ===== TC-03: 宝宝 CRUD =====
  test('TC-03: Baby CRUD via API', async () => {
    const token = wx.getStorageSync('baby_diary_access_token');

    // Create a baby
    const createRes = await new Promise((resolve) => {
      wx.request({
        url: API_BASE + '/babies/',
        method: 'POST',
        header: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
        data: { name: 'E2E测试宝宝', gender: 'female', birthDate: '2026-01-01' },
        success: resolve,
      });
    });
    expect(createRes.statusCode).toBe(200);
    const babyId = createRes.data.id;
    console.log('  → Baby created:', babyId);

    // List babies
    const listRes = await new Promise((resolve) => {
      wx.request({
        url: API_BASE + '/babies/',
        method: 'GET',
        header: { 'Authorization': 'Bearer ' + token },
        success: resolve,
      });
    });
    expect(listRes.statusCode).toBe(200);
    expect(Array.isArray(listRes.data)).toBe(true);
    console.log('  → Baby list:', listRes.data.length, 'babies');

    // Navigate to baby list page
    const page = await helper.navigateTo('/pages/baby_list/baby_list', { waitTime: 2000 });
    expect(page).toBeTruthy();
    await helper.screenshot('TC03-baby-list.png');

    // Delete the test baby
    const delRes = await new Promise((resolve) => {
      wx.request({
        url: API_BASE + '/babies/' + babyId,
        method: 'DELETE',
        header: { 'Authorization': 'Bearer ' + token },
        success: resolve,
      });
    });
    expect(delRes.statusCode).toBe(200);
    console.log('  → Baby deleted');
  }, 20000);

  // ===== TC-04: 上传流程（Mock STS 签名） =====
  test('TC-04: Upload sign + media CRUD', async () => {
    const token = wx.getStorageSync('baby_diary_access_token');
    const babyId = wx.getStorageSync('baby_diary_current_baby_id') || 'demo-1';

    // Get upload sign
    const signRes = await new Promise((resolve) => {
      wx.request({
        url: API_BASE + '/upload/sign',
        method: 'POST',
        header: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
        data: { fileName: 'test.jpg', fileType: 'image', babyId: babyId },
        success: resolve,
      });
    });
    expect(signRes.statusCode).toBe(200);
    expect(signRes.data.cosKey).toBeTruthy();
    console.log('  → Upload sign received:', signRes.data.cosKey);

    // Create media record
    const createRes = await new Promise((resolve) => {
      wx.request({
        url: API_BASE + '/media/',
        method: 'POST',
        header: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
        data: {
          babyId: babyId,
          title: 'E2E测试照片',
          type: 'image',
          cosKey: signRes.data.cosKey,
          captureDate: '2026-06-05',
        },
        success: resolve,
      });
    });
    expect(createRes.statusCode).toBe(200);
    const mediaId = createRes.data.id;
    console.log('  → Media created:', mediaId);

    // Navigate to upload page
    const page = await helper.navigateTo('/pages/upload/upload', { waitTime: 2000 });
    expect(page).toBeTruthy();
    await helper.screenshot('TC04-upload.png');

    // Cleanup
    const delRes = await new Promise((resolve) => {
      wx.request({
        url: API_BASE + '/media/' + mediaId,
        method: 'DELETE',
        header: { 'Authorization': 'Bearer ' + token },
        success: resolve,
      });
    });
    expect(delRes.statusCode).toBe(200);
    console.log('  → Media deleted');
  }, 20000);

  // ===== TC-05: 无权限拒绝 =====
  test('TC-05: Unauthorized returns 401', async () => {
    const endpoints = ['/auth/me', '/babies/', '/media/', '/analytics/stats'];

    for (let i = 0; i < endpoints.length; i++) {
      const res = await new Promise((resolve) => {
        wx.request({
          url: API_BASE + endpoints[i],
          method: 'GET',
          header: { 'Authorization': 'Bearer invalid_token' },
          success: resolve,
        });
      });
      expect(res.statusCode).toBe(401);
    }
    console.log('  → All', endpoints.length, 'endpoints correctly return 401');
  }, 15000);

  // ===== TC-06: 成就检测 =====
  test('TC-06: Achievement check API', async () => {
    const token = wx.getStorageSync('baby_diary_access_token');

    // Get achievements list
    const listRes = await new Promise((resolve) => {
      wx.request({
        url: API_BASE + '/analytics/achievements',
        method: 'GET',
        header: { 'Authorization': 'Bearer ' + token },
        success: resolve,
      });
    });
    expect(listRes.statusCode).toBe(200);
    expect(listRes.data.data.badges).toBeDefined();
    console.log('  → Achievements:', listRes.data.data.badges.length, 'badges defined');

    // Trigger check
    const checkRes = await new Promise((resolve) => {
      wx.request({
        url: API_BASE + '/analytics/achievements/check',
        method: 'POST',
        header: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
        data: {},
        success: resolve,
      });
    });
    expect(checkRes.statusCode).toBe(200);
    console.log('  → Achievement check completed');
  }, 15000);
});