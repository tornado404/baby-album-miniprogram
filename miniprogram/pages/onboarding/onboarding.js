"use strict";
// @ts-nocheck
// onboarding.ts - 登录引导页
// 对接后端 API：wx.login -> POST /auth/login -> JWT
// 首屏检测：有 authed flag -> 跳过，无 -> 展示引导页
Object.defineProperty(exports, "__esModule", { value: true });
var api_1 = require("../../config/api");
var AUTH_KEY = 'baby_diary_authed';
var TOKEN_KEY = 'baby_diary_access_token';
var REFRESH_KEY = 'baby_diary_refresh_token';
var USER_ID_KEY = 'baby_diary_user_id';
var BABY_KEY = 'baby_diary_baby_profile';
Page({
    data: {
        safeTop: 44,
        isLoading: false,
        hasAgreed: false,
        authState: 'idle', // idle | loading | error | success
        errorMsg: ''
    },
    onLoad: function () {
        try {
            var info = wx.getWindowInfo();
            this.setData({ safeTop: info.statusBarHeight || 44 });
        }
        catch (e) { }
        // Check if already logged in
        this.checkLoginStatus();
    },
    checkLoginStatus: function () {
        var token = '';
        try {
            token = wx.getStorageSync(TOKEN_KEY) || '';
        }
        catch (e) { }
        if (token) {
            this.setData({ authState: 'loading' });
            this.verifyAndRoute(token);
        }
    },
    verifyAndRoute: function (token) {
        var _this = this;
        wx.request({
            url: api_1.API_CONFIG.baseURL + '/auth/me',
            method: 'GET',
            header: { 'Authorization': 'Bearer ' + token },
            success: function (res) {
                if (res.statusCode === 200) {
                    var babyProfile = wx.getStorageSync(BABY_KEY);
                    _this.redirectTo(babyProfile ? 'home' : 'baby_onboarding');
                }
                else if (res.statusCode === 401) {
                    _this.tryRefreshToken();
                }
                else {
                    _this.setData({ authState: 'idle' });
                }
            },
            fail: function () {
                // Offline: use local cache
                var babyProfile = wx.getStorageSync(BABY_KEY);
                if (babyProfile) {
                    _this.redirectTo('home');
                }
                else {
                    _this.setData({ authState: 'idle' });
                }
            },
        });
    },
    tryRefreshToken: function () {
        var _this = this;
        var refreshToken = '';
        try {
            refreshToken = wx.getStorageSync(REFRESH_KEY) || '';
        }
        catch (e) { }
        if (!refreshToken) {
            this.setData({ authState: 'idle' });
            return;
        }
        wx.request({
            url: api_1.API_CONFIG.baseURL + '/auth/refresh',
            method: 'POST',
            data: { refreshToken: refreshToken },
            success: function (res) {
                if (res.statusCode === 200 && res.data && res.data.accessToken) {
                    wx.setStorageSync(TOKEN_KEY, res.data.accessToken);
                    if (res.data.refreshToken) {
                        wx.setStorageSync(REFRESH_KEY, res.data.refreshToken);
                    }
                    var babyProfile = wx.getStorageSync(BABY_KEY);
                    _this.redirectTo(babyProfile ? 'home' : 'baby_onboarding');
                }
                else {
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
                        url: api_1.API_CONFIG.baseURL + '/auth/login',
                        method: 'POST',
                        data: { code: loginRes.code },
                        timeout: 15000,
                        success: function (res) {
                            if (res.statusCode === 200 && res.data && res.data.accessToken) {
                                wx.setStorageSync(TOKEN_KEY, res.data.accessToken);
                                wx.setStorageSync(REFRESH_KEY, res.data.refreshToken);
                                wx.setStorageSync(USER_ID_KEY, res.data.userId);
                                wx.setStorageSync(AUTH_KEY, true);
                                _this.setData({ authState: 'success' });
                                if (res.data.isNewUser) {
                                    _this.redirectTo('baby_onboarding');
                                }
                                else {
                                    _this.redirectTo('home');
                                }
                            }
                            else {
                                _this.handleAuthError('登录失败，请重试');
                            }
                        },
                        fail: function () {
                            _this.handleOfflineFallback();
                        },
                    });
                }
                else {
                    _this.handleAuthError('微信登录失败');
                }
            },
            fail: function () {
                _this.handleAuthError('网络错误，请检查网络');
            },
        });
    },
    handleOfflineFallback: function () {
        wx.setStorageSync(AUTH_KEY, true);
        var babyProfile = wx.getStorageSync(BABY_KEY);
        this.setData({ authState: 'success' });
        if (babyProfile) {
            this.redirectTo('home');
        }
        else {
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
});
