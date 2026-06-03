// upload.ts - 上传页面
// Claymorphism 设计风格

Page({
  data: {
    safeTop: 44 // 状态栏高度
  },

  onLoad() {
    const sysInfo = wx.getSystemInfoSync();
    this.setData({ safeTop: sysInfo.statusBarHeight || 44 });
  },

  onBack() {
    wx.navigateBack();
  },

  onTakePhoto() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['camera'],
      success: (res) => {
        this.handleMediaResult(res);
      }
    });
  },

  onChooseFromAlbum() {
    wx.chooseMedia({
      count: 9,
      mediaType: ['image', 'video'],
      sourceType: ['album'],
      success: (res) => {
        this.handleMediaResult(res);
      }
    });
  },

  onUpload3D() {
    wx.navigateTo({
      url: '/pages/3d_viewer/3d_viewer'
    });
  },

  handleMediaResult(res: any) {
    const files = res.tempFiles || [];
    if (files.length > 0) {
      wx.showToast({ title: `已选择${files.length}个文件`, icon: 'none' });
      // TODO: 实际上传逻辑
    }
  }
});