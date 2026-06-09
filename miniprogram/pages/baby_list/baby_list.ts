// @ts-nocheck
// baby_list.ts - 宝宝列表页，对接后端 API

import { API_CONFIG } from '../../config/api';

Page({
  data: {
    safeTop: 44,
    babies: [],
    isLoading: false,
  },

  onLoad() {
    try {
      var info = wx.getWindowInfo();
      this.setData({ safeTop: info.statusBarHeight || 44 });
    } catch (e) {}
    this.loadBabies();
  },

  onShow() { this.loadBabies(); },

  loadBabies() {
    this.setData({ isLoading: true });
    var _this = this;
    var token = '';
    try { token = wx.getStorageSync('baby_diary_access_token') || ''; } catch (e) {}

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
    try { wx.setStorageSync('baby_diary_current_baby_id', id); } catch (e) {}
    wx.navigateTo({ url: '/pages/baby_profile/baby_profile?id=' + id });
  },

  onAddBaby() { wx.navigateTo({ url: '/pages/baby_onboarding/baby_onboarding' }); },
  onBack() { wx.navigateBack(); },
});