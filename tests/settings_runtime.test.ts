/**
 * settings_runtime.test.ts - 设置页运行时单元测试
 *
 * 覆盖场景：
 * - 页面创建与初始数据
 * - onLoad / onShow 生命周期
 * - loadStats（统计 + 成就 API）
 * - loadUserProfile
 * - 主题切换（auto / light / dark）
 * - 国际化（applyI18n / locale 切换）
 * - 环境切换（开发者面板）
 * - 菜单导航
 * - 数据导出
 * - _updateRecordDaysText
 */

var mockStorage: Record<string, any> = {};

function clearMockStorage(): void {
  for (var key in mockStorage) {
    if (mockStorage.hasOwnProperty(key)) {
      delete mockStorage[key];
    }
  }
}

// 记录 Page() 回调
var mockPageConfig: Record<string, any> = {};
var mockSetDataHistory: Array<Record<string, any>> = [];
var mockGetCurrentPagesResult: any = null;

(global as any).Page = function (config: any) {
  mockPageConfig = config;
  config.setData = function (data: any) {
    mockSetDataHistory.push(data);
    Object.assign(config.data, data);
  };
  return config;
};

(global as any).getCurrentPages = function () {
  if (mockGetCurrentPagesResult) { return mockGetCurrentPagesResult; }
  return [mockPageConfig];
};

// mock 记录
var mockRequests: Array<{ url: string; method: string; data: any; header: any }> = [];
var mockShowToastCalls: Array<{ title: string; icon?: string }> = [];
var mockShowLoadingCalls = 0;
var mockHideLoadingCalls = 0;
var mockShowModalCalls: Array<{ title: string; content: string }> = [];
var mockClipboardData = '';
var mockNavigateToCalls: Array<string> = [];

function setupWxMock(): void {
  (global as any).wx = {
    getStorageSync: function (key: string) {
      return mockStorage[key] !== undefined ? mockStorage[key] : '';
    },
    setStorageSync: function (key: string, value: any) { mockStorage[key] = value; },
    removeStorageSync: function (key: string) { delete mockStorage[key]; },

    getWindowInfo: function () { return { statusBarHeight: 44 }; },
    getSystemInfoSync: function () { return { language: 'zh_CN' }; },

    request: function (opts: any) {
      mockRequests.push({ url: opts.url, method: opts.method, data: opts.data, header: opts.header });
      if (typeof mockRequestSuccess === 'function') {
        mockRequestSuccess(opts);
      } else {
        opts.success({ statusCode: 200, data: {} });
      }
    },

    showToast: function (opts: any) {
      mockShowToastCalls.push({ title: opts.title, icon: opts.icon });
    },
    showLoading: function () { mockShowLoadingCalls++; },
    hideLoading: function () { mockHideLoadingCalls++; },
    showModal: function (opts: any) {
      mockShowModalCalls.push({ title: opts.title, content: opts.content });
      if (typeof mockModalSuccess === 'function') {
        mockModalSuccess(opts);
      }
    },
    setClipboardData: function (opts: any) {
      mockClipboardData = opts.data;
      if (opts.success) { opts.success(); }
    },
    navigateTo: function (opts: any) { mockNavigateToCalls.push(opts.url); },
    exitMiniProgram: function () {},
    navigateBack: function () {},
  };
}

var mockRequestSuccess: ((opts: any) => void) | null = null;
var mockModalSuccess: ((opts: any) => void) | null = null;

// i18n 模块引用，用于在 beforeEach 中重置 locale
var i18nModule: any = null;

var settingsInstance: any = null;

// 保存初始 data 用于 beforeEach 重置
var initialDataSnapshot: Record<string, any>;

