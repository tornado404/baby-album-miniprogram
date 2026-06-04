"use strict";
// @ts-nocheck
// index.ts - 登录引导页
// 状态: idle → loading → error / success
var AUTH_KEY = 'baby_diary_authed';
var BABY_KEY = 'baby_diary_baby_profile';
Page({
    data: {
        safeTop: 44,
        authState: 'idle', // idle | loading | error | success
        errorMsg: ''
    },
    onLoad: function () {
        // Get safe area
        try {
            var info = wx.getSystemInfoSync();
            this.setData({ safeTop: info.statusBarHeight || 44 });
        }
        catch (e) { }
        // Check if already authenticated
        var authed = wx.getStorageSync(AUTH_KEY);
        var babyProfile = wx.getStorageSync(BABY_KEY);
        if (authed && babyProfile) {
            // Already has account → go directly to home
            this.redirectToHome();
        }
    },
    onLoginTap: function () {
        var _this = this;
        this.setData({ authState: 'loading', errorMsg: '' });
        // Step 1: WeChat login (get code)
        wx.login({
            success: function (loginRes) {
                if (loginRes.code) {
                    console.log('微信登录 code:', loginRes.code);
                    // In production: send loginRes.code to backend
                    // For MVP: simulate success
                    _this.handleAuthSuccess();
                }
                else {
                    _this.handleAuthError('登录失败，请重试');
                }
            },
            fail: function () {
                _this.handleAuthError('网络错误，请检查网络后重试');
            }
        });
    },
    handleAuthSuccess: function () {
        // Mark as authenticated
        wx.setStorageSync(AUTH_KEY, true);
        this.setData({ authState: 'success' });
        // Check if baby profile exists
        var babyProfile = wx.getStorageSync(BABY_KEY);
        if (babyProfile) {
            // Has profile → go to home
            this.redirectToHome();
        }
        else {
            // No profile → guide to create
            wx.showToast({ title: '欢迎！请先创建宝宝档案', icon: 'none', duration: 2000 });
            setTimeout(function () {
                wx.redirectTo({ url: '/pages/baby_profile/baby_profile' });
            }, 1500);
        }
    },
    handleAuthError: function (msg) {
        this.setData({
            authState: 'error',
            errorMsg: msg || '授权失败，请重试'
        });
    },
    redirectToHome: function () {
        wx.redirectTo({ url: '/pages/album_home/album_home' });
    }
});
