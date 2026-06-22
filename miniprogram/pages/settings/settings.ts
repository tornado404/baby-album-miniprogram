// settings.ts - 我的/设置页面，对接后端 API
// 使用统一配置中心 API_CONFIG，支持运行时环境切换

import { API_CONFIG } from '../../config/api';
import { configService } from '../../services/config_service';
import { t, getLocale, setLocale, getAvailableLocales } from '../../utils/i18n';
import { STORAGE_KEYS } from '../../constants/storage_keys';
var tokenManager = require('../../services/request').tokenManager;

type Env = 'development' | 'testing' | 'production';

Page({
  data: {
    safeTop: 44,
    showDevPanel: false,  // 开发者面板默认隐藏
    userName: '星星妈妈',
    recordDays: 0,
    recordDaysText: '',
    photoCount: 0,
    videoCount: 0,
    modelCount: 0,
    achievementCount: 0,
    // Dark mode
    themeMode: 'auto',  // 'auto' | 'light' | 'dark'
    themeAttr: '',
    // i18n
    i18n: {},
    currentLocale: 'zh-CN',
    showLocalePicker: false,
    availableLocales: [],
    // 开发者面板
    envName: '',
    envDesc: '',
    environments: [],
    showEnvPicker: false,
    selectedEnv: '',
  },

  onLoad() {
    try {
      var info = wx.getWindowInfo();
      this.setData({ safeTop: info.statusBarHeight || 44 });
    } catch (e) {}

    this.loadThemeMode();
    this.applyI18n();
    this.loadStats();
    this.loadUserProfile();
  },

  onShow() {
    this.loadEnvInfo();
    this.applyI18n();
  },

  // ========== 数据加载 ==========

  loadStats() {
    var _this = this;
    var token = tokenManager.getAccessToken();

    // 读取当前宝宝 ID
    var babyId = '';
    try { babyId = wx.getStorageSync(STORAGE_KEYS.currentBabyId) || ''; } catch (e) {}

    // 加载统计数据（按宝宝筛选）
    var statsUrl = API_CONFIG.baseURL + '/analytics/stats';
    if (babyId) {
      statsUrl += '?baby_id=' + encodeURIComponent(babyId);
    }
    wx.request({
      url: statsUrl,
      method: 'GET',
      header: { 'Authorization': 'Bearer ' + token },
      timeout: 8000,
      success: function (res) {
        if (res.statusCode === 200 && res.data && res.data.data) {
          var d = res.data.data;
          _this.setData({
            photoCount: d.photoCount || 0,
            videoCount: d.videoCount || 0,
            modelCount: d.modelCount || 0,
            recordDays: d.recordDays || 0,
          });
          _this._updateRecordDaysText(d.recordDays || 0);
        }
      },
      fail: function () {},
    });

    // 加载成就
    wx.request({
      url: API_CONFIG.baseURL + '/analytics/achievements',
      method: 'GET',
      header: { 'Authorization': 'Bearer ' + token },
      timeout: 8000,
      success: function (res) {
        if (res.statusCode === 200 && res.data && res.data.data) {
          var unlocked = (res.data.data.badges || []).filter(function (b) { return b.unlocked; });
          _this.setData({ achievementCount: unlocked.length });
        }
      },
      fail: function () {},
    });
  },

  loadEnvInfo() {
    var currentEnv = configService.getCurrentEnv();
    var envName = configService.getCurrentEnvName();
    var envs = configService.getAvailableEnvs();

    this.setData({
      envName: envName || currentEnv,
      environments: envs,
      selectedEnv: currentEnv,
    });
  },

  // ========== 用户资料加载 ==========

  loadUserProfile() {
    var _this = this;
    var token = tokenManager.getAccessToken();
    if (!token) return;

    wx.request({
      url: API_CONFIG.baseURL + '/auth/me',
      method: 'GET',
      header: { 'Authorization': 'Bearer ' + token },
      timeout: 8000,
      success: function (res) {
        if (res.statusCode === 200 && res.data) {
          var d = res.data;
          _this.setData({
            userName: d.nickName || '',
            userAvatar: d.avatarUrl || '',
          });
        }
      },
      fail: function () {},
    });
  },

  // ========== 记录天数文本更新 ==========

  _updateRecordDaysText: function (days) {
    if (days === undefined) { days = this.data.recordDays; }
    var template = t('settings.recordDays') || '记录天数：{days}天';
    this.setData({ recordDaysText: template.replace('{days}', days || 0) });
  },

  // ========== 菜单导航 ==========

  onMenuTap(e) {
    var key = e.currentTarget.dataset.key;
    var routes = {
      baby_manage: '/pages/baby_list/baby_list',
      growth_compare: '/pages/growth_compare/growth_compare',
      achievements: '/pages/achievements/achievements',
      share: '/pages/share_settings/share_settings',
      privacy: '/pages/privacy_agreement/privacy_agreement?type=agreement',
      about: '/pages/about/about',
      export_data: '',
      export_report: '',
    };

    var url = routes[key];
    if (url) {
      wx.navigateTo({ url: url });
    } else if (key === 'export_data') {
      this.onExportData();
    } else if (key === 'export_report') {
      this.onExportReport();
    } else {
      wx.showToast({ title: '功能开发中', icon: 'none' });
    }
  },

  // ========== 成就徽章 ==========

  goToAchievements() {
    wx.navigateTo({ url: '/pages/achievements/achievements' });
  },

  // ========== 环境切换（开发者面板） ==========

  onEnvSwitchTap() {
    this.loadEnvInfo();
    this.setData({ showEnvPicker: true });
  },

  onEnvPickerClose() {
    this.setData({ showEnvPicker: false });
  },

  onEnvSelect(e) {
    var env = e.currentTarget.dataset.env;
    this.setData({ selectedEnv: env });
  },

  onConfirmSwitch() {
    var env = this.data.selectedEnv as Env;
    var _this = this;

    var success = configService.switchTo(env);
    if (!success) {
      wx.showToast({ title: '切换失败', icon: 'none' });
      return;
    }

    this.setData({ showEnvPicker: false });

    // 显示切换成功提示
    var envName = '';
    var envs = this.data.environments;
    for (var i = 0; i < envs.length; i++) {
      if (envs[i].key === env) {
        envName = envs[i].name;
        break;
      }
    }

    wx.showModal({
      title: '环境已切换',
      content: '当前环境：' + envName + '\n是否立即重启小程序使配置生效？',
      confirmText: '立即重启',
      cancelText: '稍后重启',
      success: function (res) {
        if (res.confirm) {
          try {
            wx.exitMiniProgram();
          } catch (e) {
            wx.showToast({
              title: '请手动关闭小程序重启',
              icon: 'none',
              duration: 3000,
            });
          }
        }
      },
    });
  },

  // ========== Dark Mode ==========

  loadThemeMode: function () {
    var mode = 'auto';
    try { mode = wx.getStorageSync('baby_diary_theme_mode') || 'auto'; } catch (e) {}
    this.setData({ themeMode: mode });
    this.applyTheme(mode);
  },

  onThemeTap: function () {
    var modes = ['auto', 'light', 'dark'];
    var current = this.data.themeMode;
    var nextIndex = 0;
    for (var i = 0; i < modes.length; i++) {
      if (modes[i] === current) { nextIndex = (i + 1) % modes.length; break; }
    }
    var nextMode = modes[nextIndex];
    this.setData({ themeMode: nextMode });
    try { wx.setStorageSync('baby_diary_theme_mode', nextMode); } catch (e) {}
    this.applyTheme(nextMode);
  },

  applyTheme: function (mode) {
    var pages = getCurrentPages();
    var currentPage = pages[pages.length - 1];
    if (currentPage) {
      if (mode === 'dark') {
        currentPage.setData({ themeAttr: 'dark' });
      } else if (mode === 'light') {
        currentPage.setData({ themeAttr: 'light' });
      } else {
        // auto - remove manual override, let system preference take over
        currentPage.setData({ themeAttr: '' });
      }
    }
  },

  // ========== i18n (OPT-07) ==========

  applyI18n: function () {
    var i18nData = {
      title: t('settings.title'),
      photos: t('settings.photos'),
      videos: t('settings.videos'),
      models: t('settings.models'),
      babyManage: t('settings.babyManage'),
      babyManageDesc: t('settings.babyManageDesc'),
      growthCompare: t('settings.growthCompare'),
      growthCompareDesc: t('settings.growthCompareDesc'),
      achievements: t('settings.achievements'),
      achievementsDesc: t('settings.achievementsDesc'),
      recordDays: t('settings.recordDays'),
      storage: t('settings.storage'),
      storageDesc: t('settings.storageDesc'),
      share: t('settings.share'),
      shareDesc: t('settings.shareDesc'),
      about: t('settings.about'),
      aboutDesc: t('settings.aboutDesc'),
      theme: t('settings.theme'),
      exportData: t('settings.exportData'),
      exportDataDesc: t('settings.exportDataDesc'),
      exportReport: t('settings.exportReport'),
      exportReportDesc: t('settings.exportReportDesc'),
      devSettings: t('settings.devSettings'),
    };

    var currentLocale = getLocale();
    var availableLocales = getAvailableLocales();
    this.setData({
      i18n: i18nData,
      currentLocale: currentLocale,
      availableLocales: availableLocales,
    });
    this._updateRecordDaysText();
  },

  onLocaleTap: function () {
    this.setData({ showLocalePicker: true });
  },

  onLocalePickerClose: function () {
    this.setData({ showLocalePicker: false });
  },

  onLocaleSelect: function (e) {
    var locale = e.currentTarget.dataset.locale;
    var success = setLocale(locale);
    if (success) {
      this.setData({ showLocalePicker: false });
      this.applyI18n();
      wx.showToast({ title: locale === 'zh-CN' ? '已切换为中文' : 'Switched to English', icon: 'success' });
    }
  },

  // ========== Data Export (OPT-08) ==========

  onExportData: function () {
    var token = tokenManager.getAccessToken();

    if (!token) {
      wx.showToast({ title: '请先登录', icon: 'none' });
      return;
    }

    wx.showLoading({ title: '导出中...' });
    wx.request({
      url: API_CONFIG.baseURL + '/export/data',
      method: 'POST',
      header: { 'Authorization': 'Bearer ' + token },
      timeout: 30000,
      success: function (res) {
        wx.hideLoading();
        if (res.statusCode === 200 && res.data) {
          // Save exported data to clipboard for now
          var jsonStr = JSON.stringify(res.data, null, 2);
          wx.setClipboardData({
            data: jsonStr,
            success: function () {
              wx.showToast({ title: '数据已复制到剪贴板', icon: 'success', duration: 2000 });
            },
          });
        } else {
          wx.showToast({ title: '导出失败', icon: 'none' });
        }
      },
      fail: function () {
        wx.hideLoading();
        wx.showToast({ title: '网络错误', icon: 'none' });
      },
    });
  },

  onExportReport: function () {
    var token = tokenManager.getAccessToken();

    if (!token) {
      wx.showToast({ title: '请先登录', icon: 'none' });
      return;
    }

    wx.showLoading({ title: '生成报告中...' });
    wx.request({
      url: API_CONFIG.baseURL + '/export/report',
      method: 'GET',
      header: { 'Authorization': 'Bearer ' + token },
      timeout: 30000,
      success: function (res) {
        wx.hideLoading();
        if (res.statusCode === 200 && res.data) {
          var jsonStr = JSON.stringify(res.data, null, 2);
          wx.setClipboardData({
            data: jsonStr,
            success: function () {
              wx.showToast({ title: '报告已复制到剪贴板', icon: 'success', duration: 2000 });
            },
          });
        } else {
          wx.showToast({ title: '生成失败', icon: 'none' });
        }
      },
      fail: function () {
        wx.hideLoading();
        wx.showToast({ title: '网络错误', icon: 'none' });
      },
    });
  },
});