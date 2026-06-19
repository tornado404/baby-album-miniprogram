// @ts-nocheck
// baby_item.ts - 宝宝信息编辑页面
// 提供日期选择、里程碑选择、多行文本描述

import { API_CONFIG } from '../../config/api';
import { STORAGE_KEYS } from '../../constants/storage_keys';
var tokenManager = require('../../services/request').tokenManager;

const MILESTONES = [
  '第一次翻身', '开始学坐', '会爬行',
  '开始走路', '第一次说话', '长出第一颗牙',
  '会拍手', '会挥手再见', '会叫爸爸妈妈',
  '开始吃辅食', '学会用杯子', '会自己站立'
];

Page({
  data: {
    safeTop: 44,
    babyName: '',
    avatarUrl: '',
    avatarEmoji: '👶',
    birthDate: '',
    selectedMilestone: '',
    milestoneIndex: -1,
    showMilestonePicker: false,
    description: '',
    charCount: 0,
    maxChars: 200,
    isLoading: true,
    isSaving: false,
    milestones: MILESTONES,
    babyId: '',
    gender: 'female',
  },

  onLoad: function (options) {
    try {
      var info = wx.getWindowInfo();
      this.setData({ safeTop: info.statusBarHeight || 44 });
    } catch (e) {}

    var babyId = options && options.id ? options.id : '';
    if (!babyId) {
      try { babyId = wx.getStorageSync(STORAGE_KEYS.currentBabyId) || ''; } catch (e) {}
    }
    this.setData({ babyId: babyId });

    if (babyId) {
      this.loadBabyData(babyId);
    } else {
      this.setData({ isLoading: false });
    }
  },

  loadBabyData: function (babyId) {
    var _this = this;
    var token = tokenManager.getAccessToken();

    wx.request({
      url: API_CONFIG.baseURL + '/babies/' + babyId,
      method: 'GET',
      header: { 'Authorization': 'Bearer ' + token },
      timeout: 8000,
      success: function (res) {
        if (res.statusCode === 200 && res.data) {
          _this.setBabyData(res.data);
        } else {
          _this.loadFromLocal(babyId);
        }
        _this.setData({ isLoading: false });
      },
      fail: function () {
        _this.loadFromLocal(babyId);
        _this.setData({ isLoading: false });
      },
    });
  },

  loadFromLocal: function (babyId) {
    try {
      var stored = wx.getStorageSync('album_babies') || [];
      for (var i = 0; i < stored.length; i++) {
        if (stored[i].id === babyId) {
          this.setBabyData(stored[i]);
          return;
        }
      }
    } catch (e) {}
  },

  setBabyData: function (baby) {
    var avatar = baby.avatar || '';
    this.setData({
      babyName: baby.name || '小星星',
      gender: baby.gender || 'female',
      birthDate: baby.birthDate || '',
      avatarUrl: avatar.indexOf('http') === 0 ? avatar : '',
      avatarEmoji: avatar.indexOf('http') !== 0 && avatar ? avatar : '👶',
    });
  },

  // ---- 日期选择 ----
  onDateChange: function (e) {
    this.setData({ birthDate: e.detail.value });
  },

  // ---- 里程碑选择 ----
  onMilestoneTap: function () {
    this.setData({ showMilestonePicker: !this.data.showMilestonePicker });
  },

  onMilestoneSelect: function (e) {
    var index = parseInt(e.currentTarget.dataset.index);
    this.setData({
      selectedMilestone: MILESTONES[index],
      milestoneIndex: index,
      showMilestonePicker: false,
    });
  },

  // ---- 描述文本 ----
  onDescriptionInput: function (e) {
    var value = e.detail.value || '';
    if (value.length > this.data.maxChars) {
      value = value.substring(0, this.data.maxChars);
    }
    this.setData({
      description: value,
      charCount: value.length,
    });
  },

  // ---- 头像 ----
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
                avatarEmoji: '',
              });
              _this.uploadAvatar(tempFile.tempFilePath);
            }
          },
        });
      },
    });
  },

  uploadAvatar: function (filePath) {
    if (!filePath || !this.data.babyId) return;
    var token = tokenManager.getAccessToken();
    var _this = this;

    wx.uploadFile({
      url: API_CONFIG.baseURL + '/babies/' + this.data.babyId + '/avatar',
      filePath: filePath,
      name: 'file',
      header: { 'Authorization': 'Bearer ' + token },
      success: function (res) {
        if (res.statusCode === 200) {
          try { JSON.parse(res.data); } catch (e) {}
        }
      },
      fail: function () {},
    });
  },

  // ---- 保存 ----
  onSave: function () {
    if (this.data.isSaving) return;
    this.setData({ isSaving: true });

    var babyData = {
      name: this.data.babyName,
      gender: this.data.gender,
      birthDate: this.data.birthDate,
      avatar: this.data.avatarUrl || this.data.avatarEmoji,
    };

    if (this.data.babyId) {
      this.updateBaby(babyData);
    } else {
      this.createBaby(babyData);
    }
  },

  updateBaby: function (babyData) {
    var _this = this;
    var token = tokenManager.getAccessToken();

    wx.request({
      url: API_CONFIG.baseURL + '/babies/' + this.data.babyId,
      method: 'PUT',
      data: babyData,
      header: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
      timeout: 10000,
      success: function (res) {
        _this.setData({ isSaving: false });
        if (res.statusCode === 200) {
          _this.syncLocal(babyData);
          wx.showToast({ title: '保存成功', icon: 'success' });
          wx.navigateBack();
        } else {
          wx.showToast({ title: '保存失败', icon: 'none' });
        }
      },
      fail: function () {
        _this.setData({ isSaving: false });
        _this.syncLocal(babyData);
        wx.showToast({ title: '已保存到本地', icon: 'success' });
        wx.navigateBack();
      },
    });
  },

  createBaby: function (babyData) {
    var _this = this;
    var token = tokenManager.getAccessToken();

    wx.request({
      url: API_CONFIG.baseURL + '/babies/',
      method: 'POST',
      data: babyData,
      header: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
      timeout: 10000,
      success: function (res) {
        _this.setData({ isSaving: false });
        if (res.statusCode === 201 && res.data && res.data.id) {
          try { wx.setStorageSync(STORAGE_KEYS.currentBabyId, res.data.id); } catch (e) {}
          wx.showToast({ title: '创建成功', icon: 'success' });
          wx.navigateBack();
        } else {
          wx.showToast({ title: '创建失败', icon: 'none' });
        }
      },
      fail: function () {
        _this.setData({ isSaving: false });
        wx.showToast({ title: '网络错误', icon: 'none' });
      },
    });
  },

  syncLocal: function (babyData) {
    try {
      var stored = wx.getStorageSync('album_babies') || [];
      var found = false;
      for (var i = 0; i < stored.length; i++) {
        if (stored[i].id === this.data.babyId) {
          stored[i] = Object.assign(stored[i], babyData);
          found = true;
          break;
        }
      }
      if (!found && this.data.babyId) {
        babyData['id'] = this.data.babyId;
        stored.push(babyData);
      }
      try { wx.setStorageSync('album_babies', stored); } catch (e) {}
    } catch (e) {}
  },

  onBack: function () {
    wx.navigateBack();
  },
});