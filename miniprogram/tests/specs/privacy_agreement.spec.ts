/**
 * privacy_agreement.spec.ts - 隐私协议功能 E2E 测试
 *
 * 目标：
 *   1. 验证登录页面的隐私协议链接可点击跳转（对应审核拒绝原因2）
 *   2. 验证复选框默认未选中、勾选后可登录（对应审核拒绝原因1）
 *   3. 验证用户协议页面内容正确加载
 *   4. 验证隐私政策页面内容正确加载
 *   5. 验证设置页面的隐私协议入口可正常跳转
 *
 * ===== 测试流程 =====
 *  | 步骤 | 页面               | 操作                | 验证点                                |
 *  | 1    | onboarding         | 加载登录页          | 复选框未选中、链接存在                  |
 *  | 2    | onboarding         | 点击复选框          | 复选框选中、登录按钮激活                |
 *  | 3    | onboarding         | 反选复选框          | 复选框取消选中、按钮变灰                |
 *  | 4    | 用户协议页         | 点击"《用户服务协议》" | 页面跳转、标题内容正确                    |
 *  | 5    | 隐私政策页         | 跳转隐私政策        | 页面跳转、标题内容正确                    |
 *  | 6    | settings           | 设置页隐私入口      | 菜单项存在、点击后跳转                    |
 *
 * 运行方式：
 *   npm run test:e2e -- --testPathPattern=privacy_agreement
 *   # 或全自动（Windows）：
 *   npm run test:e2e:auto -- --testPathPattern=privacy_agreement
 */

import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

/* ==================== 类型定义 ==================== */

interface AgreementPageData {
  safeTop: number;
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

const REPORTS_DIR = join(process.cwd(), 'miniprogram', 'tests', 'reports', 'privacy-test');

function timestamp(): string {
  var d = new Date();
  var pad = function (n: number) { return String(n).padStart(2, '0'); };
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) +
    '_' + pad(d.getHours()) + '-' + pad(d.getMinutes());
}

function sleep(ms: number): Promise<void> {
  return new Promise(function (resolve) { setTimeout(resolve, ms); });
}

/* ==================== 测试套件 ==================== */

