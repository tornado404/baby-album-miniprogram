// i18n.ts - 国际化多语言支持
// 提供 t(key) 翻译函数和 setLocale(locale) 切换语言
// 注意：不使用 ?. 和 ?? 语法，兼容微信小程序 runtime

// ========== 语言包 ==========

var zhCN: Record<string, string> = {
  // 设置页
  'settings.title': '我的',
  'settings.userName': '星星妈妈',
  'settings.recordDays': '记录天数：{days}天',
  'settings.photos': '照片',
  'settings.videos': '视频',
  'settings.models': '3D模型',
  'settings.babyManage': '宝宝管理',
  'settings.babyManageDesc': '管理宝宝档案',
  'settings.growthCompare': '成长对比',
  'settings.growthCompareDesc': '照片前后对比',
  'settings.achievements': '成就徽章',
  'settings.achievementsDesc': '查看已获得的徽章',
  'settings.storage': '存储管理',
  'settings.storageDesc': '管理本地和云端存储',
  'settings.share': '分享设置',
  'settings.shareDesc': '家人共享设置',
  'settings.about': '关于',
  'settings.aboutDesc': '版本 1.0.0',
  'settings.theme': '外观模式',
  'settings.themeAuto': '跟随系统',
  'settings.themeDark': '暗黑模式',
  'settings.themeLight': '浅色模式',
  'settings.exportData': '导出数据',
  'settings.exportDataDesc': '导出所有数据为 JSON',
  'settings.exportReport': '成长报告',
  'settings.exportReportDesc': '生成宝宝成长报告',
  'settings.devSettings': '开发者设置',

  // 分享设置页
  'share.title': '分享设置',
  'share.emptyList': '暂无共享关系',
  'share.emptyHint': '邀请家人一起记录宝宝成长',
  'share.inviteFamily': '邀请家人',
  'share.viewer': '仅查看',
  'share.editor': '可编辑',
  'share.revoke': '取消共享',
  'share.revokeConfirm': '确定要取消此共享关系吗？',
  'share.createInvite': '生成邀请',
  'share.selectBaby': '选择宝宝',
  'share.permission': '权限',
  'share.inviteCode': '邀请码',
  'share.copy': '复制',

  // 首页
  'home.title': '宝宝成长日记',
  'home.selectBaby': '选择宝宝',
  'home.all': '全部',
  'home.loading': '加载中...',
  'home.empty': '暂无照片，上传第一张记录',
  'home.uploadPhoto': '上传照片',
  'home.noTitle': '无标题',
  'home.records': '{count}张记录',

  // 通用
  'common.cancel': '取消',
  'common.confirm': '确认',
  'common.loading': '加载中...',
  'common.networkError': '网络错误',
  'common.loginFirst': '请先登录',
  'common.comingSoon': '功能开发中',
};

