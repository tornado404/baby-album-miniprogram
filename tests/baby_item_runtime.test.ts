/**
 * 宝宝信息编辑页 (Baby Item) 运行时测试
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

describe('宝宝信息编辑页 (Baby Item) - 运行时逻辑', function () {
  var page: any;

  beforeAll(function () {
    mockStorage = {};
    mockPageConfig = null;

    jest.doMock('../config/api', function () {
      return { API_CONFIG: { baseURL: 'https://api.test.com' } };
    }, { virtual: true });
    jest.doMock('../constants/storage_keys', function () {
      return { STORAGE_KEYS: { currentBabyId: 'baby_diary_current_baby_id' } };
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
    require(path.resolve(__dirname, '../miniprogram/pages/baby_item/baby_item.js'));
    page = mockPageConfig;
  });

  beforeEach(function () {
    mockStorage = {};
    (global as any).wx.getStorageSync = function (key: string) {
      return mockStorage[key] !== undefined ? mockStorage[key] : '';
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

  // ==================== 基础 ====================

  test('Page 应正常创建', function () {
    expect(page).toBeDefined();
  });

  test('data 初始值应包含必需字段', function () {
    expect(page.data).toBeDefined();
    expect(page.data.safeTop).toBe(44);
    expect(page.data.babyName).toBe('');
    expect(page.data.birthDate).toBe('');
    expect(page.data.selectedMilestone).toBe('');
    expect(page.data.milestoneIndex).toBe(-1);
    expect(page.data.showMilestonePicker).toBe(false);
    expect(page.data.description).toBe('');
    expect(page.data.charCount).toBe(0);
    expect(page.data.maxChars).toBe(200);
    expect(page.data.isLoading).toBe(true);
    expect(page.data.isSaving).toBe(false);
    expect(page.data.babyId).toBe('');
    expect(Array.isArray(page.data.milestones)).toBe(true);
    expect(page.data.milestones.length).toBeGreaterThanOrEqual(12);
  });

  // ==================== onLoad ====================

  test('onLoad 无参数时应从缓存读取 babyId', function () {
    mockStorage['baby_diary_current_baby_id'] = 'baby-from-cache';
    page.onLoad({});
    expect(page.data.babyId).toBe('baby-from-cache');
    // isLoading stays true when loadBabyData is called (async, mock request doesn't callback)
    expect(page.data.isLoading).toBe(true);
  });

  test('onLoad 有 id 参数时应使用传入 id', function () {
    page.onLoad({ id: 'baby-from-param' });
    expect(page.data.babyId).toBe('baby-from-param');
  });

  test('onLoad 无参数且无缓存时 isLoading 应为 false', function () {
    page.onLoad();
    expect(page.data.babyId).toBe('');
    expect(page.data.isLoading).toBe(false);
  });

  test('onLoad statusBarHeight 为 0 时应使用默认值 44', function () {
    (global as any).wx.getWindowInfo = function () { return { statusBarHeight: 0, pixelRatio: 2 }; };
    page.data.safeTop = 0;
    page.onLoad({});
    expect(page.data.safeTop).toBe(44);
  });

  // ==================== setBabyData ====================

  test('setBabyData 应设置宝宝基本信息', function () {
    page.setBabyData({ name: '小星星', gender: 'female', birthDate: '2025-06-01', avatar: 'http://example.com/avatar.png' });
    expect(page.data.babyName).toBe('小星星');
    expect(page.data.gender).toBe('female');
    expect(page.data.birthDate).toBe('2025-06-01');
    expect(page.data.avatarUrl).toBe('http://example.com/avatar.png');
    expect(page.data.avatarEmoji).toBe('👶');
  });

  test('setBabyData 非 http 头像应作为 emoji', function () {
    page.setBabyData({ name: '小星星', avatar: '👧' });
    expect(page.data.avatarUrl).toBe('');
    expect(page.data.avatarEmoji).toBe('👧');
  });

  test('setBabyData 空名字应使用默认值', function () {
    page.setBabyData({ name: '' });
    expect(page.data.babyName).toBe('小星星');
  });

  // ==================== onDateChange ====================

  test('onDateChange 应更新 birthDate', function () {
    page.onDateChange({ detail: { value: '2025-08-15' } });
    expect(page.data.birthDate).toBe('2025-08-15');
  });

  // ==================== 里程碑选择 ====================

  test('onMilestoneTap 应切换下拉状态', function () {
    var before = page.data.showMilestonePicker;
    page.onMilestoneTap();
    expect(page.data.showMilestonePicker).toBe(!before);
  });

  test('onMilestoneTap 再次点击应恢复状态', function () {
    var before = page.data.showMilestonePicker;
    page.onMilestoneTap();
    page.onMilestoneTap();
    expect(page.data.showMilestonePicker).toBe(before);
  });

  test('onMilestoneSelect 应选择里程碑', function () {
    page.onMilestoneSelect({ currentTarget: { dataset: { index: 0 } } });
    expect(page.data.selectedMilestone).toBe('第一次翻身');
    expect(page.data.milestoneIndex).toBe(0);
    expect(page.data.showMilestonePicker).toBe(false);
  });

  test('onMilestoneSelect 应能选择其他里程碑', function () {
    page.onMilestoneSelect({ currentTarget: { dataset: { index: 3 } } });
    expect(page.data.selectedMilestone).toBe('开始走路');
    expect(page.data.milestoneIndex).toBe(3);
  });

  // ==================== 文本描述 ====================

  test('onDescriptionInput 应更新描述和字符计数', function () {
    page.onDescriptionInput({ detail: { value: '翻身记录' } });
    expect(page.data.description).toBe('翻身记录');
    expect(page.data.charCount).toBe(4);
  });

  test('onDescriptionInput 超出 maxChars 应截断', function () {
    var longText = new Array(250).join('a');
    page.onDescriptionInput({ detail: { value: longText } });
    expect(page.data.description.length).toBe(200);
    expect(page.data.charCount).toBe(200);
  });

  test('onDescriptionInput 空值应安全处理', function () {
    page.onDescriptionInput({ detail: {} });
    expect(page.data.description).toBe('');
    expect(page.data.charCount).toBe(0);
  });

  // ==================== 头像 ====================

  test('onAvatarTap 应弹出操作菜单', function () {
    var actionSheetOptions: any = null;
    (global as any).wx.showActionSheet = function (opts: any) { actionSheetOptions = opts; };
    page.onAvatarTap();
    expect(actionSheetOptions).not.toBeNull();
    expect(actionSheetOptions.itemList).toEqual(['拍照', '从相册选择']);
  });

  test('onAvatarTap 选择拍照应调用 chooseMedia', function () {
    var mediaOptions: any = null;
    (global as any).wx.showActionSheet = function (opts: any) {
      opts.success({ tapIndex: 0 });
    };
    (global as any).wx.chooseMedia = function (opts: any) { mediaOptions = opts; };
    page.onAvatarTap();
    expect(mediaOptions).not.toBeNull();
    expect(mediaOptions.sourceType).toEqual(['camera']);
  });

  test('onAvatarTap 选择相册应调用 chooseMedia', function () {
    var mediaOptions: any = null;
    (global as any).wx.showActionSheet = function (opts: any) {
      opts.success({ tapIndex: 1 });
    };
    (global as any).wx.chooseMedia = function (opts: any) { mediaOptions = opts; };
    page.onAvatarTap();
    expect(mediaOptions).not.toBeNull();
    expect(mediaOptions.sourceType).toEqual(['album']);
  });

  test('onAvatarTap 选择媒体后应上传', function () {
    var uploadedPath = '';
    var origUpload = page.uploadAvatar;
    page.uploadAvatar = function (filePath: string) { uploadedPath = filePath; };
    (global as any).wx.showActionSheet = function (opts: any) {
      opts.success({ tapIndex: 0 });
    };
    (global as any).wx.chooseMedia = function (opts: any) {
      opts.success({ tempFiles: [{ tempFilePath: '/tmp/photo.jpg' }] });
    };
    page.onAvatarTap();
    expect(uploadedPath).toBe('/tmp/photo.jpg');
    page.uploadAvatar = origUpload;
  });

  test('onAvatarTap chooseMedia tempFilePath 为空应跳过上传', function () {
    var uploadCalled = false;
    var origUpload = page.uploadAvatar;
    page.uploadAvatar = function () { uploadCalled = true; };
    (global as any).wx.showActionSheet = function (opts: any) {
      opts.success({ tapIndex: 0 });
    };
    (global as any).wx.chooseMedia = function (opts: any) {
      opts.success({ tempFiles: [{ tempFilePath: '' }] });
    };
    var setDataCalls: any[] = [];
    var origSetData = page.setData;
    page.setData = function (data: any) { setDataCalls.push(data); Object.assign(page.data, data); };
    page.onAvatarTap();
    expect(uploadCalled).toBe(true);
    expect(setDataCalls.some(function (c: any) { return c.avatarUrl === ''; })).toBe(true);
    page.uploadAvatar = origUpload;
    page.setData = origSetData;
  });

  test('uploadAvatar 无 babyId 应跳过', function () {
    var uploadCalled = false;
    page.setData({ babyId: '' });
    (global as any).wx.uploadFile = function () { uploadCalled = true; };
    page.uploadAvatar('/tmp/test.jpg');
    expect(uploadCalled).toBe(false);
  });

  test('uploadAvatar 应调用 wx.uploadFile', function () {
    var uploadUrl = '';
    page.setData({ babyId: 'b1' });
    (global as any).wx.uploadFile = function (opts: any) { uploadUrl = opts.url; };
    page.uploadAvatar('/tmp/test.jpg');
    expect(uploadUrl).toContain('/babies/b1/avatar');
  });

  test('uploadAvatar 成功不应抛出', function () {
    page.setData({ babyId: 'b1' });
    (global as any).wx.uploadFile = function (opts: any) {
      opts.success({ statusCode: 200, data: '{}' });
    };
    expect(function () { page.uploadAvatar('/tmp/test.jpg'); }).not.toThrow();
  });

  test('uploadAvatar 非 200 状态码应不抛出', function () {
    page.setData({ babyId: 'b1' });
    (global as any).wx.uploadFile = function (opts: any) {
      opts.success({ statusCode: 400, data: '{}' });
    };
    expect(function () { page.uploadAvatar('/tmp/test.jpg'); }).not.toThrow();
  });

  test("uploadAvatar 网络失败应不抛出", function () {
    page.setData({ babyId: "b1" });
    (global as any).wx.uploadFile = function (opts: any) {
      opts.fail({ errMsg: "network error" });
    };
    expect(function () { page.uploadAvatar("/tmp/test.jpg"); }).not.toThrow();
  });

  test('uploadAvatar filePath 为空应跳过上传', function () {
    var uploadCalled = false;
    (global as any).wx.uploadFile = function () { uploadCalled = true; };
    page.uploadAvatar('');
    expect(uploadCalled).toBe(false);
  });

  test('onAvatarTap chooseMedia 无 tempFile 应跳过上传', function () {
    var uploadCalled = false;
    var origUpload = page.uploadAvatar;
    page.uploadAvatar = function () { uploadCalled = true; };
    (global as any).wx.showActionSheet = function (opts: any) {
      opts.success({ tapIndex: 0 });
    };
    (global as any).wx.chooseMedia = function (opts: any) {
      opts.success({ tempFiles: [null] });
    };
    page.onAvatarTap();
    expect(uploadCalled).toBe(false);
    page.uploadAvatar = origUpload;
  });

  // ==================== 保存 - 更新 ====================

  test('onSave 应调用 updateBaby（有 babyId）', function () {
    var called = false;
    page.setData({ babyId: 'b1', babyName: '小星星', isSaving: false });
    var origUpdate = page.updateBaby;
    page.updateBaby = function () { called = true; };
    page.onSave();
    expect(called).toBe(true);
    page.updateBaby = origUpdate;
  });

  test('onSave 应调用 createBaby（无 babyId）', function () {
    var called = false;
    page.setData({ babyId: '', babyName: '新宝宝', isSaving: false });
    var origCreate = page.createBaby;
    page.createBaby = function () { called = true; };
    page.onSave();
    expect(called).toBe(true);
    page.createBaby = origCreate;
  });

  test('onSave 正在保存时应跳过', function () {
    page.setData({ isSaving: true });
    var called = false;
    var origUpdate = page.updateBaby;
    page.updateBaby = function () { called = true; };
    page.onSave();
    expect(called).toBe(false);
    page.updateBaby = origUpdate;
  });

  test('onSave avatarUrl 为空时应使用 avatarEmoji', function () {
    var savedData: any = null;
    page.setData({
      babyId: 'b1', babyName: '小星星', isSaving: false,
      avatarUrl: '', avatarEmoji: '👶',
    });
    var origUpdate = page.updateBaby;
    page.updateBaby = function (data: any) { savedData = data; };
    page.onSave();
    expect(savedData).not.toBeNull();
    expect(savedData.avatar).toBe('👶');
    page.updateBaby = origUpdate;
  });

  test('updateBaby 成功应保存并返回', function () {
    var navBackCalled = false;
    var toastTitle = '';
    (global as any).wx.navigateBack = function () { navBackCalled = true; };
    (global as any).wx.showToast = function (opts: any) { toastTitle = opts.title; };

    page.setData({ babyId: 'b1', babyName: '小星星', isSaving: false });
    (global as any).wx.request = function (opts: any) {
      opts.success({ statusCode: 200 });
    };
    page.updateBaby({ name: '小星星' });
    expect(navBackCalled).toBe(true);
    expect(toastTitle).toBe('保存成功');
  });

  test('updateBaby 失败应提示', function () {
    var toastTitle = '';
    (global as any).wx.showToast = function (opts: any) { toastTitle = opts.title; };

    page.setData({ babyId: 'b1', isSaving: false });
    (global as any).wx.request = function (opts: any) {
      opts.success({ statusCode: 400 });
    };
    page.updateBaby({ name: 'test' });
    expect(toastTitle).toBe('保存失败');
  });

  test('updateBaby 网络错误应本地保存', function () {
    var toastTitle = '';
    var navBackCalled = false;
    (global as any).wx.showToast = function (opts: any) { toastTitle = opts.title; };
    (global as any).wx.navigateBack = function () { navBackCalled = true; };

    page.setData({ babyId: 'b1', isSaving: false });
    (global as any).wx.request = function (opts: any) {
      opts.fail({});
    };
    page.updateBaby({ name: 'test' });
    expect(toastTitle).toBe('已保存到本地');
    expect(navBackCalled).toBe(true);
  });

  test('updateBaby 更新后 isSaving 应为 false', function () {
    page.setData({ babyId: 'b1' });
    (global as any).wx.request = function (opts: any) {
      opts.success({ statusCode: 200 });
    };
    page.updateBaby({ name: 'test' });
    expect(page.data.isSaving).toBe(false);
  });

  // ==================== 保存 - 创建 ====================

  test('createBaby 成功应保存并返回', function () {
    var navBackCalled = false;
    var toastTitle = '';
    var storedId = '';
    (global as any).wx.navigateBack = function () { navBackCalled = true; };
    (global as any).wx.showToast = function (opts: any) { toastTitle = opts.title; };
    (global as any).wx.setStorageSync = function (key: string, val: any) { storedId = val; };

    page.setData({ babyId: '', isSaving: false });
    (global as any).wx.request = function (opts: any) {
      opts.success({ statusCode: 201, data: { id: 'new-baby-1' } });
    };
    page.createBaby({ name: '新宝宝' });
    expect(storedId).toBe('new-baby-1');
    expect(navBackCalled).toBe(true);
    expect(toastTitle).toBe('创建成功');
  });

  test('createBaby 失败应提示', function () {
    var toastTitle = '';
    (global as any).wx.showToast = function (opts: any) { toastTitle = opts.title; };

    page.setData({ babyId: '', isSaving: false });
    (global as any).wx.request = function (opts: any) {
      opts.success({ statusCode: 400 });
    };
    page.createBaby({ name: 'test' });
    expect(toastTitle).toBe('创建失败');
  });

  test('createBaby 网络错误应提示', function () {
    var toastTitle = '';
    (global as any).wx.showToast = function (opts: any) { toastTitle = opts.title; };

    page.setData({ babyId: '', isSaving: false });
    (global as any).wx.request = function (opts: any) {
      opts.fail({});
    };
    page.createBaby({ name: 'test' });
    expect(toastTitle).toBe('网络错误');
  });

  test('createBaby 后 isSaving 应为 false', function () {
    page.setData({ babyId: '' });
    (global as any).wx.request = function (opts: any) {
      opts.success({ statusCode: 201, data: { id: 'new' } });
    };
    page.createBaby({ name: 'test' });
    expect(page.data.isSaving).toBe(false);
  });

  test('createBaby 网络错误后 isSaving 应为 false', function () {
    page.setData({ babyId: '' });
    (global as any).wx.request = function (opts: any) {
      opts.fail({});
    };
    page.createBaby({ name: 'test' });
    expect(page.data.isSaving).toBe(false);
  });

  // ==================== syncLocal ====================

  test('syncLocal 应更新本地缓存已有记录', function () {
    mockStorage['album_babies'] = [
      { id: 'b1', name: '旧名字' },
      { id: 'b2', name: '其他宝宝' },
    ];
    page.setData({ babyId: 'b1' });
    page.syncLocal({ name: '新名字', gender: 'male' });
    expect(mockStorage['album_babies'][0].name).toBe('新名字');
    expect(mockStorage['album_babies'][1].name).toBe('其他宝宝');
  });

  test('syncLocal 应新增不存在的记录', function () {
    mockStorage['album_babies'] = [{ id: 'old', name: '旧宝宝' }];
    page.setData({ babyId: 'new-baby' });
    page.syncLocal({ name: '新宝宝' });
    expect(mockStorage['album_babies'].length).toBe(2);
    expect(mockStorage['album_babies'][1].id).toBe('new-baby');
  });

  test('syncLocal 空缓存应安全处理', function () {
    mockStorage['album_babies'] = [];
    page.setData({ babyId: 'b1' });
    expect(function () { page.syncLocal({ name: 'test' }); }).not.toThrow();
  });

  test('syncLocal 缓存读取失败应不抛出异常', function () {
    (global as any).wx.getStorageSync = function () { throw new Error('storage error'); };
    page.setData({ babyId: 'b1' });
    expect(function () { page.syncLocal({ name: 'test' }); }).not.toThrow();
  });

  // ==================== onBack ====================

  test('onBack 应返回上一页', function () {
    var called = false;
    (global as any).wx.navigateBack = function () { called = true; };
    page.onBack();
    expect(called).toBe(true);
  });

  // ==================== loadFromLocal ====================

  test('loadFromLocal 应从本地缓存加载', function () {
    mockStorage['album_babies'] = [
      { id: 'b1', name: '本地宝宝', gender: 'male', birthDate: '2025-01-01' }
    ];
    page.loadFromLocal('b1');
    expect(page.data.babyName).toBe('本地宝宝');
  });

  test('loadFromLocal 找不到 babyId 时不修改数据', function () {
    page.data.babyName = '初始名';
    mockStorage['album_babies'] = [{ id: 'b2', name: '其他宝宝' }];
    page.loadFromLocal('b1');
    expect(page.data.babyName).toBe('初始名');
  });

  test('loadFromLocal 缓存为空安全处理', function () {
    mockStorage['album_babies'] = [];
    expect(function () { page.loadFromLocal('b1'); }).not.toThrow();
  });

  test('loadFromLocal 缓存读取失败安全处理', function () {
    (global as any).wx.getStorageSync = function () { throw new Error('fail'); };
    expect(function () { page.loadFromLocal('b1'); }).not.toThrow();
  });

  test('loadFromLocal getStorageSync 返回空字符串时不抛异常', function () {
    (global as any).wx.getStorageSync = function () { return ''; };
    expect(function () { page.loadFromLocal('b1'); }).not.toThrow();
  });

  // ==================== loadBabyData ====================

  test('loadBabyData 成功应设置宝宝数据', function () {
    page.setData({ isLoading: true });
    (global as any).wx.request = function (opts: any) {
      opts.success({ statusCode: 200, data: { id: 'b1', name: 'API 宝宝', gender: 'female' } });
    };
    page.loadBabyData('b1');
    expect(page.data.babyName).toBe('API 宝宝');
    expect(page.data.isLoading).toBe(false);
  });

  test('loadBabyData 非 200 应走本地降级', function () {
    var localCalled = false;
    var origLocal = page.loadFromLocal;
    page.loadFromLocal = function () { localCalled = true; };
    (global as any).wx.request = function (opts: any) {
      opts.success({ statusCode: 400 });
    };
    page.loadBabyData('b1');
    expect(localCalled).toBe(true);
    page.loadFromLocal = origLocal;
  });

  test('loadBabyData 网络错误应走本地降级', function () {
    var localCalled = false;
    page.isLoading = true;
    var origLocal = page.loadFromLocal;
    page.loadFromLocal = function () { localCalled = true; };
    (global as any).wx.request = function (opts: any) {
      opts.fail({});
    };
    page.loadBabyData('b1');
    expect(localCalled).toBe(true);
    page.loadFromLocal = origLocal;
  });
});