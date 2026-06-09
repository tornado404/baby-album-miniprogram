// @ts-nocheck
// app.ts - 应用入口，Token 检测 + 自动刷新
// 使用统一配置中心获取 API 地址

import { API_CONFIG } from './config/api';

App({
  globalData: {
    env: API_CONFIG.name,
  },

  onLaunch() {
    console.log('[app] 当前环境:', API_CONFIG.name, API_CONFIG.baseURL);
    this.checkToken();
  },

  checkToken() {
    var token = '';
    var that = this;
    try { token = wx.getStorageSync('baby_diary_access_token') || ''; } catch (e) {}

    if (!token) return;

    wx.request({
      url: API_CONFIG.baseURL + '/auth/me',
      method: 'GET',
      header: { 'Authorization': 'Bearer ' + token },
      success: function (res) {
        if (res.statusCode === 401) {
          that.refreshToken();
        }
      },
      fail: function () {},
    });
  },

  refreshToken() {
    var refreshToken = '';
    try { refreshToken = wx.getStorageSync('baby_diary_refresh_token') || ''; } catch (e) {}
    if (!refreshToken) return;

    wx.request({
      url: API_CONFIG.baseURL + '/auth/refresh',
      method: 'POST',
      data: { refreshToken: refreshToken },
      success: function (res) {
        if (res.statusCode === 200 && res.data && res.data.accessToken) {
          wx.setStorageSync('baby_diary_access_token', res.data.accessToken);
        }
      },
      fail: function () {},
    });
  },
});