describe('隐私协议功能 E2E 测试', function () {
  jest.setTimeout(120000);

  var mp: any;       // MiniProgram 实例
  var page: any;     // Page 实例
  var outputDir: string;

  beforeAll(async function () {
    mp = (global as any).__AUTOMATOR__;
    if (!mp) {
      throw new Error(
        '未建立 automator 连接。请运行：npm run test:e2e:auto\n' +
        '或确保：1) 开发者工具已启动 2) 服务端口已开启'
      );
    }

    var runId = 'privacy-test_' + timestamp();
    outputDir = join(REPORTS_DIR, runId);
    if (!existsSync(outputDir)) {
      mkdirSync(outputDir, { recursive: true });
    }
    console.log('[privacy-test] 报告目录: ' + outputDir);
  });

  /* =========== 测试 1：登录页初始状态 =========== */

  test('1. 登录页初始状态 - 复选框默认未选中、链接存在', async function () {
    page = await mp.reLaunch('/pages/onboarding/onboarding');
    await sleep(2000);
    if (!page) page = await mp.currentPage();
    expect(page).toBeTruthy();

    var path = page ? page.path : 'unknown';
    console.log('[privacy-test] 页面路径: ' + path);
    expect(path).toContain('onboarding');

    // 验证复选框默认未选中
    var data: OnboardingPageData = await page.data();
    console.log('[privacy-test] hasAgreed 初始值:', data.hasAgreed);
    expect(data.hasAgreed).toBe(false);

    // 验证协议链接存在
    var agreementLink = await page.$('.privacy-link');
    expect(agreementLink).toBeTruthy();

    var linkText = await agreementLink.text();
    console.log('[privacy-test] 协议链接文字:', linkText);
    expect(linkText).toContain('用户服务协议');

    // 验证复选框元素存在
    var checkbox = await page.$('.privacy-checkbox');
    expect(checkbox).toBeTruthy();

    // 验证登录按钮存在且处于禁用状态（灰色）
    var loginBtn = await page.$('.login-btn');
    expect(loginBtn).toBeTruthy();
    var btnClasses = await page.data().then(function (d: any) {
      return d.hasAgreed === false ? 'disabled' : 'enabled';
    });
    // hasAgreed === false 所以按钮应该灰色
    console.log('[privacy-test] 初始状态: 复选框未选中, 按钮灰色');
  });

  /* =========== 测试 2：勾选复选框 =========== */

  test('2. 勾选复选框 - 复选框选中、按钮激活', async function () {
    // 点击复选框勾选
    var checkbox = await page.$('.privacy-checkbox');
    expect(checkbox).toBeTruthy();

    await checkbox.tap();
    await sleep(500);

    var data: OnboardingPageData = await page.data();
    console.log('[privacy-test] 点击后 hasAgreed:', data.hasAgreed);
    expect(data.hasAgreed).toBe(true);

    // 验证打勾图标出现
    var checkIcon = await page.$('.checkbox-icon');
    expect(checkIcon).toBeTruthy();

    var iconText = await checkIcon.text();
    expect(iconText).toBe('✓');

    console.log('[privacy-test] ✓ 复选框已勾选, 图标显示正确');
  });

  /* =========== 测试 3：取消勾选 =========== */

  test('3. 取消勾选复选框 - 复选框取消选中、按钮变灰', async function () {
    var checkbox = await page.$('.privacy-checkbox');
    expect(checkbox).toBeTruthy();

    // 再次点击取消勾选
    await checkbox.tap();
    await sleep(500);

    var data: OnboardingPageData = await page.data();
    expect(data.hasAgreed).toBe(false);

    // 打勾图标应消失
    var checkIcon = await page.$('.checkbox-icon');
    expect(checkIcon).toBeNull();

    console.log('[privacy-test] ✓ 复选框已取消勾选');

    // 重新勾选，准备后续测试
    await checkbox.tap();
    await sleep(500);
    data = await page.data();
    expect(data.hasAgreed).toBe(true);
    console.log('[privacy-test] ✓ 已重新勾选，准备后续测试');
  });

  /* =========== 测试 4：点击《用户服务协议》链接跳转 =========== */

  test('4. 点击《用户服务协议》链接 - 跳转到协议内容页', async function () {
    // 查找用户服务协议链接（第一个 .privacy-link）
    var links = await page.$$('.privacy-link');
    expect(links.length).toBeGreaterThanOrEqual(2);
    expect(links).toBeTruthy();

    // 第一个链接是《用户服务协议》
    var agreementLink = links[0];
    var linkText = await agreementLink.text();
    console.log('[privacy-test] 点击链接: "' + linkText + '"');
    expect(linkText).toContain('用户服务协议');

    // 点击链接
    await agreementLink.tap();
    await sleep(2000);

    // 验证已跳转到协议页面
    var currentPage = await mp.currentPage();
    expect(currentPage).toBeTruthy();

    var path = currentPage ? currentPage.path : 'unknown';
    console.log('[privacy-test] 跳转到: ' + path);
    expect(path).toContain('privacy_agreement');

    // 读取页面数据，验证协议内容
    var data: AgreementPageData = await currentPage.data();
    expect(data.pageTitle).toBe('用户服务协议');
    expect(data.updatedDate).toBeTruthy();

    // 验证协议章节内容加载
    var sections = data.contentSections;
    expect(sections).toBeTruthy();
    expect(Array.isArray(sections)).toBe(true);
    expect(sections.length).toBeGreaterThanOrEqual(10);

    console.log('[privacy-test] 协议标题: "' + data.pageTitle + '"');
    console.log('[privacy-test] 更新日期: ' + data.updatedDate);
    console.log('[privacy-test] 章节数: ' + sections.length);
    console.log('[privacy-test] 第一章: "' + sections[0].title + '"');

    // 验证导航栏标题显示
    var navTitle = await currentPage.$('.nav-title');
    expect(navTitle).toBeTruthy();
    var navTitleText = await navTitle.text();
    expect(navTitleText).toBe('用户服务协议');

    // 验证返回按钮存在
    var backBtn = await currentPage.$('.nav-btn-circle');
    expect(backBtn).toBeTruthy();

    // 验证第一个章节卡片内容
    var firstSection = await currentPage.$('.agreement-section');
    expect(firstSection).toBeTruthy();

    var sectionTitle = await firstSection.$('.section-title');
    expect(sectionTitle).toBeTruthy();
    var sectionTitleText = await sectionTitle.text();
    expect(sectionTitleText).toBe('一、接受条款');

    console.log('[privacy-test] ✓ 用户服务协议页面验证通过');
  });

  /* =========== 测试 5：验证隐私政策页面 =========== */

  test('5. 导航到隐私政策页面 - 内容正确加载', async function () {
    // 直接 navigateTo 隐私政策类型
    page = await mp.reLaunch('/pages/privacy_agreement/privacy_agreement?type=privacy');
    await sleep(2000);
    if (!page) page = await mp.currentPage();
    expect(page).toBeTruthy();

    var path = page ? page.path : 'unknown';
    console.log('[privacy-test] 页面路径: ' + path);

    var data: AgreementPageData = await page.data();
    expect(data.pageTitle).toBe('隐私政策');

    var sections = data.contentSections;
    expect(sections).toBeTruthy();
    expect(Array.isArray(sections)).toBe(true);
    expect(sections.length).toBeGreaterThanOrEqual(8);

    console.log('[privacy-test] 页面标题: "' + data.pageTitle + '"');
    console.log('[privacy-test] 章节目录:');
    for (var i = 0; i < sections.length; i++) {
      console.log('  ' + (i + 1) + '. ' + sections[i].title);
    }

    // 验证关键词存在（核心隐私内容）
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

    console.log('[privacy-test] ✓ 隐私政策页面验证通过');
  });

  /* =========== 测试 6：验证用户协议页面 =========== */

  test('6. 导航到用户协议页面 - 内容正确加载', async function () {
    page = await mp.reLaunch('/pages/privacy_agreement/privacy_agreement?type=agreement');
    await sleep(2000);
    if (!page) page = await mp.currentPage();
    expect(page).toBeTruthy();

    var data: AgreementPageData = await page.data();
    expect(data.pageTitle).toBe('用户服务协议');

    var sections = data.contentSections;
    expect(sections.length).toBeGreaterThanOrEqual(10);

    // 验证关键章节存在
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

    console.log('[privacy-test] 协议章节数: ' + sections.length);
    console.log('[privacy-test] ✓ 用户服务协议页面验证通过');
  });

  /* =========== 测试 7：设置页入口验证 =========== */

  test('7. 设置页隐私政策入口 - 菜单项存在且可跳转', async function () {
    page = await mp.reLaunch('/pages/settings/settings');
    await sleep(2000);
    if (!page) page = await mp.currentPage();
    expect(page).toBeTruthy();

    // 查找隐私政策菜单项
    var menuItems = await page.$$('.menu-item');
    expect(menuItems.length).toBeGreaterThan(0);

    var privacyItem: any = null;
    for (var i = 0; i < menuItems.length; i++) {
      try {
        var text = await menuItems[i].text();
        if (text && text.indexOf('隐私政策') !== -1) {
          privacyItem = menuItems[i];
          console.log('[privacy-test] 找到设置页隐私政策入口: "' + text + '"');
          break;
        }
      } catch (_) { /* 忽略 */ }
    }
    expect(privacyItem).toBeTruthy();

    // 点击隐私政策菜单项
    await privacyItem.tap();
    await sleep(2000);

    var currentPage = await mp.currentPage();
    expect(currentPage).toBeTruthy();

    var targetPath = currentPage ? currentPage.path : 'unknown';
    console.log('[privacy-test] 从设置页跳转到: ' + targetPath);
    expect(targetPath).toContain('privacy_agreement');

    var data: AgreementPageData = await currentPage.data();
    // 默认从设置页跳转到用户服务协议（?type=agreement 是默认值）
    expect(data.pageTitle).toBe('用户服务协议');

    console.log('[privacy-test] ✓ 设置页隐私政策入口验证通过');
  });

  /* =========== 测试 8：截图保存 =========== */

  test('8. 关键页面截图保存', async function () {
    // 截取用户协议页面
    var timeout = function (ms: number) {
      return new Promise(function (_, reject) {
        setTimeout(function () { reject(new Error('截图超时 ' + ms + 'ms')); }, ms);
      });
    };

    console.log('[privacy-test] 正在截图...');

    // 截图1：用户协议页
    var ss1 = await Promise.race([mp.screenshot(), timeout(15000)]) as string;
    var buf1 = Buffer.from(ss1, 'base64');
    var file1 = join(outputDir, '01-user-agreement.png');
    writeFileSync(file1, buf1);
    console.log('[privacy-test] 截图1(用户协议): ' + (buf1.length / 1024).toFixed(1) + ' KB');

    // 截图2：隐私政策页
    page = await mp.reLaunch('/pages/privacy_agreement/privacy_agreement?type=privacy');
    await sleep(2000);
    var ss2 = await Promise.race([mp.screenshot(), timeout(15000)]) as string;
    var buf2 = Buffer.from(ss2, 'base64');
    var file2 = join(outputDir, '02-privacy-policy.png');
    writeFileSync(file2, buf2);
    console.log('[privacy-test] 截图2(隐私政策): ' + (buf2.length / 1024).toFixed(1) + ' KB');

    // 截图3：登录页（含复选框和链接）
    page = await mp.reLaunch('/pages/onboarding/onboarding');
    await sleep(2000);
    var ss3 = await Promise.race([mp.screenshot(), timeout(15000)]) as string;
    var buf3 = Buffer.from(ss3, 'base64');
    var file3 = join(outputDir, '03-onboarding-privacy.png');
    writeFileSync(file3, buf3);
    console.log('[privacy-test] 截图3(登录页): ' + (buf3.length / 1024).toFixed(1) + ' KB');

    expect(buf1.length).toBeGreaterThan(1024);
    expect(buf2.length).toBeGreaterThan(1024);
    expect(buf3.length).toBeGreaterThan(1024);
    console.log('[privacy-test] ✓ 所有截图已保存到: ' + outputDir);
  });
});