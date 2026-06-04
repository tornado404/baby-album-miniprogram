const automator = require('miniprogram-automator')
const fs = require('fs')
const path = require('path')

/**
 * 小程序首屏截图测试
 * 捕获首页渲染后的屏幕截图并保存
 */
describe('首屏截图测试', () => {
  let miniProgram
  const projectPath = path.resolve(__dirname, '../../miniprogram')
  const screenshotDir = path.resolve(__dirname, '../screenshots')

  // 确保截图目录存在
  beforeAll(() => {
    if (!fs.existsSync(screenshotDir)) {
      fs.mkdirSync(screenshotDir, { recursive: true })
    }
  })

  beforeAll(async () => {
    // 启动开发者工具并连接小程序
    console.log('正在启动开发者工具...')
    miniProgram = await automator.launch({
      projectPath: projectPath,
      timeout: 60000, // 首次编译可能需要较长时间
    })
    console.log('开发者工具启动成功')
  }, 60000)

  afterAll(async () => {
    // 测试完成后关闭连接
    if (miniProgram) {
      await miniProgram.close()
      console.log('开发者工具已关闭')
    }
  })

  it('应该成功截取首页屏幕', async () => {
    // 获取当前时间戳作为文件名
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const screenshotPath = path.join(screenshotDir, `home-${timestamp}.png`)

    // 导航到首页（使用 reLaunch 确保从首页开始）
    console.log('正在导航到首页...')
    const page = await miniProgram.reLaunch('/pages/album_home/album_home')

    // 等待页面完全渲染
    // 方式1：固定等待时间（适用于简单页面）
    await page.waitFor(2000)

    // 方式2：等待特定元素出现（更可靠）
    // await page.waitFor('.album-container')

    // 获取当前页面信息
    const currentPage = await miniProgram.currentPage()
    console.log('当前页面路径:', currentPage.path)

    // 截图并保存
    console.log('正在截取屏幕...')
    const buffer = await miniProgram.screenshot()

    // 保存截图文件
    fs.writeFileSync(screenshotPath, buffer)
    console.log('截图已保存:', screenshotPath)

    // 验证截图文件是否存在且不为空
    const stats = fs.statSync(screenshotPath)
    expect(stats.size).toBeGreaterThan(0)
    console.log('截图文件大小:', (stats.size / 1024).toFixed(2), 'KB')
  }, 30000)
})
