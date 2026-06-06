// @ts-nocheck
// upload.ts - 上传页面，对接 MinIO 直传 + 后端媒体 API

const API_BASE = 'http://101.126.41.146:8000/api/v1';

Page({
  data: {
    safeTop: 44,
    isUploading: false,
    uploadProgress: 0,
    uploadStatus: '',
  },

  onLoad() {
    try {
      var info = wx.getSystemInfoSync();
      this.setData({ safeTop: info.statusBarHeight || 44 });
    } catch (e) {}
  },

  onBack() { wx.navigateBack(); },

  getToken() {
    try { return wx.getStorageSync('baby_diary_access_token') || ''; } catch (e) { return ''; }
  },

  getBabyId() {
    try { return wx.getStorageSync('baby_diary_current_baby_id') || 'demo-1'; } catch (e) { return 'demo-1'; }
  },

  onTakePhoto() {
    var _this = this;
    wx.chooseMedia({
      count: 1, mediaType: ['image'], sourceType: ['camera'],
      success: function (res) { _this.handleMediaResult(res); },
    });
  },

  onChooseFromAlbum() {
    var _this = this;
    wx.chooseMedia({
      count: 9, mediaType: ['image', 'video'], sourceType: ['album'],
      success: function (res) { _this.handleMediaResult(res); },
    });
  },

  onUpload3D() {
    wx.navigateTo({ url: '/pages/3d_viewer/3d_viewer' });
  },

  /**
   * 完整上传流程：
   * 1. POST /upload/sign 获取预签名 URL
   * 2. wx.uploadFile 直传 MinIO
   * 3. POST /media 创建媒体记录
   */
  handleMediaResult(res) {
    var files = res.tempFiles || [];
    if (files.length === 0) return;

    this.setData({ isUploading: true, uploadProgress: 0, uploadStatus: '获取上传凭证...' });
    var _this = this;
    var babyId = this.getBabyId();
    var token = this.getToken();
    var uploaded = 0;
    var total = files.length;

    // 逐个上传
    for (var i = 0; i < files.length; i++) {
      this.uploadFile(files[i], babyId, token, function () {
        uploaded++;
        var pct = Math.floor(uploaded / total * 100);
        _this.setData({ uploadProgress: pct, uploadStatus: '上传中 ' + pct + '%' });

        if (uploaded >= total) {
          _this.setData({ isUploading: false, uploadStatus: '' });
          wx.showToast({ title: '上传完成', icon: 'success', duration: 1500 });
        }
      });
    }
  },

  /**
   * 单文件上传（sign → put → create）
   */
  uploadFile(file, babyId, token, callback) {
    var _this = this;
    var fileName = (file.tempFilePath || 'photo.jpg').split('/').pop() || 'photo.jpg';
    var fileType = file.mediaType === 'video' ? 'video' : 'image';
    var captureDate = new Date().toISOString().split('T')[0];

    // Step 1: 获取预签名 URL
    wx.request({
      url: API_BASE + '/upload/sign',
      method: 'POST',
      data: { fileName: fileName, fileType: fileType, babyId: babyId },
      header: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
      timeout: 10000,
      success: function (signRes) {
        if (signRes.statusCode !== 200 || !signRes.data.uploadUrl) {
          _this.fallbackMockUpload(file, babyId, callback);
          return;
        }

        var uploadUrl = signRes.data.uploadUrl;
        var cosKey = signRes.data.cosKey;

        // Step 2: 直传 MinIO
        wx.uploadFile({
          url: uploadUrl,
          filePath: file.tempFilePath,
          name: 'file',
          method: 'PUT',
          success: function (uploadRes) {
            if (uploadRes.statusCode < 200 || uploadRes.statusCode >= 300) {
              _this.handleUploadError(callback);
              return;
            }

            // Step 3: 创建媒体记录
            wx.request({
              url: API_BASE + '/media/',
              method: 'POST',
              data: {
                babyId: babyId, title: '', type: fileType,
                cosKey: cosKey, captureDate: captureDate,
              },
              header: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
              success: function (mediaRes) {
                if (mediaRes.statusCode === 200 || mediaRes.statusCode === 201) {
                  // 同步到本地缓存
                  _this.syncToLocal(file, babyId, fileType, captureDate, cosKey);
                }
                if (callback) callback();
              },
              fail: function () {
                // 媒体记录创建失败但不影响文件上传
                if (callback) callback();
              },
            });
          },
          fail: function () {
            _this.fallbackMockUpload(file, babyId, callback);
          },
        });
      },
      fail: function () {
        // 后端不可达，降级到本地 Mock
        _this.fallbackMockUpload(file, babyId, callback);
      },
    });
  },

  /**
   * 离线降级：本地 Mock 上传
   */
  fallbackMockUpload(file, babyId, callback) {
    var mediaList = [];
    try {
      var stored = wx.getStorageSync('album_media');
      if (stored && Array.isArray(stored)) mediaList = stored;
    } catch (e) {}

    var now = new Date();
    var dateStr = now.getFullYear() + '-' +
      String(now.getMonth() + 1).padStart(2, '0') + '-' +
      String(now.getDate()).padStart(2, '0');

    mediaList.unshift({
      id: 'media_' + Date.now(),
      title: '新记录',
      url: file.tempFilePath || '',
      thumbnailUrl: file.tempFilePath || '',
      captureDate: dateStr,
      type: file.mediaType === 'video' ? 'video' : 'image',
      babyId: babyId,
      cardColor: ['pink', 'blue', 'beige', 'mint'][Math.floor(Math.random() * 4)],
      createdAt: now.toISOString(),
    });

    try { wx.setStorageSync('album_media', mediaList); } catch (e) {}
    if (callback) callback();
  },

  /**
   * 同步上传成功的文件到本地缓存
   */
  syncToLocal(file, babyId, fileType, captureDate, cosKey) {
    var mediaList = [];
    try {
      var stored = wx.getStorageSync('album_media');
      if (stored && Array.isArray(stored)) mediaList = stored;
    } catch (e) {}

    mediaList.unshift({
      id: 'media_' + Date.now(),
      title: '新记录',
      url: file.tempFilePath || '',
      thumbnailUrl: '',
      captureDate: captureDate,
      type: fileType,
      babyId: babyId,
      cosKey: cosKey,
      cardColor: ['pink', 'blue', 'beige', 'mint'][Math.floor(Math.random() * 4)],
      createdAt: new Date().toISOString(),
      synced: true,
    });

    try { wx.setStorageSync('album_media', mediaList); } catch (e) {}
  },

  handleUploadError(callback) {
    wx.showToast({ title: '上传失败', icon: 'none', duration: 1500 });
    if (callback) callback();
  },
});