describe('设置页运行时测试', function () {
  beforeAll(function () {
    setupWxMock();
    mockStorage['baby_diary_theme_mode'] = 'auto';
    i18nModule = require('../miniprogram/utils/i18n');
    require('../miniprogram/pages/settings/settings.js');
    settingsInstance = mockPageConfig;
    // 快照初始 data
    initialDataSnapshot = JSON.parse(JSON.stringify(settingsInstance.data));
  });

  beforeEach(function () {
    clearMockStorage();
    mockStorage['baby_diary_theme_mode'] = 'auto';
    // 默认设置 token 避免大部分测试因无 token 跳过 API 调用
    mockStorage['baby_diary_access_token'] = 'test-access-token';
    // 重置 i18n locale 到 zh-CN
    if (i18nModule) { i18nModule.setLocale('zh-CN'); }
    // 重置 mock 计数
    mockRequests = [];
    mockShowToastCalls = [];
    mockShowLoadingCalls = 0;
    mockHideLoadingCalls = 0;
    mockShowModalCalls = [];
    mockClipboardData = '';
    mockNavigateToCalls = [];
    mockSetDataHistory = [];
    mockRequestSuccess = null;
    mockModalSuccess = null;
    mockGetCurrentPagesResult = null;
    // 恢复可能被某个测试覆盖的 storage 函数
    (global as any).wx.getStorageSync = function (key: string) {
      return mockStorage[key] !== undefined ? mockStorage[key] : '';
    };
    (global as any).wx.setStorageSync = function (key: string, value: any) { mockStorage[key] = value; };
    // 重置 data 到初始状态
    if (initialDataSnapshot) {
      var keys = Object.keys(settingsInstance.data);
      for (var i = 0; i < keys.length; i++) {
        delete settingsInstance.data[keys[i]];
      }
      Object.assign(settingsInstance.data, JSON.parse(JSON.stringify(initialDataSnapshot)));
    }
  });

  afterAll(function () {
    delete (global as any).Page;
    delete (global as any).getCurrentPages;
    delete (global as any).wx;
  });

  // ==================== 页面创建 ====================

  describe('页面创建', function () {
    test('应包含初始 data 字段', function () {
      expect(settingsInstance.data).toBeDefined();
      expect(settingsInstance.data.safeTop).toBe(44);
      expect(settingsInstance.data.userName).toBe('星星妈妈');
      expect(settingsInstance.data.recordDays).toBe(0);
      expect(settingsInstance.data.photoCount).toBe(0);
      expect(settingsInstance.data.videoCount).toBe(0);
      expect(settingsInstance.data.modelCount).toBe(0);
      expect(settingsInstance.data.achievementCount).toBe(0);
      expect(settingsInstance.data.themeMode).toBe('auto');
      expect(settingsInstance.data.showLocalePicker).toBe(false);
      expect(settingsInstance.data.showEnvPicker).toBe(false);
    });

    test('应有所有方法', function () {
      expect(typeof settingsInstance.onLoad).toBe('function');
      expect(typeof settingsInstance.onShow).toBe('function');
      expect(typeof settingsInstance.loadStats).toBe('function');
      expect(typeof settingsInstance.loadUserProfile).toBe('function');
      expect(typeof settingsInstance.loadEnvInfo).toBe('function');
      expect(typeof settingsInstance.loadThemeMode).toBe('function');
      expect(typeof settingsInstance.onThemeTap).toBe('function');
      expect(typeof settingsInstance.applyTheme).toBe('function');
      expect(typeof settingsInstance.applyI18n).toBe('function');
      expect(typeof settingsInstance.onMenuTap).toBe('function');
      expect(typeof settingsInstance.onExportData).toBe('function');
      expect(typeof settingsInstance.onExportReport).toBe('function');
      expect(typeof settingsInstance.onLocaleTap).toBe('function');
      expect(typeof settingsInstance.onLocaleSelect).toBe('function');
      expect(typeof settingsInstance.onEnvSwitchTap).toBe('function');
	      expect(typeof settingsInstance.goToAchievements).toBe('function');
      expect(typeof settingsInstance.onEnvSelect).toBe('function');
      expect(typeof settingsInstance.onConfirmSwitch).toBe('function');
    });
  });

  // ==================== onLoad ====================

  describe('onLoad', function () {
    test('应设置 safeTop 并加载主题/国际化/统计/用户信息', function () {
      settingsInstance.onLoad();
      expect(settingsInstance.data.safeTop).toBe(44);
      expect(settingsInstance.data.themeMode).toBe('auto');
      expect(settingsInstance.data.i18n).toBeDefined();
      expect(settingsInstance.data.i18n.title).toBe('我的');
      // 应发出 API 请求
      var statsFound = false;
      var achievementsFound = false;
      var authFound = false;
      for (var i = 0; i < mockRequests.length; i++) {
        var url = mockRequests[i].url;
        if (url.indexOf('/analytics/stats') >= 0) { statsFound = true; }
        if (url.indexOf('/analytics/achievements') >= 0) { achievementsFound = true; }
        if (url.indexOf('/auth/me') >= 0) { authFound = true; }
      }
      expect(statsFound).toBe(true);
      expect(achievementsFound).toBe(true);
      expect(authFound).toBe(true);
    });

    test('getWindowInfo 异常时 safeTop 应为默认 44', function () {
      (global as any).wx.getWindowInfo = function () { throw new Error('fail'); };
      settingsInstance.onLoad();
      expect(settingsInstance.data.safeTop).toBe(44);
    });

    test('statusBarHeight 为 0 时应使用默认值 44', function () {
      (global as any).wx.getWindowInfo = function () { return { statusBarHeight: 0 }; };
      settingsInstance.onLoad();
      expect(settingsInstance.data.safeTop).toBe(44);
      (global as any).wx.getWindowInfo = function () { return { statusBarHeight: 44 }; };
    });
  });

  // ==================== onShow ====================

  describe('onShow', function () {
    test('应加载环境信息并应用国际化', function () {
      settingsInstance.onShow();
      expect(settingsInstance.data.envName).toBe('测试服务器');
      expect(settingsInstance.data.envName.length).toBeGreaterThan(0);
      expect(settingsInstance.data.i18n.title).toBe('我的');
    });
  });

  // ==================== _updateRecordDaysText ====================

  describe('_updateRecordDaysText', function () {
    test('传入天数应更新 recordDaysText', function () {
      settingsInstance._updateRecordDaysText(42);
      expect(settingsInstance.data.recordDaysText).toBe('记录天数：42天');
    });

    test('不传参数应使用 data.recordDays', function () {
      settingsInstance.data.recordDays = 10;
      settingsInstance._updateRecordDaysText();
      expect(settingsInstance.data.recordDaysText).toBe('记录天数：10天');
    });
  });

  // ==================== loadStats ====================

  describe('loadStats', function () {
    test('成功应设置统计数据和成就数', function () {
      mockRequestSuccess = function (opts: any) {
        if (opts.url.indexOf('/analytics/stats') >= 0) {
          opts.success({
            statusCode: 200,
            data: { data: { photoCount: 10, videoCount: 5, modelCount: 2, recordDays: 30 } },
          });
        } else if (opts.url.indexOf('/analytics/achievements') >= 0) {
          opts.success({
            statusCode: 200,
            data: { data: { badges: [{ unlocked: true }, { unlocked: false }, { unlocked: true }] } },
          });
        } else {
          opts.success({ statusCode: 200, data: {} });
        }
      };
      settingsInstance.loadStats();
      expect(settingsInstance.data.photoCount).toBe(10);
      expect(settingsInstance.data.videoCount).toBe(5);
      expect(settingsInstance.data.modelCount).toBe(2);
      expect(settingsInstance.data.achievementCount).toBe(2);
      expect(settingsInstance.data.recordDaysText).toBe('记录天数：30天');
    });

    test('API 返回非 200 不应修改数据', function () {
      var origPhoto = settingsInstance.data.photoCount;
      mockRequestSuccess = function (opts: any) {
        opts.success({ statusCode: 500, data: {} });
      };
      settingsInstance.loadStats();
      expect(settingsInstance.data.photoCount).toBe(origPhoto);
    });

    test('API 失败不应抛出异常', function () {
      mockRequestSuccess = function (opts: any) {
        if (opts.fail) { opts.fail({ errMsg: 'timeout' }); }
      };
      expect(function () { settingsInstance.loadStats(); }).not.toThrow();
    });
  });

  // ==================== loadUserProfile ====================

  describe('loadUserProfile', function () {
    test('成功应设置用户名和头像', function () {
      mockRequestSuccess = function (opts: any) {
        opts.success({
          statusCode: 200,
          data: { nickName: '测试妈妈', avatarUrl: 'http://example.com/avatar.jpg' },
        });
      };
      settingsInstance.loadUserProfile();
      expect(settingsInstance.data.userName).toBe('测试妈妈');
      expect(settingsInstance.data.userAvatar).toBe('http://example.com/avatar.jpg');
    });

    test('无 token 应跳过 API 调用', function () {
      // mockRequestSuccess 设为抛出异常，确保 API 不被调用
      var apiCalled = false;
      mockRequestSuccess = function () { apiCalled = true; };
      mockStorage['baby_diary_access_token'] = '';
      // 重新读取 token（resetModules 不可用，这里模拟 token 为空）
      settingsInstance.loadUserProfile();
      expect(apiCalled).toBe(false);
    });

    test('API 失败不应抛出异常', function () {
      mockRequestSuccess = function (opts: any) {
        if (opts.fail) { opts.fail({ errMsg: 'timeout' }); }
      };
      expect(function () { settingsInstance.loadUserProfile(); }).not.toThrow();
    });
  });

  // ==================== onMenuTap ====================

  describe('onMenuTap', function () {
    test('已知路由应 navigateTo', function () {
      settingsInstance.onMenuTap({ currentTarget: { dataset: { key: 'baby_manage' } } });
      expect(mockNavigateToCalls).toContain('/pages/baby_list/baby_list');
    });

    test('achievements 应跳转到成就页', function () {
      settingsInstance.onMenuTap({ currentTarget: { dataset: { key: 'achievements' } } });
      expect(mockNavigateToCalls).toContain('/pages/achievements/achievements');
    });

    test('goToAchievements 应跳转到成就页', function () {
      settingsInstance.goToAchievements();
      expect(mockNavigateToCalls).toContain('/pages/achievements/achievements');
    });

    test('export_data 应调用 onExportData', function () {
      var spyCalled = false;
      var orig = settingsInstance.onExportData;
      settingsInstance.onExportData = function () { spyCalled = true; };
      settingsInstance.onMenuTap({ currentTarget: { dataset: { key: 'export_data' } } });
      expect(spyCalled).toBe(true);
      settingsInstance.onExportData = orig;
    });

    test('export_report 应调用 onExportReport', function () {
      var spyCalled = false;
      var orig = settingsInstance.onExportReport;
      settingsInstance.onExportReport = function () { spyCalled = true; };
      settingsInstance.onMenuTap({ currentTarget: { dataset: { key: 'export_report' } } });
      expect(spyCalled).toBe(true);
      settingsInstance.onExportReport = orig;
    });

    test('未知 key 应 showToast 功能开发中', function () {
      settingsInstance.onMenuTap({ currentTarget: { dataset: { key: 'unknown_feature' } } });
      expect(mockShowToastCalls.length).toBeGreaterThan(0);
      expect(mockShowToastCalls[0].title).toBe('功能开发中');
    });
  });

  // ==================== 主题 ====================

  describe('loadThemeMode', function () {
    test('应从存储读取主题并应用', function () {
      mockStorage['baby_diary_theme_mode'] = 'dark';
      settingsInstance.loadThemeMode();
      expect(settingsInstance.data.themeMode).toBe('dark');
    });

    test('存储读取异常应默认 auto', function () {
      (global as any).wx.getStorageSync = function () { throw new Error('fail'); };
      settingsInstance.loadThemeMode();
      expect(settingsInstance.data.themeMode).toBe('auto');
    });
  });

  describe('onThemeTap', function () {
    test('应从 auto 切换到 light', function () {
      settingsInstance.data.themeMode = 'auto';
      settingsInstance.onThemeTap();
      expect(settingsInstance.data.themeMode).toBe('light');
      expect(mockStorage['baby_diary_theme_mode']).toBe('light');
    });

    test('应从 light 切换到 dark', function () {
      settingsInstance.data.themeMode = 'light';
      settingsInstance.onThemeTap();
      expect(settingsInstance.data.themeMode).toBe('dark');
    });

    test('应从 dark 切换到 auto', function () {
      settingsInstance.data.themeMode = 'dark';
      settingsInstance.onThemeTap();
      expect(settingsInstance.data.themeMode).toBe('auto');
    });

    test('存储写入异常不应抛出', function () {
      (global as any).wx.setStorageSync = function () { throw new Error('fail'); };
      settingsInstance.data.themeMode = 'auto';
      expect(function () { settingsInstance.onThemeTap(); }).not.toThrow();
    });
  });

  describe('applyTheme', function () {
    test('dark 模式应设置 themeAttr 为 dark', function () {
      var target: any = { setData: function (d: any) { Object.assign(this, d); } };
      mockGetCurrentPagesResult = [target];
      settingsInstance.applyTheme('dark');
      expect(target.themeAttr).toBe('dark');
    });

    test('light 模式应设置 themeAttr 为 light', function () {
      var target: any = { setData: function (d: any) { Object.assign(this, d); } };
      mockGetCurrentPagesResult = [target];
      settingsInstance.applyTheme('light');
      expect(target.themeAttr).toBe('light');
    });

    test('auto 模式应清除 themeAttr', function () {
      var target: any = { setData: function (d: any) { Object.assign(this, d); } };
      mockGetCurrentPagesResult = [target];
      settingsInstance.applyTheme('auto');
      expect(target.themeAttr).toBe('');
    });
  });

  // ==================== i18n ====================

  describe('applyI18n', function () {
    test('应设置 i18n 数据和当前 locale', function () {
      settingsInstance.applyI18n();
      expect(settingsInstance.data.i18n.title).toBe('我的');
      expect(settingsInstance.data.i18n.photos).toBe('照片');
      expect(settingsInstance.data.currentLocale).toBe('zh-CN');
      expect(settingsInstance.data.availableLocales.length).toBe(2);
    });
  });

  describe('onLocaleTap', function () {
    test('应显示语言选择器', function () {
      settingsInstance.onLocaleTap();
      expect(settingsInstance.data.showLocalePicker).toBe(true);
    });
  });

  describe('onLocalePickerClose', function () {
    test('应关闭语言选择器', function () {
      settingsInstance.data.showLocalePicker = true;
      settingsInstance.onLocalePickerClose();
      expect(settingsInstance.data.showLocalePicker).toBe(false);
    });
  });

  describe('onLocaleSelect', function () {
    test('选择有效语言应切换并提示', function () {
      settingsInstance.onLocaleSelect({ currentTarget: { dataset: { locale: 'en-US' } } });
      expect(settingsInstance.data.showLocalePicker).toBe(false);
      expect(settingsInstance.data.i18n.title).toBe('Me');
      var found = false;
      for (var i = 0; i < mockShowToastCalls.length; i++) {
        if (mockShowToastCalls[i].title === 'Switched to English') { found = true; break; }
      }
      expect(found).toBe(true);
    });

    test('选择无效语言不切换', function () {
      settingsInstance.onLocaleSelect({ currentTarget: { dataset: { locale: 'fr-FR' } } });
      // 未切换，需要手动调用 applyI18n 检查中文
      settingsInstance.applyI18n();
      expect(settingsInstance.data.i18n.title).toBe('我的');
    });
  });

  // ==================== 环境切换 ====================

  describe('onEnvSwitchTap', function () {
    test('应加载环境信息并显示选择器', function () {
      settingsInstance.onEnvSwitchTap();
      expect(settingsInstance.data.showEnvPicker).toBe(true);
      expect(settingsInstance.data.envName).toBe('测试服务器');
      expect(settingsInstance.data.environments.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('onEnvPickerClose', function () {
    test('应关闭环境选择器', function () {
      settingsInstance.data.showEnvPicker = true;
      settingsInstance.onEnvPickerClose();
      expect(settingsInstance.data.showEnvPicker).toBe(false);
    });
  });

  describe('onEnvSelect', function () {
    test('应设置 selectedEnv', function () {
      settingsInstance.onEnvSelect({ currentTarget: { dataset: { env: 'production' } } });
      expect(settingsInstance.data.selectedEnv).toBe('production');
    });
  });

  describe('onConfirmSwitch', function () {
    test('切换后应显示确认对话框', function () {
      settingsInstance.onEnvSelect({ currentTarget: { dataset: { env: 'development' } } });
      settingsInstance.onConfirmSwitch();
      expect(settingsInstance.data.showEnvPicker).toBe(false);
      var hasModal = mockShowModalCalls.length > 0;
      var hasToast = mockShowToastCalls.some(function (t) { return t.title === '切换失败'; });
      expect(hasModal || hasToast).toBe(true);
    });

    test('无效环境应显示切换失败', function () {
      // 先确保 environments 数组里有数据（模拟 loadEnvInfo 后的状态）
      settingsInstance.data.environments = [
        { key: 'development', name: '开发环境' },
        { key: 'production', name: '生产环境' },
      ];
      settingsInstance.data.selectedEnv = 'invalid_env';
      settingsInstance.onConfirmSwitch();
      expect(mockShowToastCalls.some(function (t) { return t.title === '切换失败'; })).toBe(true);
    });

    test('成功切换应显示确认重启对话框', function () {
      settingsInstance.data.environments = [
        { key: 'development', name: '开发环境' },
        { key: 'production', name: '生产环境' },
      ];
      settingsInstance.onEnvSelect({ currentTarget: { dataset: { env: 'development' } } });
      settingsInstance.onConfirmSwitch();
      // 应该显示 envName 的确认框
      var modal = mockShowModalCalls.find(function (m) { return m.title === '环境已切换'; });
      expect(modal).toBeDefined();
      if (modal) { expect(modal.content).toContain('开发环境'); }
    });

    test('确认重启应调用 exitMiniProgram', function () {
      var exitCalled = false;
      (global as any).wx.exitMiniProgram = function () { exitCalled = true; };
      settingsInstance.data.environments = [
        { key: 'development', name: '开发环境' },
      ];
      settingsInstance.onEnvSelect({ currentTarget: { dataset: { env: 'development' } } });
      // 拦截 modal success 并确认
      mockModalSuccess = function (opts: any) { opts.success({ confirm: true }); };
      settingsInstance.onConfirmSwitch();
      expect(exitCalled).toBe(true);
    });

    test('exitMiniProgram 异常应显示提示', function () {
      (global as any).wx.exitMiniProgram = function () { throw new Error('fail'); };
      settingsInstance.data.environments = [
        { key: 'development', name: '开发环境' },
      ];
      settingsInstance.onEnvSelect({ currentTarget: { dataset: { env: 'development' } } });
      mockModalSuccess = function (opts: any) { opts.success({ confirm: true }); };
      settingsInstance.onConfirmSwitch();
      expect(mockShowToastCalls.some(function (t) { return t.title === '请手动关闭小程序重启'; })).toBe(true);
    });
  });

  // ==================== 数据导出 ====================

  describe('onExportData', function () {
    test('成功应复制数据到剪贴板', function () {
      mockStorage['baby_diary_access_token'] = 'test-token';
      mockRequestSuccess = function (opts: any) {
        opts.success({ statusCode: 200, data: { photos: 10, videos: 5 } });
      };
      settingsInstance.onExportData();
      expect(mockShowLoadingCalls).toBe(1);
      expect(mockHideLoadingCalls).toBe(1);
      expect(mockClipboardData).toContain('photos');
    });

    test('API 错误应显示 toast', function () {
      mockStorage['baby_diary_access_token'] = 'test-token';
      mockRequestSuccess = function (opts: any) {
        opts.success({ statusCode: 400, data: {} });
      };
      settingsInstance.onExportData();
      var found = mockShowToastCalls.some(function (t) { return t.title === '导出失败'; });
      expect(found).toBe(true);
    });

    test('网络错误应显示 toast', function () {
      mockStorage['baby_diary_access_token'] = 'test-token';
      mockRequestSuccess = function (opts: any) {
        if (opts.fail) { opts.fail({ errMsg: 'timeout' }); }
      };
      settingsInstance.onExportData();
      var found = mockShowToastCalls.some(function (t) { return t.title === '网络错误'; });
      expect(found).toBe(true);
    });

    test('无 token 应提示登录', function () {
      mockStorage['baby_diary_access_token'] = '';
      settingsInstance.onExportData();
      var found = mockShowToastCalls.some(function (t) { return t.title === '请先登录'; });
      expect(found).toBe(true);
    });
  });

  describe('onExportReport', function () {
    test('成功应复制报告到剪贴板', function () {
      mockStorage['baby_diary_access_token'] = 'test-token';
      mockRequestSuccess = function (opts: any) {
        opts.success({ statusCode: 200, data: { summary: '宝宝成长良好' } });
      };
      settingsInstance.onExportReport();
      expect(mockShowLoadingCalls).toBe(1);
      expect(mockHideLoadingCalls).toBe(1);
      expect(mockClipboardData).toContain('成长良好');
    });

    test('API 错误应显示 toast', function () {
      mockStorage['baby_diary_access_token'] = 'test-token';
      mockRequestSuccess = function (opts: any) {
        opts.success({ statusCode: 500, data: {} });
      };
      settingsInstance.onExportReport();
      var found = mockShowToastCalls.some(function (t) { return t.title === '生成失败'; });
      expect(found).toBe(true);
    });

    test('网络错误应显示 toast', function () {
      mockStorage['baby_diary_access_token'] = 'test-token';
      mockRequestSuccess = function (opts: any) {
        if (opts.fail) { opts.fail({ errMsg: 'timeout' }); }
      };
      settingsInstance.onExportReport();
      var found = mockShowToastCalls.some(function (t) { return t.title === '网络错误'; });
      expect(found).toBe(true);
    });

    test('无 token 应提示登录', function () {
      mockStorage['baby_diary_access_token'] = '';
      settingsInstance.onExportReport();
      var found = mockShowToastCalls.some(function (t) { return t.title === '请先登录'; });
      expect(found).toBe(true);
    });
  });
});

export {};