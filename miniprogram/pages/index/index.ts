// @ts-nocheck
// index.ts - 登录引导页
// 对接后端 API：wx.login → POST /auth/login → JWT

import { API_CONFIG } from '../../config/api';

const AUTH_KEY = 'baby_diary_authed';
const BABY_KEY = 'baby_diary_baby_profile';

Page({
  data: {
    safeTop: 44,
    authState: 'idle',    // idle | loading | error | success
    errorMsg: ''
  },

  onLoad() {
    try {
      var info = wx.getWindowInfo();
      this.setData({ safeTop: info.statusBarHeight || 44 });
    } catch (e) {}

    // Check token validity
    this.checkLoginStatus();
  },

  checkLoginStatus() {
    var token = '';
    try { token = wx.getStorageSync('baby_diary_access_token') || ''; } catch (e) {}

    if (token) {
      this.setData({ authState: 'loading' });
      this.verifyAndRoute(token);
    }
  },

  verifyAndRoute(token) {
    var _this = this;
    wx.request({
      url: API_CONFIG.baseURL + '/auth/me',
      method: 'GET',
      header: { 'Authorization': 'Bearer ' + token },
      success: function (res) {
        if (res.statusCode === 200) {
          var babyProfile = wx.getStorageSync(BABY_KEY);
          _this.redirectTo(babyProfile ? 'home' : 'onboarding');
        } else if (res.statusCode === 401) {
          _this.tryRefreshToken();
        } else {
          _this.setData({ authState: 'idle' });
        }
      },
      fail: function () {
        // Offline: use local cache
        var babyProfile = wx.getStorageSync(BABY_KEY);
        if (babyProfile) _this.redirectTo('home');
        else _this.setData({ authState: 'idle' });
      },
    });
  },

  tryRefreshToken() {
    var _this = this;
    var refreshToken = '';
    try { refreshToken = wx.getStorageSync('baby_diary_refresh_token') || ''; } catch (e) {}

    if (!refreshToken) { this.setData({ authState: 'idle' }); return; }

    wx.request({
      url: API_CONFIG.baseURL + '/auth/refresh',
      method: 'POST',
      data: { refreshToken: refreshToken },
      success: function (res) {
        if (res.statusCode === 200 && res.data && res.data.accessToken) {
          wx.setStorageSync('baby_diary_access_token', res.data.accessToken);
          if (res.data.refreshToken) {
            wx.setStorageSync('baby_diary_refresh_token', res.data.refreshToken);
          }
          var babyProfile = wx.getStorageSync(BABY_KEY);
          _this.redirectTo(babyProfile ? 'home' : 'onboarding');
        } else {
          _this.setData({ authState: 'idle' });
        }
      },
      fail: function () { _this.setData({ authState: 'idle' }); },
    });
  },

  onLoginTap() {
    this.setData({ authState: 'loading', errorMsg: '' });
    var _this = this;

    wx.login({
      success: function (loginRes) {
        if (loginRes.code) {
          wx.request({
            url: API_CONFIG.baseURL + '/auth/login',
            method: 'POST',
            data: { code: loginRes.code },
            timeout: 15000,
            success: function (res) {
              if (res.statusCode === 200 && res.data && res.data.accessToken) {
                wx.setStorageSync('baby_diary_access_token', res.data.accessToken);
                wx.setStorageSync('baby_diary_refresh_token', res.data.refreshToken);
                wx.setStorageSync('baby_diary_user_id', res.data.userId);
                wx.setStorageSync(AUTH_KEY, true);
                _this.setData({ authState: 'success' });
                if (res.data.isNewUser) {
                  _this.redirectTo('onboarding');
                } else {
                  _this.redirectTo('home');
                }
              } else {
                _this.handleAuthError('登录失败，请重试');
              }
            },
            fail: function () {
              _this.handleOfflineFallback();
            },
          });
        } else {
          _this.handleAuthError('微信登录失败');
        }
      },
      fail: function () { _this.handleAuthError('网络错误，请检查网络'); },
    });
  },

  handleOfflineFallback() {
    wx.setStorageSync(AUTH_KEY, true);
    var babyProfile = wx.getStorageSync(BABY_KEY);
    this.setData({ authState: 'success' });
    if (babyProfile) { this.redirectTo('home'); } else { this.redirectTo('onboarding'); }
  },

  handleAuthError(msg) {
    this.setData({ authState: 'error', errorMsg: msg || '授权失败，请重试' });
  },

  redirectTo(target) {
    var url = target === 'home'
      ? '/pages/album_home/album_home'
      : '/pages/baby_onboarding/baby_onboarding';
    wx.redirectTo({ url: url });
  },
});