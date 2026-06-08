// @ts-nocheck
// app.ts - 应用入口，Token 检测 + 自动刷新

const API_BASE = 'http://101.126.41.146:8000/api/v1';

App({
  globalData: {},

  onLaunch() {
    // 检查 token 有效性
    this.checkToken();
  },

  checkToken() {
    var token = '';
    var that = this;  // 保存 App 实例引用
    try { token = wx.getStorageSync('baby_diary_access_token') || ''; } catch (e) {}

    if (!token) return;

    // 验证 token
    wx.request({
      url: API_BASE + '/auth/me',
      method: 'GET',
      header: { 'Authorization': 'Bearer ' + token },
      success: function (res) {
        if (res.statusCode === 401) {
          // Token 过期，尝试刷新
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
      url: API_BASE + '/auth/refresh',
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