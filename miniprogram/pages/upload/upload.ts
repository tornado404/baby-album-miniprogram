// upload.ts - 上传页面
// Claymorphism 设计风格，使用 Mock 云存储

Page({
  data: {
    safeTop: 44,
    isUploading: false,
    uploadProgress: 0
  },

  onLoad() {
    const sysInfo = wx.getSystemInfoSync();
    this.setData({ safeTop: sysInfo.statusBarHeight || 44 });
  },

  onBack() {
    wx.navigateBack();
  },

  onTakePhoto() {
    var _this = this;
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['camera'],
      success: function (res) {
        _this.handleMediaResult(res);
      }
    });
  },

  onChooseFromAlbum() {
    var _this = this;
    wx.chooseMedia({
      count: 9,
      mediaType: ['image', 'video'],
      sourceType: ['album'],
      success: function (res) {
        _this.handleMediaResult(res);
      }
    });
  },

  onUpload3D() {
    wx.navigateTo({
      url: '/pages/3d_viewer/3d_viewer'
    });
  },

  handleMediaResult(res: any) {
    var _this = this;
    var files = res.tempFiles || [];
    if (files.length === 0) return;

    this.setData({ isUploading: true, uploadProgress: 0 });

    var uploaded = 0;
    var total = files.length;

    // Get current baby ID for associating media
    var babyId = '';
    try {
      babyId = wx.getStorageSync('baby_diary_current_baby_id') || 'demo-1';
    } catch (e) {
      babyId = 'demo-1';
    }

    // Process each file
    for (var i = 0; i < files.length; i++) {
      var file = files[i];
      this.mockUpload(file, babyId, function () {
        uploaded++;
        _this.setData({ uploadProgress: Math.floor(uploaded / total * 100) });

        if (uploaded >= total) {
          _this.setData({ isUploading: false, uploadProgress: 0 });
          wx.showToast({ title: '上传完成(mock)', icon: 'success', duration: 1500 });
        }
      });
    }
  },

  mockUpload(file: any, babyId: string, callback: Function) {
    // Simulate network delay
    setTimeout(function () {
      // Create a media record in storage
      var mediaList = [];
      try {
        var stored = wx.getStorageSync('album_media');
        if (stored && Array.isArray(stored)) {
          mediaList = stored;
        }
      } catch (e) {}

      var now = new Date();
      var dateStr = now.getFullYear() + '-' +
        String(now.getMonth() + 1).padStart(2, '0') + '-' +
        String(now.getDate()).padStart(2, '0');

      var mediaItem = {
        id: 'media_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
        title: '新记录',
        url: file.tempFilePath || '',
        thumbnailUrl: file.tempFilePath || '',
        captureDate: dateStr,
        type: file.mediaType === 'video' ? 'video' : 'image',
        babyId: babyId,
        cardColor: ['pink', 'blue', 'beige', 'mint'][Math.floor(Math.random() * 4)],
        createdAt: now.toISOString()
      };

      mediaList.unshift(mediaItem);

      try {
        wx.setStorageSync('album_media', mediaList);
      } catch (e) {}

      if (callback) callback();
    }, 800);
  }
});