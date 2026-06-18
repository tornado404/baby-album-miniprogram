// @ts-nocheck
// onboarding.ts - 登录引导页
// 对接后端 API：wx.login -> POST /auth/login -> JWT
// 首屏检测：有 authed flag -> 跳过，无 -> 展示引导页

import { API_CONFIG } from '../../config/api';

var TOKEN_KEY = 'baby_diary_access_token';
var REFRESH_KEY = 'baby_diary_refresh_token';
var USER_ID_KEY = 'baby_diary_user_id';
var BABY_KEY = 'baby_diary_baby_profile';

Page({
  data: {
    safeTop: 44,
    isLoading: false,
    hasAgreed: false,
    authState: 'idle',   // idle | loading | error | success
    errorMsg: ''
  },

  onLoad: function () {
    try {
      var info = wx.getWindowInfo();
      this.setData({ safeTop: info.statusBarHeight || 44 });
    } catch (e) {}

    // Check if already logged in
    this.checkLoginStatus();
  },

  checkLoginStatus: function () {
    var token = '';
    try { token = wx.getStorageSync(TOKEN_KEY) || ''; } catch (e) {}

    if (token) {
      this.setData({ authState: 'loading' });
      this.verifyAndRoute(token);
    }
  },

  verifyAndRoute: function (token) {
    var _this = this;
    wx.request({
      url: API_CONFIG.baseURL + '/auth/me',
      method: 'GET',
      header: { 'Authorization': 'Bearer ' + token },
      success: function (res) {
        if (res.statusCode === 200) {
          var babyProfile = wx.getStorageSync(BABY_KEY);
          if (babyProfile) {
            _this.redirectTo('home');
          } else {
            // 本地无宝宝缓存 → 查 API 确认后再跳转
            _this.checkBabiesBeforeRoute(token);
          }
        } else if (res.statusCode === 401) {
          _this.tryRefreshToken();
        } else {
          _this.setData({ authState: 'idle' });
        }
      },
      fail: function () {
        // Offline: use local cache
        var babyProfile = wx.getStorageSync(BABY_KEY);
        if (babyProfile) {
          _this.redirectTo('home');
        } else {
          _this.setData({ authState: 'idle' });
        }
      },
    });
  },

  tryRefreshToken: function () {
    var _this = this;
    var refreshToken = '';
    try { refreshToken = wx.getStorageSync(REFRESH_KEY) || ''; } catch (e) {}

    if (!refreshToken) {
      this.setData({ authState: 'idle' });
      return;
    }

    wx.request({
      url: API_CONFIG.baseURL + '/auth/refresh',
      method: 'POST',
      data: { refreshToken: refreshToken },
      success: function (res) {
        if (res.statusCode === 200 && res.data && res.data.accessToken) {
          try { wx.setStorageSync(TOKEN_KEY, res.data.accessToken); } catch (e) {}
          if (res.data.refreshToken) {
            try { wx.setStorageSync(REFRESH_KEY, res.data.refreshToken); } catch (e) {}
          }
          var babyProfile = wx.getStorageSync(BABY_KEY);
          if (babyProfile) {
            _this.redirectTo('home');
          } else {
            _this.checkBabiesBeforeRoute(res.data.accessToken);
          }
        } else {
          _this.setData({ authState: 'idle' });
        }
      },
      fail: function () {
        _this.setData({ authState: 'idle' });
      },
    });
  },

  onPrivacyTap: function () {
    var current = this.data.hasAgreed;
    this.setData({ hasAgreed: !current });
  },

  onLoginTap: function () {
    if (!this.data.hasAgreed) {
      wx.showToast({ title: '请先同意用户协议和隐私政策', icon: 'none', duration: 2000 });
      return;
    }

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
                try { wx.setStorageSync(TOKEN_KEY, res.data.accessToken); } catch (e) {}
                try { wx.setStorageSync(REFRESH_KEY, res.data.refreshToken); } catch (e) {}
                try { wx.setStorageSync(USER_ID_KEY, res.data.userId); } catch (e) {}
                _this.setData({ authState: 'success' });
                if (res.data.isNewUser) {
                  _this.redirectTo('baby_onboarding');
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
      fail: function () {
        _this.handleAuthError('网络错误，请检查网络');
      },
    });
  },

  handleOfflineFallback: function () {
    var babyProfile = wx.getStorageSync(BABY_KEY);
    this.setData({ authState: 'success' });
    if (babyProfile) {
      this.redirectTo('home');
    } else {
      this.redirectTo('baby_onboarding');
    }
  },

  handleAuthError: function (msg) {
    this.setData({ authState: 'error', errorMsg: msg || '授权失败，请重试' });
  },

  redirectTo: function (target) {
    var url = target === 'home'
      ? '/pages/album_home/album_home'
      : '/pages/baby_onboarding/baby_onboarding';
    wx.reLaunch({ url: url });
  },

  // 查 API 确认宝宝是否存在后再决定跳转（防止缓存清除后误跳新建页）
  checkBabiesBeforeRoute: function (token) {
    var _this = this;
    wx.request({
      url: API_CONFIG.baseURL + '/babies/',
      method: 'GET',
      header: { 'Authorization': 'Bearer ' + token },
      timeout: 8000,
      success: function (res) {
        if (res.statusCode === 200 && Array.isArray(res.data) && res.data.length > 0) {
          var babies = res.data;
          try { wx.setStorageSync('album_babies', babies); } catch (e) {}
          try { wx.setStorageSync(BABY_KEY, babies[0]); } catch (e) {}
          try { wx.setStorageSync('baby_diary_current_baby_id', babies[0].id); } catch (e) {}
          _this.redirectTo('home');
        } else {
          _this.redirectTo('baby_onboarding');
        }
      },
      fail: function () {
        // 网络不可用，保守跳首页（用户可能已有缓存但读取失败）
        _this.redirectTo('home');
      },
    });
  },
});
