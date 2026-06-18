// @ts-nocheck
// baby_onboarding.ts - 首次登录宝宝信息填写页
// 对接后端 API：POST /api/v1/babies/ 保存到云端

import { API_CONFIG } from '../../config/api';
import { STORAGE_KEYS } from '../../constants/storage_keys';
var tokenManager = require('../../services/request').tokenManager;

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

    var token = tokenManager.getAccessToken();

    if (!token) {
      this.fallbackToLocal(name);
      return;
    }

    // 先检查服务端是否已有宝宝，防止重复创建
    this.checkExistingBabies(token, name);
  },

  checkExistingBabies: function (token, name) {
    var _this = this;
    wx.request({
      url: API_CONFIG.baseURL + '/babies/',
      method: 'GET',
      header: { 'Authorization': 'Bearer ' + token },
      timeout: 8000,
      success: function (res) {
        if (res.statusCode === 200 && Array.isArray(res.data) && res.data.length > 0) {
          // 已有宝宝 → 不创建，刷新缓存并跳首页
          var babies = res.data;
          try { wx.setStorageSync('album_babies', babies); } catch (e) {}
          try { wx.setStorageSync(BABY_KEY, babies[0]); } catch (e) {}
          try { wx.setStorageSync(STORAGE_KEYS.currentBabyId, babies[0].id); } catch (e) {}
          wx.showToast({ title: '宝宝已存在', icon: 'none', duration: 1500 });
          setTimeout(function () { wx.redirectTo({ url: '/pages/album_home/album_home' }); }, 1500);
        } else {
          // 确实无宝宝 → 正常创建
          _this.createBaby(token, name);
        }
      },
      fail: function () {
        // 网络不可用 → 离线创建
        _this.fallbackToLocal(name);
      },
    });
  },

  createBaby: function (token, name) {
    this.setData({ isSaving: true });
    var _this = this;

    wx.request({
      url: API_CONFIG.baseURL + '/babies/',
      method: 'POST',
      data: { name: name, gender: null, birthDate: null, avatar: _this.data.avatarUrl || _this.data.avatarEmoji },
      header: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
      timeout: 10000,
      success: function (res) {
        if (res.statusCode === 200 || res.statusCode === 201) {
          var baby = res.data;
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
        } else {
          // API 返回非成功状态码，降级到本地存储
          _this.setData({ isSaving: false });
          _this.fallbackToLocal(name);
        }
      },
      fail: function () {
        // 离线降级到本地存储
        _this.fallbackToLocal(name);
      },
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
