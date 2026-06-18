/**
 * 宝宝列表页 (Baby List) 运行时测试
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

describe('宝宝列表页 (Baby List) - 运行时逻辑', function () {
  var page: any;

  beforeAll(function () {
    mockStorage = {};
    mockPageConfig = null;

    // Write mock module files so Node's require resolves them
    // The page JS uses: require('../../config/api') from miniprogram/pages/baby_list/
    // which resolves to: <project>/miniprogram/config/api
    var projectRoot = path.resolve(__dirname, '..');

    require(path.resolve(projectRoot, 'miniprogram/pages/baby_list/baby_list.js'));
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
    (global as any).wx.navigateTo = function () {};
    (global as any).wx.navigateBack = function () {};
    (global as any).wx.reLaunch = function () {};
  });

  test('Page 应正常创建', function () {
    expect(page).toBeDefined();
  });

  test('data 初始值应包含必需字段', function () {
    expect(page.data).toBeDefined();
    expect(page.data.safeTop).toBe(44);
    expect(page.data.isLoading).toBe(false);
    expect(Array.isArray(page.data.babies)).toBe(true);
    expect(page.data.babies.length).toBe(0);
    expect(page.data.currentBabyId).toBe('');
  });

  test('loadCurrentBabyId 应读取本地存储', function () {
    mockStorage['baby_diary_current_baby_id'] = 'baby-123';
    page.loadCurrentBabyId();
    expect(page.data.currentBabyId).toBe('baby-123');
  });

  test('loadCurrentBabyId 缓存为空时应返回空字符串', function () {
    page.loadCurrentBabyId();
    expect(page.data.currentBabyId).toBe('');
  });

  test('getMockBabies 应返回 2 个宝宝', function () {
    var babies = page.getMockBabies ? page.getMockBabies() : [];
    expect(Array.isArray(babies)).toBe(true);
    expect(babies.length).toBe(2);
    expect(babies[0].name).toBe('小星星');
    expect(babies[1].name).toBe('小月亮');
  });

  test('getMockBabies 应包含性别和年龄文本', function () {
    var babies = page.getMockBabies ? page.getMockBabies() : [];
    expect(babies[0].gender).toBe('female');
    expect(babies[0].ageText).toContain('个月');
  });

  test('fallbackBabies 应从本地缓存读取', function () {
    mockStorage['album_babies'] = [
      { id: 'b1', name: 'Test Baby', gender: 'male' }
    ];
    page.fallbackBabies();
    expect(page.data.isLoading).toBe(false);
    expect(page.data.babies.length).toBe(1);
    expect(page.data.babies[0].name).toBe('Test Baby');
  });

  test('fallbackBabies 缓存为空时应使用 mock 数据', function () {
    page.fallbackBabies();
    expect(page.data.isLoading).toBe(false);
    expect(page.data.babies.length).toBe(2);
  });

  test('onBabyTap 应存储当前宝宝 ID 并导航', function () {
    var navUrl = '';
    (global as any).wx.navigateTo = function (opts: any) { navUrl = opts.url; };
    var event = { currentTarget: { dataset: { id: 'baby-456' } } };
    page.onBabyTap(event);
    expect(mockStorage['baby_diary_current_baby_id']).toBe('baby-456');
    expect(navUrl).toContain('baby-456');
    expect(navUrl).toContain('baby_profile');
  });

  test('onAddBaby 应跳转到 onboarding 页', function () {
    var navUrl = '';
    (global as any).wx.navigateTo = function (opts: any) { navUrl = opts.url; };
    page.onAddBaby();
    expect(navUrl).toContain('baby_onboarding');
  });

  test('onBabyLongPress 应弹出确认对话框', function () {
    var modalOptions: any = null;
    (global as any).wx.showModal = function (opts: any) { modalOptions = opts; };
    var event = { currentTarget: { dataset: { id: 'b1', name: '小星星' } } };
    page.onBabyLongPress(event);
    expect(modalOptions).not.toBeNull();
    expect(modalOptions.title).toBe('删除宝宝');
    expect(modalOptions.content).toContain('小星星');
    expect(modalOptions.confirmColor).toBe('#e64340');
  });

  test('onBack 应返回上一页', function () {
    var called = false;
    (global as any).wx.navigateBack = function () { called = true; };
    page.onBack();
    expect(called).toBe(true);
  });

  test('deleteBaby 应请求删除 API', function () {
    var requestUrls: string[] = [];
    var requestMethods: string[] = [];
    (global as any).wx.request = function (opts: any) {
      requestUrls.push(opts.url);
      requestMethods.push(opts.method || 'GET');
      opts.success({ statusCode: 200 });
    };
    // Prevent success handler's loadBabies from making another request
    var origLoad = page.loadBabies;
    page.loadBabies = function () {};
    page.deleteBaby('b1');
    expect(requestUrls[0]).toContain('/babies/b1');
    expect(requestMethods[0]).toBe('DELETE');
    page.loadBabies = origLoad;
  });

  test('deleteBaby 失败应提示', function () {
    var toastTitle = '';
    (global as any).wx.showToast = function (opts: any) { toastTitle = opts.title; };
    (global as any).wx.hideLoading = function () {};
    (global as any).wx.request = function (opts: any) {
      opts.success({ statusCode: 400 });
    };
    page.deleteBaby('b1');
    expect(toastTitle).toBe('删除失败');
  });

  test('deleteBaby 网络错误应提示', function () {
    var toastTitle = '';
    (global as any).wx.showToast = function (opts: any) { toastTitle = opts.title; };
    (global as any).wx.hideLoading = function () {};
    (global as any).wx.request = function (opts: any) {
      opts.fail({});
    };
    page.deleteBaby('b1');
    expect(toastTitle).toBe('网络错误');
  });

  test('onLoad 应初始化 safeTop 和数据', function () {
    page.data.babies = [];
    page.onLoad();
    expect(page.data.safeTop).toBe(44);
  });

  test('onShow 应重新加载宝宝列表', function () {
    var loaded = false;
    var origLoad = page.loadBabies;
    page.loadBabies = function () { loaded = true; };
    page.onShow();
    expect(loaded).toBe(true);
    page.loadBabies = origLoad;
  });

  test('loadBabies 应设置 loading 状态', function () {
    page.data.isLoading = false;
    page.loadBabies();
    expect(page.data.isLoading).toBe(true);
  });

  test('onBabyLongPress confirm 应调用 deleteBaby', function () {
    var deletedId = '';
    var origDelete = page.deleteBaby;
    page.deleteBaby = function (id: string) { deletedId = id; };
    (global as any).wx.showModal = function (opts: any) {
      opts.success({ confirm: true });
    };
    var event = { currentTarget: { dataset: { id: 'b1', name: '小星星' } } };
    page.onBabyLongPress(event);
    expect(deletedId).toBe('b1');
    page.deleteBaby = origDelete;
  });

  test('onBabyLongPress cancel 不应调用 deleteBaby', function () {
    var deletedId = '';
    var origDelete = page.deleteBaby;
    page.deleteBaby = function (id: string) { deletedId = id; };
    (global as any).wx.showModal = function (opts: any) {
      opts.success({ confirm: false });
    };
    var event = { currentTarget: { dataset: { id: 'b1', name: '小星星' } } };
    page.onBabyLongPress(event);
    expect(deletedId).toBe('');
    page.deleteBaby = origDelete;
  });

  test('deleteBaby 应显示 loading', function () {
    var loadingShown = false;
    (global as any).wx.showLoading = function (opts: any) { loadingShown = true; };
    (global as any).wx.request = function () {};
    page.deleteBaby('b1');
    expect(loadingShown).toBe(true);
  });

  test('deleteBaby 成功应隐藏 loading', function () {
    var loadingHidden = false;
    (global as any).wx.hideLoading = function () { loadingHidden = true; };
    (global as any).wx.request = function (opts: any) {
      opts.success({ statusCode: 200 });
    };
    page.deleteBaby('b1');
    expect(loadingHidden).toBe(true);
  });

  test('loadBabies API 成功应设置 babies', function () {
    var requestCallback: any = null;
    (global as any).wx.request = function (opts: any) { requestCallback = opts; };
    page.loadBabies();
    requestCallback.success({ statusCode: 200, data: [{ id: 'b1', name: 'API Baby' }] });
    expect(page.data.isLoading).toBe(false);
    expect(page.data.babies.length).toBe(1);
    expect(page.data.babies[0].name).toBe('API Baby');
  });

  test('loadBabies API 非 200 应走 fallback', function () {
    var fellBack = false;
    var origFallback = page.fallbackBabies;
    page.fallbackBabies = function () { fellBack = true; };
    (global as any).wx.request = function (opts: any) {
      opts.success({ statusCode: 500 });
    };
    page.loadBabies();
    expect(fellBack).toBe(true);
    page.fallbackBabies = origFallback;
  });

  test('loadBabies API 网络错误应走 fallback', function () {
    var fellBack = false;
    var origFallback = page.fallbackBabies;
    page.fallbackBabies = function () { fellBack = true; };
    (global as any).wx.request = function (opts: any) {
      opts.fail({});
    };
    page.loadBabies();
    expect(fellBack).toBe(true);
    page.fallbackBabies = origFallback;
  });

  test('fallbackBabies 非数组缓存应使用 mock', function () {
    mockStorage['album_babies'] = 'not-array';
    page.fallbackBabies();
    expect(page.data.babies.length).toBe(2);
  });

  test('getStorageSync 异常时应不抛出', function () {
    (global as any).wx.getStorageSync = function () { throw new Error('fail'); };
    expect(function () { page.loadCurrentBabyId(); }).not.toThrow();
  });

  test('onLoad statusBarHeight 为 0 时应使用默认值 44', function () {
    (global as any).wx.getWindowInfo = function () { return { statusBarHeight: 0, pixelRatio: 2 }; };
    page.data.safeTop = 0;
    page.onLoad();
    expect(page.data.safeTop).toBe(44);
  });

  test('onBabyLongPress dataset 无 name 时应使用空字符串', function () {
    var modalOptions: any = null;
    (global as any).wx.showModal = function (opts: any) { modalOptions = opts; };
    var event = { currentTarget: { dataset: { id: 'b1' } } }; // no name
    page.onBabyLongPress(event);
    expect(modalOptions).not.toBeNull();
    expect(modalOptions.content).toContain('「」');
  });
});