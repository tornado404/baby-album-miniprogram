"use strict";
// @ts-nocheck
// baby_onboarding.ts - 首次登录宝宝信息填写页
// 对接后端 API：POST /api/v1/babies/ 保存到云端
Object.defineProperty(exports, "__esModule", { value: true });
var baby_api_1 = require("../../services/baby_api");
var storage_keys_1 = require("../../constants/storage_keys");
var BABY_KEY = 'baby_diary_baby_profile';
Page({
    data: {
        safeTop: 44,
        nickname: '',
        avatarEmoji: '👶',
        avatarUrl: '',
        isSaving: false,
        inputFocus: false,
    },
    onLoad: function () {
        var _this_1 = this;
        try {
            var info = wx.getWindowInfo();
            this.setData({ safeTop: info.statusBarHeight || 44 });
        }
        catch (e) { }
        setTimeout(function () { _this_1.setData({ inputFocus: true }); }, 500);
    },
    onBack: function () { wx.navigateBack(); },
    onAvatarTap: function () {
        var _this = this;
        wx.showActionSheet({
            itemList: ['拍照', '从相册选择'],
            success: function (res) {
                wx.chooseMedia({
                    count: 1, mediaType: ['image'],
                    sourceType: [res.tapIndex === 0 ? 'camera' : 'album'],
                    success: function (mediaRes) {
                        var f = mediaRes.tempFiles[0];
                        if (f)
                            _this.setData({ avatarUrl: f.tempFilePath || '', avatarEmoji: '' });
                    },
                });
            },
        });
    },
    onNicknameInput: function (e) { this.setData({ nickname: e.detail.value }); },
    onSave: function () {
        var name = this.data.nickname.trim();
        if (!name) {
            wx.showToast({ title: '请输入宝宝昵称', icon: 'none' });
            return;
        }
        this.setData({ isSaving: true });
        var _this = this;
        baby_api_1.babyApi.create({
            name: name,
            gender: null,
            birthDate: null,
            avatar: _this.data.avatarUrl || _this.data.avatarEmoji,
        }).then(function (baby) {
            var profile = { id: baby.id || 'baby_' + Date.now(), name: name, avatar: _this.data.avatarUrl || _this.data.avatarEmoji, createdAt: new Date().toISOString() };
            // 写入当前宝宝 ID 和 profile
            try {
                wx.setStorageSync(BABY_KEY, profile);
            }
            catch (e) { }
            try {
                wx.setStorageSync(storage_keys_1.STORAGE_KEYS.currentBabyId, profile.id);
            }
            catch (e) { }
            // 更新 album_babies 缓存列表
            var babies = [];
            try {
                babies = wx.getStorageSync('album_babies') || [];
            }
            catch (e) { }
            if (!Array.isArray(babies)) {
                babies = [];
            }
            babies.push(profile);
            try {
                wx.setStorageSync('album_babies', babies);
            }
            catch (e) { }
            wx.showToast({ title: '创建成功', icon: 'success', duration: 1000 });
            setTimeout(function () { wx.redirectTo({ url: '/pages/album_home/album_home' }); }, 1000);
        }).catch(function () {
            // 离线降级到本地存储
            _this.setData({ isSaving: false });
            _this.fallbackToLocal(name);
        });
    },
    fallbackToLocal: function (name) {
        var profile = { id: 'baby_' + Date.now(), name: name, avatar: this.data.avatarUrl || this.data.avatarEmoji, createdAt: new Date().toISOString() };
        try {
            wx.setStorageSync(BABY_KEY, profile);
        }
        catch (e) { }
        try {
            wx.setStorageSync(storage_keys_1.STORAGE_KEYS.currentBabyId, profile.id);
        }
        catch (e) { }
        var babies = [];
        try {
            babies = wx.getStorageSync('album_babies') || [];
        }
        catch (e) { }
        if (!Array.isArray(babies)) {
            babies = [];
        }
        babies.push(profile);
        try {
            wx.setStorageSync('album_babies', babies);
        }
        catch (e) { }
        this.setData({ isSaving: false });
        wx.showToast({ title: '已保存到本地', icon: 'success', duration: 1000 });
        setTimeout(function () { wx.redirectTo({ url: '/pages/album_home/album_home' }); }, 1000);
    },
});
