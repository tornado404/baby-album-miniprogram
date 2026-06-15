// settings.ts - 我的/设置页面，对接后端 API
// 使用统一配置中心 API_CONFIG，支持运行时环境切换

import { API_CONFIG } from '../../config/api';
import { configService } from '../../services/config_service';

type Env = 'development' | 'testing' | 'production';

Page({
  data: {
    safeTop: 44,
    userName: '星星妈妈',
    recordDays: 0,
    photoCount: 0,
    videoCount: 0,
    modelCount: 0,
    achievementCount: 0,
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

    this.loadStats();
  },

  onShow() {
    this.loadEnvInfo();
  },

  // ========== 数据加载 ==========

  loadStats() {
    var _this = this;
    var token = '';
    try { token = wx.getStorageSync('baby_diary_access_token') || ''; } catch (e) {}

    // 加载统计数据
    wx.request({
      url: API_CONFIG.baseURL + '/analytics/stats',
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

  // ========== 菜单导航 ==========

  onMenuTap(e) {
    var key = e.currentTarget.dataset.key;
    var routes = {
      baby_manage: '/pages/baby_list/baby_list',
      growth_compare: '',
      achievements: '',
      storage: '',
      share: '',
      about: '',
    };

    var url = routes[key];
    if (url) {
      if (key === 'baby_manage') {
        wx.navigateTo({ url: url });
      } else {
        wx.showToast({ title: '功能开发中', icon: 'none' });
      }
    } else {
      wx.showToast({ title: '功能开发中', icon: 'none' });
    }
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
});