var enUS: Record<string, string> = {
  // Settings
  'settings.title': 'Me',
  'settings.userName': 'Star Mom',
  'settings.recordDays': 'Days recorded: {days}',
  'settings.photos': 'Photos',
  'settings.videos': 'Videos',
  'settings.models': '3D Models',
  'settings.babyManage': 'Baby Management',
  'settings.babyManageDesc': 'Manage baby profiles',
  'settings.growthCompare': 'Growth Compare',
  'settings.growthCompareDesc': 'Before & after photos',
  'settings.achievements': 'Achievements',
  'settings.achievementsDesc': 'View earned badges',
  'settings.storage': 'Storage',
  'settings.storageDesc': 'Manage local & cloud storage',
  'settings.share': 'Share Settings',
  'settings.shareDesc': 'Family sharing settings',
  'settings.about': 'About',
  'settings.aboutDesc': 'Version 1.0.0',
  'settings.theme': 'Appearance',
  'settings.themeAuto': 'Follow System',
  'settings.themeDark': 'Dark Mode',
  'settings.themeLight': 'Light Mode',
  'settings.exportData': 'Export Data',
  'settings.exportDataDesc': 'Export all data as JSON',
  'settings.exportReport': 'Growth Report',
  'settings.exportReportDesc': 'Generate baby growth report',
  'settings.devSettings': 'Developer Settings',

  // Share
  'share.title': 'Share Settings',
  'share.emptyList': 'No sharing relationships',
  'share.emptyHint': 'Invite family to record baby growth together',
  'share.inviteFamily': 'Invite Family',
  'share.viewer': 'View Only',
  'share.editor': 'Can Edit',
  'share.revoke': 'Revoke',
  'share.revokeConfirm': 'Are you sure you want to revoke this sharing?',
  'share.createInvite': 'Create Invite',
  'share.selectBaby': 'Select Baby',
  'share.permission': 'Permission',
  'share.inviteCode': 'Invite Code',
  'share.copy': 'Copy',

  // Home
  'home.title': 'Baby Growth Diary',
  'home.selectBaby': 'Select Baby',
  'home.all': 'All',
  'home.loading': 'Loading...',
  'home.empty': 'No photos yet, upload the first one',
  'home.uploadPhoto': 'Upload Photo',
  'home.noTitle': 'Untitled',
  'home.records': '{count} records',

  // Common
  'common.cancel': 'Cancel',
  'common.confirm': 'Confirm',
  'common.loading': 'Loading...',
  'common.networkError': 'Network error',
  'common.loginFirst': 'Please login first',
  'common.comingSoon': 'Coming soon',
};

// ========== 语言包映射 ==========

var LANG_PACKS: Record<string, Record<string, string>> = {
  'zh-CN': zhCN,
  'en-US': enUS,
};

// ========== 当前语言 ==========

var _currentLocale = 'zh-CN';

var LOCALE_STORAGE_KEY = 'baby_diary_locale';

/**
 * 初始化语言设置（从缓存读取或使用系统语言）
 */
function initLocale(): void {
  var saved = '';
  try { saved = wx.getStorageSync(LOCALE_STORAGE_KEY) || ''; } catch (e) {}

  if (saved && LANG_PACKS[saved]) {
    _currentLocale = saved;
    return;
  }

  // 使用系统语言
  try {
    var sysInfo = wx.getSystemInfoSync();
    var lang = sysInfo.language || 'zh_CN';
    // Normalize: zh_CN -> zh-CN, en -> en-US
    if (lang.indexOf('zh') >= 0) {
      _currentLocale = 'zh-CN';
    } else {
      _currentLocale = 'en-US';
    }
  } catch (e) {
    _currentLocale = 'zh-CN';
  }
}

/**
 * 获取当前语言
 */
function getLocale(): string {
  return _currentLocale;
}

/**
 * 设置语言
 */
function setLocale(locale: string): boolean {
  if (!LANG_PACKS[locale]) {
    return false;
  }
  _currentLocale = locale;
  try { wx.setStorageSync(LOCALE_STORAGE_KEY, locale); } catch (e) {}
  return true;
}

/**
 * 翻译函数
 * @param key - 翻译键，如 'settings.title'
 * @param params - 可选参数，用于替换 {name} 占位符
 */
function t(key: string, params?: Record<string, string | number>): string {
  var pack = LANG_PACKS[_currentLocale];
  if (!pack) {
    pack = zhCN;
  }

  var value = pack[key];
  if (!value) {
    // 回退到中文
    value = zhCN[key];
  }
  if (!value) {
    return key;
  }

  // 替换参数
  if (params) {
    var keys = Object.keys(params);
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      value = value.replace('{' + k + '}', String(params[k]));
    }
  }

  return value;
}

/**
 * 获取所有可用的语言列表
 */
function getAvailableLocales(): Array<{ key: string; name: string }> {
  return [
    { key: 'zh-CN', name: '中文' },
    { key: 'en-US', name: 'English' },
  ];
}

// 初始化
initLocale();

export { t, getLocale, setLocale, getAvailableLocales, LOCALE_STORAGE_KEY };
