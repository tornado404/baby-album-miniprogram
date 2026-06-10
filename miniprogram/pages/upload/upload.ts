// @ts-nocheck
// upload.ts - 上传页面，对接 MinIO 直传 + 后端媒体 API
// 上传流程：POST /upload/sign → PUT MinIO → POST /media/

import { API_CONFIG } from '../../config/api';
import { mediaApi } from '../../services/media_api';
import { STORAGE_KEYS } from '../../constants/storage_keys';

Page({
  data: {
    safeTop: 44,
    isUploading: false,
    uploadProgress: 0,
    uploadStatus: '',
  },

  onLoad() {
    try {
      var info = wx.getWindowInfo();
      this.setData({ safeTop: info.statusBarHeight || 44 });
    } catch (e) {}
  },

  onBack() { wx.navigateBack(); },

  getBabyId() {
    try { return wx.getStorageSync(STORAGE_KEYS.currentBabyId) || ''; } catch (e) { return ''; }
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
    var uploaded = 0;
    var total = files.length;

    // 逐个上传
    for (var i = 0; i < files.length; i++) {
      this.uploadFile(files[i], babyId, function () {
        uploaded++;
        var pct = Math.floor(uploaded / total * 100);
        _this.setData({ uploadProgress: pct, uploadStatus: '上传中 ' + pct + '%' });

        if (uploaded >= total) {
          _this.setData({ isUploading: false, uploadStatus: '' });
          wx.showToast({ title: '上传完成', icon: 'success', duration: 1500 });
          // 上传完成后延迟返回首页，触发 onShow 刷新列表
          setTimeout(function () { wx.navigateBack(); }, 1500);
        }
      });
    }
  },

  /**
   * 单文件上传（sign → put → create）
   * 注意：用 wx.request + ArrayBuffer 直传 MinIO（不用 wx.uploadFile，
   *       因为 wx.uploadFile 只支持 POST multipart，而预签名 URL 需要 PUT 原始二进制）
   */
  uploadFile(file, babyId, callback) {
    var _this = this;
    var fileName = (file.tempFilePath || 'photo.jpg').split('/').pop() || 'photo.jpg';
    var fileType = file.mediaType === 'video' ? 'video' : 'image';
    var captureDate = new Date().toISOString().split('T')[0];

    // Step 1: 获取预签名 URL
    if (!babyId) {
      console.warn('[upload] 未选择宝宝，跳过上传');
      wx.showToast({ title: '请先创建宝宝档案', icon: 'none', duration: 2000 });
      if (callback) callback();
      return;
    }

    mediaApi.getUploadSign(fileName, fileType, babyId).then(function (signData) {
      var uploadUrl = signData.uploadUrl;
      var cosKey = signData.cosKey;
      if (!uploadUrl || !cosKey) {
        console.warn('[upload] 获取上传签名失败: 响应缺少字段', signData);
        _this.fallbackMockUpload(file, babyId, callback);
        return;
      }

      // Step 2: 读取文件为 ArrayBuffer，用 PUT 直传 MinIO
      var fs = wx.getFileSystemManager();
      try {
        var arrayBuf = fs.readFileSync(file.tempFilePath);
      } catch (e) {
        _this.fallbackMockUpload(file, babyId, callback);
        return;
      }

      wx.request({
        url: uploadUrl,
        method: 'PUT',
        data: arrayBuf,
        // 注意：预签名 URL 只签了 host 头，不能添加其他 Header
        header: {},
        timeout: 30000,
        success: function (uploadRes) {
          if (uploadRes.statusCode < 200 || uploadRes.statusCode >= 300) {
            _this.handleUploadError(callback);
            return;
          }

          // Step 3: 创建媒体记录
          mediaApi.create({
            babyId: babyId, title: '', type: fileType,
            cosKey: cosKey, captureDate: captureDate,
          }).then(function () {
            // 同步到本地缓存
            _this.syncToLocal(file, babyId, fileType, captureDate, cosKey);
            if (callback) callback();
          }).catch(function () {
            console.warn('[upload] 创建媒体记录失败');
            _this.setData({ uploadStatus: '记录创建失败' });
            if (callback) callback();
          });
        },
        fail: function () {
          _this.fallbackMockUpload(file, babyId, callback);
        },
      });
    }).catch(function () {
      // 后端不可达，降级到本地 Mock
      _this.fallbackMockUpload(file, babyId, callback);
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