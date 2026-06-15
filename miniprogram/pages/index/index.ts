// @ts-nocheck
// index.ts - 入口路由页
// 检测登录状态，未登录跳转 onboarding，已登录跳转 album_home

var TOKEN_KEY = 'baby_diary_access_token';
var BABY_KEY = 'baby_diary_baby_profile';

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
        wx.reLaunch({ url: '/pages/baby_onboarding/baby_onboarding' });
      }
    } else {
      wx.reLaunch({ url: '/pages/onboarding/onboarding' });
    }
  },
});
