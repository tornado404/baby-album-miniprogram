// @ts-nocheck
// index.ts - 入口路由页
// 检测登录状态，未登录跳转 onboarding，已登录跳转 album_home
// 修复：token 存在但本地无宝宝缓存时，先查 API 再决定跳转

var TOKEN_KEY = 'baby_diary_access_token';
var BABY_KEY = 'baby_diary_baby_profile';
var API_BASE = require('../../config/api').API_CONFIG.baseURL;

Page({
  onLoad: function () {
    this.routeToTarget();
  },

  routeToTarget: function () {
    var token = '';
    try { token = wx.getStorageSync(TOKEN_KEY) || ''; } catch (e) {}

    if (token) {
      var babyProfile = wx.getStorageSync(BABY_KEY);
      if (babyProfile) {
        wx.reLaunch({ url: '/pages/album_home/album_home' });
      } else {
        // 本地无宝宝缓存 → 查 API 确认是否已有宝宝
        this.checkBabiesFromApi(token);
      }
    } else {
      wx.reLaunch({ url: '/pages/onboarding/onboarding' });
    }
  },

  checkBabiesFromApi: function (token) {
    var _this = this;
    wx.request({
      url: API_BASE + '/babies/',
      method: 'GET',
      header: { 'Authorization': 'Bearer ' + token },
      timeout: 8000,
      success: function (res) {
        if (res.statusCode === 200 && Array.isArray(res.data) && res.data.length > 0) {
          // 服务端已有宝宝 → 缓存并跳转首页
          var babies = res.data;
          try { wx.setStorageSync('album_babies', babies); } catch (e) {}
          try { wx.setStorageSync(BABY_KEY, babies[0]); } catch (e) {}
          try { wx.setStorageSync('baby_diary_current_baby_id', babies[0].id); } catch (e) {}
          wx.reLaunch({ url: '/pages/album_home/album_home' });
        } else {
          // 确实没有宝宝 → 跳新建页
          wx.reLaunch({ url: '/pages/baby_onboarding/baby_onboarding' });
        }
      },
      fail: function () {
        // 网络不可用 → 跳新建页（用户可离线创建）
        wx.reLaunch({ url: '/pages/baby_onboarding/baby_onboarding' });
      },
    });
  },
});
