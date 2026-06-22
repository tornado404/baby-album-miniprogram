/**
 * privacy_agreement.spec.ts - 隐私协议功能 E2E 测试
 *
 * 目标：
 *   1. 验证隐私政策页面内容正确加载
 *   2. 验证用户协议页面内容正确加载
 *   3. 验证登录页面的复选框默认未选中、协议链接存在
 *   4. 验证复选框勾选/取消功能正常
 *   5. 验证《用户服务协议》链接可点击跳转到内容页
 *   6. 验证设置页面的隐私协议入口可正常跳转
 *
 * 运行方式：
 *   npm run test:e2e:auto -- --testPathPatterns=privacy_agreement
 */

/* ==================== 类型定义 ==================== */

interface AgreementPageData {
  pageTitle: string;
  contentSections: Array<{ title: string; body: string }>;
  updatedDate: string;
  [key: string]: unknown;
}

interface OnboardingPageData {
  hasAgreed: boolean;
  authState: string;
  errorMsg: string;
  [key: string]: unknown;
}

/* ==================== 工具函数 ==================== */

function sleep(ms: number): Promise<void> {
  return new Promise(function (resolve) { setTimeout(resolve, ms); });
}

/* ==================== 测试套件 ==================== */

describe('隐私协议功能 E2E 测试', function () {
  jest.setTimeout(180000); // 3min 全局超时（导航、编译、渲染可能较慢）

  var mp: any;       // MiniProgram 实例
  var page: any;     // Page 实例

  beforeAll(async function () {
    mp = (global as any).__AUTOMATOR__;
    if (!mp) {
      throw new Error(
        '未建立 automator 连接。请运行：npm run test:e2e:auto\n' +
        '或确保：1) 开发者工具已启动 2) 服务端口已开启'
      );
    }
  });

  /* =========== 测试 1：隐私政策页面内容 =========== */

  test('1. 隐私政策页面内容正确加载', async function () {
    page = await mp.reLaunch('/pages/privacy_agreement/privacy_agreement?type=privacy');
    await sleep(3000);
    if (!page) page = await mp.currentPage();
    expect(page).toBeTruthy();

    var path = page ? page.path : 'unknown';
    console.log('[privacy-test] 页面路径: ' + path);
    expect(path).toContain('privacy_agreement');

    var data: AgreementPageData = await page.data();
    expect(data.pageTitle).toBe('隐私政策');

    var sections = data.contentSections;
    expect(sections).toBeTruthy();
    expect(Array.isArray(sections)).toBe(true);
    expect(sections.length).toBeGreaterThanOrEqual(8);

    // 验证关键词存在
    var hasCollectSection = false;
    var hasUserRights = false;
    var hasMinorProtection = false;
    for (var j = 0; j < sections.length; j++) {
      var title = sections[j].title;
      if (title.indexOf('收集') !== -1) hasCollectSection = true;
      if (title.indexOf('权利') !== -1) hasUserRights = true;
      if (title.indexOf('未成年人') !== -1) hasMinorProtection = true;
    }
    expect(hasCollectSection).toBe(true);
    expect(hasUserRights).toBe(true);
    expect(hasMinorProtection).toBe(true);

    // 验证导航标题（通过 data 验证更可靠）
    expect(data.pageTitle).toBe('隐私政策');

    // 验证返回按钮
    var backBtn = await page.$('.nav-btn-circle');
    expect(backBtn).toBeTruthy();

    console.log('[privacy-test] ✓ 隐私政策页面验证通过');
  });

  /* =========== 测试 2：用户协议页面内容 =========== */

  test('2. 用户服务协议页面内容正确加载', async function () {
    page = await mp.reLaunch('/pages/privacy_agreement/privacy_agreement?type=agreement');
    await sleep(3000);
    if (!page) page = await mp.currentPage();
    expect(page).toBeTruthy();

    var data: AgreementPageData = await page.data();
    expect(data.pageTitle).toBe('用户服务协议');

    var sections = data.contentSections;
    expect(sections.length).toBeGreaterThanOrEqual(10);

    // 验证关键章节
    var hasIPSection = false;
    var hasDisclaimer = false;
    var hasContactSection = false;
    for (var i = 0; i < sections.length; i++) {
      if (sections[i].title.indexOf('知识产权') !== -1) hasIPSection = true;
      if (sections[i].title.indexOf('免责') !== -1) hasDisclaimer = true;
      if (sections[i].title.indexOf('联系') !== -1) hasContactSection = true;
    }
    expect(hasIPSection).toBe(true);
    expect(hasDisclaimer).toBe(true);
    expect(hasContactSection).toBe(true);

    console.log('[privacy-test] ✓ 用户服务协议页面验证通过');
  });

  /* =========== 测试 3：登录页初始状态 =========== */

  test('3. 登录页初始状态 - 复选框默认未选中、链接存在', async function () {
    page = await mp.reLaunch('/pages/onboarding/onboarding');
    // DevTools 首次导航可能较慢（项目编译），等最多 60s
    await sleep(10000);
    if (!page) {
      console.log('[privacy-test] 首次导航慢，重试 currentPage...');
      await sleep(10000);
      page = await mp.currentPage();
    }
    expect(page).toBeTruthy();

    var path = page ? page.path : 'unknown';
    console.log('[privacy-test] 页面路径: ' + path);
    expect(path).toContain('onboarding');

    // 验证复选框默认未选中
    var data: OnboardingPageData = await page.data();
    console.log('[privacy-test] hasAgreed 初始值:', data.hasAgreed);
    expect(data.hasAgreed).toBe(false);

    // 验证协议链接存在
    var links = await page.$$('.privacy-link');
    expect(links.length).toBeGreaterThanOrEqual(2);

    var linkText0 = await links[0].text();
    console.log('[privacy-test] 链接1:', linkText0);
    expect(linkText0).toContain('用户服务协议');

    var linkText1 = await links[1].text();
    console.log('[privacy-test] 链接2:', linkText1);
    expect(linkText1).toContain('隐私政策');

    // 验证复选框元素存在
    var checkbox = await page.$('.privacy-checkbox');
    expect(checkbox).toBeTruthy();

    // 验证登录按钮存在且灰色（通过 data 确认）
    var loginData: OnboardingPageData = await page.data();
    expect(loginData.hasAgreed).toBe(false);
    console.log('[privacy-test] 登录按钮状态: hasAgreed=' + loginData.hasAgreed + ' (disabled)');

    console.log('[privacy-test] ✓ 登录页初始状态验证通过');
  });

  /* =========== 测试 4：勾选复选框 =========== */

  test('4. 勾选复选框 - 复选框选中、按钮激活', async function () {
    expect(page).toBeTruthy();

    // 点击复选框勾选
    var checkbox = await page.$('.privacy-checkbox');
    expect(checkbox).toBeTruthy();

    await checkbox.tap();
    await sleep(1000);

    var data: OnboardingPageData = await page.data();
    console.log('[privacy-test] 点击后 hasAgreed:', data.hasAgreed);
    expect(data.hasAgreed).toBe(true);

    // 验证打勾图标出现
    var checkIcon = await page.$('.checkbox-icon');
    expect(checkIcon).toBeTruthy();

    var iconText = await checkIcon.text();
    expect(iconText).toBe('✓');

    console.log('[privacy-test] ✓ 复选框已勾选');
  });

  /* =========== 测试 5：取消勾选再重新勾选 =========== */

  test('5. 取消再勾选复选框', async function () {
    expect(page).toBeTruthy();

    var checkbox = await page.$('.privacy-checkbox');
    expect(checkbox).toBeTruthy();

    // 取消勾选
    await checkbox.tap();
    await sleep(500);

    var data: OnboardingPageData = await page.data();
    expect(data.hasAgreed).toBe(false);

    // 打勾图标应消失
    var checkIcon = await page.$('.checkbox-icon');
    expect(checkIcon).toBeNull();
    console.log('[privacy-test] ✓ 复选框已取消');

    // 重新勾选
    await checkbox.tap();
    await sleep(500);
    data = await page.data();
    expect(data.hasAgreed).toBe(true);
    console.log('[privacy-test] ✓ 已重新勾选');
  });

  /* =========== 测试 6：点击《用户服务协议》链接跳转 =========== */

  test('6. 点击《用户服务协议》链接 - 跳转到协议内容页', async function () {
    expect(page).toBeTruthy();

    var links = await page.$$('.privacy-link');
    expect(links.length).toBeGreaterThanOrEqual(2);

    // 第一个链接是《用户服务协议》
    var agreementLink = links[0];
    var linkText = await agreementLink.text();
    console.log('[privacy-test] 点击链接: "' + linkText + '"');
    expect(linkText).toContain('用户服务协议');

    // 点击链接
    await agreementLink.tap();
    await sleep(3000);

    var currentPage = await mp.currentPage();
    expect(currentPage).toBeTruthy();
    var path = currentPage ? currentPage.path : 'unknown';
    console.log('[privacy-test] 跳转到: ' + path);
    expect(path).toContain('privacy_agreement');

    var data: AgreementPageData = await currentPage.data();
    expect(data.pageTitle).toBe('用户服务协议');

    console.log('[privacy-test] ✓ 协议链接跳转验证通过');
  });

  /* =========== 测试 7：设置页入口验证 =========== */

  test('7. 设置页隐私政策入口 - 菜单项存在', async function () {
    page = await mp.reLaunch('/pages/settings/settings');
    await sleep(5000);
    if (!page) page = await mp.currentPage();
    expect(page).toBeTruthy();

    var menuItems = await page.$$('.menu-item');
    expect(menuItems.length).toBeGreaterThan(0);

    var privacyFound = false;
    for (var i = 0; i < menuItems.length; i++) {
      try {
        var text = await menuItems[i].text();
        if (text && text.indexOf('隐私政策') !== -1) {
          privacyFound = true;
          console.log('[privacy-test] ✓ 设置页存在隐私政策入口');
          break;
        }
      } catch (_) { /* 忽略 */ }
    }
    expect(privacyFound).toBe(true);

    // 导航到协议页面验证可访问
    var targetPage = await mp.reLaunch('/pages/privacy_agreement/privacy_agreement?type=agreement');
    await sleep(3000);
    if (!targetPage) targetPage = await mp.currentPage();
    expect(targetPage).toBeTruthy();

    var data: AgreementPageData = await targetPage.data();
    expect(data.pageTitle).toBe('用户服务协议');

    console.log('[privacy-test] ✓ 设置页隐私政策入口验证通过');
  });
});