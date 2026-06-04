// baby_onboarding.ts - 首次登录宝宝信息填写页
// 简化版：仅头像+昵称，保存后跳转首页

const BABY_KEY = 'baby_diary_baby_profile';

Page({
  data: {
    safeTop: 44,
    nickname: '',
    avatarEmoji: '👶',
    isSaving: false,
    inputFocus: false
  },

  onLoad() {
    try {
      const info = wx.getSystemInfoSync();
      this.setData({ safeTop: info.statusBarHeight || 44 });
    } catch (e) {}

    // Auto-focus the nickname input
    setTimeout(() => {
      this.setData({ inputFocus: true });
    }, 500);
  },

  onBack() {
    wx.navigateBack();
  },

  onAvatarTap() {
    // For MVP: show toast that avatar custom upload is coming
    // In future: implement wx.chooseMedia for avatar
    wx.showToast({
      title: '头像功能即将开放',
      icon: 'none',
      duration: 1500
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

    // Save baby profile (minimal version)
    var babyProfile = {
      id: 'baby_' + Date.now(),
      name: nickname,
      avatar: this.data.avatarEmoji,
      createdAt: new Date().toISOString()
    };

    try {
      wx.setStorageSync(BABY_KEY, babyProfile);
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

    // Navigate to album home after save
    setTimeout(() => {
      wx.redirectTo({
        url: '/pages/album_home/album_home'
      });
    }, 1000);
  }
});