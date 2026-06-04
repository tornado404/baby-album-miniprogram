const automator = require('miniprogram-automator')
const fs = require('fs')
const path = require('path')

/**
 * 小程序首屏截图测试 - 高级版本
 * 支持多分辨率截图、元素等待、性能数据收集
 */
describe('首屏截图高级测试', () => {
  let miniProgram
  let page
  const projectPath = path.resolve(__dirname, '../../miniprogram')
  const screenshotDir = path.resolve(__dirname, '../screenshots')

  // 测试配置
  const config = {
    // 首页路径
    homePath: '/pages/album_home/album_home',
    // 等待页面加载的最大时间（毫秒）
    maxWaitTime: 10000,
    // 截图质量（仅部分工具版本支持）
    quality: 80,
  }

  beforeAll(() => {
    // 创建截图目录
    if (!fs.existsSync(screenshotDir)) {
      fs.mkdirSync(screenshotDir, { recursive: true })
    }
  })

  beforeAll(async () => {
    console.log('🚀 正在启动开发者工具...')
    console.log('📁 项目路径:', projectPath)

    miniProgram = await automator.launch({
      projectPath: projectPath,
      timeout: 60000,
    })

    console.log('✅ 开发者工具启动成功')
  }, 60000)

  beforeEach(async () => {
    // 每个测试用例前重新加载首页
    console.log('📱 正在加载首页...')
    page = await miniProgram.reLaunch(config.homePath)
  })

  afterAll(async () => {
    if (miniProgram) {
      await miniProgram.close()
      console.log('👋 开发者工具已关闭')
    }
  })

  /**
   * 等待页面就绪 - 检测关键元素
   */
  async function waitForPageReady() {
    const startTime = Date.now()

    try {
      // 方式1：等待特定选择器出现
      await page.waitFor('.album-container', config.maxWaitTime)
      console.log('✅ 页面关键元素已加载')
    } catch (e) {
      // 方式2：如果特定元素不存在，等待固定时间
      console.log('⚠️ 未检测到特定元素，使用固定等待时间')
      await page.waitFor(3000)
    }

    const loadTime = Date.now() - startTime
    console.log(`⏱️ 页面加载耗时: ${loadTime}ms`)
    return loadTime
  }

  /**
   * 生成截图文件名
   */
  function generateFileName(prefix = 'screenshot') {
    const now = new Date()
    const timestamp = now.toISOString()
      .replace(/[:.]/g, '-')
      .replace('T', '_')
      .slice(0, 19)
    return `${prefix}-${timestamp}.png`
  }

  it('应该截取完整首页截图', async () => {
    const screenshotPath = path.join(screenshotDir, generateFileName('home-full'))

    // 等待页面就绪
    await waitForPageReady()

    // 额外等待资源加载（图片等）
    await page.waitFor(1000)

    // 截图
    console.log('📸 正在截取完整屏幕...')
    const buffer = await miniProgram.screenshot()

    // 保存
    fs.writeFileSync(screenshotPath, buffer)

    // 验证
    const stats = fs.statSync(screenshotPath)
    expect(stats.size).toBeGreaterThan(1024) // 至少 1KB

    console.log('✅ 截图已保存:', screenshotPath)
    console.log(`📊 文件大小: ${(stats.size / 1024).toFixed(2)} KB`)
  }, 30000)

  it('应该截取首屏区域截图（不包含滚动区域）', async () => {
    const screenshotPath = path.join(screenshotDir, generateFileName('home-first-screen'))

    // 滚动到顶部确保从首屏开始
    await miniProgram.pageScrollTo(0)
    await page.waitFor(500)

    // 等待页面就绪
    await waitForPageReady()

    // 截图
    console.log('📸 正在截取首屏...')
    const buffer = await miniProgram.screenshot()
    fs.writeFileSync(screenshotPath, buffer)

    const stats = fs.statSync(screenshotPath)
    expect(stats.size).toBeGreaterThan(1024)

    console.log('✅ 首屏截图已保存:', screenshotPath)
  }, 30000)

  it('应该获取页面基础信息', async () => {
    await waitForPageReady()

    // 获取页面信息
    const currentPage = await miniProgram.currentPage()
    const systemInfo = await miniProgram.systemInfo()
    const pageSize = await page.size()

    console.log('\n📋 页面信息:')
    console.log('  路径:', currentPage.path)
    console.log('  参数:', JSON.stringify(currentPage.query))
    console.log('  页面尺寸:', `${pageSize.width}x${pageSize.height}`)
    console.log('  设备型号:', systemInfo.model)
    console.log('  屏幕尺寸:', `${systemInfo.screenWidth}x${systemInfo.screenHeight}`)
    console.log('  系统:', systemInfo.system)

    expect(currentPage.path).toContain('album_home')
  }, 30000)
})
