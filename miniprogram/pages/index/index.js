"use strict";
// @ts-nocheck
// index.ts
// 获取应用实例
var app = getApp();
var defaultAvatarUrl = 'https://mmbiz.qpic.cn/mmbiz/icTdbqWNOwNRna42FI242Lcia07jQodd2FJGIYQfG0LAJGFxM4FbnQP6yfMxBgJ0F3YRqJCJ1aPAK2dQagdusBZg/0';
Component({
    data: {
        motto: 'Hello World',
        userInfo: {
            avatarUrl: defaultAvatarUrl,
            nickName: '',
        },
        hasUserInfo: false,
        canIUseGetUserProfile: wx.canIUse('getUserProfile'),
        canIUseNicknameComp: wx.canIUse('input.type.nickname'),
    },
    methods: {
        // 事件处理函数
        bindViewTap: function () {
            wx.navigateTo({
                url: '../logs/logs',
            });
        },
        onChooseAvatar: function (e) {
            var avatarUrl = e.detail.avatarUrl;
            var nickName = this.data.userInfo.nickName;
            this.setData({
                "userInfo.avatarUrl": avatarUrl,
                hasUserInfo: nickName && avatarUrl && avatarUrl !== defaultAvatarUrl,
            });
        },
        onInputChange: function (e) {
            var nickName = e.detail.value;
            var avatarUrl = this.data.userInfo.avatarUrl;
            this.setData({
                "userInfo.nickName": nickName,
                hasUserInfo: nickName && avatarUrl && avatarUrl !== defaultAvatarUrl,
            });
        },
        getUserProfile: function () {
            var _this = this;
            // 推荐使用wx.getUserProfile获取用户信息，开发者每次通过该接口获取用户个人信息均需用户确认，开发者妥善保管用户快速填写的头像昵称，避免重复弹窗
            wx.getUserProfile({
                desc: '展示用户信息', // 声明获取用户个人信息后的用途，后续会展示在弹窗中，请谨慎填写
                success: function (res) {
                    console.log(res);
                    _this.setData({
                        userInfo: res.userInfo,
                        hasUserInfo: true
                    });
                }
            });
        },
    },
});
