// @ts-nocheck
// baby_onboarding.ts - 首次登录宝宝信息填写页
// 对接后端 API：POST /api/v1/babies/ 保存到云端

import { babyApi } from '../../services/baby_api';
import { STORAGE_KEYS } from '../../constants/storage_keys';

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

  onLoad() {
    try {
      var info = wx.getWindowInfo();
      this.setData({ safeTop: info.statusBarHeight || 44 });
    } catch (e) {}
    setTimeout(() => { this.setData({ inputFocus: true }); }, 500);
  },

  onBack() { wx.navigateBack(); },

  onAvatarTap() {
    var _this = this;
    wx.showActionSheet({
      itemList: ['拍照', '从相册选择'],
      success: function (res) {
        wx.chooseMedia({
          count: 1, mediaType: ['image'],
          sourceType: [res.tapIndex === 0 ? 'camera' : 'album'],
          success: function (mediaRes) {
            var f = mediaRes.tempFiles[0];
            if (f) _this.setData({ avatarUrl: f.tempFilePath || '', avatarEmoji: '' });
          },
        });
      },
    });
  },

  onNicknameInput(e) { this.setData({ nickname: e.detail.value }); },

  onSave() {
    var name = this.data.nickname.trim();
    if (!name) { wx.showToast({ title: '请输入宝宝昵称', icon: 'none' }); return; }
    this.setData({ isSaving: true });
    var _this = this;

    babyApi.create({
      name: name,
      gender: null,
      birthDate: null,
      avatar: _this.data.avatarUrl || _this.data.avatarEmoji,
    }).then(function (baby) {
      var profile = { id: baby.id || 'baby_' + Date.now(), name: name, avatar: _this.data.avatarUrl || _this.data.avatarEmoji, createdAt: new Date().toISOString() };
      // 写入当前宝宝 ID 和 profile
      try { wx.setStorageSync(BABY_KEY, profile); } catch (e) {}
      try { wx.setStorageSync(STORAGE_KEYS.currentBabyId, profile.id); } catch (e) {}
      // 更新 album_babies 缓存列表
      var babies = [];
      try { babies = wx.getStorageSync('album_babies') || []; } catch (e) {}
      if (!Array.isArray(babies)) { babies = []; }
      babies.push(profile);
      try { wx.setStorageSync('album_babies', babies); } catch (e) {}
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
    try { wx.setStorageSync(BABY_KEY, profile); } catch (e) {}
    try { wx.setStorageSync(STORAGE_KEYS.currentBabyId, profile.id); } catch (e) {}
    var babies = [];
    try { babies = wx.getStorageSync('album_babies') || []; } catch (e) {}
    if (!Array.isArray(babies)) { babies = []; }
    babies.push(profile);
    try { wx.setStorageSync('album_babies', babies); } catch (e) {}
    this.setData({ isSaving: false });
    wx.showToast({ title: '已保存到本地', icon: 'success', duration: 1000 });
    setTimeout(function () { wx.redirectTo({ url: '/pages/album_home/album_home' }); }, 1000);
  },
});
