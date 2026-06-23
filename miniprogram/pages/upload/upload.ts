// @ts-nocheck
// upload.ts - 上传页面 v2 (4步渐进流程：选择来源→确认信息→上传中→完成反馈)

import { API_CONFIG } from '../../config/api';
import { mediaApi } from '../../services/media_api';
import { STORAGE_KEYS } from '../../constants/storage_keys';
var tokenManager = require('../../services/request').tokenManager;

Page({
  data: {
    safeTop: 44,

    // Step flow
    currentStep: 1,
    navTitle: '记录成长',
    selectedFiles: [],
    thumbColors: ['#f1dce2', '#dceaf1', '#f4e6d6', '#e2f1e6'],

    // Form fields (Step 2)
    babyName: '',
    captureDate: '',
    todayDate: '',
    milestone: '',
    description: '',

    // Upload state (Step 3)
    isUploading: false,
    uploadProgress: 0,
    uploadCurrentFile: 0,
    uploadStatus: '',

    // Milestone picker
    showMilestonePicker: false,
    milestoneInput: '',

    // For retry
    _pendingFiles: [],
  },

  onLoad: function () {
    try {
      var info = wx.getWindowInfo();
      this.setData({ safeTop: info.statusBarHeight || 44 });
    } catch (e) {}

    // Load baby name
    this.loadBabyName();

    // Set default date
    var now = new Date();
    var y = now.getFullYear();
    var m = ('0' + (now.getMonth() + 1)).slice(-2);
    var d = ('0' + now.getDate()).slice(-2);
    this.setData({
      todayDate: y + '-' + m + '-' + d,
      captureDate: y + '-' + m + '-' + d,
    });
  },

  loadBabyName: function () {
    try {
      var babyId = wx.getStorageSync(STORAGE_KEYS.currentBabyId) || '';
      if (!babyId) return;
      var babies = wx.getStorageSync('album_babies');
      if (!Array.isArray(babies)) return;
      for (var i = 0; i < babies.length; i++) {
        if (babies[i].id === babyId) {
          this.setData({ babyName: babies[i].name || '小星星 ✨' });
          return;
        }
      }
    } catch (e) {}
    this.setData({ babyName: '小星星 ✨' });
  },

  onBack: function () { wx.navigateBack(); },

  getToken: function () {
    return tokenManager.getAccessToken();
  },

  getBabyId: function () {
    try { return wx.getStorageSync(STORAGE_KEYS.currentBabyId) || ''; } catch (e) { return ''; }
  },

  // ===== Step Transitions =====

  requireLogin: function () {
    if (this.getToken()) return true;
    try { wx.setStorageSync('login_redirect', '/pages/upload/upload'); } catch (e) {}
    wx.redirectTo({ url: '/pages/onboarding/onboarding' });
    return false;
  },

  onTakePhoto: function () {
    if (!this.requireLogin()) return;
    var _this = this;
    wx.chooseMedia({
      count: 1, mediaType: ['image'], sourceType: ['camera'],
      success: function (res) { _this.handleMediaResult(res); },
    });
  },

  onChooseFromAlbum: function () {
    if (!this.requireLogin()) return;
    var _this = this;
    wx.chooseMedia({
      count: 9, mediaType: ['image', 'video'], sourceType: ['album'],
      success: function (res) { _this.handleMediaResult(res); },
    });
  },

  handleMediaResult: function (res) {
    var files = res.tempFiles || [];
    if (files.length === 0) return;

    // 补充 fileType：wx.chooseMedia 单个文件用 fileType，顶层用 res.type
    for (var i = 0; i < files.length; i++) {
      if (!files[i].fileType) {
        files[i].fileType = res.type === 'video' ? 'video' : 'image';
      }
    }

    this.setData({
      selectedFiles: files,
      _pendingFiles: files,
      currentStep: 2,
      navTitle: '添加记录',
    });
  },

  onCaptureDateChange: function (e) {
    this.setData({ captureDate: e.detail.value });
  },

  onPickMilestone: function () {
    this.setData({
      showMilestonePicker: !this.data.showMilestonePicker,
      milestoneInput: '',
    });
  },

  onSelectMilestone: function (e) {
    var name = e.currentTarget.dataset.name;
    this.setData({ milestone: name, showMilestonePicker: false });
  },

  onMilestoneInput: function (e) {
    this.setData({ milestoneInput: e.detail.value });
  },

  onConfirmCustomMilestone: function () {
    var val = this.data.milestoneInput.trim();
    if (val) {
      this.setData({ milestone: val, showMilestonePicker: false, milestoneInput: '' });
    }
  },

  onCloseMilestonePicker: function () {
    this.setData({ showMilestonePicker: false });
  },

  onDescriptionInput: function (e) {
    this.setData({ description: e.detail.value });
  },

  // ===== Upload Flow =====

  onConfirmUpload: function () {
    if (!this.requireLogin()) return;
    var files = this.data.selectedFiles;
    if (files.length === 0) {
      wx.showToast({ title: '请选择文件', icon: 'none' });
      return;
    }

    this.setData({
      currentStep: 3,
      navTitle: '上传中',
      isUploading: true,
      uploadProgress: 0,
      uploadCurrentFile: 0,
      uploadStatus: '获取上传凭证...',
    });

    this.startUpload(files);
  },

  startUpload: function (files) {
    var _this = this;
    var babyId = this.getBabyId();
    var token = this.getToken();
    var uploaded = 0;
    var total = files.length;

    // Upload one by one
    var uploadNext = function (idx) {
      if (idx >= total) {
        // All done
        _this.setData({
          isUploading: false,
          uploadProgress: 100,
          uploadStatus: '',
          currentStep: 4,
          navTitle: '完成',
        });
        return;
      }

      _this.setData({ uploadCurrentFile: idx + 1 });

      _this.uploadFile(files[idx], babyId, token, function () {
        uploaded++;
        var pct = Math.floor(uploaded / total * 100);
        _this.setData({ uploadProgress: pct });

        // Wait a tick before next upload for UI update
        setTimeout(function () { uploadNext(idx + 1); }, 100);
      });
    };

    uploadNext(0);
  },

  /**
   * 单文件上传（sign → put ArrayBuffer → create media）
   */
  uploadFile: function (file, babyId, token, callback) {
    var _this = this;
    var fileName = (file.tempFilePath || 'photo.jpg').split('/').pop() || 'photo.jpg';
    var fileType = file.fileType === 'video' ? 'video' : 'image';
    var captureDate = this.data.captureDate || new Date().toISOString().split('T')[0];

    if (!babyId) {
      console.warn('[upload] 未选择宝宝，跳过上传');
      wx.showToast({ title: '请先创建宝宝档案', icon: 'none', duration: 2000 });
      if (callback) callback();
      return;
    }

    wx.request({
      url: API_CONFIG.baseURL + '/upload/sign',
      method: 'POST',
      data: { fileName: fileName, fileType: fileType, babyId: babyId },
      header: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
      timeout: 10000,
      success: function (signRes) {
        if (signRes.statusCode !== 200 || !signRes.data.uploadUrl) {
          console.warn('[upload] 获取上传签名失败:', signRes.statusCode, signRes.data);
          _this.fallbackMockUpload(file, babyId, callback);
          return;
        }

        var uploadUrl = signRes.data.uploadUrl;
        var cosKey = signRes.data.cosKey;

        // Replace internal MinIO URL with external
        if (uploadUrl && uploadUrl.indexOf('minio:9000') !== -1) {
          uploadUrl = uploadUrl.replace('http://minio:9000', API_CONFIG.minioURL);
          uploadUrl = uploadUrl.replace('https://minio:9000', API_CONFIG.minioURL);
        }

        // Read file as ArrayBuffer and PUT to MinIO
        var fs = wx.getFileSystemManager();
        try {
          var arrayBuf = fs.readFileSync(file.tempFilePath);
        } catch (e) {
          _this.fallbackMockUpload(file, babyId, callback);
          return;
        }

        // 根据文件扩展名设置 Content-Type，否则 MinIO 存为 application/octet-stream
        var contentType = fileType === 'video' ? 'video/mp4' : 'image/jpeg';

        wx.request({
          url: uploadUrl,
          method: 'PUT',
          data: arrayBuf,
          header: { 'Content-Type': contentType },
          timeout: 30000,
          success: function (uploadRes) {
            if (uploadRes.statusCode < 200 || uploadRes.statusCode >= 300) {
              _this.handleUploadError(callback);
              return;
            }

            // Create media record
            wx.request({
              url: API_CONFIG.baseURL + '/media/',
              method: 'POST',
              data: {
                babyId: babyId,
                title: _this.data.description || '',
                type: fileType,
                cosKey: cosKey,
                captureDate: captureDate,
                milestone: _this.data.milestone || '',
              },
              header: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
              timeout: 10000,
              success: function (mediaRes) {
                if (mediaRes.statusCode === 200 || mediaRes.statusCode === 201) {
                  _this.syncToLocal(file, babyId, fileType, captureDate, cosKey);
                } else {
                  console.warn('[upload] 创建媒体记录失败:', mediaRes.statusCode, mediaRes.data);
                }
                if (callback) callback();
              },
              fail: function (err) {
                console.warn('[upload] 创建媒体请求失败:', err);
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
        _this.fallbackMockUpload(file, babyId, callback);
      },
    });
  },

  fallbackMockUpload: function (file, babyId, callback) {
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
      title: this.data.description || '新记录',
      url: file.tempFilePath || '',
      thumbnailUrl: file.tempFilePath || '',
      captureDate: this.data.captureDate || dateStr,
      type: file.fileType === 'video' ? 'video' : 'image',
      babyId: babyId,
      milestone: this.data.milestone || '',
      cardColor: ['#f1dce2', '#dceaf1', '#f4e6d6', '#e2f1e6'][Math.floor(Math.random() * 4)],
      createdAt: now.toISOString(),
    });

    try { wx.setStorageSync('album_media', mediaList); } catch (e) {}
    if (callback) callback();
  },

  syncToLocal: function (file, babyId, fileType, captureDate, cosKey) {
    var mediaList = [];
    try {
      var stored = wx.getStorageSync('album_media');
      if (stored && Array.isArray(stored)) mediaList = stored;
    } catch (e) {}

    mediaList.unshift({
      id: 'media_' + Date.now(),
      title: this.data.description || '新记录',
      url: file.tempFilePath || '',
      thumbnailUrl: '',
      captureDate: captureDate,
      type: fileType,
      babyId: babyId,
      cosKey: cosKey,
      milestone: this.data.milestone || '',
      cardColor: ['#f1dce2', '#dceaf1', '#f4e6d6', '#e2f1e6'][Math.floor(Math.random() * 4)],
      createdAt: new Date().toISOString(),
      synced: true,
    });

    try { wx.setStorageSync('album_media', mediaList); } catch (e) {}
  },

  handleUploadError: function (callback) {
    wx.showToast({ title: '上传失败', icon: 'none', duration: 1500 });
    if (callback) callback();
  },

  // ===== Cancel / Retry (Step 3) =====

  onCancelUpload: function () {
    // Reset to step 1
    this.setData({
      currentStep: 1,
      navTitle: '记录成长',
      isUploading: false,
      uploadProgress: 0,
      uploadCurrentFile: 0,
      uploadStatus: '',
      selectedFiles: [],
    });
    wx.showToast({ title: '已取消', icon: 'none', duration: 1000 });
  },

  onRetryUpload: function () {
    var pending = this.data._pendingFiles;
    if (pending && pending.length > 0) {
      this.setData({
        uploadProgress: 0,
        uploadCurrentFile: 0,
      });
      this.startUpload(pending);
    }
  },

  // ===== Step 4 Actions =====

  onViewRecord: function () {
    // Navigate to growth page (album_home)
    wx.redirectTo({ url: '/pages/album_home/album_home' });
  },

  onContinueUpload: function () {
    // Reset to step 1 for another upload
    this.setData({
      currentStep: 1,
      navTitle: '记录成长',
      selectedFiles: [],
      milestone: '',
      description: '',
      uploadProgress: 0,
      uploadCurrentFile: 0,
      uploadStatus: '',
      showMilestonePicker: false,
      milestoneInput: '',
    });
  },
});