/**
 * upload_runtime.test.ts - 上传页运行时测试
 *
 * 覆盖：
 * - 页面创建与初始数据
 * - onLoad（safeTop、日期、loadBabyName）
 * - loadBabyName（各种存储场景）
 * - onBack
 * - onTakePhoto / onChooseFromAlbum
 * - handleMediaResult（空/有文件）
 * - onPickDate（确认/取消）
 * - onPickMilestone
 * - onInputDescription
 * - onConfirmUpload（无文件/有文件→step 3）
 * - uploadFile（无 babyId→跳过；完整链路：sign→PUT→create→sync）
 * - fallbackMockUpload（降级存储）
 * - handleUploadError
 * - onCancelUpload
 * - onRetryUpload
 * - onViewRecord / onContinueUpload
 */

var mockStorage: Record<string, any> = {};
var mockRequests: Array<{ url: string; method: string; data?: any; header?: any }> = [];
var mockShowToastCalls: Array<{ title: string; icon?: string; duration?: number }> = [];
var mockNavigateBackCalled = false;
var mockRedirectToUrl = '';

function clearMockStorage(): void {
  for (var key in mockStorage) {
    if (mockStorage.hasOwnProperty(key)) {
      delete mockStorage[key];
    }
  }
}

var mockPageConfig: Record<string, any> = {};
var mockRequestHandler: ((opts: any) => void) | null = null;
var mockChooseMediaHandler: ((opts: any) => void) | null = null;
var mockShowActionSheetHandler: ((opts: any) => void) | null = null;
var uploadInstance: any = null;
var initialDataSnapshot: Record<string, any>;

(global as any).Page = function (config: any) {
  mockPageConfig = config;
  config.setData = function (data: any) {
    for (var key in data) {
      if (data.hasOwnProperty(key)) {
        if (key.indexOf('.') >= 0) {
          var parts = key.split('.');
          var target = config.data;
          for (var i = 0; i < parts.length - 1; i++) {
            if (target[parts[i]] === undefined) target[parts[i]] = {};
            target = target[parts[i]];
          }
          target[parts[parts.length - 1]] = data[key];
        } else {
          config.data[key] = data[key];
        }
      }
    }
  };
  return config;
};

function setupWxMock(): void {
  (global as any).wx = {
    getStorageSync: function (key: string) { return mockStorage[key] !== undefined ? mockStorage[key] : ''; },
    setStorageSync: function (key: string, value: any) { mockStorage[key] = value; },
    removeStorageSync: function (key: string) { delete mockStorage[key]; },
    getWindowInfo: function () { return { statusBarHeight: 44 }; },
    getSystemInfoSync: function () { return { language: 'zh_CN' }; },
    getFileSystemManager: function () {
      return {
        readFileSync: function () { return new ArrayBuffer(128); },
      };
    },
    chooseMedia: function (opts: any) {
      if (typeof mockChooseMediaHandler === 'function') {
        mockChooseMediaHandler(opts);
      }
    },
    showActionSheet: function (opts: any) {
      if (typeof mockShowActionSheetHandler === 'function') {
        mockShowActionSheetHandler(opts);
      }
    },
    request: function (opts: any) {
      mockRequests.push({ url: opts.url, method: opts.method, data: opts.data, header: opts.header });
      if (typeof mockRequestHandler === 'function') {
        mockRequestHandler(opts);
      } else {
        opts.success({ statusCode: 200, data: {} });
      }
    },
    showToast: function (opts: any) { mockShowToastCalls.push({ title: opts.title, icon: opts.icon, duration: opts.duration }); },
    showModal: function (opts: any) {
      if (opts.success) { opts.success({ confirm: false }); }
    },
    navigateBack: function () { mockNavigateBackCalled = true; },
    redirectTo: function (opts: any) { mockRedirectToUrl = opts.url; },
    showLoading: function () {},
    hideLoading: function () {},
  };
}

