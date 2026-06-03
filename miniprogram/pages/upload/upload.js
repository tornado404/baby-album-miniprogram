"use strict";
// upload.ts - 上传页面
// Claymorphism 设计风格
Page({
    data: {
        safeTop: 44 // 状态栏高度
    },
    onLoad: function () {
        var sysInfo = wx.getSystemInfoSync();
        this.setData({ safeTop: sysInfo.statusBarHeight || 44 });
    },
    onBack: function () {
        wx.navigateBack();
    },
    onTakePhoto: function () {
        var _this = this;
        wx.chooseMedia({
            count: 1,
            mediaType: ['image'],
            sourceType: ['camera'],
            success: function (res) {
                _this.handleMediaResult(res);
            }
        });
    },
    onChooseFromAlbum: function () {
        var _this = this;
        wx.chooseMedia({
            count: 9,
            mediaType: ['image', 'video'],
            sourceType: ['album'],
            success: function (res) {
                _this.handleMediaResult(res);
            }
        });
    },
    onUpload3D: function () {
        wx.navigateTo({
            url: '/pages/3d_viewer/3d_viewer'
        });
    },
    handleMediaResult: function (res) {
        var files = res.tempFiles || [];
        if (files.length > 0) {
            wx.showToast({ title: "\u5DF2\u9009\u62E9".concat(files.length, "\u4E2A\u6587\u4EF6"), icon: 'none' });
            // TODO: 实际上传逻辑
        }
    }
});
