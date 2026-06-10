// @ts-nocheck
// baby_list.ts - 宝宝列表页，对接后端 API

import { babyApi } from '../../services/baby_api';
import { STORAGE_KEYS } from '../../constants/storage_keys';

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
    babyApi.list().then(function (babies) {
      if (Array.isArray(babies)) {
        _this.setData({ babies: babies, isLoading: false });
      } else {
        _this.fallbackBabies();
      }
    }).catch(function () {
      _this.fallbackBabies();
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
});