describe('上传页运行时测试', function () {
  beforeAll(function () {
    setupWxMock();
    mockStorage['baby_diary_access_token'] = 'test-token';
    mockStorage['baby_diary_current_baby_id'] = 'baby-001';
    mockStorage['album_babies'] = [{ id: 'baby-001', name: '小星星' }];

    require('../miniprogram/pages/upload/upload');
    uploadInstance = mockPageConfig;
    initialDataSnapshot = JSON.parse(JSON.stringify(uploadInstance.data));
  });

  beforeEach(function () {
    clearMockStorage();
    mockStorage['baby_diary_access_token'] = 'test-token';
    mockStorage['baby_diary_current_baby_id'] = 'baby-001';
    mockStorage['album_babies'] = [{ id: 'baby-001', name: '小星星' }];

    mockRequests = [];
    mockShowToastCalls = [];
    mockNavigateBackCalled = false;
    mockRedirectToUrl = '';
    mockRequestHandler = null;
    mockChooseMediaHandler = null;
    mockShowActionSheetHandler = null;

    // 恢复默认 wx 函数
    (global as any).wx.getStorageSync = function (key: string) {
      return mockStorage[key] !== undefined ? mockStorage[key] : '';
    };
    (global as any).wx.setStorageSync = function (key: string, value: any) { mockStorage[key] = value; };
    (global as any).wx.removeStorageSync = function (key: string) { delete mockStorage[key]; };
    (global as any).wx.getFileSystemManager = function () {
      return { readFileSync: function () { return new ArrayBuffer(128); } };
    };
    (global as any).wx.showToast = function (opts: any) { mockShowToastCalls.push({ title: opts.title, icon: opts.icon, duration: opts.duration }); };
    (global as any).wx.navigateBack = function () { mockNavigateBackCalled = true; };
    (global as any).wx.redirectTo = function (opts: any) { mockRedirectToUrl = opts.url; };

    // 重置 data
    if (initialDataSnapshot) {
      var keys = Object.keys(uploadInstance.data);
      for (var i = 0; i < keys.length; i++) { delete uploadInstance.data[keys[i]]; }
      Object.assign(uploadInstance.data, JSON.parse(JSON.stringify(initialDataSnapshot)));
    }

    // 重置 Page mock，清除上次的 data 副作用
    uploadInstance.data.currentStep = 1;
  });

  afterAll(function () {
    delete (global as any).Page;
    (global as any).wx = {
      getStorageSync: function () { return ''; },
      setStorageSync: function () {},
      removeStorageSync: function () {},
      getWindowInfo: function () { return { statusBarHeight: 44 }; },
      getSystemInfoSync: function () { return { language: 'zh_CN' }; },
      getFileSystemManager: function () { return { readFileSync: function () {} }; },
      chooseMedia: function () {},
      showActionSheet: function () {},
      request: function () {},
      showToast: function () {},
      showModal: function () {},
      navigateBack: function () {},
      redirectTo: function () {},
      showLoading: function () {},
      hideLoading: function () {},
    };
  });

  describe('页面创建', function () {
    test('应包含初始 data', function () {
      expect(uploadInstance.data.safeTop).toBe(44);
      expect(uploadInstance.data.currentStep).toBe(1);
      expect(uploadInstance.data.navTitle).toBe('记录成长');
      expect(Array.isArray(uploadInstance.data.selectedFiles)).toBe(true);
      expect(uploadInstance.data.isUploading).toBe(false);
    });

    test('应有所有方法', function () {
      expect(typeof uploadInstance.onLoad).toBe('function');
      expect(typeof uploadInstance.loadBabyName).toBe('function');
      expect(typeof uploadInstance.onBack).toBe('function');
      expect(typeof uploadInstance.getToken).toBe('function');
      expect(typeof uploadInstance.getBabyId).toBe('function');
      expect(typeof uploadInstance.onTakePhoto).toBe('function');
      expect(typeof uploadInstance.onChooseFromAlbum).toBe('function');
      expect(typeof uploadInstance.handleMediaResult).toBe('function');
      expect(typeof uploadInstance.onPickDate).toBe('function');
      expect(typeof uploadInstance.onPickMilestone).toBe('function');
      expect(typeof uploadInstance.onInputDescription).toBe('function');
      expect(typeof uploadInstance.onConfirmUpload).toBe('function');
      expect(typeof uploadInstance.startUpload).toBe('function');
      expect(typeof uploadInstance.uploadFile).toBe('function');
      expect(typeof uploadInstance.fallbackMockUpload).toBe('function');
      expect(typeof uploadInstance.syncToLocal).toBe('function');
      expect(typeof uploadInstance.handleUploadError).toBe('function');
      expect(typeof uploadInstance.onCancelUpload).toBe('function');
      expect(typeof uploadInstance.onRetryUpload).toBe('function');
      expect(typeof uploadInstance.onViewRecord).toBe('function');
      expect(typeof uploadInstance.onContinueUpload).toBe('function');
    });
  });

  describe('onLoad', function () {
    test('应设置 safeTop 和默认日期', function () {
      uploadInstance.onLoad();
      expect(uploadInstance.data.safeTop).toBe(44);
      expect(uploadInstance.data.todayDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(uploadInstance.data.captureDate).toBe(uploadInstance.data.todayDate);
    });

    test('statusBarHeight 为 0 时应使用默认值 44', function () {
      (global as any).wx.getWindowInfo = function () { return { statusBarHeight: 0 }; };
      uploadInstance.onLoad();
      expect(uploadInstance.data.safeTop).toBe(44);
      // 恢复默认
      (global as any).wx.getWindowInfo = function () { return { statusBarHeight: 44 }; };
    });

    test('应加载宝宝名称', function () {
      uploadInstance.onLoad();
      expect(uploadInstance.data.babyName).toBe('小星星');
    });
  });

  describe('loadBabyName', function () {
    test('无 babyId 应返回', function () {
      mockStorage['baby_diary_current_baby_id'] = '';
      uploadInstance.loadBabyName();
      expect(uploadInstance.data.babyName).toBe('');
    });

    test('无 babies 应返回', function () {
      delete mockStorage['album_babies'];
      uploadInstance.loadBabyName();
      expect(uploadInstance.data.babyName).toBe('');
    });

    test('匹配失败应使用默认名称', function () {
      mockStorage['album_babies'] = [{ id: 'other-baby', name: '小明' }];
      uploadInstance.loadBabyName();
      expect(uploadInstance.data.babyName).toBe('小星星 ✨');
    });

    test('getStorageSync 异常应使用默认名称', function () {
      (global as any).wx.getStorageSync = function () { throw new Error('fail'); };
      uploadInstance.loadBabyName();
      expect(uploadInstance.data.babyName).toBe('小星星 ✨');
    });
  });

  describe('按钮导航', function () {
    test('onBack 应调用 navigateBack', function () {
      uploadInstance.onBack();
      expect(mockNavigateBackCalled).toBe(true);
    });
  });

  describe('onTakePhoto', function () {
    test('应调用 chooseMedia 并成功处理结果', function () {
      var capturedOpts: any = null;
      mockChooseMediaHandler = function (opts: any) {
        capturedOpts = opts;
        opts.success({ tempFiles: [{ tempFilePath: 'camera/photo.jpg' }] });
      };
      uploadInstance.onTakePhoto();
      expect(capturedOpts).not.toBeNull();
      expect(capturedOpts.count).toBe(1);
      expect(capturedOpts.sourceType).toEqual(['camera']);
      expect(capturedOpts.mediaType).toEqual(['image']);
      // 成功回调应跳转到 Step 2
      expect(uploadInstance.data.currentStep).toBe(2);
    });
  });

  describe('onChooseFromAlbum', function () {
    test('应调用 chooseMedia 并成功处理结果', function () {
      var capturedOpts: any = null;
      mockChooseMediaHandler = function (opts: any) {
        capturedOpts = opts;
        opts.success({ tempFiles: [{ tempFilePath: 'album/photo1.jpg' }, { tempFilePath: 'album/photo2.jpg' }] });
      };
      uploadInstance.onChooseFromAlbum();
      expect(capturedOpts).not.toBeNull();
      expect(capturedOpts.count).toBe(9);
      expect(capturedOpts.sourceType).toEqual(['album']);
      expect(capturedOpts.mediaType).toEqual(['image', 'video']);
      // 成功回调应处理多文件并跳转到 Step 2
      expect(uploadInstance.data.currentStep).toBe(2);
      expect(uploadInstance.data.selectedFiles.length).toBe(2);
    });
  });

  describe('handleMediaResult', function () {
    test('空文件应返回', function () {
      uploadInstance.handleMediaResult({ tempFiles: [] });
      expect(uploadInstance.data.currentStep).toBe(1);
    });

    test('有文件应跳到 Step 2', function () {
      var files = [{ tempFilePath: 'temp/photo.jpg' }];
      uploadInstance.handleMediaResult({ tempFiles: files });
      expect(uploadInstance.data.currentStep).toBe(2);
      expect(uploadInstance.data.navTitle).toBe('添加记录');
      expect(uploadInstance.data.selectedFiles.length).toBe(1);
    });
  });

  describe('onPickDate', function () {
    test('确认应设置日期', function () {
      (global as any).wx.showModal = function (opts: any) {
        expect(opts.editable).toBe(true);
        opts.success({ confirm: true, content: '2026-06-15' });
      };
      uploadInstance.data.captureDate = '';
      uploadInstance.onPickDate();
      expect(uploadInstance.data.captureDate).toBe('2026-06-15');
    });

    test('取消不修改日期', function () {
      (global as any).wx.showModal = function (opts: any) {
        opts.success({ confirm: false, content: '2026-06-15' });
      };
      uploadInstance.data.captureDate = '2026-01-01';
      uploadInstance.onPickDate();
      expect(uploadInstance.data.captureDate).toBe('2026-01-01');
    });
  });

  describe('onPickMilestone', function () {
    test('应显示 actionSheet 并设置选中里程碑', function () {
      mockShowActionSheetHandler = function (opts: any) {
        opts.success({ tapIndex: 0 });
      };
      uploadInstance.onPickMilestone();
      expect(uploadInstance.data.milestone).toBe('第一次翻身');
    });

    test('超出范围的索引应忽略', function () {
      mockShowActionSheetHandler = function (opts: any) {
        opts.success({ tapIndex: 99 });
      };
      uploadInstance.onPickMilestone();
      expect(uploadInstance.data.milestone).toBe('');
    });
  });

  describe('onInputDescription', function () {
    test('确认应设置描述', function () {
      (global as any).wx.showModal = function (opts: any) {
        opts.success({ confirm: true, content: '今天很开心' });
      };
      uploadInstance.onInputDescription();
      expect(uploadInstance.data.description).toBe('今天很开心');
    });

    test('取消不应设置描述', function () {
      (global as any).wx.showModal = function (opts: any) {
        opts.success({ confirm: false, content: '不会设置' });
      };
      uploadInstance.onInputDescription();
      expect(uploadInstance.data.description).toBe('');
    });
  });

  describe('onConfirmUpload', function () {
    test('无文件应显示提示', function () {
      uploadInstance.data.selectedFiles = [];
      uploadInstance.onConfirmUpload();
      expect(mockShowToastCalls.length).toBeGreaterThan(0);
      expect(mockShowToastCalls[0].title).toBe('请选择文件');
    });

    test('有文件应跳转到 Step 3', function () {
      uploadInstance.data.selectedFiles = [{ tempFilePath: 'temp/photo.jpg' }];
      uploadInstance.onConfirmUpload();
      expect(uploadInstance.data.currentStep).toBe(3);
      expect(uploadInstance.data.isUploading).toBe(true);
    });
  });

  describe('uploadFile - no babyId', function () {
    test('无 babyId 应跳过并提示', function () {
      uploadInstance.uploadFile({ tempFilePath: 'test.jpg' }, '', 'token', function () {});
      expect(mockShowToastCalls.length).toBeGreaterThan(0);
      expect(mockShowToastCalls[0].title).toBe('请先创建宝宝档案');
    });
  });

  describe('fallbackMockUpload', function () {
    test('应写入本地存储', function () {
      uploadInstance.data.description = '测试记录';
      uploadInstance.fallbackMockUpload(
        { tempFilePath: 'temp/test.jpg' },
        'baby-001',
        function () {}
      );
      var stored = mockStorage['album_media'];
      expect(Array.isArray(stored)).toBe(true);
      expect(stored.length).toBe(1);
      expect(stored[0].title).toBe('测试记录');
    });
  });

  describe('handleUploadError', function () {
    test('应显示失败 toast', function () {
      var cbCalled = false;
      uploadInstance.handleUploadError(function () { cbCalled = true; });
      expect(mockShowToastCalls[0].title).toBe('上传失败');
      expect(cbCalled).toBe(true);
    });
  });

  describe('onCancelUpload', function () {
    test('应重置到 Step 1', function () {
      uploadInstance.data.currentStep = 3;
      uploadInstance.data.isUploading = true;
      uploadInstance.onCancelUpload();
      expect(uploadInstance.data.currentStep).toBe(1);
      expect(uploadInstance.data.isUploading).toBe(false);
      expect(mockShowToastCalls[0].title).toBe('已取消');
    });
  });

  describe('onRetryUpload', function () {
    test('有 pending 文件应触发上传', function () {
      uploadInstance.data._pendingFiles = [{ tempFilePath: 'temp/retry.jpg' }];
      uploadInstance.onRetryUpload();
      // startUpload 被调用，会发起 sign 请求
      expect(mockRequests.length).toBeGreaterThan(0);
    });

    test('无 pending 文件不操作', function () {
      uploadInstance.data._pendingFiles = [];
      uploadInstance.onRetryUpload();
      // should not crash
    });
  });

  describe('onViewRecord', function () {
    test('应跳转到 album_home', function () {
      uploadInstance.onViewRecord();
      expect(mockRedirectToUrl).toBe('/pages/album_home/album_home');
    });
  });

  describe('onContinueUpload', function () {
    test('应重置到 Step 1', function () {
      uploadInstance.data.currentStep = 4;
      uploadInstance.data.milestone = '第一次翻身';
      uploadInstance.data.description = 'test';
      uploadInstance.onContinueUpload();
      expect(uploadInstance.data.currentStep).toBe(1);
      expect(uploadInstance.data.navTitle).toBe('记录成长');
      expect(uploadInstance.data.milestone).toBe('');
      expect(uploadInstance.data.description).toBe('');
    });
  });

  describe('完整上传链路', function () {
    test('sign → PUT → create media → syncToLocal 完整链路', function () {
      var callCount = 0;
      mockRequestHandler = function (opts: any) {
        if (opts.method === 'PUT') {
          opts.success({ statusCode: 200, data: '' });
          return;
        }
        if (opts.url.indexOf('/upload/sign') >= 0) {
          callCount++;
          opts.success({
            statusCode: 200,
            data: { uploadUrl: 'http://minio:9000/bucket/key?X-Amz-Algorithm=', cosKey: 'photos/key' },
          });
          return;
        }
        if (opts.url.indexOf('/media/') >= 0) {
          opts.success({ statusCode: 201, data: { id: 'media_123' } });
          return;
        }
        opts.success({ statusCode: 200, data: {} });
      };

      uploadInstance.data.captureDate = '2026-06-15';
      uploadInstance.data.description = '测试上传';
      uploadInstance.uploadFile(
        { tempFilePath: 'temp/test.jpg' },
        'baby-001',
        'test-token',
        function () {}
      );

      // sign 请求 + PUT 请求 + create media 请求
      expect(mockRequests.length).toBe(3);
      // 创建媒体记录请求应包含描述和 milestone
      var createReq = mockRequests[mockRequests.length - 1];
      expect(createReq.data.title).toBe('测试上传');
      // syncToLocal 应写入存储
      var stored = mockStorage['album_media'];
      expect(Array.isArray(stored)).toBe(true);
      expect(stored[0].synced).toBe(true);
    });

    test('MinIO 内部 URL 应替换为外部 URL', function () {
      mockRequestHandler = function (opts: any) {
        if (opts.method === 'PUT') {
          opts.success({ statusCode: 200, data: '' });
          return;
        }
        if (opts.url.indexOf('/upload/sign') >= 0) {
          opts.success({
            statusCode: 200,
            data: { uploadUrl: 'http://minio:9000/bucket/key', cosKey: 'photos/key' },
          });
          return;
        }
        if (opts.url.indexOf('/media/') >= 0) {
          opts.success({ statusCode: 201, data: { id: 'media_123' } });
          return;
        }
        opts.success({ statusCode: 200, data: {} });
      };
      uploadInstance.uploadFile(
        { tempFilePath: 'temp/test.jpg' },
        'baby-001',
        'test-token',
        function () {}
      );
      // PUT 请求的 URL 应已被替换（minio:9000 → external）
      var putReq = mockRequests[1];
      expect(putReq.url).not.toContain('minio:9000');
    });

    test('readFileSync 异常应触发 fallback', function () {
      (global as any).wx.getFileSystemManager = function () {
        return { readFileSync: function () { throw new Error('read fail'); } };
      };
      mockRequestHandler = function (opts: any) {
        if (opts.url.indexOf('/upload/sign') >= 0) {
          opts.success({
            statusCode: 200,
            data: { uploadUrl: 'http://example.com/upload', cosKey: 'photos/key' },
          });
          return;
        }
        opts.success({ statusCode: 200, data: {} });
      };
      uploadInstance.uploadFile(
        { tempFilePath: 'temp/test.jpg' },
        'baby-001',
        'test-token',
        function () {}
      );
      // fallback 应写入存储
      var stored = mockStorage['album_media'];
      expect(Array.isArray(stored)).toBe(true);
      expect(stored.length).toBe(1);
    });

    test('PUT 失败应触发 handleUploadError', function () {
      mockRequestHandler = function (opts: any) {
        if (opts.method === 'PUT') {
          opts.success({ statusCode: 500, data: '' });
          return;
        }
        if (opts.url.indexOf('/upload/sign') >= 0) {
          opts.success({
            statusCode: 200,
            data: { uploadUrl: 'http://example.com/upload', cosKey: 'photos/key' },
          });
          return;
        }
        opts.success({ statusCode: 200, data: {} });
      };
      uploadInstance.uploadFile(
        { tempFilePath: 'temp/test.jpg' },
        'baby-001',
        'test-token',
        function () {}
      );
      expect(mockShowToastCalls.length).toBeGreaterThan(0);
    });

    test('sign 请求网络失败应触发 fallback', function () {
      mockRequestHandler = function (opts: any) {
        if (opts.url.indexOf('/upload/sign') >= 0) {
          if (opts.fail) opts.fail({ errMsg: 'timeout' });
          return;
        }
        opts.success({ statusCode: 200, data: {} });
      };
      uploadInstance.uploadFile(
        { tempFilePath: 'temp/test.jpg' },
        'baby-001',
        'test-token',
        function () {}
      );
      var stored = mockStorage['album_media'];
      expect(Array.isArray(stored)).toBe(true);
      expect(stored.length).toBe(1);
    });

    test('startUpload 全部完成后应跳转到 Step 4', function () {
      jest.useFakeTimers();
      mockRequestHandler = function (opts: any) {
        if (opts.method === 'PUT') {
          opts.success({ statusCode: 200, data: '' });
          return;
        }
        if (opts.url.indexOf('/upload/sign') >= 0) {
          opts.success({
            statusCode: 200,
            data: { uploadUrl: 'http://example.com/upload', cosKey: 'photos/key' },
          });
          return;
        }
        if (opts.url.indexOf('/media/') >= 0) {
          opts.success({ statusCode: 201, data: { id: 'media_123' } });
          return;
        }
        opts.success({ statusCode: 200, data: {} });
      };

      uploadInstance.startUpload([{ tempFilePath: 'temp/test.jpg' }]);
      // 推进全部定时器，使上传完成
      jest.advanceTimersByTime(500);
      expect(uploadInstance.data.currentStep).toBe(4);
      expect(uploadInstance.data.isUploading).toBe(false);
      expect(uploadInstance.data.uploadProgress).toBe(100);
      jest.useRealTimers();
    });

    test('PUT 请求网络失败应触发 fallback', function () {
      mockRequestHandler = function (opts: any) {
        if (opts.method === 'PUT') {
          if (opts.fail) opts.fail({ errMsg: 'network error' });
          return;
        }
        if (opts.url.indexOf('/upload/sign') >= 0) {
          opts.success({
            statusCode: 200,
            data: { uploadUrl: 'http://example.com/upload', cosKey: 'photos/key' },
          });
          return;
        }
        opts.success({ statusCode: 200, data: {} });
      };
      uploadInstance.uploadFile(
        { tempFilePath: 'temp/test.jpg' },
        'baby-001',
        'test-token',
        function () {}
      );
      var stored = mockStorage['album_media'];
      expect(Array.isArray(stored)).toBe(true);
      expect(stored.length).toBe(1);
    });

    test('创建媒体记录失败应在回调中继续', function () {
      var cbCalled = false;
      mockRequestHandler = function (opts: any) {
        if (opts.method === 'PUT') {
          opts.success({ statusCode: 200, data: '' });
          return;
        }
        if (opts.url.indexOf('/upload/sign') >= 0) {
          opts.success({
            statusCode: 200,
            data: { uploadUrl: 'http://example.com/upload', cosKey: 'photos/key' },
          });
          return;
        }
        if (opts.url.indexOf('/media/') >= 0) {
          opts.success({ statusCode: 400, data: {} });
          return;
        }
        opts.success({ statusCode: 200, data: {} });
      };
      uploadInstance.uploadFile(
        { tempFilePath: 'temp/test.jpg' },
        'baby-001',
        'test-token',
        function () { cbCalled = true; }
      );
      // 即使媒体记录创建失败，回调也应被调用
      expect(cbCalled).toBe(true);
    });

    test('创建媒体请求网络失败应在回调中继续', function () {
      var cbCalled = false;
      mockRequestHandler = function (opts: any) {
        if (opts.method === 'PUT') {
          opts.success({ statusCode: 200, data: '' });
          return;
        }
        if (opts.url.indexOf('/upload/sign') >= 0) {
          opts.success({
            statusCode: 200,
            data: { uploadUrl: 'http://example.com/upload', cosKey: 'photos/key' },
          });
          return;
        }
        if (opts.url.indexOf('/media/') >= 0) {
          if (opts.fail) opts.fail({ errMsg: 'network error' });
          return;
        }
        opts.success({ statusCode: 200, data: {} });
      };
      uploadInstance.uploadFile(
        { tempFilePath: 'temp/test.jpg' },
        'baby-001',
        'test-token',
        function () { cbCalled = true; }
      );
      expect(cbCalled).toBe(true);
    });
  });
});

export {};