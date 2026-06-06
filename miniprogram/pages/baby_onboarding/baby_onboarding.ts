// @ts-nocheck
// baby_onboarding.ts - 首次登录宝宝信息填写页
// 对接后端 API：POST /api/v1/babies/ 保存到云端

const BABY_KEY = 'baby_diary_baby_profile';
const CURRENT_BABY_KEY = 'baby_diary_current_baby_id';
const API_BASE = 'http://101.126.41.146:8000/api/v1';

Page({
  data: {
    safeTop: 44,
    nickname: '',
    avatarEmoji: '👶',
    avatarUrl: '',
    isSaving: false,
    inputFocus: false,
  },

  onLoad() {
    try {
      var info = wx.getWindowInfo();
      this.setData({ safeTop: info.statusBarHeight || 44 });
    } catch (e) {}
    setTimeout(() => { this.setData({ inputFocus: true }); }, 500);
  },

  onBack() { wx.navigateBack(); },

  onAvatarTap() {
    var _this = this;
    wx.showActionSheet({
      itemList: ['拍照', '从相册选择'],
      success: function (res) {
        wx.chooseMedia({
          count: 1, mediaType: ['image'],
          sourceType: [res.tapIndex === 0 ? 'camera' : 'album'],
          success: function (mediaRes) {
            var f = mediaRes.tempFiles[0];
            if (f) _this.setData({ avatarUrl: f.tempFilePath || '', avatarEmoji: '' });
          },
        });
      },
    });
  },

  onNicknameInput(e) { this.setData({ nickname: e.detail.value }); },

  onSave() {
    var name = this.data.nickname.trim();
    if (!name) { wx.showToast({ title: '请输入宝宝昵称', icon: 'none' }); return; }
    this.setData({ isSaving: true });
    var _this = this;

    var token = '';
    try { token = wx.getStorageSync('baby_diary_access_token') || ''; } catch (e) {}

    wx.request({
      url: API_BASE + '/babies/',
      method: 'POST',
      data: { name: name, gender: null, birthDate: null, avatar: _this.data.avatarUrl || _this.data.avatarEmoji },
      header: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
      success: function (res) {
        if (res.statusCode === 200 || res.statusCode === 201) {
          var baby = res.data;
          var profile = { id: baby.id || 'baby_' + Date.now(), name: name, avatar: _this.data.avatarUrl || _this.data.avatarEmoji, createdAt: new Date().toISOString() };
          try { wx.setStorageSync(BABY_KEY, profile); wx.setStorageSync(CURRENT_BABY_KEY, profile.id); } catch (e) {}
          wx.showToast({ title: '保存成功', icon: 'success', duration: 1000 });
          setTimeout(function () { wx.redirectTo({ url: '/pages/album_home/album_home' }); }, 1000);
        } else { _this.setData({ isSaving: false }); wx.showToast({ title: '保存失败', icon: 'none' }); }
      },
      fail: function () {
        // 离线降级
        var profile = { id: 'baby_' + Date.now(), name: name, avatar: _this.data.avatarUrl || _this.data.avatarEmoji, createdAt: new Date().toISOString() };
        try { wx.setStorageSync(BABY_KEY, profile); wx.setStorageSync(CURRENT_BABY_KEY, profile.id); } catch (e) {}
        wx.showToast({ title: '已保存到本地', icon: 'success', duration: 1000 });
        setTimeout(function () { wx.redirectTo({ url: '/pages/album_home/album_home' }); }, 1000);
      },
    });
  },
});