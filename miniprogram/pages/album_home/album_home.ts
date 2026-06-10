// @ts-nocheck
// album_home.ts - 首页，对接后端 API
// 使用统一服务层 babyApi / mediaApi

import { babyApi } from '../../services/baby_api';
import { mediaApi } from '../../services/media_api';
import { STORAGE_KEYS } from '../../constants/storage_keys';

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
    babyAgeText: '',
    headerCollapsed: false,
    headerHeight: 136
  },

  onLoad: function () {
    try {
      var info = wx.getWindowInfo();
      this.setData({ safeTop: info.statusBarHeight || 44 });
    } catch (e) {}

    // Read currentBabyId from storage
    try {
      var storedId = wx.getStorageSync(STORAGE_KEYS.currentBabyId) || '';
      this.setData({ currentBabyId: storedId });
    } catch (e) {}

    this.initPage();
    this.loadBabies();
  },

  onShow: function () {
    // 从其他页面返回时刷新数据（如上传完成后返回）
    var babyId = '';
    try {
      babyId = wx.getStorageSync(STORAGE_KEYS.currentBabyId) || '';
    } catch (e) {}

    if (babyId && babyId !== this.data.currentBabyId) {
      this.setData({ currentBabyId: babyId });
      this.loadBabies();
      this.fetchBabyInfo(babyId);
      this.fetchMediaList(babyId, 1);
    } else if (babyId) {
      // babyId 没变但也刷新数据（确保最新）
      this.fetchBabyInfo(babyId);
      this.fetchMediaList(babyId, 1);
    } else {
      // 没有当前宝宝 ID，显示空状态引导
      this.setData({ isEmpty: true });
    }
  },

  initPage: function () {
    var _this = this;
    var babyId = this.data.currentBabyId || '';

    this.setData({ isLoading: true });

    // 1. 尝试从 API 加载宝宝信息
    this.fetchBabyInfo(babyId);

    // 2. 尝试从 API 加载媒体列表
    this.fetchMediaList(babyId, 1);
  },

  fetchBabyInfo: function (babyId) {
    var _this = this;
    if (!babyId) {
      this.fallbackBabyInfo(babyId);
      return;
    }
    babyApi.get(babyId).then(function (baby) {
      _this.setData({
        currentBaby: baby,
        babyAgeText: baby.birthDate ? _this.calcAge(baby.birthDate) + ' · ' + (baby.gender === 'male' ? '男宝' : '女宝') : '',
        isLoading: false,
      });
    }).catch(function () {
      _this.fallbackBabyInfo(babyId);
    });
  },

  fallbackBabyInfo: function (babyId) {
    // 从本地缓存读取
    var babies = [];
    try {
      var stored = wx.getStorageSync('album_babies');
      if (Array.isArray(stored)) babies = stored;
    } catch (e) {}

    var currentBaby = null;
    for (var i = 0; i < babies.length; i++) {
      if (babies[i].id === babyId) { currentBaby = babies[i]; break; }
    }
    if (!currentBaby && babies.length > 0) { currentBaby = babies[0]; }

    this.setData({
      currentBaby: currentBaby,
      babyAgeText: currentBaby ? (currentBaby.birthDate ? '未知年龄' : '') : '',
      isLoading: false,
    });
  },

  fetchMediaList: function (babyId, page) {
    var _this = this;
    if (!babyId) { this.fallbackMediaList(); return; }

    mediaApi.list(babyId, page).then(function (items) {
      if (Array.isArray(items) && items.length > 0) {
        var mapped = items.map(function (m) {
          return {
            id: m.id, title: m.title || '', url: m.cosUrl || '',
            thumbnailUrl: m.thumbnailUrl || m.cosUrl || '',
            cardColor: _this.getCardColor(m.id),
            captureDate: m.captureDate,
          };
        });
        // 分页合并：如果是第一页直接替换，否则追加
        var list = page === 1 ? mapped : _this.data.mediaList.concat(mapped);
        _this.setData({
          mediaList: list,
          isEmpty: list.length === 0,
          isLoading: false,
          isLoadingMore: false,
          hasMore: items.length >= _this.data.pageSize,
          page: page,
        });
      } else {
        if (page === 1) { _this.fallbackMediaList(); }
        else { _this.setData({ isLoadingMore: false, hasMore: false }); }
      }
    }).catch(function () {
      if (page === 1) { _this.fallbackMediaList(); }
      else { _this.setData({ isLoadingMore: false }); }
    });
  },

  fallbackMediaList: function () {
    // 从本地缓存读取媒体列表
    var mediaList = [];
    try {
      var stored = wx.getStorageSync('album_media');
      if (Array.isArray(stored) && stored.length > 0) mediaList = stored;
    } catch (e) {}

    if (mediaList.length === 0) {
      mediaList = this.getMockMediaList();
    }

    this.setData({
      mediaList: mediaList,
      isEmpty: mediaList.length === 0,
      isLoading: false,
    });
  },

  getMockMediaList: function () {
    return [
      { id: 'm1', title: '第一次翻身', url: '', thumbnailUrl: '', cardColor: 'pink', captureDate: '2026-05-01' },
      { id: 'm2', title: '学坐啦', url: '', thumbnailUrl: '', cardColor: 'blue', captureDate: '2026-05-10' },
      { id: 'm3', title: '今天会笑了', url: '', thumbnailUrl: '', cardColor: 'beige', captureDate: '2026-05-15' },
      { id: 'm4', title: '新玩具', url: '', thumbnailUrl: '', cardColor: 'mint', captureDate: '2026-05-20' },
    ];
  },

  loadMoreMedia: function () {
    if (this.data.isLoadingMore || !this.data.hasMore || !this.data.currentBabyId) return;
    this.setData({ isLoadingMore: true });
    this.fetchMediaList(this.data.currentBabyId, this.data.page + 1);
  },

  loadBabies: function () {
    var _this = this;
    babyApi.list().then(function (babies) {
      if (Array.isArray(babies)) {
        _this.setData({ babies: babies, isEmpty: babies.length === 0 });
        // 缓存到本地
        if (babies.length > 0) {
          try { wx.setStorageSync('album_babies', babies); } catch (e) {}
          // 如果当前没有选中的宝宝，或选中的宝宝不在列表中，自动选第一个
          var currentId = _this.data.currentBabyId;
          var found = false;
          for (var i = 0; i < babies.length; i++) {
            if (babies[i].id === currentId) { found = true; break; }
          }
          if (!currentId || !found) {
            var firstBaby = babies[0];
            _this.setData({ currentBabyId: firstBaby.id, currentBaby: firstBaby });
            try { wx.setStorageSync(STORAGE_KEYS.currentBabyId, firstBaby.id); } catch (e) {}
            // 加载第一个宝宝的媒体
            _this.fetchBabyInfo(firstBaby.id);
            _this.fetchMediaList(firstBaby.id, 1);
          }
        }
      } else {
        _this.fallbackBabies();
      }
    }).catch(function () {
      _this.fallbackBabies();
    });
  },

  fallbackBabies: function () {
    var _this = this;
    try {
      var stored = wx.getStorageSync('album_babies');
      if (Array.isArray(stored) && stored.length > 0) {
        _this.setData({ babies: stored, isEmpty: false });
        // auto-select if needed
        var currentId = _this.data.currentBabyId;
        var found = false;
        for (var i = 0; i < stored.length; i++) {
          if (stored[i].id === currentId) { found = true; break; }
        }
        if (!currentId || !found) {
          var firstBaby = stored[0];
          _this.setData({ currentBabyId: firstBaby.id, currentBaby: firstBaby });
          try { wx.setStorageSync(STORAGE_KEYS.currentBabyId, firstBaby.id); } catch (e) {}
        }
        return;
      }
    } catch (e) {}
    // 无任何宝宝数据，显示空状态
    this.setData({ babies: [], isEmpty: true });
  },

  calcAge: function (birthDate) {
    if (!birthDate) return '';
    var parts = birthDate.split('-');
    var birth = new Date(parts[0], parts[1] - 1, parts[2]);
    var now = new Date();
    var months = (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth());
    if (months < 0) months = 0;
    return months + '个月';
  },

  getCardColor: function (id) {
    var colors = ['pink', 'blue', 'beige', 'mint'];
    var hash = 0;
    for (var i = 0; i < id.length; i++) { hash = ((hash << 5) - hash) + id.charCodeAt(i); }
    return colors[Math.abs(hash) % colors.length];
  },

  onContentScroll: function (e) {
    var scrollTop = e.scrollTop || 0;
    var collapsed = scrollTop > 60;
    if (collapsed !== this.data.headerCollapsed) {
      this.setData({ headerCollapsed: collapsed });
    }
    // 分页触发：距底部 < 300px 且不在加载中
    var detail = e.detail || {};
    var threshold = 300;
    var scrollHeight = detail.scrollHeight || 0;
    var clientHeight = detail.clientHeight || 0;
    if (scrollHeight > 0 && clientHeight > 0 &&
        scrollTop + clientHeight >= scrollHeight - threshold &&
        !this.data.isLoadingMore && this.data.hasMore) {
      this.loadMoreMedia();
    }
  },

  onBabyStripTap: function (e) {
    var babyId = e.currentTarget.dataset.id;
    var babies = this.data.babies;
    var currentBaby = null;
    for (var i = 0; i < babies.length; i++) {
      if (babies[i].id === babyId) { currentBaby = babies[i]; break; }
    }
    if (currentBaby) {
      this.setData({
        currentBabyId: babyId, currentBaby: currentBaby, headerCollapsed: false
      });
      try { wx.setStorageSync(STORAGE_KEYS.currentBabyId, babyId); } catch (e) {}
      // 重新加载媒体列表
      this.fetchMediaList(babyId, 1);
    }
  },

  onAddBabyTap: function () { wx.navigateTo({ url: '/pages/baby_onboarding/baby_onboarding' }); },
  onFilterSelect: function (e) {
    var value = e.currentTarget.dataset.value;
    var opts = this.data.filterOptions.map(function (o) { o.active = o.value === value; return o; });
    this.setData({ filterOptions: opts });
  },
  onBabySelect: function () { wx.navigateTo({ url: '/pages/baby_profile/baby_profile' }); },
  onMediaTap: function (e) { wx.navigateTo({ url: '/pages/media_detail/media_detail?id=' + e.currentTarget.dataset.id }); },
  goToSettings: function () { wx.redirectTo({ url: '/pages/settings/settings' }); },
  goToBabyProfile: function () { wx.navigateTo({ url: '/pages/baby_profile/baby_profile' }); },
});
