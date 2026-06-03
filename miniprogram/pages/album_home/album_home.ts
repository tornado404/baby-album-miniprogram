// @ts-nocheck
Page({
  data: {
    safeTop: 44,
    currentMonthLabel: '全部',
    currentBabyId: '',
    currentBaby: null,
    babies: [],
    mediaList: [],
    isEmpty: false,
    uploaderVisible: false,
    isLoading: false,
    hasMore: true,
    isLoadingMore: false,
    page: 1,
    pageSize: 20,
    filterMinAge: null,
    filterMaxAge: null,
    filterOptions: [
      { label: '全部', value: null, minAge: null, maxAge: null, active: true }
    ],
    babyAgeText: ''
  },

  onLoad: function () {
    try {
      var info = wx.getSystemInfoSync();
      this.setData({ safeTop: info.statusBarHeight || 44 });
    } catch (e) {}
    this.initPage();
  },

  initPage: function () {
    // Static demo data for UI testing
    this.setData({
      currentBabyId: 'demo-1',
      currentBaby: { id: 'demo-1', name: '小星星', birthDate: '2025-12-01', gender: 'female' },
      babyAgeText: '6个月3天 · 女宝',
      mediaList: [
        { id: 'm1', title: '第一次翻身', url: '', thumbnailUrl: '', cardColor: 'pink', captureDate: '2026-05-01' },
        { id: 'm2', title: '学坐啦', url: '', thumbnailUrl: '', cardColor: 'blue', captureDate: '2026-05-10' },
        { id: 'm3', title: '今天会笑了', url: '', thumbnailUrl: '', cardColor: 'beige', captureDate: '2026-05-15' },
        { id: 'm4', title: '新玩具', url: '', thumbnailUrl: '', cardColor: 'mint', captureDate: '2026-05-20' }
      ],
      filterOptions: [
        { label: '全部', value: null, active: true },
        { label: '7个月', value: 7, active: false },
        { label: '6个月', value: 6, active: false },
        { label: '5个月', value: 5, active: false },
        { label: '4个月', value: 4, active: false },
        { label: '3个月', value: 3, active: false }
      ],
      isLoading: false
    });
  },

  onFilterSelect: function (e) {
    var value = e.currentTarget.dataset.value;
    var opts = this.data.filterOptions.map(function (o) {
      o.active = o.value === value;
      return o;
    });
    this.setData({ filterOptions: opts });
  },

  onBabySelect: function () {
    wx.navigateTo({ url: '/pages/baby_profile/baby_profile' });
  },

  onMediaTap: function (e) {
    var id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: '/pages/media_detail/media_detail?id=' + id });
  },

  onUploadTap: function () {
    wx.showToast({ title: '功能开发中', icon: 'none' });
  },

  goToSettings: function () {
    wx.redirectTo({ url: '/pages/settings/settings' });
  },

  goToBabyProfile: function () {
    wx.navigateTo({ url: '/pages/baby_profile/baby_profile' });
  }
});