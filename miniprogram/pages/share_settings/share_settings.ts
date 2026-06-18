// share_settings.ts - 分享设置页面，对接后端共享 API
// 使用统一配置中心 API_CONFIG

import { API_CONFIG } from '../../config/api';
import { t } from '../../utils/i18n';
var tokenManager = require('../../services/request').tokenManager;

Page({
  data: {
    safeTop: 44,
    shareList: [],
    babies: [],
    isLoading: true,
    showInvitePopup: false,
    selectedBabyId: '',
    selectedPermission: 'viewer',
    inviteToken: '',
    // i18n
    i18n: {},
  },

  onLoad: function () {
    try {
      var info = wx.getWindowInfo();
      this.setData({ safeTop: info.statusBarHeight || 44 });
    } catch (e) {}

    this.applyI18n();
    this.loadBabies();
    this.loadShareList();
  },

  applyI18n: function () {
    this.setData({
      i18n: {
        title: t('share.title'),
        emptyList: t('share.emptyList'),
        emptyHint: t('share.emptyHint'),
        inviteFamily: t('share.inviteFamily'),
        viewer: t('share.viewer'),
        editor: t('share.editor'),
        revoke: t('share.revoke'),
        createInvite: t('share.createInvite'),
        selectBaby: t('share.selectBaby'),
        permission: t('share.permission'),
        inviteCode: t('share.inviteCode'),
        copy: t('share.copy'),
        cancel: t('common.cancel'),
      },
    });
  },

  getToken: function () {
    return tokenManager.getAccessToken();
  },

  // ========== 数据加载 ==========

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
          _this.setData({ babies: res.data });
        }
      },
      fail: function () {},
    });
  },

  loadShareList: function () {
    var _this = this;
    var token = this.getToken();

    wx.request({
      url: API_CONFIG.baseURL + '/share/relations',
      method: 'GET',
      header: { 'Authorization': 'Bearer ' + token },
      timeout: 8000,
      success: function (res) {
        if (res.statusCode === 200 && res.data) {
          var list = res.data;
          if (!Array.isArray(list)) {
            list = [];
          }
          _this.setData({ shareList: list, isLoading: false });
        } else {
          _this.setData({ shareList: [], isLoading: false });
        }
      },
      fail: function () {
        _this.setData({ shareList: [], isLoading: false });
      },
    });
  },

  // ========== 邀请操作 ==========

  onInviteTap: function () {
    var babies = this.data.babies;
    var selectedBabyId = babies.length > 0 ? babies[0].id : '';
    this.setData({ showInvitePopup: true, selectedBabyId: selectedBabyId, inviteToken: '' });
  },

  onInvitePopupClose: function () {
    this.setData({ showInvitePopup: false });
  },

  onBabySelect: function (e) {
    this.setData({ selectedBabyId: e.currentTarget.dataset.id });
  },

  onPermissionSelect: function (e) {
    this.setData({ selectedPermission: e.currentTarget.dataset.perm });
  },

  onCreateInvite: function () {
    var _this = this;
    var token = this.getToken();
    var babyId = this.data.selectedBabyId;
    var permission = this.data.selectedPermission;

    if (!babyId) {
      wx.showToast({ title: '请选择宝宝', icon: 'none' });
      return;
    }

    wx.request({
      url: API_CONFIG.baseURL + '/share/invitations',
      method: 'POST',
      data: { babyId: babyId, permission: permission },
      header: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
      timeout: 8000,
      success: function (res) {
        if (res.statusCode === 200 && res.data && res.data.token) {
          _this.setData({ inviteToken: res.data.token });
          wx.showToast({ title: '邀请已创建', icon: 'success' });
        } else {
          wx.showToast({ title: '创建失败', icon: 'none' });
        }
      },
      fail: function () {
        wx.showToast({ title: '网络错误', icon: 'none' });
      },
    });
  },

  onCopyToken: function () {
    var token = this.data.inviteToken;
    if (!token) return;
    wx.setClipboardData({
      data: token,
      success: function () {
        wx.showToast({ title: '已复制邀请码', icon: 'success' });
      },
    });
  },

  onShareAppMessage: function () {
    var token = this.data.inviteToken;
    return {
      title: '邀请你一起记录宝宝成长',
      path: '/pages/album_home/album_home?inviteToken=' + (token || ''),
    };
  },

  // ========== 取消共享 ==========

  onRevokeTap: function (e) {
    var _this = this;
    var relationId = e.currentTarget.dataset.id;
    var token = this.getToken();

    wx.showModal({
      title: '确认取消',
      content: '确定要取消此共享关系吗？',
      confirmText: '取消共享',
      confirmColor: '#ff6b6b',
      success: function (res) {
        if (res.confirm) {
          wx.request({
            url: API_CONFIG.baseURL + '/share/relations/' + relationId,
            method: 'DELETE',
            header: { 'Authorization': 'Bearer ' + token },
            timeout: 8000,
            success: function (resp) {
              if (resp.statusCode === 200) {
                wx.showToast({ title: '已取消共享', icon: 'success' });
                _this.loadShareList();
              } else {
                wx.showToast({ title: '取消失败', icon: 'none' });
              }
            },
            fail: function () {
              wx.showToast({ title: '网络错误', icon: 'none' });
            },
          });
        }
      },
    });
  },

  // ========== 导航 ==========

  onBackTap: function () {
    wx.navigateBack({ delta: 1 });
  },
});
