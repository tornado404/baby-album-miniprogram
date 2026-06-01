/**
 * 核心用户旅程测试用例
 *
 * 覆盖设计文档第 5 节：
 *  | 步骤 | 页面        | 操作                | 截图 | AI 验证点                       |
 *  | 1    | album_home  | 加载相册首页        | ✓    | 标题、媒体卡片列表、上传按钮   |
 *  | 2    | 媒体上传    | 点击上传按钮        | ✓    | 上传弹窗                       |
 *  | 3    | media_detail| 点击媒体卡片        | ✓    | 详情页、缩略图信息             |
 *  | 4    | 返回相册    | 返回上一页          | ✓    | 相册列表恢复                   |
 *  | 5    | logs        | 跳转日志页          | ✓    | 日志列表                       |
 *
 * 这里是纯数据描述，由 e2e runner 负责执行。
 */

import { TestStep } from '../e2e/types';

export const ALBUM_FLOW_NAME = 'album-user-journey';

export const albumFlowSteps: TestStep[] = [
  {
    step: 1,
    page: 'album_home',
    action: 'reLaunch',
    name: '加载相册首页',
    waitMs: 1000,
    aiPrompt:
      '页面标题为"宝宝相册"或类似相册主题；存在媒体卡片列表（Masonry 瀑布流布局）；' +
      '底部或右下角有上传按钮（圆形/加号图标）。'
  },
  {
    step: 2,
    page: 'album_home',
    action: 'tap',
    selector: '.upload-btn',
    name: '点击上传按钮',
    waitMs: 800,
    aiPrompt:
      '页面出现上传弹窗或选择器（媒体选择面板、ActionSheet 等），' +
      '显示从相册/拍照/视频等选项。'
  },
  {
    step: 3,
    page: 'media_detail',
    action: 'navigateTo',
    selector: '/pages/media_detail/index?id=test-1',
    name: '打开媒体详情',
    waitMs: 1200,
    aiPrompt:
      '页面为媒体详情页，显示媒体缩略图、宝宝年龄/拍摄时间等元信息，' +
      '布局简洁清晰。'
  },
  {
    step: 4,
    page: 'album_home',
    action: 'navigateBack',
    name: '返回相册列表',
    waitMs: 800,
    aiPrompt:
      '页面回到相册首页，媒体卡片列表仍正常显示，与步骤 1 类似。'
  },
  {
    step: 5,
    page: 'logs',
    action: 'navigateTo',
    selector: '/pages/logs/index',
    name: '跳转到日志页',
    waitMs: 800,
    aiPrompt:
      '页面为日志页，显示启动日志列表（包含时间戳/日志内容），' +
      '标题为"日志"或类似名称。'
  }
];
