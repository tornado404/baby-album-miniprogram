// baby_profile.ts - 宝宝档案编辑页面
// Claymorphism 设计风格，支持头像上传

import { STORAGE_KEYS } from '../../constants/storage_keys';
import { API_CONFIG } from '../../config/api';
var tokenManager = require('../../services/request').tokenManager;

Page({
  data: {
    safeTop: 44,
    nickname: '小星星',
    gender: 'female',
    birthDate: '2025-12-01',
    weight: '7.2',
    height: '65',
    avatarUrl: '',
    avatarEmoji: '👶'
  },

  onLoad: function () {
    var sysInfo = wx.getWindowInfo();
    this.setData({ safeTop: sysInfo.statusBarHeight || 44 });

    var babyId = '';
    try {
      babyId = wx.getStorageSync(STORAGE_KEYS.currentBabyId) || '';
    } catch (e) {}

    if (babyId) {
      this.loadFromApi(babyId);
    }

    if (this.data.birthDate) {
      this.setData({ birthDateArray: this.dateToArray(this.data.birthDate) });
    }
  },

  loadFromApi: function (babyId) {
    var _this = this;
    var token = tokenManager.getAccessToken();

    wx.request({
      url: API_CONFIG.baseURL + '/babies/' + babyId,
      method: 'GET',
      header: { 'Authorization': 'Bearer ' + token },
      timeout: 8000,
      success: function (res) {
        if (res.statusCode === 200 && res.data) {
          var b = res.data;
          var avatar = b.avatar || '';
          _this.setData({
            nickname: b.name || '小星星',
            gender: b.gender || 'female',
            birthDate: b.birthDate || '2025-12-01',
            avatarUrl: avatar.indexOf('http') === 0 ? avatar : '',
            avatarEmoji: avatar.indexOf('http') !== 0 && avatar ? avatar : '👶',
          });
          if (_this.data.birthDate) {
            _this.setData({ birthDateArray: _this.dateToArray(_this.data.birthDate) });
          }
        } else {
          _this.loadFromLocal(babyId);
        }
      },
      fail: function () { _this.loadFromLocal(babyId); },
    });
  },

  loadFromLocal: function (babyId) {
    try {
      var storedBabies = wx.getStorageSync('album_babies') || [];
      for (var i = 0; i < storedBabies.length; i++) {
        if (storedBabies[i].id === babyId) {
          var baby = storedBabies[i];
          var avatar = baby.avatar || '';
          this.setData({
            nickname: baby.name || '小星星',
            gender: baby.gender || 'female',
            birthDate: baby.birthDate || '2025-12-01',
            avatarUrl: avatar.indexOf('http') === 0 ? avatar : '',
            avatarEmoji: avatar.indexOf('http') !== 0 && avatar ? avatar : '👶',
          });
          break;
        }
      }
    } catch (e) {}
  },

  dateToArray: function (dateStr) {
    var parts = dateStr.split('-');
    return parts.map(function (p) { return parseInt(p); });
  },

  arrayToDate: function (arr) {
    return arr.map(function (n) { return String(n).padStart(2, '0'); }).join('-');
  },

  onAvatarTap: function () {
    var _this = this;
    wx.showActionSheet({
      itemList: ['拍照', '从相册选择'],
      success: function (res) {
        wx.chooseMedia({
          count: 1,
          mediaType: ['image'],
          sourceType: [res.tapIndex === 0 ? 'camera' : 'album'],
          success: function (mediaRes) {
            var tempFile = mediaRes.tempFiles[0];
            if (tempFile) {
              _this.setData({
                avatarUrl: tempFile.tempFilePath || '',
                avatarEmoji: ''
              });
              // 上传头像到服务器
              _this.uploadAvatar(tempFile.tempFilePath);
            }
          }
        });
      }
    });
  },

  uploadAvatar: function (filePath) {
    if (!filePath) return;
    var babyId = '';
    try { babyId = wx.getStorageSync(STORAGE_KEYS.currentBabyId) || ''; } catch (e) {}
    if (!babyId) return;

    var token = tokenManager.getAccessToken();

    wx.uploadFile({
      url: API_CONFIG.baseURL + '/babies/' + babyId + '/avatar',
      filePath: filePath,
      name: 'file',
      header: { 'Authorization': 'Bearer ' + token },
      success: function (res) {
        if (res.statusCode === 200) {
          try {
            var data = JSON.parse(res.data);
            if (data && data.data && data.data.avatar) {
              // 更新为服务器返回的永久 URL
              // (不立即更新 UI，避免闪烁，下次加载时自动获取)
            }
          } catch (e) {}
        }
      },
      fail: function () {
        // 上传失败，本地预览仍然生效
      },
    });
  },

  onBack: function () {
    wx.navigateBack();
  },

  onSave: function () {
    var babyProfile = {
      name: this.data.nickname,
      gender: this.data.gender,
      birthDate: this.data.birthDate,
      avatar: this.data.avatarUrl || this.data.avatarEmoji,
      weight: this.data.weight,
      height: this.data.height,
    };

    var babyId = '';
    try { babyId = wx.getStorageSync(STORAGE_KEYS.currentBabyId) || ''; } catch (e) {}

    var token = tokenManager.getAccessToken();

    var _this = this;

    var url;
    var method;
    if (babyId) {
      url = API_CONFIG.baseURL + '/babies/' + babyId;
      method = 'PUT';
    } else {
      url = API_CONFIG.baseURL + '/babies/';
      method = 'POST';
    }

    wx.request({
      url: url,
      method: method,
      data: babyProfile,
      header: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
      timeout: 10000,
      success: function (res) {
        if (res.statusCode === 200 || res.statusCode === 201) {
          var savedBaby = res.data;
          if (!babyId && savedBaby && savedBaby.id) {
            try { wx.setStorageSync(STORAGE_KEYS.currentBabyId, savedBaby.id); } catch (e) {}
          }
          _this.syncLocalBabies(babyProfile, babyId, savedBaby);
          wx.showToast({ title: '保存成功', icon: 'success' });
          wx.navigateBack();
        } else {
          _this.saveLocalFallback(babyProfile, babyId);
        }
      },
      fail: function () {
        _this.saveLocalFallback(babyProfile, babyId);
      },
    });
  },

  syncLocalBabies: function (profile, babyId, savedBaby) {
    try {
      var storedBabies = wx.getStorageSync('album_babies') || [];
      var found = false;
      var targetId = babyId || (savedBaby && savedBaby.id);
      for (var i = 0; i < storedBabies.length; i++) {
        if (storedBabies[i].id === targetId) {
          storedBabies[i] = Object.assign(storedBabies[i], profile);
          if (savedBaby) {
            storedBabies[i] = Object.assign(storedBabies[i], savedBaby);
          }
          found = true;
          break;
        }
      }
      if (!found && targetId) {
        profile['id'] = targetId;
        storedBabies.push(profile);
      }
      wx.setStorageSync('album_babies', storedBabies);
      // 更新 BABY_KEY 确保首页读到最新数据
      if (found && targetId) {
        var currentBabyId = '';
        try { currentBabyId = wx.getStorageSync(STORAGE_KEYS.currentBabyId) || ''; } catch (e) {}
        if (targetId === currentBabyId) {
          var updatedBaby = null;
          for (var j = 0; j < storedBabies.length; j++) {
            if (storedBabies[j].id === targetId) { updatedBaby = storedBabies[j]; break; }
          }
          if (updatedBaby) { try { wx.setStorageSync('baby_diary_baby_profile', updatedBaby); } catch (e) {} }
        }
      }
    } catch (e) {}
  },

  saveLocalFallback: function (profile, babyId) {
    try {
      var storedBabies = wx.getStorageSync('album_babies') || [];
      var found = false;
      for (var i = 0; i < storedBabies.length; i++) {
        if (storedBabies[i].id === babyId) {
          storedBabies[i] = Object.assign(storedBabies[i], profile);
          found = true;
          break;
        }
      }
      if (!found) {
        profile['id'] = babyId || 'baby_' + Date.now();
        storedBabies.push(profile);
      }
      wx.setStorageSync('album_babies', storedBabies);
      if (found && babyId) {
        var currentBabyId = '';
        try { currentBabyId = wx.getStorageSync(STORAGE_KEYS.currentBabyId) || ''; } catch (e) {}
        if (babyId === currentBabyId) {
          var updatedBaby = null;
          for (var j = 0; j < storedBabies.length; j++) {
            if (storedBabies[j].id === babyId) { updatedBaby = storedBabies[j]; break; }
          }
          if (updatedBaby) { try { wx.setStorageSync('baby_diary_baby_profile', updatedBaby); } catch (e) {} }
        }
      }
    } catch (e) {}
    wx.showToast({ title: '已保存到本地', icon: 'success' });
    wx.navigateBack();
  },

  onNicknameInput: function (e) {
    this.setData({ nickname: e.detail.value });
  },

  onGenderSelect: function (e) {
    var gender = e.currentTarget.dataset.gender;
    this.setData({ gender: gender });
  },

  onBirthDateChange: function (e) {
    this.setData({ birthDate: e.detail.value });
  },

  onWeightMinus: function () {
    var w = parseFloat(this.data.weight) - 0.1;
    if (w >= 0) this.setData({ weight: w.toFixed(1) });
  },

  onWeightPlus: function () {
    var w = parseFloat(this.data.weight) + 0.1;
    this.setData({ weight: w.toFixed(1) });
  },

  onHeightMinus: function () {
    var h = parseInt(this.data.height) - 1;
    if (h >= 0) this.setData({ height: String(h) });
  },

  onHeightPlus: function () {
    var h = parseInt(this.data.height) + 1;
    this.setData({ height: String(h) });
  }
});