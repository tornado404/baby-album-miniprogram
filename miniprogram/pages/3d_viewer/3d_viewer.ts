// 3d_viewer.ts - 3D模型查看页面

Page({
  data: {
    safeTop: 44
  },

  onLoad() {
    const sysInfo = wx.getWindowInfo();
    this.setData({ safeTop: sysInfo.statusBarHeight || 44 });
  },

  onBack() {
    wx.navigateBack();
  },

  onShare() {
    wx.showToast({ title: '分享功能开发中', icon: 'none' });
  }
});