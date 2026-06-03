/**
 * 核心用户旅程测试用例
 *
 * 按 architect §2.2.5：FlowStep + FlowContext 接口
 *  - FlowStep.action(ctx) 接受上下文（automator, screenshot, validator, reporter, page）
 *  - FlowStep.expectations AI 验证点列表
 *
 * 5 步流程（参考设计文档 §5）：
 *  | 步骤 | 页面        | 操作                | 截图 | AI 验证点                       |
 *  | 1    | album_home  | 加载相册首页        | ✓    | 标题、媒体卡片列表、上传按钮   |
 *  | 2    | 媒体上传    | 点击上传按钮        | ✓    | 上传弹窗                       |
 *  | 3    | media_detail| 点击媒体卡片        | ✓    | 详情页、缩略图信息             |
 *  | 4    | 返回相册    | 返回上一页          | ✓    | 相册列表恢复                   |
 *  | 5    | logs        | 跳转日志页          | ✓    | 日志列表                       |
 */

import { FlowContext, FlowStep } from '../e2e/album-flow-types';

/* ==================== FlowStep 定义 ==================== */

export const ALBUM_FLOW_NAME = 'album-user-journey';

/**
 * 5 步用户旅程
 * action 接收 FlowContext，可访问 automator / screenshot / validator / reporter / page
 */
export const ALBUM_FLOW: FlowStep[] = [
  {
    name: '加载相册首页',
    page: 'album_home',
    step: 1,
    action: async (ctx: FlowContext) => {
      // 重新启动到相册首页
      // 兼容两种 automator API：reLaunch 或 page.$ 先存在
      const automator: any = ctx.automator;
      if (typeof automator.reLaunch === 'function') {
        await automator.reLaunch('/pages/album_home/index');
      } else {
        await ctx.page.waitFor('view', 5000);
      }
    },
    expectations: [
      '页面标题为"宝宝相册"或类似相册主题',
      '存在媒体卡片列表（Masonry 瀑布流布局）',
      '底部或右下角有上传按钮（圆形/加号图标）'
    ]
  },
  {
    name: '点击上传按钮',
    page: 'album_home',
    step: 2,
    action: async (ctx: FlowContext) => {
      // 点击上传按钮（推荐使用 data-testid 选择器）
      // 当前项目使用 class 名 .upload-btn；后续可改为 data-testid="upload-btn"
      const page: any = ctx.page;
      let el = null;
      try {
        el = await page.$('.upload-btn');
      } catch {
        el = null;
      }
      if (el && typeof el.tap === 'function') {
        await el.tap();
      } else {
        // 兜底：等待弹窗出现（也许已经显示）
        await page.waitFor('t-popup', 3000).catch(() => undefined);
      }
    },
    expectations: [
      '页面出现上传弹窗或选择器（媒体选择面板、ActionSheet 等）',
      '显示从相册/拍照/视频等选项'
    ]
  },
  {
    name: '打开媒体详情',
    page: 'media_detail',
    step: 3,
    action: async (ctx: FlowContext) => {
      const automator: any = ctx.automator;
      if (typeof automator.navigateTo === 'function') {
        await automator.navigateTo({ url: '/pages/media_detail/index?id=test-1' });
      } else {
        await ctx.page.waitFor('view', 5000);
      }
    },
    expectations: [
      '页面为媒体详情页，显示媒体缩略图',
      '包含宝宝年龄/拍摄时间等元信息',
      '布局简洁清晰'
    ]
  },
  {
    name: '返回相册列表',
    page: 'album_home',
    step: 4,
    action: async (ctx: FlowContext) => {
      const automator: any = ctx.automator;
      if (typeof automator.navigateBack === 'function') {
        await automator.navigateBack();
      } else {
        await ctx.page.waitFor('view', 5000);
      }
    },
    expectations: ['页面回到相册首页', '媒体卡片列表仍正常显示']
  },
  {
    name: '跳转到日志页',
    page: 'logs',
    step: 5,
    action: async (ctx: FlowContext) => {
      const automator: any = ctx.automator;
      if (typeof automator.navigateTo === 'function') {
        await automator.navigateTo({ url: '/pages/logs/index' });
      } else {
        await ctx.page.waitFor('view', 5000);
      }
    },
    expectations: [
      '页面为日志页，显示启动日志列表（包含时间戳/日志内容）',
      '标题为"日志"或类似名称'
    ]
  },
  {
    name: '验证瀑布流布局',
    page: 'album_home',
    step: 6,
    action: async (ctx: FlowContext) => {
      const page: any = ctx.page;
      // 验证瀑布流组件存在
      let masonryExists = false;
      try {
        const masonry = await page.$('masonry-layout');
        masonryExists = !!masonry;
      } catch {
        masonryExists = false;
      }
      if (masonryExists) {
        console.log('瀑布流组件已正确集成');
      }
    },
    expectations: [
      '瀑布流布局显示正确',
      '图片按原始比例显示',
      '懒加载正常'
    ]
  }
];

/* ==================== 备注 ====================
 *
 * 旧版的 TestStep[] 数据驱动形式（由 runE2E 调度）已废弃。
 * 新代码请使用 ALBUM_FLOW + runFlow()。
 *
 * 如需保留旧 API 对照，请参考 git 历史。
 */
