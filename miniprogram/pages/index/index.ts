// @ts-nocheck
// index.ts - 登录引导页
// 状态: idle → loading → error / success

const AUTH_KEY = 'baby_diary_authed';
const BABY_KEY = 'baby_diary_baby_profile';

Page({
  data: {
    safeTop: 44,
    authState: 'idle',    // idle | loading | error | success
    errorMsg: ''
  },

  onLoad() {
    // Get safe area
    try {
      const info = wx.getSystemInfoSync();
      this.setData({ safeTop: info.statusBarHeight || 44 });
    } catch (e) {}

    // Check if already authenticated
    const authed = wx.getStorageSync(AUTH_KEY);
    const babyProfile = wx.getStorageSync(BABY_KEY);

    if (authed && babyProfile) {
      // Already has account → go directly to home
      this.redirectToHome();
    }
  },

  onLoginTap() {
    this.setData({ authState: 'loading', errorMsg: '' });

    // Step 1: WeChat login (get code)
    wx.login({
      success: (loginRes) => {
        if (loginRes.code) {
          console.log('微信登录 code:', loginRes.code);
          // In production: send loginRes.code to backend
          // For MVP: simulate success
          this.handleAuthSuccess();
        } else {
          this.handleAuthError('登录失败，请重试');
        }
      },
      fail: () => {
        this.handleAuthError('网络错误，请检查网络后重试');
      }
    });
  },

  handleAuthSuccess() {
    // Mark as authenticated
    wx.setStorageSync(AUTH_KEY, true);

    this.setData({ authState: 'success' });

    // Check if baby profile exists
    const babyProfile = wx.getStorageSync(BABY_KEY);

    if (babyProfile) {
      // Has profile → go to home
      this.redirectToHome();
    } else {
      // No profile → go to simplified baby onboarding (nickname + avatar only)
      wx.showToast({ title: '欢迎！请先设置宝宝昵称', icon: 'none', duration: 1500 });
      setTimeout(() => {
        wx.redirectTo({ url: '/pages/baby_onboarding/baby_onboarding' });
      }, 1200);
    }
  },

  handleAuthError(msg) {
    this.setData({
      authState: 'error',
      errorMsg: msg || '授权失败，请重试'
    });
  },

  redirectToHome() {
    wx.redirectTo({ url: '/pages/album_home/album_home' });
  }
});