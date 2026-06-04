/**
 * 核心用户流程 E2E 测试
 * 覆盖：首次登录 → baby_onboarding → album_home → baby_list → baby_profile
 * 使用 mock 数据，无需真实后端
 */
const { ScreenshotHelper } = require('./screenshot-helper')
const path = require('path')

describe('核心用户流程 E2E 测试', () => {
  let helper

  beforeAll(async () => {
    helper = new ScreenshotHelper({
      screenshotDir: path.resolve(__dirname, '../reports/screenshots')
    })
    await helper.init()
  }, 60000)

  afterAll(async () => {
    await helper.close()
  })

  // ===== Flow 1: 首页渲染 =====
  test('F1: Album Home 首页渲染', async () => {
    const page = await helper.navigateTo('/pages/album_home/album_home', { waitTime: 3000 })
    expect(page).toBeTruthy()

    // Check key elements exist
    const title = await page.$('.home-nav-title')
    const titleText = await title.text()
    expect(titleText).toContain('宝宝成长日记')

    // Verify FAB button exists
    const fab = await page.$('.fab-upload')
    expect(fab).toBeTruthy()

    // Screenshot
    const result = await helper.screenshot('F1-album-home.png')
    expect(result.size).toBeGreaterThan(0)
    console.log('  → 首屏渲染正常:', result.sizeKB, 'KB')
  }, 30000)

  // ===== Flow 2: 展开/折叠 Header =====
  test('F2: Header 折叠动画', async () => {
    const page = await helper.navigateTo('/pages/album_home/album_home', { waitTime: 2000 })

    // Scroll down to trigger collapse
    await helper.miniProgram.pageScrollTo({ scrollTop: 100 })
    await page.waitFor(500)

    const result = await helper.screenshot('F2-header-collapsed.png')
    expect(result.size).toBeGreaterThan(0)
    console.log('  → Header 折叠态正常:', result.sizeKB, 'KB')

    // Scroll back to top
    await helper.miniProgram.pageScrollTo({ scrollTop: 0 })
    await page.waitFor(500)
    console.log('  → Header 已展开恢复')
  }, 30000)

  // ===== Flow 3: 首次登录 → baby_onboarding =====
  test('F3: Baby Onboarding 页面', async () => {
    const page = await helper.navigateTo('/pages/baby_onboarding/baby_onboarding', { waitTime: 2000 })
    expect(page).toBeTruthy()

    // Check nav title
    const navTitle = await page.$('.nav-title')
    const titleText = await navTitle.text()
    expect(titleText).toContain('宝宝信息')
    console.log('  → 导航标题:', titleText)

    // Check avatar exists
    const avatar = await page.$('.avatar-circle')
    expect(avatar).toBeTruthy()

    // Check save button
    const saveBtn = await page.$('.save-btn')
    expect(saveBtn).toBeTruthy()

    // Screenshot
    const result = await helper.screenshot('F3-baby-onboarding.png')
    expect(result.size).toBeGreaterThan(0)
    console.log('  → Onboarding 页面正常:', result.sizeKB, 'KB')
  }, 30000)

  // ===== Flow 4: Baby List 页面 =====
  test('F4: 宝宝列表页', async () => {
    const page = await helper.navigateTo('/pages/baby_list/baby_list', { waitTime: 2000 })
    expect(page).toBeTruthy()

    // Check nav title
    const navTitle = await page.$('.nav-title')
    const titleText = await navTitle.text()
    expect(titleText).toContain('选择宝宝')

    // Check baby cards exist (at least one)
    const babyCards = await page.$$('.baby-card')
    expect(babyCards.length).toBeGreaterThanOrEqual(1)
    console.log('  → 宝宝卡片数量:', babyCards.length)

    // Check add button exists
    const addBtn = await page.$('.add-btn')
    expect(addBtn).toBeTruthy()

    const result = await helper.screenshot('F4-baby-list.png')
    expect(result.size).toBeGreaterThan(0)
    console.log('  → 宝宝列表正常:', result.sizeKB, 'KB')
  }, 30000)

  // ===== Flow 5: 设置页 =====
  test('F5: 设置页渲染', async () => {
    const page = await helper.navigateTo('/pages/settings/settings', { waitTime: 2000 })
    expect(page).toBeTruthy()

    // Check user card
    const userCard = await page.$('.user-card')
    expect(userCard).toBeTruthy()

    // Check menu items
    const menuItems = await page.$$('.menu-item')
    expect(menuItems.length).toBeGreaterThanOrEqual(6)
    console.log('  → 菜单项数量:', menuItems.length)

    const result = await helper.screenshot('F5-settings.png')
    expect(result.size).toBeGreaterThan(0)
    console.log('  → 设置页正常:', result.sizeKB, 'KB')
  }, 30000)

  // ===== Flow 6: 上传页 =====
  test('F6: 上传页渲染', async () => {
    const page = await helper.navigateTo('/pages/upload/upload', { waitTime: 2000 })
    expect(page).toBeTruthy()

    // Check upload card
    const uploadCard = await page.$('.upload-card')
    expect(uploadCard).toBeTruthy()

    // Check options
    const options = await page.$$('.upload-option')
    expect(options.length).toBe(3)
    console.log('  → 上传选项数量:', options.length)

    const result = await helper.screenshot('F6-upload.png')
    expect(result.size).toBeGreaterThan(0)
    console.log('  → 上传页正常:', result.sizeKB, 'KB')
  }, 30000)

  // ===== Flow 7: Baby Profile 页面 =====
  test('F7: 宝宝档案页', async () => {
    const page = await helper.navigateTo('/pages/baby_profile/baby_profile', { waitTime: 2000 })
    expect(page).toBeTruthy()

    // Check nav title
    const navTitle = await page.$('.nav-title')
    const titleText = await navTitle.text()
    expect(titleText).toContain('宝宝档案')

    // Check avatar
    const avatar = await page.$('.avatar-circle')
    expect(avatar).toBeTruthy()

    // Check fields
    const fields = await page.$$('.field-item')
    expect(fields.length).toBe(6)
    console.log('  → 字段数量:', fields.length)

    // Check save button at bottom
    const saveBtn = await page.$('.save-btn')
    expect(saveBtn).toBeTruthy()

    const result = await helper.screenshot('F7-baby-profile.png')
    expect(result.size).toBeGreaterThan(0)
    console.log('  → 档案页正常:', result.sizeKB, 'KB')
  }, 30000)

  // ===== Flow 8: 全页面导航跳转 =====
  test('F8: 设置→宝宝列表→档案 跳转链路', async () => {
    // Start at settings
    await helper.navigateTo('/pages/settings/settings', { waitTime: 1500 })

    // Find and tap "宝宝管理" menu item
    const menuItems = await helper.miniProgram.$$('.menu-item')
    const firstItem = menuItems[0]
    const firstItemTitle = await firstItem.$('.menu-title')
    const titleText = await firstItemTitle.text()
    expect(titleText).toContain('宝宝管理')
    console.log('  → 菜单第一项:', titleText)

    // Tap it
    await firstItem.tap()
    await new Promise(r => setTimeout(r, 2000))

    // Should now be on baby_list
    const currentPage = await helper.miniProgram.currentPage()
    console.log('  → 跳转到:', currentPage.path)
    expect(currentPage.path).toContain('baby_list')

    const result = await helper.screenshot('F8-nav-flow.png')
    expect(result.size).toBeGreaterThan(0)
    console.log('  → 导航跳转正常:', result.sizeKB, 'KB')
  }, 30000)
})