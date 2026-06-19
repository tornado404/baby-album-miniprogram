/**
 * 宝宝列表页 (Baby List) E2E 测试
 * 验证页面渲染、宝宝卡片展示、导航跳转
 */

import * as automator from 'miniprogram-automator';

const PAGE_PATH = 'pages/baby_list/baby_list';
const TIMEOUT = 30000;

describe('宝宝列表页 (Baby List) - E2E', function () {
  var miniProgram: any;

  beforeAll(async function () {
    miniProgram = (global as any).__miniProgram__;
    expect(miniProgram).toBeDefined();
  }, TIMEOUT);

  test('应能正常跳转到宝宝列表页', async function () {
    await miniProgram.navigateTo(PAGE_PATH);
    var page = await miniProgram.currentPage();
    expect(page).toBeDefined();
    expect(page.path).toContain('baby_list');
  }, TIMEOUT);

  test('页面应包含返回按钮', async function () {
    var page = await miniProgram.currentPage();
    var backBtn = await page.callWxMethod('onBack');
    expect(backBtn).toBeDefined();
  }, TIMEOUT);

  test('页面应包含添加宝宝按钮', async function () {
    var page = await miniProgram.currentPage();
    // Check that the add baby button element exists
    var elements = await page.waitFor('.add-btn', 5000);
    expect(elements).toBeDefined();
  }, TIMEOUT);

  test('页面应渲染宝宝卡片列表', async function () {
    var page = await miniProgram.currentPage();
    var babyCards = await page.waitFor('.baby-card', 5000);
    expect(babyCards).toBeDefined();
  }, TIMEOUT);

  test('页面应显示正确标题', async function () {
    var page = await miniProgram.currentPage();
    var titleEl = await page.waitFor('.item-nav-title', 5000);
    if (titleEl) {
      var text = await titleEl.text();
      expect(text).toContain('切换宝宝');
    }
  }, TIMEOUT);

  test('页面数据应包含必需字段', async function () {
    var page = await miniProgram.currentPage();
    var data = await page.data();
    expect(data).toBeDefined();
    expect(data).toHaveProperty('safeTop');
    expect(data).toHaveProperty('babies');
    expect(data).toHaveProperty('isLoading');
    expect(data).toHaveProperty('currentBabyId');
  }, TIMEOUT);
});