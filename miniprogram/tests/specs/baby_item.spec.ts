/**
 * 宝宝信息编辑页 (Baby Item) E2E 测试
 * 验证页面渲染、表单字段、保存按钮
 */

const PAGE_PATH = 'pages/baby_item/baby_item';
const TIMEOUT = 30000;

describe('宝宝信息编辑页 (Baby Item) - E2E', function () {
  var miniProgram: any;

  beforeAll(async function () {
    miniProgram = (global as any).__miniProgram__;
    expect(miniProgram).toBeDefined();
  }, TIMEOUT);

  test('应能正常跳转到宝宝信息页', async function () {
    await miniProgram.navigateTo(PAGE_PATH);
    var page = await miniProgram.currentPage();
    expect(page).toBeDefined();
    expect(page.path).toContain('baby_item');
  }, TIMEOUT);

  test('页面应包含返回按钮', async function () {
    var page = await miniProgram.currentPage();
    var backBtn = await page.callWxMethod('onBack');
    expect(backBtn).toBeDefined();
  }, TIMEOUT);

  test('页面应包含宝宝名称输入', async function () {
    var page = await miniProgram.currentPage();
    var el = await page.waitFor('.baby-name-input', 5000);
    expect(el).toBeDefined();
  }, TIMEOUT);

  test('页面应包含日期选择器', async function () {
    var page = await miniProgram.currentPage();
    var el = await page.waitFor('.birth-date-picker', 5000);
    expect(el).toBeDefined();
  }, TIMEOUT);

  test('页面应包含里程碑选择器', async function () {
    var page = await miniProgram.currentPage();
    var el = await page.waitFor('.milestone-selector', 5000);
    expect(el).toBeDefined();
  }, TIMEOUT);

  test('页面应包含保存按钮', async function () {
    var page = await miniProgram.currentPage();
    var el = await page.waitFor('.save-btn', 5000);
    expect(el).toBeDefined();
  }, TIMEOUT);

  test('页面数据应包含必需字段', async function () {
    var page = await miniProgram.currentPage();
    var data = await page.data();
    expect(data).toBeDefined();
    expect(data).toHaveProperty('babyName');
    expect(data).toHaveProperty('birthDate');
    expect(data).toHaveProperty('isSaving');
    expect(data).toHaveProperty('milestones');
    expect(data).toHaveProperty('description');
  }, TIMEOUT);
});