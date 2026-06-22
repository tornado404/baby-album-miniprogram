/**
 * baby_profile.ts 运行时测试
 * 模拟 wx 环境，执行实际页面逻辑，验证方法行为
 */

var path = require('path');

// Mock wx 全局对象
var mockStorage: any = {};
var mockPageConfig: any = null;

(global as any).wx = {
  getWindowInfo: function () {
    return { statusBarHeight: 44, pixelRatio: 2 };
  },
  getStorageSync: function (key: string) {
    return mockStorage[key] !== undefined ? mockStorage[key] : '';
  },
  setStorageSync: function (key: string, value: any) {
    mockStorage[key] = value;
  },
  removeStorageSync: function (key: string) {
    delete mockStorage[key];
  },
  request: function () {},
  showLoading: function () {},
  hideLoading: function () {},
  showToast: function () {},
  showModal: function () {},
  showActionSheet: function () {},
  chooseMedia: function () {},
  uploadFile: function () {},
  navigateTo: function () {},
  navigateBack: function () {},
  reLaunch: function () {},
};

// Mock Page() — capture config and provide setData
(global as any).Page = function (config: any) {
  config.setData = function (data: any) {
    Object.assign(config.data, data);
  };
  mockPageConfig = config;
  return config;
};

describe('宝宝档案页 (Baby Profile) - 运行时逻辑', function () {
  var page: any;

  beforeAll(function () {
    mockStorage = {};
    mockPageConfig = null;

    jest.doMock('../constants/storage_keys', function () {
      return { STORAGE_KEYS: { currentBabyId: 'baby_diary_current_baby_id' } };
    }, { virtual: true });
    jest.doMock('../config/api', function () {
      return { API_CONFIG: { baseURL: 'http://test.api/api/v1' } };
    }, { virtual: true });
    jest.doMock('../services/request', function () {
      return {
        tokenManager: {
          getAccessToken: function () { return 'mock-token'; },
          getRefreshToken: function () { return 'mock-refresh'; },
        }
      };
    }, { virtual: true });

    jest.resetModules();
    require(path.resolve(__dirname, '../miniprogram/pages/baby_profile/baby_profile.js'));
    page = mockPageConfig;
  });

  function clearMockStorage(): void {
    for (var key in mockStorage) {
      if (mockStorage.hasOwnProperty(key)) {
        delete mockStorage[key];
      }
    }
  }

  beforeEach(function () {
    clearMockStorage();
    (global as any).wx.getStorageSync = function (key: string) {
      return mockStorage[key] !== undefined ? mockStorage[key] : '';
    };
    (global as any).wx.setStorageSync = function (key: string, value: any) {
      mockStorage[key] = value;
    };
    (global as any).wx.removeStorageSync = function (key: string) {
      delete mockStorage[key];
    };
    (global as any).wx.request = function () {};
    (global as any).wx.showLoading = function () {};
    (global as any).wx.hideLoading = function () {};
    (global as any).wx.showToast = function () {};
    (global as any).wx.showModal = function () {};
    (global as any).wx.showActionSheet = function () {};
    (global as any).wx.chooseMedia = function () {};
    (global as any).wx.uploadFile = function () {};
    (global as any).wx.navigateTo = function () {};
    (global as any).wx.navigateBack = function () {};
    (global as any).wx.reLaunch = function () {};
  });

  afterEach(function () {
    clearMockStorage();
  });

  // ==================== 基础 ====================

  test('Page 应正常创建', function () {
    expect(page).toBeDefined();
  });

  test('data 初始值应包含必需字段', function () {
    expect(page.data).toBeDefined();
    expect(page.data.safeTop).toBe(44);
    expect(page.data.nickname).toBe('小星星');
    expect(page.data.gender).toBe('female');
    expect(page.data.birthDate).toBe('');
    expect(page.data.dueDate).toBe('2025-11-24');
    expect(typeof page.data.weight).toBe('string');
    expect(typeof page.data.height).toBe('string');
  });

  // ==================== dateToArray ====================

  describe('dateToArray', function () {
    test('日期字符串应转为数值数组', function () {
      var result = page.dateToArray('2025-12-01');
      expect(result).toEqual([2025, 12, 1]);
    });

    test('单数字月份应正确处理', function () {
      var result = page.dateToArray('2025-06-05');
      expect(result).toEqual([2025, 6, 5]);
    });
  });

  // ==================== arrayToDate ====================

  describe('arrayToDate', function () {
    test('数值数组应转为日期字符串', function () {
      var result = page.arrayToDate([2025, 12, 1]);
      expect(result).toBe('2025-12-01');
    });

    test('单数字应补零', function () {
      var result = page.arrayToDate([2025, 6, 5]);
      expect(result).toBe('2025-06-05');
    });
  });

  // ==================== onLoad ====================

  describe('onLoad', function () {
    test('有 currentBabyId 时应调用 loadFromApi', function () {
      var loadCalledWith = '';
      var origLoad = page.loadFromApi;
      page.loadFromApi = function (babyId: string) { loadCalledWith = babyId; };
      mockStorage['baby_diary_current_baby_id'] = 'baby-123';
      page.onLoad();
      expect(loadCalledWith).toBe('baby-123');
      page.loadFromApi = origLoad;
    });

    test('无 currentBabyId 时不调用 loadFromApi', function () {
      var loadCalled = false;
      var origLoad = page.loadFromApi;
      page.loadFromApi = function () { loadCalled = true; };
      page.onLoad();
      expect(loadCalled).toBe(false);
      page.loadFromApi = origLoad;
    });

    test('birthDate 存在时应设置 birthDateArray', function () {
      page.setData({ birthDate: '2025-06-15' });
      page.onLoad();
      expect(page.data.birthDateArray).toEqual([2025, 6, 15]);
    });

    test('dueDate 存在时应设置 dueDateArray', function () {
      page.setData({ dueDate: '2025-05-20' });
      page.onLoad();
      expect(page.data.dueDateArray).toEqual([2025, 5, 20]);
    });

    test('statusBarHeight 为 0 时应使用默认值 44', function () {
      (global as any).wx.getWindowInfo = function () { return { statusBarHeight: 0, pixelRatio: 2 }; };
      page.data.safeTop = 0;
      page.onLoad();
      expect(page.data.safeTop).toBe(44);
    });
  });

  // ==================== loadFromApi ====================

  describe('loadFromApi', function () {
    test('成功应设置宝宝数据', function () {
      (global as any).wx.request = function (opts: any) {
        opts.success({
          statusCode: 200,
          data: { name: 'API宝宝', gender: 'male', birthDate: '2026-01-01', avatar: '' },
        });
      };
      page.loadFromApi('baby-1');
      expect(page.data.nickname).toBe('API宝宝');
      expect(page.data.gender).toBe('male');
      expect(page.data.birthDate).toBe('2026-01-01');
    });

    test('非 200 状态码应走本地降级', function () {
      var localCalled = false;
      var origLocal = page.loadFromLocal;
      page.loadFromLocal = function () { localCalled = true; };
      (global as any).wx.request = function (opts: any) {
        opts.success({ statusCode: 400 });
      };
      page.loadFromApi('baby-1');
      expect(localCalled).toBe(true);
      page.loadFromLocal = origLocal;
    });

    test('网络错误应走本地降级', function () {
      var localCalled = false;
      var origLocal = page.loadFromLocal;
      page.loadFromLocal = function () { localCalled = true; };
      (global as any).wx.request = function (opts: any) {
        opts.fail({});
      };
      page.loadFromApi('baby-1');
      expect(localCalled).toBe(true);
      page.loadFromLocal = origLocal;
    });

    test('http 头像应设置为 avatarUrl', function () {
      (global as any).wx.request = function (opts: any) {
        opts.success({
          statusCode: 200,
          data: { name: '宝宝', avatar: 'http://example.com/avatar.png' },
        });
      };
      page.loadFromApi('baby-1');
      expect(page.data.avatarUrl).toBe('http://example.com/avatar.png');
      expect(page.data.avatarEmoji).toBe('👶');
    });

    test('非 http 头像应设置为 avatarEmoji', function () {
      (global as any).wx.request = function (opts: any) {
        opts.success({
          statusCode: 200,
          data: { name: '宝宝', avatar: '🐱' },
        });
      };
      page.loadFromApi('baby-1');
      expect(page.data.avatarUrl).toBe('');
      expect(page.data.avatarEmoji).toBe('🐱');
    });

    test('birthDate 存在时应更新 birthDateArray', function () {
      (global as any).wx.request = function (opts: any) {
        opts.success({
          statusCode: 200,
          data: { name: '宝宝', birthDate: '2026-03-15' },
        });
      };
      page.loadFromApi('baby-1');
      expect(page.data.birthDateArray).toEqual([2026, 3, 15]);
    });
  });

  // ==================== loadFromLocal ====================

  describe('loadFromLocal', function () {
    test('应从本地缓存加载', function () {
      mockStorage['album_babies'] = [
        { id: 'b1', name: '本地宝宝', gender: 'male', birthDate: '2025-06-01', avatar: '' },
      ];
      page.loadFromLocal('b1');
      expect(page.data.nickname).toBe('本地宝宝');
      expect(page.data.gender).toBe('male');
    });

    test('找不到 babyId 时不修改数据', function () {
      page.data.nickname = '初始名';
      mockStorage['album_babies'] = [{ id: 'b2', name: '其他宝宝' }];
      page.loadFromLocal('b1');
      expect(page.data.nickname).toBe('初始名');
    });

    test('缓存为空安全处理', function () {
      mockStorage['album_babies'] = [];
      expect(function () { page.loadFromLocal('b1'); }).not.toThrow();
    });

    test('缓存读取失败安全处理', function () {
      (global as any).wx.getStorageSync = function () { throw new Error('fail'); };
      expect(function () { page.loadFromLocal('b1'); }).not.toThrow();
    });
  });

  // ==================== onAvatarTap ====================

  describe('onAvatarTap', function () {
    test('应弹出操作菜单', function () {
      var actionSheetOptions: any = null;
      (global as any).wx.showActionSheet = function (opts: any) { actionSheetOptions = opts; };
      page.onAvatarTap();
      expect(actionSheetOptions).not.toBeNull();
      expect(actionSheetOptions.itemList).toEqual(['拍照', '从相册选择']);
    });

    test('选择拍照应调用 chooseMedia 相机', function () {
      var mediaOptions: any = null;
      (global as any).wx.showActionSheet = function (opts: any) { opts.success({ tapIndex: 0 }); };
      (global as any).wx.chooseMedia = function (opts: any) { mediaOptions = opts; };
      page.onAvatarTap();
      expect(mediaOptions).not.toBeNull();
      expect(mediaOptions.sourceType).toEqual(['camera']);
    });

    test('选择相册应调用 chooseMedia album', function () {
      var mediaOptions: any = null;
      (global as any).wx.showActionSheet = function (opts: any) { opts.success({ tapIndex: 1 }); };
      (global as any).wx.chooseMedia = function (opts: any) { mediaOptions = opts; };
      page.onAvatarTap();
      expect(mediaOptions.sourceType).toEqual(['album']);
    });

    test('选择媒体后应上传', function () {
      var uploadedPath = '';
      var origUpload = page.uploadAvatar;
      page.uploadAvatar = function (filePath: string) { uploadedPath = filePath; };
      (global as any).wx.showActionSheet = function (opts: any) { opts.success({ tapIndex: 0 }); };
      (global as any).wx.chooseMedia = function (opts: any) {
        opts.success({ tempFiles: [{ tempFilePath: '/tmp/photo.jpg' }] });
      };
      page.onAvatarTap();
      expect(uploadedPath).toBe('/tmp/photo.jpg');
      page.uploadAvatar = origUpload;
    });

    test('tempFiles 为空时跳过上传', function () {
      var uploadCalled = false;
      var origUpload = page.uploadAvatar;
      page.uploadAvatar = function () { uploadCalled = true; };
      (global as any).wx.showActionSheet = function (opts: any) { opts.success({ tapIndex: 0 }); };
      (global as any).wx.chooseMedia = function (opts: any) {
        opts.success({ tempFiles: [null] });
      };
      page.onAvatarTap();
      expect(uploadCalled).toBe(false);
      page.uploadAvatar = origUpload;
    });
  });

  // ==================== uploadAvatar ====================

  describe('uploadAvatar', function () {
    test('无 babyId 应跳过', function () {
      var uploadCalled = false;
      (global as any).wx.uploadFile = function () { uploadCalled = true; };
      page.uploadAvatar('/tmp/test.jpg');
      expect(uploadCalled).toBe(false);
    });

    test('应调用 wx.uploadFile', function () {
      var uploadUrl = '';
      mockStorage['baby_diary_current_baby_id'] = 'baby-1';
      (global as any).wx.uploadFile = function (opts: any) { uploadUrl = opts.url; };
      page.uploadAvatar('/tmp/test.jpg');
      expect(uploadUrl).toContain('/babies/baby-1/avatar');
    });

    test('成功不应抛出', function () {
      mockStorage['baby_diary_current_baby_id'] = 'baby-1';
      (global as any).wx.uploadFile = function (opts: any) {
        opts.success({ statusCode: 200, data: '{}' });
      };
      expect(function () { page.uploadAvatar('/tmp/test.jpg'); }).not.toThrow();
    });

    test('非 200 状态码不应抛出', function () {
      mockStorage['baby_diary_current_baby_id'] = 'baby-1';
      (global as any).wx.uploadFile = function (opts: any) {
        opts.success({ statusCode: 400, data: '{}' });
      };
      expect(function () { page.uploadAvatar('/tmp/test.jpg'); }).not.toThrow();
    });

    test('网络失败不应抛出', function () {
      mockStorage['baby_diary_current_baby_id'] = 'baby-1';
      (global as any).wx.uploadFile = function (opts: any) {
        opts.fail({ errMsg: 'network error' });
      };
      expect(function () { page.uploadAvatar('/tmp/test.jpg'); }).not.toThrow();
    });

    test('filePath 为空应跳过', function () {
      var uploadCalled = false;
      (global as any).wx.uploadFile = function () { uploadCalled = true; };
      page.uploadAvatar('');
      expect(uploadCalled).toBe(false);
    });
  });

  // ==================== onSave ====================

  describe('onSave', function () {
    test('有 babyId 时应 PUT /babies/:id', function () {
      var requestUrl = '';
      mockStorage['baby_diary_current_baby_id'] = 'baby-1';
      (global as any).wx.request = function (opts: any) { requestUrl = opts.url; opts.success({ statusCode: 200 }); };
      (global as any).wx.navigateBack = function () {};
      page.onSave();
      expect(requestUrl).toContain('/babies/baby-1');
    });

    test('无 babyId 时应 POST /babies/', function () {
      var requestUrl = '';
      (global as any).wx.request = function (opts: any) { requestUrl = opts.url; opts.success({ statusCode: 201, data: { id: 'new-id' } }); };
      (global as any).wx.navigateBack = function () {};
      (global as any).wx.setStorageSync = function () {};
      page.onSave();
      expect(requestUrl).toContain('/babies/');
      expect(requestUrl).not.toContain('undefined');
    });

    test('保存成功应显示 toast', function () {
      var toastTitle = '';
      (global as any).wx.request = function (opts: any) { opts.success({ statusCode: 200 }); };
      (global as any).wx.navigateBack = function () {};
      (global as any).wx.showToast = function (opts: any) { toastTitle = opts.title; };
      page.onSave();
      expect(toastTitle).toBe('保存成功');
    });

    test('保存失败应走本地降级', function () {
      var toastTitle = '';
      (global as any).wx.request = function (opts: any) { opts.success({ statusCode: 400 }); };
      (global as any).wx.navigateBack = function () {};
      (global as any).wx.showToast = function (opts: any) { toastTitle = opts.title; };
      page.onSave();
      expect(toastTitle).toBe('已保存到本地');
    });

    test('网络错误应走本地降级', function () {
      var toastTitle = '';
      (global as any).wx.request = function (opts: any) { opts.fail({}); };
      (global as any).wx.navigateBack = function () {};
      (global as any).wx.showToast = function (opts: any) { toastTitle = opts.title; };
      page.onSave();
      expect(toastTitle).toBe('已保存到本地');
    });

    test('新创建的 baby 应保存 currentBabyId', function () {
      (global as any).wx.request = function (opts: any) { opts.success({ statusCode: 201, data: { id: 'new-id-123' } }); };
      (global as any).wx.navigateBack = function () {};
      page.onSave();
      expect(mockStorage['baby_diary_current_baby_id']).toBe('new-id-123');
    });
  });

  // ==================== syncLocalBabies ====================

  describe('syncLocalBabies', function () {
    test('应更新已有记录', function () {
      mockStorage['album_babies'] = [
        { id: 'b1', name: '旧名字' },
        { id: 'b2', name: '其他宝宝' },
      ];
      page.syncLocalBabies({ name: '新名字' }, 'b1', null);
      expect(mockStorage['album_babies'][0].name).toBe('新名字');
      expect(mockStorage['album_babies'][1].name).toBe('其他宝宝');
    });

    test('新增不存在的记录', function () {
      mockStorage['album_babies'] = [{ id: 'old', name: '旧宝宝' }];
      page.syncLocalBabies({ name: '新宝宝' }, 'new-baby', null);
      expect(mockStorage['album_babies'].length).toBe(2);
      expect(mockStorage['album_babies'][1].id).toBe('new-baby');
    });

    test('保存后的 baby 数据应合并', function () {
      mockStorage['album_babies'] = [{ id: 'b1', name: '旧名字' }];
      page.syncLocalBabies({ name: '更新名字' }, 'b1', { id: 'b1', serverField: 'val' });
      // 本地 profile + 服务器返回数据应合并
      var saved = mockStorage['album_babies'][0];
      expect(saved.name).toBe('更新名字');
      expect(saved.serverField).toBe('val');
    });

    test('当前 baby 应更新 BABY_KEY', function () {
      mockStorage['baby_diary_current_baby_id'] = 'b1';
      mockStorage['album_babies'] = [{ id: 'b1', name: '旧名字' }];
      page.syncLocalBabies({ name: '新名字' }, 'b1', null);
      // BABY_KEY should be set to the updated baby object
      expect(mockStorage['baby_diary_baby_profile']).toBeDefined();
      expect(mockStorage['baby_diary_baby_profile'].name).toBe('新名字');
    });

    test('非当前 baby 不应更新 BABY_KEY', function () {
      mockStorage['baby_diary_current_baby_id'] = 'b2';
      mockStorage['album_babies'] = [{ id: 'b1', name: '旧名字' }];
      page.syncLocalBabies({ name: '新名字' }, 'b1', null);
      expect(mockStorage['baby_diary_baby_profile']).toBeUndefined();
    });

    test('缓存读取失败安全处理', function () {
      (global as any).wx.getStorageSync = function () { throw new Error('fail'); };
      expect(function () { page.syncLocalBabies({}, 'b1', null); }).not.toThrow();
    });

    test('savedBaby 对象应合并到存储', function () {
      mockStorage['album_babies'] = [{ id: 'b1', name: '旧名字' }];
      page.syncLocalBabies({ name: '更新名字' }, 'b1', { id: 'b1', serverField: 'val' });
      var saved = mockStorage['album_babies'][0];
      expect(saved.name).toBe('更新名字');
      expect(saved.serverField).toBe('val');
    });

    test('debug syncLocalBabies BABY_KEY', function () {
      mockStorage['baby_diary_current_baby_id'] = 'b1';
      mockStorage['album_babies'] = [{ id: 'b1', name: '旧名字' }];
      // Verify mockStorage
      expect(Object.keys(mockStorage).length).toBe(2);
      // Verify wx mock reads from mockStorage
      var readById = wx.getStorageSync('baby_diary_current_baby_id');
      expect(readById).toBe('b1');
      var readAlbum = wx.getStorageSync('album_babies');
      expect(readAlbum).toBeDefined();
      expect(readAlbum[0].id).toBe('b1');
      // Call method
      page.syncLocalBabies({ name: '新名字' }, 'b1', null);
      // Check album_babies was stored
      expect(mockStorage['album_babies'][0].name).toBe('新名字');
      // Check BABY_KEY
      expect(mockStorage['baby_diary_baby_profile']).toBeDefined();
      expect(mockStorage['baby_diary_baby_profile'].name).toBe('新名字');
    });
  });

  // ==================== saveLocalFallback ====================

  describe('saveLocalFallback', function () {
    test('已有记录应更新', function () {
      mockStorage['album_babies'] = [{ id: 'b1', name: '旧名字' }];
      mockStorage['baby_diary_current_baby_id'] = 'b1';
      (global as any).wx.navigateBack = function () {};
      page.saveLocalFallback({ name: '新名字' }, 'b1');
      expect(mockStorage['album_babies'][0].name).toBe('新名字');
    });

    test('新记录应新增', function () {
      mockStorage['album_babies'] = [];
      (global as any).wx.navigateBack = function () {};
      page.saveLocalFallback({ name: '新宝宝' }, '');
      expect(mockStorage['album_babies'].length).toBe(1);
    });

    test('当前 baby 应更新 BABY_KEY', function () {
      mockStorage['baby_diary_current_baby_id'] = 'b1';
      mockStorage['album_babies'] = [{ id: 'b1', name: '旧名字' }];
      (global as any).wx.navigateBack = function () {};
      page.saveLocalFallback({ name: '新名字' }, 'b1');
      expect(mockStorage['baby_diary_baby_profile']).toBeDefined();
      expect(mockStorage['baby_diary_baby_profile'].name).toBe('新名字');
    });
  });

  // ==================== 表单交互 ====================

  describe('onNicknameInput', function () {
    test('应更新 nickname', function () {
      page.onNicknameInput({ detail: { value: '小月亮' } });
      expect(page.data.nickname).toBe('小月亮');
    });
  });

  describe('onGenderSelect', function () {
    test('应更新 gender', function () {
      page.onGenderSelect({ currentTarget: { dataset: { gender: 'male' } } });
      expect(page.data.gender).toBe('male');
    });

    test('其他值应正确设置', function () {
      page.onGenderSelect({ currentTarget: { dataset: { gender: 'female' } } });
      expect(page.data.gender).toBe('female');
    });
  });

  describe('onBirthDateChange', function () {
    test('应更新 birthDate 和 birthDateArray', function () {
      page.onBirthDateChange({ detail: { value: '2026-06-15' } });
      expect(page.data.birthDate).toBe('2026-06-15');
      expect(page.data.birthDateArray).toEqual([2026, 6, 15]);
    });
  });

  describe('onDueDateChange', function () {
    test('应更新 dueDate 和 dueDateArray', function () {
      page.onDueDateChange({ detail: { value: [2026, 5, 20] } });
      expect(page.data.dueDate).toBe('2026-05-20');
      expect(page.data.dueDateArray).toEqual([2026, 5, 20]);
    });
  });

  // ==================== 体重/身高步进器 ====================

  describe('onWeightMinus', function () {
    test('应减少 0.1', function () {
      page.setData({ weight: '7.2' });
      page.onWeightMinus();
      expect(page.data.weight).toBe('7.1');
    });

    test('不应低于 0', function () {
      page.setData({ weight: '0.0' });
      page.onWeightMinus();
      expect(page.data.weight).toBe('0.0');
    });
  });

  describe('onWeightPlus', function () {
    test('应增加 0.1', function () {
      page.setData({ weight: '7.2' });
      page.onWeightPlus();
      expect(page.data.weight).toBe('7.3');
    });

    test('从 0 开始增加', function () {
      page.setData({ weight: '0.0' });
      page.onWeightPlus();
      expect(page.data.weight).toBe('0.1');
    });
  });

  describe('onHeightMinus', function () {
    test('应减少 1', function () {
      page.setData({ height: '65' });
      page.onHeightMinus();
      expect(page.data.height).toBe('64');
    });

    test('不应低于 0', function () {
      page.setData({ height: '0' });
      page.onHeightMinus();
      expect(page.data.height).toBe('0');
    });
  });

  describe('onHeightPlus', function () {
    test('应增加 1', function () {
      page.setData({ height: '65' });
      page.onHeightPlus();
      expect(page.data.height).toBe('66');
    });
  });

  // ==================== onBack ====================

  describe('onBack', function () {
    test('应返回上一页', function () {
      var called = false;
      (global as any).wx.navigateBack = function () { called = true; };
      page.onBack();
      expect(called).toBe(true);
    });
  });
});

export {};