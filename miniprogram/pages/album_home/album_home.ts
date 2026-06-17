// @ts-nocheck
// album_home.ts - 成长 v2 (瀑布流 + 年龄段筛选 + 里程碑分组)

import { API_CONFIG } from '../../config/api';
import { STORAGE_KEYS } from '../../constants/storage_keys';

Page({
  data: {
    safeTop: 44,
    isAuthorMode: true,
    currentFilter: '全部',
    currentBabyId: '',
    currentBaby: null,
    babies: [],
    sections: [],
    isEmpty: false,
    isLoading: false,
    filterOptions: [
      { label: '全部', value: null, minAge: null, maxAge: null },
      { label: '0-1月', value: '0-1', minAge: 0, maxAge: 1 },
      { label: '2-3月', value: '2-3', minAge: 2, maxAge: 3 },
      { label: '4-6月', value: '4-6', minAge: 4, maxAge: 6 },
      { label: '7-12月', value: '7-12', minAge: 7, maxAge: 12 },
      { label: '1岁+', value: '1plus', minAge: 12, maxAge: 999 },
    ],
  },

  onLoad: function () {
    try {
      var info = wx.getWindowInfo();
      this.setData({ safeTop: info.statusBarHeight || 44 });
    } catch (e) {}

    try {
      var storedId = wx.getStorageSync(STORAGE_KEYS.currentBabyId) || '';
      this.setData({ currentBabyId: storedId });
    } catch (e) {}

    this.loadBabies();
  },

  onShow: function () {
    var babyId = '';
    try {
      babyId = wx.getStorageSync(STORAGE_KEYS.currentBabyId) || '';
    } catch (e) {}

    if (babyId && babyId !== this.data.currentBabyId) {
      this.setData({ currentBabyId: babyId });
      this.loadBabies();
    } else if (babyId) {
      this.loadData(babyId);
    }
  },

  loadData: function (babyId) {
    if (!babyId) return;
    this.setData({ isLoading: true });
    this.fetchGroups(babyId);
  },

  getToken: function () {
    try { return wx.getStorageSync('baby_diary_access_token') || ''; } catch (e) { return ''; }
  },

  fetchGroups: function (babyId) {
    var _this = this;
    var token = this.getToken();

    if (!babyId || !token) {
      this.useMockData();
      return;
    }

    // Try to fetch media list and group by milestone
    wx.request({
      url: API_CONFIG.baseURL + '/media/',
      method: 'GET',
      data: { babyId: babyId },
      header: { 'Authorization': 'Bearer ' + token },
      timeout: 8000,
      success: function (res) {
        if (res.statusCode === 200 && res.data) {
          var items = res.data.map(function (m) {
            return _this.normalizeMedia(m);
          });
          var sections = _this.groupByMilestone(items);
          _this.setData({
            sections: sections,
            isEmpty: sections.length === 0,
            isLoading: false,
          });
        } else {
          _this.useMockData();
        }
      },
      fail: function () { _this.useMockData(); },
    });
  },

  useMockData: function () {
    var mockItems = [
      // 第一次翻身
      { id: 'm1', title: '自己翻身啦', url: '', thumbnailUrl: '', captureDate: '2026-05-20', displayDate: '05.20', mediaType: 'image', milestone: '第一次翻身 🎉', milestoneIcon: '⭐', monthAge: 5 },
      { id: 'm2', title: '努力练习中', url: '', thumbnailUrl: '', captureDate: '2026-05-19', displayDate: '05.19', mediaType: 'image', milestone: '第一次翻身 🎉', milestoneIcon: '⭐', monthAge: 5 },
      // 开始学坐
      { id: 'm3', title: '靠着沙发坐', url: '', thumbnailUrl: '', captureDate: '2026-04-15', displayDate: '04.15', mediaType: 'video', duration: '0:15', milestone: '开始学坐', milestoneIcon: '🧸', monthAge: 4 },
      { id: 'm4', title: '需要扶着', url: '', thumbnailUrl: '', captureDate: '2026-04-10', displayDate: '04.10', mediaType: 'image', milestone: '开始学坐', milestoneIcon: '🧸', monthAge: 4 },
      // 会笑出声
      { id: 'm5', title: '咯咯笑', url: '', thumbnailUrl: '', captureDate: '2026-03-10', displayDate: '03.10', mediaType: 'image', milestone: '会笑出声 😊', milestoneIcon: '😊', monthAge: 3 },
      { id: 'm6', title: '逗笑瞬间', url: '', thumbnailUrl: '', captureDate: '2026-03-08', displayDate: '03.08', mediaType: 'image', milestone: '会笑出声 😊', milestoneIcon: '😊', monthAge: 3 },
    ];
    var sections = this.groupByMilestone(mockItems);
    this.setData({
      sections: sections,
      isEmpty: sections.length === 0,
      isLoading: false,
    });
  },

  normalizeMedia: function (m) {
    var captureDate = m.captureDate || '';
    var displayDate = '';
    if (captureDate) {
      var parts = captureDate.split('-');
      if (parts.length >= 3) {
        displayDate = parts[1] + '.' + parts[2];
      }
    }
    return {
      id: m.id,
      title: m.title || '',
      url: m.cosUrl || '',
      thumbnailUrl: m.thumbnailUrl || m.cosUrl || '',
      captureDate: captureDate,
      displayDate: displayDate,
      mediaType: m.mediaType || 'image',
      duration: m.duration || '',
      milestone: m.milestone || '',
      milestoneIcon: m.milestoneIcon || '📷',
      monthAge: m.monthAge || 0,
      cardColor: this.getCardColor(m.id),
    };
  },

  groupByMilestone: function (items) {
    var groups = {};
    for (var i = 0; i < items.length; i++) {
      var item = items[i];
      var key = item.milestone || '其他';
      if (!groups[key]) {
        groups[key] = {
          title: key,
          icon: item.milestoneIcon || '📷',
          dateLabel: this.extractGroupDate(item.captureDate),
          ageLabel: this.extractGroupAge(item.monthAge),
          items: [],
          leftItems: [],
          rightItems: [],
        };
      }
      groups[key].items.push(item);
    }

    var result = [];
    var keys = Object.keys(groups);
    for (var j = 0; j < keys.length; j++) {
      var group = groups[keys[j]];
      var leftItems = [];
      var rightItems = [];
      var gap = 20;
      var cardWidth = 335;
      var leftCol = 0;
      var rightCol = 0;

      for (var k = 0; k < group.items.length; k++) {
        var h = this.getItemHeight(group.items[k]);
        if (leftCol <= rightCol) {
          group.items[k]._col = 'left';
          group.items[k]._height = h;
          leftItems.push(group.items[k]);
          leftCol += h + gap;
        } else {
          group.items[k]._col = 'right';
          group.items[k]._height = h;
          rightItems.push(group.items[k]);
          rightCol += h + gap;
        }
      }

      result.push({
        title: group.title,
        icon: group.icon,
        dateLabel: group.dateLabel,
        ageLabel: group.ageLabel,
        items: group.items,
        leftItems: leftItems,
        rightItems: rightItems,
      });
    }
    return result;
  },

  getItemHeight: function (item) {
    // Heights vary to create waterfall effect
    if (item.mediaType === 'video') return 240;
    var heights = [200, 220, 180, 250, 210, 190];
    var hash = 0;
    for (var i = 0; i < item.id.length; i++) { hash = ((hash << 5) - hash) + item.id.charCodeAt(i); }
    return heights[Math.abs(hash) % heights.length];
  },

  extractGroupDate: function (captureDate) {
    if (!captureDate) return '';
    var d = captureDate.replace(/-/g, '/');
    var date = new Date(d);
    if (isNaN(date.getTime())) return '';
    var y = date.getFullYear();
    var m = ('0' + (date.getMonth() + 1)).slice(-2);
    var day = ('0' + date.getDate()).slice(-2);
    return y + '.' + m + '.' + day;
  },

  extractGroupAge: function (monthAge) {
    if (monthAge == null) return '';
    return monthAge + '个月' + (monthAge % 30 > 0 ? Math.floor(monthAge % 30) + '天' : '');
  },

  loadBabies: function () {
    var _this = this;
    var token = this.getToken();

    wx.request({
      url: API_CONFIG.baseURL + '/babies/',
      method: 'GET',
      header: { 'Authorization': 'Bearer ' + token },
      timeout: 8000,
      success: function (res) {
        if (res.statusCode === 200 && Array.isArray(res.data)) {
          var babies = res.data;
          _this.setData({ babies: babies });
          if (babies.length > 0) {
            try { wx.setStorageSync('album_babies', babies); } catch (e) {}
            var currentId = _this.data.currentBabyId;
            var found = false;
            for (var i = 0; i < babies.length; i++) {
              if (babies[i].id === currentId) { found = true; break; }
            }
            if (!currentId || !found) {
              var firstBaby = babies[0];
              _this.setData({ currentBabyId: firstBaby.id, currentBaby: firstBaby });
              try { wx.setStorageSync(STORAGE_KEYS.currentBabyId, firstBaby.id); } catch (e) {}
            }
            var targetId = _this.data.currentBabyId;
            if (targetId) _this.loadData(targetId);
          } else {
            _this.setData({ isEmpty: true, isLoading: false });
            _this.useMockData();
          }
        } else {
          _this.fallbackBabies();
        }
      },
      fail: function () { _this.fallbackBabies(); },
    });
  },

  fallbackBabies: function () {
    var _this = this;
    try {
      var stored = wx.getStorageSync('album_babies');
      if (Array.isArray(stored) && stored.length > 0) {
        _this.setData({ babies: stored });
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
        _this.loadData(_this.data.currentBabyId);
        return;
      }
    } catch (e) {}
    _this.useMockData();
  },

  getCardColor: function (id) {
    var colors = ['#f1dce2', '#dceaf1', '#f4e6d6', '#e2f1e6'];
    var hash = 0;
    for (var i = 0; i < id.length; i++) { hash = ((hash << 5) - hash) + id.charCodeAt(i); }
    return colors[Math.abs(hash) % colors.length];
  },

  formatDate: function (dateStr) {
    if (!dateStr) return '';
    var parts = dateStr.split('-');
    if (parts.length < 3) return dateStr;
    return parts[1] + '.' + parts[2];
  },

  onFilterSelect: function (e) {
    var value = e.currentTarget.dataset.value;
    this.setData({ currentFilter: value || '全部' });
  },

  onMediaTap: function (e) {
    var id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: '/pages/media_detail/media_detail?id=' + id });
  },

  onMenuTap: function (e) {
    var id = e.currentTarget.dataset.id;
    // Show action sheet for the media item
    wx.showActionSheet({
      itemList: ['编辑', '删除', '分享'],
      success: function (res) {
        if (res.tapIndex === 0) {
          // Edit
        } else if (res.tapIndex === 1) {
          // Delete
        } else if (res.tapIndex === 2) {
          // Share
        }
      },
    });
  },

  goToRecord: function () {
    wx.redirectTo({ url: '/pages/upload/upload' });
  },

  goToProfile: function () {
    wx.redirectTo({ url: '/pages/settings/settings' });
  },

  onContentScroll: function (e) {
    // Optional scroll handling
  },
});