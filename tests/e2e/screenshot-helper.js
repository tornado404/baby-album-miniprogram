const automator = require('miniprogram-automator')
const fs = require('fs')
const path = require('path')

/**
 * 小程序截图工具类
 * 封装常用截图操作
 */
class ScreenshotHelper {
  constructor(options = {}) {
    this.projectPath = options.projectPath || path.resolve(__dirname, '../../miniprogram')
    this.screenshotDir = options.screenshotDir || path.resolve(__dirname, '../screenshots')
    this.miniProgram = null
    this.defaultTimeout = options.timeout || 60000
  }

  /**
   * 初始化并启动开发者工具
   */
  async init() {
    // 创建截图目录
    if (!fs.existsSync(this.screenshotDir)) {
      fs.mkdirSync(this.screenshotDir, { recursive: true })
    }

    console.log('🚀 正在启动开发者工具...')
    this.miniProgram = await automator.launch({
      projectPath: this.projectPath,
      timeout: this.defaultTimeout,
    })
    console.log('✅ 开发者工具启动成功')

    return this
  }

  /**
   * 关闭开发者工具
   */
  async close() {
    if (this.miniProgram) {
      await this.miniProgram.close()
      this.miniProgram = null
      console.log('👋 开发者工具已关闭')
    }
  }

  /**
   * 导航到指定页面
   * @param {string} url - 页面路径
   * @param {Object} options - 选项
   */
  async navigateTo(url, options = {}) {
    const { waitTime = 2000, waitForSelector } = options

    console.log(`📱 正在导航到: ${url}`)
    const page = await this.miniProgram.reLaunch(url)

    // 等待特定元素或固定时间
    if (waitForSelector) {
      try {
        await page.waitFor(waitForSelector, 10000)
        console.log(`✅ 元素 ${waitForSelector} 已出现`)
      } catch (e) {
        console.log(`⚠️ 等待元素 ${waitForSelector} 超时，使用固定等待`)
        await page.waitFor(waitTime)
      }
    } else {
      await page.waitFor(waitTime)
    }

    return page
  }

  /**
   * 截图并保存
   * @param {string} filename - 文件名（不含路径）
   * @param {Object} options - 选项
   */
  async screenshot(filename, options = {}) {
    const { scrollTop = 0, fullPage = false } = options

    // 如果指定了滚动位置
    if (scrollTop > 0) {
      await this.miniProgram.pageScrollTo(scrollTop)
      await new Promise(r => setTimeout(r, 500))
    }

    console.log('📸 正在截图...')
    const buffer = await this.miniProgram.screenshot()

    // 生成文件名
    const finalFilename = filename || this.generateFilename()
    const filepath = path.join(this.screenshotDir, finalFilename)

    fs.writeFileSync(filepath, buffer)
    console.log('✅ 截图已保存:', filepath)

    // 返回文件信息
    const stats = fs.statSync(filepath)
    return {
      path: filepath,
      filename: finalFilename,
      size: stats.size,
      sizeKB: (stats.size / 1024).toFixed(2),
    }
  }

  /**
   * 截取多屏长图（通过滚动）
   * @param {string} baseFilename - 基础文件名
   * @param {Object} options - 选项
   */
  async screenshotFullPage(baseFilename, options = {}) {
    const { pageHeight = 800, scrollStep = 600 } = options
    const screenshots = []

    const page = await this.miniProgram.currentPage()
    const { height } = await page.size()

    console.log(`📏 页面总高度: ${height}px`)

    let scrollTop = 0
    let index = 0

    while (scrollTop < height) {
      const filename = `${baseFilename}-part${index}.png`
      const result = await this.screenshot(filename, { scrollTop })
      screenshots.push(result)

      scrollTop += scrollStep
      index++

      // 防止无限循环
      if (index > 20) break
    }

    return screenshots
  }

  /**
   * 对比截图（用于回归测试）
   * @param {string} filename - 基准文件名
   */
  async screenshotForCompare(filename) {
    const timestamp = new Date().toISOString().split('T')[0]
    const compareDir = path.join(this.screenshotDir, 'compare', timestamp)

    if (!fs.existsSync(compareDir)) {
      fs.mkdirSync(compareDir, { recursive: true })
    }

    const filepath = path.join(compareDir, filename)
    const buffer = await this.miniProgram.screenshot()
    fs.writeFileSync(filepath, buffer)

    return {
      path: filepath,
      filename,
      compareDir,
    }
  }

  /**
   * 生成文件名
   */
  generateFilename(prefix = 'screenshot') {
    const timestamp = new Date().toISOString()
      .replace(/[:.]/g, '-')
      .replace('T', '_')
      .slice(0, 19)
    return `${prefix}-${timestamp}.png`
  }

  /**
   * 获取系统信息
   */
  async getSystemInfo() {
    return await this.miniProgram.systemInfo()
  }

  /**
   * 获取当前页面信息
   */
  async getCurrentPage() {
    return await this.miniProgram.currentPage()
  }
}

/**
 * 快捷使用函数 - 单张截图
 * @param {string} url - 页面路径
 * @param {string} outputPath - 输出路径（可选）
 */
async function quickScreenshot(url, outputPath) {
  const helper = new ScreenshotHelper()

  try {
    await helper.init()
    await helper.navigateTo(url)

    const result = await helper.screenshot(outputPath)
    console.log('\n✅ 截图完成!')
    console.log('文件:', result.path)
    console.log('大小:', result.sizeKB + ' KB')

    return result
  } finally {
    await helper.close()
  }
}

// 导出
module.exports = {
  ScreenshotHelper,
  quickScreenshot,
}

// 如果直接运行此文件
if (require.main === module) {
  const targetUrl = process.argv[2] || '/pages/album_home/album_home'
  const outputFile = process.argv[3]

  quickScreenshot(targetUrl, outputFile)
    .then(() => process.exit(0))
    .catch(err => {
      console.error('❌ 截图失败:', err)
      process.exit(1)
    })
}
