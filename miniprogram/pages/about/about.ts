// about.ts - 关于页面，显示版本号+更新日志
import { API_CONFIG } from '../../config/api';

Page({
  data: {
    safeTop: 44,
    version: '1.1.0',
    commit: '',
    buildTime: '',
    changelog: [
      { version: '1.1.0', date: '2026-06-15', items: ['成就徽章系统', '里程碑自动标注', '宝宝头像上传', '关于页面', '页面过渡动画'] },
      { version: '1.0.0', date: '2026-06-01', items: ['初始发布', '宝宝档案管理', '照片/视频上传', '成长相册首页'] },
    ],
  },

  onLoad: function () {
    try {
      var info = wx.getWindowInfo();
      this.setData({ safeTop: info.statusBarHeight || 44 });
    } catch (e) {}

    this.loadVersion();
  },

  loadVersion: function () {
    var _this = this;
    wx.request({
      url: API_CONFIG.baseURL + '/version',
      method: 'GET',
      timeout: 5000,
      success: function (res) {
        if (res.statusCode === 200 && res.data && res.data.data) {
          var d = res.data.data;
          _this.setData({
            version: d.version || '1.1.0',
            commit: d.commit || '',
            buildTime: d.buildTime || '',
          });
        }
      },
      fail: function () {},
    });
  },

  onBack: function () {
    wx.navigateBack();
  },
});
