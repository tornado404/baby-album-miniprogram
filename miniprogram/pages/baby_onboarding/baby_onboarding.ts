// baby_onboarding.ts - 首次登录宝宝信息填写页
// 简化版：仅头像+昵称，保存后跳转首页

const BABY_KEY = 'baby_diary_baby_profile';
const CURRENT_BABY_KEY = 'baby_diary_current_baby_id';

Page({
  data: {
    safeTop: 44,
    nickname: '',
    avatarEmoji: '👶',
    avatarUrl: '',
    isSaving: false,
    inputFocus: false
  },

  onLoad() {
    try {
      const info = wx.getSystemInfoSync();
      this.setData({ safeTop: info.statusBarHeight || 44 });
    } catch (e) {}

    setTimeout(() => {
      this.setData({ inputFocus: true });
    }, 500);
  },

  onBack() {
    wx.navigateBack();
  },

  onAvatarTap() {
    var _this = this;
    wx.showActionSheet({
      itemList: ['拍照', '从相册选择'],
      success: function (res) {
        wx.chooseMedia({
          count: 1,
          mediaType: ['image'],
          sourceType: [res.tapIndex === 0 ? 'camera' : 'album'],
          success: function (mediaRes) {
            var tempFile = mediaRes.tempFiles[0];
            if (tempFile) {
              _this.setData({
                avatarUrl: tempFile.tempFilePath || tempFile.thumbTempFilePath || '',
                avatarEmoji: ''
              });
            }
          }
        });
      }
    });
  },

  onNicknameInput(e: any) {
    this.setData({ nickname: e.detail.value });
  },

  onSave() {
    const nickname = this.data.nickname.trim();

    if (!nickname) {
      wx.showToast({
        title: '请输入宝宝昵称',
        icon: 'none',
        duration: 1500
      });
      return;
    }

    this.setData({ isSaving: true });

    var babyProfile = {
      id: 'baby_' + Date.now(),
      name: nickname,
      avatar: this.data.avatarUrl || this.data.avatarEmoji,
      createdAt: new Date().toISOString()
    };

    try {
      wx.setStorageSync(BABY_KEY, babyProfile);
      wx.setStorageSync(CURRENT_BABY_KEY, babyProfile.id);
    } catch (e) {
      wx.showToast({
        title: '保存失败，请重试',
        icon: 'none',
        duration: 1500
      });
      this.setData({ isSaving: false });
      return;
    }

    wx.showToast({
      title: '保存成功',
      icon: 'success',
      duration: 1000
    });

    setTimeout(() => {
      wx.redirectTo({
        url: '/pages/album_home/album_home'
      });
    }, 1000);
  }
});