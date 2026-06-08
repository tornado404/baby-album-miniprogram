"use strict";
// 3d_viewer.ts - 3D模型查看页面
Page({
    data: {
        safeTop: 44
    },
    onLoad: function () {
        var sysInfo = wx.getWindowInfo();
        this.setData({ safeTop: sysInfo.statusBarHeight || 44 });
    },
    onBack: function () {
        wx.navigateBack();
    },
    onShare: function () {
        wx.showToast({ title: '分享功能开发中', icon: 'none' });
    }
});
