// @ts-nocheck
// baby_list.ts - 宝宝列表页，对接后端 API

import { API_CONFIG } from '../../config/api';
import { STORAGE_KEYS } from '../../constants/storage_keys';
var tokenManager = require('../../services/request').tokenManager;

Page({
  data: {
    safeTop: 44,
    babies: [],
    isLoading: false,
    currentBabyId: '',
  },

  onLoad() {
    try {
      var info = wx.getWindowInfo();
      this.setData({ safeTop: info.statusBarHeight || 44 });
    } catch (e) {}
    this.loadCurrentBabyId();
    this.loadBabies();
  },

  onShow() {
    this.loadCurrentBabyId();
    this.loadBabies();
  },

  loadCurrentBabyId() {
    var id = '';
    try { id = wx.getStorageSync(STORAGE_KEYS.currentBabyId) || ''; } catch (e) {}
    this.setData({ currentBabyId: id });
  },

  loadBabies() {
    this.setData({ isLoading: true });
    var _this = this;
    var token = tokenManager.getAccessToken();

    wx.request({
      url: API_CONFIG.baseURL + '/babies/',
      method: 'GET',
      header: { 'Authorization': 'Bearer ' + token },
      timeout: 8000,
      success: function (res) {
        if (res.statusCode === 200 && Array.isArray(res.data)) {
          _this.setData({ babies: res.data, isLoading: false });
        } else {
          _this.fallbackBabies();
        }
      },
      fail: function () { _this.fallbackBabies(); },
    });
  },

  fallbackBabies() {
    try {
      var stored = wx.getStorageSync('album_babies');
      if (Array.isArray(stored) && stored.length > 0) {
        this.setData({ babies: stored, isLoading: false });
        return;
      }
    } catch (e) {}
    this.setData({ babies: this.getMockBabies(), isLoading: false });
  },

  getMockBabies() {
    return [
      { id: 'demo-1', name: '小星星', avatar: '👶', gender: 'female', ageText: '6个月3天 · 女宝', birthDate: '2025-12-01' },
      { id: 'demo-2', name: '小月亮', avatar: '👧', gender: 'male', ageText: '2个月15天 · 男宝', birthDate: '2026-03-20' },
    ];
  },

  onBabyTap(e) {
    var id = e.currentTarget.dataset.id;
    try { wx.setStorageSync(STORAGE_KEYS.currentBabyId, id); } catch (e) {}
    wx.navigateTo({ url: '/pages/baby_profile/baby_profile?id=' + id });
  },

  onAddBaby() { wx.navigateTo({ url: '/pages/baby_onboarding/baby_onboarding' }); },
  onBack() { wx.navigateBack(); },

  // ========== 删除宝宝（长按触发） ==========

  onBabyLongPress(e) {
    var id = e.currentTarget.dataset.id;
    var name = e.currentTarget.dataset.name || '';
    var _this = this;

    wx.showModal({
      title: '删除宝宝',
      content: '确认删除「' + name + '」？此操作不可恢复，该宝宝的所有照片、视频和成长记录将被永久删除。',
      confirmText: '确认删除',
      cancelText: '取消',
      confirmColor: '#e64340',
      success: function (res) {
        if (res.confirm) {
          _this.deleteBaby(id);
        }
      },
    });
  },

  deleteBaby(babyId) {
    var _this = this;
    var token = tokenManager.getAccessToken();

    wx.showLoading({ title: '删除中...' });
    wx.request({
      url: API_CONFIG.baseURL + '/babies/' + babyId,
      method: 'DELETE',
      header: { 'Authorization': 'Bearer ' + token },
      timeout: 8000,
      success: function (res) {
        wx.hideLoading();
        if (res.statusCode === 200) {
          wx.showToast({ title: '已删除', icon: 'success' });
          _this.loadBabies();
        } else {
          wx.showToast({ title: '删除失败', icon: 'none' });
        }
      },
      fail: function () {
        wx.hideLoading();
        wx.showToast({ title: '网络错误', icon: 'none' });
      },
    });
  },
});