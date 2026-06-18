// achievements.ts - 成就徽章页
import { API_CONFIG } from '../../config/api';

Page({
  data: {
    safeTop: 44,
    badges: [],
    totalBadgeCount: 0,
    i18n: {
      title: '成就徽章',
      earned: '已获得',
      badges: '枚',
      empty: '暂无已获得的徽章',
      emptyHint: '多上传记录来解锁徽章吧',
    },
  },

  onLoad() {
    try {
      var info = wx.getWindowInfo();
      this.setData({ safeTop: info.statusBarHeight || 44 });
    } catch (e) {}

    this.loadAchievements();
  },

  loadAchievements() {
    var _this = this;
    var token = '';
    try { token = wx.getStorageSync('baby_diary_access_token') || ''; } catch (e) {}

    if (!token) {
      wx.showToast({ title: '请先登录', icon: 'none' });
      return;
    }

    wx.request({
      url: API_CONFIG.baseURL + '/analytics/achievements',
      method: 'GET',
      header: { 'Authorization': 'Bearer ' + token },
      timeout: 8000,
      success: function (res) {
        if (res.statusCode === 200 && res.data && res.data.data) {
          var allBadges = res.data.data.badges || [];
          var unlocked = [];
          for (var i = 0; i < allBadges.length; i++) {
            if (allBadges[i].unlocked) {
              unlocked.push(allBadges[i]);
            }
          }
          _this.setData({
            badges: unlocked,
            totalBadgeCount: allBadges.length,
          });
        }
      },
      fail: function () {
        wx.showToast({ title: '网络错误', icon: 'none' });
      },
    });
  },

  // 格式化日期
  formatDate(isoStr) {
    if (!isoStr) return '';
    var parts = isoStr.split('T');
    if (parts.length > 0) {
      return parts[0];
    }
    return '';
  },

  goBack() {
    wx.navigateBack({ delta: 1 });
  },
});