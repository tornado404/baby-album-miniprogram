// @ts-nocheck
// journey.ts - 成长历程页面

import { API_CONFIG } from '../../config/api';

Page({
  data: {
    safeTop: 44,
    currentBaby: null,
    babyAgeText: '',
    totalMedia: 0,
    mediaList: [],
    groupedMedia: [],
    milestones: [
      { key: 'newborn', icon: '🍼' },
      { key: 'head_up', icon: '👶' },
      { key: 'explore', icon: '👐' },
      { key: 'teething', icon: '🦷' },
      { key: 'toddler', icon: '🚶' },
      { key: 'walking', icon: '🏃' },
      { key: 'language', icon: '🗣️' },
      { key: 'creative', icon: '🎨' },
    ],
    isLoading: false,
  },

  onLoad() {
    try { var info = wx.getWindowInfo(); this.setData({ safeTop: info.statusBarHeight || 44 }); } catch (e) {}
    this.loadData();
  },

  onShow() { this.loadData(); },

  getToken() { try { return wx.getStorageSync('baby_diary_access_token') || ''; } catch (e) { return ''; } },

  loadData() {
    this.setData({ isLoading: true });
    this.loadBabyInfo();
    this.loadMedia();
  },

  loadBabyInfo() {
    var _this = this;
    var token = this.getToken();
    var babyId = '';
    try { babyId = wx.getStorageSync('baby_diary_current_baby_id') || ''; } catch (e) {}
    if (!babyId || !token) { this.fallbackBaby(); return; }

    wx.request({
      url: API_CONFIG.baseURL + '/babies/' + babyId,
      method: 'GET',
      header: { 'Authorization': 'Bearer ' + token },
      success: function (res) {
        if (res.statusCode === 200) {
          var b = res.data;
          var age = '';
          if (b.birthDate) {
            var p = b.birthDate.split('-');
            var birth = new Date(p[0], p[1]-1, p[2]);
            var now = new Date();
            var m = (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth());
            if (m >= 12) age = Math.floor(m/12) + '岁' + (m%12) + '个月';
            else age = m + '个月';
          }
          _this.setData({ currentBaby: b, babyAgeText: age });
        } else { _this.fallbackBaby(); }
      },
      fail: function () { _this.fallbackBaby(); },
    });
  },

  fallbackBaby() {
    this.setData({ currentBaby: { name: '小星星', avatar: '👶' }, babyAgeText: '6个月' });
  },

  loadMedia() {
    var _this = this;
    var token = this.getToken();
    var babyId = '';
    try { babyId = wx.getStorageSync('baby_diary_current_baby_id') || ''; } catch (e) {}
    if (!babyId || !token) { this.loadFallback(); return; }

    wx.request({
      url: API_CONFIG.baseURL + '/media/',
      method: 'GET',
      data: { babyId: babyId, archived: 'true' },
      header: { 'Authorization': 'Bearer ' + token },
      success: function (res) {
        if (res.statusCode === 200 && Array.isArray(res.data)) {
          var list = res.data;
          _this.setData({ mediaList: list, totalMedia: list.length, isLoading: false });
          _this.groupByMonth(list);
        } else { _this.loadFallback(); }
      },
      fail: function () { _this.loadFallback(); },
    });
  },

  groupByMonth(list) {
    var groups = {};
    for (var i = 0; i < list.length; i++) {
      var m = list[i];
      var monthKey = (m.captureDate || '').substring(0, 7);
      if (!monthKey) continue;
      if (!groups[monthKey]) groups[monthKey] = { month: monthKey, items: [] };
      groups[monthKey].items.push(m);
    }
    var result = [];
    var keys = Object.keys(groups).sort().reverse();
    for (var j = 0; j < keys.length; j++) {
      result.push(groups[keys[j]]);
    }
    this.setData({ groupedMedia: result });
  },

  loadFallback() {
    var mock = [
      { month: '2026-06', items: [
        { id: 'm1', title: '第一次翻身', captureDate: '2026-06-15', locationName: '📍 家里', tags: ['里程碑'], moment: '翻身啦 🎉', type: 'image', cardColor: 'pink' },
        { id: 'm2', title: '公园散步', captureDate: '2026-06-10', locationName: '📍 朝阳公园', tags: ['外出'], type: 'image', cardColor: 'blue' },
      ]},
      { month: '2026-05', items: [
        { id: 'm3', title: '满月照', captureDate: '2026-05-20', locationName: '📍 家里', tags: ['第1月'], type: 'image', cardColor: 'beige' },
      ]},
    ];
    this.setData({ groupedMedia: mock, totalMedia: 3, isLoading: false, currentBaby: { name: '小星星', avatar: '👶' }, babyAgeText: '6个月' });
  },

  onMediaTap(e) {
    var id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: '/pages/media_detail/media_detail?id=' + id });
  },

  onShare() {
    wx.shareAppMessage({
      title: this.data.currentBaby ? (this.data.currentBaby.name + ' 的成长历程') : '宝宝成长历程',
      path: '/pages/journey/journey?shared=true',
    });
  },
});