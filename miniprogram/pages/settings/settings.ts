// @ts-nocheck
// settings.ts - 我的/设置页面，对接后端 API

const API_BASE = 'http://101.126.41.146:8000/api/v1';

Page({
  data: {
    safeTop: 44,
    userName: '星星妈妈',
    recordDays: 0,
    photoCount: 0,
    videoCount: 0,
    modelCount: 0,
    achievementCount: 0,
  },

  onLoad() {
    try {
      var info = wx.getWindowInfo();
      this.setData({ safeTop: info.statusBarHeight || 44 });
    } catch (e) {}

    this.loadStats();
  },

  loadStats() {
    var _this = this;
    var token = '';
    try { token = wx.getStorageSync('baby_diary_access_token') || ''; } catch (e) {}

    // 加载统计数据
    wx.request({
      url: API_BASE + '/analytics/stats',
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
      url: API_BASE + '/analytics/achievements',
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
});