"use strict";
// settings.ts - 我的/设置页面
// Claymorphism 设计风格
Page({
    data: {
        safeTop: 44,
        userName: '星星妈妈',
        recordDays: 180,
        photoCount: 128,
        videoCount: 32,
        modelCount: 3,
        achievementCount: 3
    },
    onLoad: function () {
        var sysInfo = wx.getSystemInfoSync();
        this.setData({ safeTop: sysInfo.statusBarHeight || 44 });
    },
    onMenuTap: function (e) {
        var key = e.currentTarget.dataset.key;
        var routes = {
            baby_manage: '/pages/baby_profile/baby_profile',
            growth_compare: '',
            achievements: '',
            storage: '',
            share: '',
            about: ''
        };
        var url = routes[key];
        if (url) {
            switch (key) {
                case 'baby_manage':
                    wx.navigateTo({ url: url });
                    break;
                default:
                    wx.showToast({ title: '功能开发中', icon: 'none' });
            }
        }
        else {
            wx.showToast({ title: '功能开发中', icon: 'none' });
        }
    }
});
