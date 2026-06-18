/**
 * album_home_runtime.test.ts - 首页运行时测试
 *
 * 覆盖：
 * - 页面创建与初始 data
 * - onLoad（safeTop / babyId / loadBabies）
 * - onShow（babyId 变更→reload；不变→loadData）
 * - fetchGroups（API 成功→normalize → group；失败→useMockData）
 * - useMockData
 * - normalizeMedia（日期格式、字段映射）
 * - groupByMilestone（分组、瀑布流左右列分配）
 * - getItemHeight（video/其他）
 * - extractGroupDate / extractGroupAge
 * - loadBabies（API 成功→有/无宝宝；失败→fallbackBabies）
 * - fallbackBabies（有存储/无存储）
 * - getCardColor
 * - onFilterSelect
 * - onMediaTap
 * - handleDelete（确认→doDelete）
 * - doDelete（成功/失败→toast）
 * - goToRecord / goToProfile
 */

var mockStorage: Record<string, any> = {};
var mockPageConfig: Record<string, any> = {};
var mockRequests: Array<{ url: string; method: string; data?: any }> = [];
var mockShowToastCalls: Array<{ title: string; icon?: string }> = [];
var mockShowModalCalls: Array<{ title: string; content?: string }> = [];
var mockNavigateToUrl = '';
var mockRedirectToUrl = '';

function clearMockStorage(): void {
  for (var key in mockStorage) {
    if (mockStorage.hasOwnProperty(key)) { delete mockStorage[key]; }
  }
}

var mockRequestHandler: ((opts: any) => void) | null = null;
var mockModalHandler: ((opts: any) => void) | null = null;
var mockActionSheetHandler: ((opts: any) => void) | null = null;
var homeInstance: any = null;
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
    request: function (opts: any) {
      mockRequests.push({ url: opts.url, method: opts.method, data: opts.data });
      if (typeof mockRequestHandler === 'function') { mockRequestHandler(opts); }
      else { opts.success({ statusCode: 200, data: [] }); }
    },
    showToast: function (opts: any) { mockShowToastCalls.push({ title: opts.title, icon: opts.icon }); },
    showModal: function (opts: any) {
      mockShowModalCalls.push({ title: opts.title, content: opts.content });
      if (typeof mockModalHandler === 'function') { mockModalHandler(opts); }
      else { opts.success({ confirm: false }); }
    },
    showActionSheet: function (opts: any) {
      if (typeof mockActionSheetHandler === 'function') { mockActionSheetHandler(opts); }
    },
    navigateTo: function (opts: any) { mockNavigateToUrl = opts.url; },
    redirectTo: function (opts: any) { mockRedirectToUrl = opts.url; },
    showLoading: function () {},
    hideLoading: function () {},
  };
}

describe('首页运行时测试', function () {
  beforeAll(function () {
    setupWxMock();
    mockStorage['baby_diary_access_token'] = 'test-token';
    mockStorage['baby_diary_current_baby_id'] = 'baby-001';
    mockStorage['album_babies'] = [{ id: 'baby-001', name: '小星星' }];

    require('../miniprogram/pages/album_home/album_home.js');
    homeInstance = mockPageConfig;
    initialDataSnapshot = JSON.parse(JSON.stringify(homeInstance.data));
  });

  beforeEach(function () {
    clearMockStorage();
    mockStorage['baby_diary_access_token'] = 'test-token';
    mockStorage['baby_diary_current_baby_id'] = 'baby-001';
    mockStorage['album_babies'] = [{ id: 'baby-001', name: '小星星' }];

    mockRequests = [];
    mockShowToastCalls = [];
    mockShowModalCalls = [];
    mockNavigateToUrl = '';
    mockRedirectToUrl = '';
    mockRequestHandler = null;
    mockModalHandler = null;
    mockActionSheetHandler = null;

    (global as any).wx.getStorageSync = function (key: string) {
      return mockStorage[key] !== undefined ? mockStorage[key] : '';
    };
    (global as any).wx.setStorageSync = function (key: string, value: any) { mockStorage[key] = value; };
    (global as any).wx.removeStorageSync = function (key: string) { delete mockStorage[key]; };
    (global as any).wx.showToast = function (opts: any) { mockShowToastCalls.push({ title: opts.title, icon: opts.icon }); };
    (global as any).wx.showModal = function (opts: any) {
      mockShowModalCalls.push({ title: opts.title, content: opts.content });
      if (typeof mockModalHandler === 'function') { mockModalHandler(opts); }
      else { opts.success({ confirm: false }); }
    };
    (global as any).wx.showActionSheet = function (opts: any) {
      if (typeof mockActionSheetHandler === 'function') { mockActionSheetHandler(opts); }
    };
    (global as any).wx.navigateTo = function (opts: any) { mockNavigateToUrl = opts.url; };
    (global as any).wx.redirectTo = function (opts: any) { mockRedirectToUrl = opts.url; };

    if (initialDataSnapshot) {
      var keys = Object.keys(homeInstance.data);
      for (var i = 0; i < keys.length; i++) { delete homeInstance.data[keys[i]]; }
      Object.assign(homeInstance.data, JSON.parse(JSON.stringify(initialDataSnapshot)));
    }
  });

  afterAll(function () {
    delete (global as any).Page;
    (global as any).wx = {
      getStorageSync: function () { return ''; },
      setStorageSync: function () {},
      removeStorageSync: function () {},
      getWindowInfo: function () { return { statusBarHeight: 44 }; },
      getSystemInfoSync: function () { return { language: 'zh_CN' }; },
      request: function () {},
      showToast: function () {},
      showModal: function () {},
      showActionSheet: function () {},
      navigateTo: function () {},
      redirectTo: function () {},
      showLoading: function () {},
      hideLoading: function () {},
    };
  });

  describe('页面创建', function () {
    test('应包含初始 data', function () {
      expect(homeInstance.data.safeTop).toBe(44);
      expect(homeInstance.data.isAuthorMode).toBe(true);
      expect(homeInstance.data.currentFilter).toBe('全部');
      expect(homeInstance.data.filterOptions.length).toBe(6);
      expect(homeInstance.data.isEmpty).toBe(false);
      expect(homeInstance.data.isLoading).toBe(false);
    });

    test('应有所有方法', function () {
      expect(typeof homeInstance.onLoad).toBe('function');
      expect(typeof homeInstance.onShow).toBe('function');
      expect(typeof homeInstance.loadData).toBe('function');
      expect(typeof homeInstance.fetchGroups).toBe('function');
      expect(typeof homeInstance.useMockData).toBe('function');
      expect(typeof homeInstance.normalizeMedia).toBe('function');
      expect(typeof homeInstance.groupByMilestone).toBe('function');
      expect(typeof homeInstance.loadBabies).toBe('function');
      expect(typeof homeInstance.fallbackBabies).toBe('function');
      expect(typeof homeInstance.onFilterSelect).toBe('function');
      expect(typeof homeInstance.onMediaTap).toBe('function');
      expect(typeof homeInstance.handleDelete).toBe('function');
      expect(typeof homeInstance.doDelete).toBe('function');
      expect(typeof homeInstance.goToRecord).toBe('function');
      expect(typeof homeInstance.goToProfile).toBe('function');
    });
  });

  describe('normalizeMedia', function () {
    test('应正确转换日期和字段', function () {
      var m = homeInstance.normalizeMedia({ id: 'm1', captureDate: '2026-05-20' });
      expect(m.displayDate).toBe('05.20');
      expect(m.id).toBe('m1');
      expect(m.mediaType).toBe('image');
      expect(m.cardColor).toBeTruthy();
    });

    test('无 captureDate 应返回空 displayDate', function () {
      var m = homeInstance.normalizeMedia({ id: 'm2' });
      expect(m.displayDate).toBe('');
    });
  });

  describe('groupByMilestone', function () {
    test('应按里程碑分组并分配瀑布流列', function () {
      var items = [
        { id: 'm1', milestone: '第一次翻身 🎉', milestoneIcon: '⭐', captureDate: '2026-05-20', monthAge: 5, mediaType: 'image', title: 'a' },
        { id: 'm2', milestone: '第一次翻身 🎉', milestoneIcon: '⭐', captureDate: '2026-05-19', monthAge: 5, mediaType: 'image', title: 'b' },
        { id: 'm3', milestone: '开始学坐', milestoneIcon: '🧸', captureDate: '2026-04-15', monthAge: 4, mediaType: 'video', title: 'c' },
      ];
      var sections = homeInstance.groupByMilestone(items);
      expect(sections.length).toBe(2);
      expect(sections[0].title).toBe('第一次翻身 🎉');
      expect(sections[1].title).toBe('开始学坐');
      // 瀑布流分配
      expect(sections[0].leftItems.length + sections[0].rightItems.length).toBe(2);
    });

    test('空列表应返回空数组', function () {
      expect(homeInstance.groupByMilestone([])).toEqual([]);
    });
  });

  describe('getItemHeight', function () {
    test('video 应为 240', function () {
      expect(homeInstance.getItemHeight({ id: 'v1', mediaType: 'video' })).toBe(240);
    });

    test('图片应从预定义高度中选一个', function () {
      var h = homeInstance.getItemHeight({ id: 'm1', mediaType: 'image' });
      expect([200, 220, 180, 250, 210, 190]).toContain(h);
    });
  });

  describe('extractGroupDate', function () {
    test('应格式化日期', function () {
      expect(homeInstance.extractGroupDate('2026-05-20')).toBe('2026.05.20');
    });

    test('空值应返回空', function () {
      expect(homeInstance.extractGroupDate('')).toBe('');
    });

    test('无效日期应返回空', function () {
      expect(homeInstance.extractGroupDate('not-a-date')).toBe('');
    });
  });

  describe('extractGroupAge', function () {
    test('monthAge 为 30 的倍数应只返回月数', function () {
      expect(homeInstance.extractGroupAge(30)).toBe('30个月');
    });

    test('monthAge 有余数应包含天数', function () {
      expect(homeInstance.extractGroupAge(5)).toBe('5个月5天');
    });

    test('null 应返回空', function () {
      expect(homeInstance.extractGroupAge(null)).toBe('');
    });
  });

  describe('getCardColor', function () {
    test('相同 id 应返回一致颜色', function () {
      var c1 = homeInstance.getCardColor('m1');
      var c2 = homeInstance.getCardColor('m1');
      expect(c1).toBe(c2);
    });
  });

  describe('fetchGroups', function () {
    test('无 token 应 useMockData', function () {
      mockStorage['baby_diary_access_token'] = '';
      homeInstance.fetchGroups('baby-001');
      expect(homeInstance.data.sections.length).toBeGreaterThan(0);
    });

    test('API 成功应分组', function () {
      mockRequestHandler = function (opts: any) {
        opts.success({
          statusCode: 200,
          data: [
            { id: 'm1', captureDate: '2026-05-20', milestone: '翻身', monthAge: 5 },
            { id: 'm2', captureDate: '2026-04-15', milestone: '学坐', monthAge: 4 },
          ],
        });
      };
      homeInstance.fetchGroups('baby-001');
      expect(homeInstance.data.sections.length).toBe(2);
      expect(homeInstance.data.isLoading).toBe(false);
    });

    test('非 200 应 useMockData', function () {
      mockRequestHandler = function (opts: any) { opts.success({ statusCode: 500, data: {} }); };
      homeInstance.fetchGroups('baby-001');
      expect(homeInstance.data.sections.length).toBeGreaterThan(0);
    });

    test('网络错误应 useMockData', function () {
      mockRequestHandler = function (opts: any) { if (opts.fail) opts.fail({ errMsg: 'timeout' }); };
      homeInstance.fetchGroups('baby-001');
      expect(homeInstance.data.sections.length).toBeGreaterThan(0);
    });
  });

  describe('loadBabies', function () {
    test('API 成功且 currentBabyId 匹配应加载数据', function () {
      homeInstance.data.currentBabyId = 'baby-001';
      mockRequestHandler = function (opts: any) {
        opts.success({ statusCode: 200, data: [{ id: 'baby-001', name: '小星星' }] });
      };
      homeInstance.loadBabies();
      expect(homeInstance.data.babies.length).toBe(1);
      // currentBabyId 匹配时不会覆盖 currentBaby，但 loadData 会被调用
    });

    test('API 成功有宝宝应加载数据', function () {
      mockRequestHandler = function (opts: any) {
        opts.success({ statusCode: 200, data: [{ id: 'baby-001', name: '小星星' }] });
      };
      homeInstance.loadBabies();
      expect(homeInstance.data.babies.length).toBe(1);
    });

    test('API 返回空列表应 useMockData（加载 mock 数据）', function () {
      mockRequestHandler = function (opts: any) {
        opts.success({ statusCode: 200, data: [] });
      };
      homeInstance.loadBabies();
      expect(homeInstance.data.sections.length).toBeGreaterThan(0);
    });

    test('API 失败应 fallbackBabies', function () {
      mockRequestHandler = function (opts: any) { if (opts.fail) opts.fail({ errMsg: 'timeout' }); };
      homeInstance.loadBabies();
      expect(homeInstance.data.babies.length).toBeGreaterThan(0);
    });

    test('API 非 200 应 fallbackBabies', function () {
      mockRequestHandler = function (opts: any) { opts.success({ statusCode: 500, data: {} }); };
      homeInstance.loadBabies();
      expect(homeInstance.data.babies.length).toBeGreaterThan(0);
    });
  });

  describe('fallbackBabies', function () {
    test('有本地存储应使用缓存', function () {
      mockStorage['album_babies'] = [{ id: 'baby-001', name: '小星星' }];
      homeInstance.fallbackBabies();
      expect(homeInstance.data.babies.length).toBe(1);
    });

    test('缓存中 currentBabyId 匹配应保持选择', function () {
      homeInstance.data.currentBabyId = 'baby-001';
      mockStorage['album_babies'] = [
        { id: 'baby-001', name: '小星星' },
        { id: 'baby-002', name: '月亮' },
      ];
      homeInstance.fallbackBabies();
      expect(homeInstance.data.babies.length).toBe(2);
      // currentBabyId 匹配时不会覆盖
    });

    test('缓存中 currentBabyId 不匹配应设置第一个宝宝', function () {
      homeInstance.data.currentBabyId = 'baby-999';
      mockStorage['album_babies'] = [
        { id: 'baby-001', name: '小星星' },
        { id: 'baby-002', name: '月亮' },
      ];
      homeInstance.fallbackBabies();
      expect(homeInstance.data.currentBaby).not.toBeNull();
      expect(homeInstance.data.currentBaby.name).toBe('小星星');
    });

    test('无存储应 useMockData', function () {
      delete mockStorage['album_babies'];
      homeInstance.fallbackBabies();
      expect(homeInstance.data.sections.length).toBeGreaterThan(0);
    });
  });

  describe('onFilterSelect', function () {
    test('应切换筛选值', function () {
      homeInstance.onFilterSelect({ currentTarget: { dataset: { value: '0-1' } } });
      expect(homeInstance.data.currentFilter).toBe('0-1');
    });

    test('null 值应回退为全部', function () {
      homeInstance.onFilterSelect({ currentTarget: { dataset: { value: null } } });
      expect(homeInstance.data.currentFilter).toBe('全部');
    });
  });

  describe('onMediaTap', function () {
    test('应跳转到 media_detail', function () {
      homeInstance.onMediaTap({ currentTarget: { dataset: { id: 'm1' } } });
      expect(mockNavigateToUrl).toContain('/pages/media_detail/media_detail?id=m1');
    });
  });

  describe('handleDelete / doDelete', function () {
    test('无 token 应提示登录', function () {
      mockStorage['baby_diary_access_token'] = '';
      homeInstance.handleDelete('m1');
      expect(mockShowToastCalls[0].title).toBe('请先登录');
    });

    test('确认应调用 doDelete', function () {
      mockModalHandler = function (opts: any) { opts.success({ confirm: true }); };
      mockRequestHandler = function (opts: any) {
        opts.success({ statusCode: 200, data: {} });
      };
      homeInstance.handleDelete('m1');
      expect(mockShowToastCalls[0].title).toBe('删除成功');
    });

    test('取消不删除', function () {
      mockModalHandler = function (opts: any) { opts.success({ confirm: false }); };
      homeInstance.handleDelete('m1');
      expect(mockShowToastCalls.length).toBe(0);
    });
  });

  describe('导航', function () {
    test('goToRecord 应跳转到上传页', function () {
      homeInstance.goToRecord();
      expect(mockRedirectToUrl).toBe('/pages/upload/upload');
    });

    test('goToProfile 应跳转到设置页', function () {
      homeInstance.goToProfile();
      expect(mockRedirectToUrl).toBe('/pages/settings/settings');
    });
  });

  describe('doDelete', function () {
    test('API 成功应从 sections 移除', function () {
      mockRequestHandler = function (opts: any) {
        expect(opts.method).toBe('DELETE');
        opts.success({ statusCode: 204, data: {} });
      };
      homeInstance.data.sections = [
        { title: '翻身', icon: '⭐', leftItems: [{ id: 'm1' }], rightItems: [{ id: 'm2' }], items: [{ id: 'm1' }, { id: 'm2' }] },
      ];
      homeInstance.doDelete('m1', 'token');
      expect(homeInstance.data.sections[0].leftItems.length).toBe(0);
      expect(homeInstance.data.sections[0].rightItems.length).toBe(1);
    });

    test('API 失败应显示 toast', function () {
      mockRequestHandler = function (opts: any) {
        opts.success({ statusCode: 500, data: {} });
      };
      homeInstance.doDelete('m1', 'token');
      expect(mockShowToastCalls[0].title).toBe('删除失败');
    });

    test('网络错误应显示 toast', function () {
      mockRequestHandler = function (opts: any) {
        if (opts.fail) opts.fail({ errMsg: 'timeout' });
      };
      homeInstance.doDelete('m1', 'token');
      expect(mockShowToastCalls[0].title).toBe('删除失败');
    });
  });

  describe('removeMediaFromSections', function () {
    beforeEach(function () {
      homeInstance.data.sections = [
        {
          title: '翻身',
          icon: '⭐',
          dateLabel: '2026.05.20',
          ageLabel: '5个月',
          items: [{ id: 'm1', _col: 'left', _height: 200 }, { id: 'm2', _col: 'right', _height: 220 }],
          leftItems: [{ id: 'm1', _col: 'left', _height: 200 }],
          rightItems: [{ id: 'm2', _col: 'right', _height: 220 }],
        },
      ];
    });

    test('移除后应更新 sections', function () {
      homeInstance.removeMediaFromSections('m1');
      expect(homeInstance.data.sections[0].leftItems.length).toBe(0);
      expect(homeInstance.data.sections[0].rightItems.length).toBe(1);
    });

    test('全部移除后 section 应消失', function () {
      homeInstance.removeMediaFromSections('m1');
      homeInstance.removeMediaFromSections('m2');
      expect(homeInstance.data.sections.length).toBe(0);
      expect(homeInstance.data.isEmpty).toBe(true);
    });

    test('移除左列非首项应保持顺序', function () {
      homeInstance.data.sections = [
        {
          title: '翻身',
          icon: '⭐',
          dateLabel: '2026.05.20',
          ageLabel: '5个月',
          items: [{ id: 'm1' }, { id: 'm2' }, { id: 'm3' }],
          leftItems: [{ id: 'm1', _col: 'left' }, { id: 'm3', _col: 'left' }],
          rightItems: [{ id: 'm2', _col: 'right' }],
        },
      ];
      homeInstance.removeMediaFromSections('m1');
      expect(homeInstance.data.sections[0].leftItems.length).toBe(1);
      expect(homeInstance.data.sections[0].leftItems[0].id).toBe('m3');
    });
  });

  describe('onMenuTap', function () {
    test('删除操作应调用 handleDelete', function () {
      var handleDeleteCalled = false;
      var origHandleDelete = homeInstance.handleDelete;
      homeInstance.handleDelete = function () { handleDeleteCalled = true; };
      mockActionSheetHandler = function (opts: any) { opts.success({ tapIndex: 1 }); };
      homeInstance.onMenuTap({ currentTarget: { dataset: { id: 'm1' } } });
      expect(handleDeleteCalled).toBe(true);
      homeInstance.handleDelete = origHandleDelete;
    });

    test('分享操作无 babyId 应提示', function () {
      homeInstance.data.currentBabyId = '';
      mockActionSheetHandler = function (opts: any) {
        opts.success({ tapIndex: 2 });
      };
      homeInstance.onMenuTap({ currentTarget: { dataset: { id: 'm1' } } });
      expect(mockShowToastCalls[0].title).toBe('请先选择宝宝');
    });

    test('分享操作有 babyId 无 token 应提示', function () {
      mockStorage['baby_diary_access_token'] = '';
      homeInstance.data.currentBaby = { id: 'baby-001', name: '小星星' };
      homeInstance.data.currentBabyId = 'baby-001';
      mockActionSheetHandler = function (opts: any) {
        opts.success({ tapIndex: 2 });
      };
      homeInstance.onMenuTap({ currentTarget: { dataset: { id: 'm1' } } });
      // 应先弹出 modal（邀请），modal 中的成功回调检查 token 并提示
      expect(mockShowModalCalls.length).toBeGreaterThan(0);
    });
  });

  describe('loadData', function () {
    test('无 babyId 应返回', function () {
      homeInstance.loadData('');
      expect(homeInstance.data.isLoading).toBe(false);
    });
  });

  describe('onLoad', function () {
    test('getWindowInfo 异常应使用默认 safeTop', function () {
      (global as any).wx.getWindowInfo = function () { throw new Error('fail'); };
      homeInstance.onLoad();
      expect(homeInstance.data.safeTop).toBe(44);
    });

    test('onLoad 成功应设置 safeTop', function () {
      (global as any).wx.getWindowInfo = function () { return { statusBarHeight: 56 }; };
      homeInstance.onLoad();
      expect(homeInstance.data.safeTop).toBe(56);
    });

    test('statusBarHeight 为 0 时应使用默认值 44', function () {
      (global as any).wx.getWindowInfo = function () { return { statusBarHeight: 0 }; };
      homeInstance.onLoad();
      expect(homeInstance.data.safeTop).toBe(44);
      (global as any).wx.getWindowInfo = function () { return { statusBarHeight: 44 }; };
    });
  });

  describe('onShow', function () {
    test('babyId 变更应重新 loadBabies', function () {
      var loadBabiesCalled = false;
      var origLoadBabies = homeInstance.loadBabies;
      homeInstance.loadBabies = function () { loadBabiesCalled = true; };
      mockStorage['baby_diary_current_baby_id'] = 'baby-002';
      homeInstance.data.currentBabyId = 'baby-001';
      homeInstance.onShow();
      expect(loadBabiesCalled).toBe(true);
      homeInstance.loadBabies = origLoadBabies;
    });

    test('babyId 相同应 loadData', function () {
      var loadDataCalled = '';
      var origLoadData = homeInstance.loadData;
      homeInstance.loadData = function (id: any) { loadDataCalled = id; };
      homeInstance.data.currentBabyId = 'baby-001';
      homeInstance.onShow();
      expect(loadDataCalled).toBe('baby-001');
      homeInstance.loadData = origLoadData;
    });

    test('babyId 空不操作', function () {
      mockStorage['baby_diary_current_baby_id'] = '';
      homeInstance.onShow();
      expect(homeInstance.data.isLoading).toBe(false);
    });
  });

  describe('formatDate', function () {
    test('空值应返回空字符串', function () {
      expect(homeInstance.formatDate('')).toBe('');
    });

    test('有效日期应格式化为 MM.DD', function () {
      expect(homeInstance.formatDate('2026-05-20')).toBe('05.20');
    });

    test('非标准格式应返回原文', function () {
      expect(homeInstance.formatDate('test')).toBe('test');
    });
  });

  describe('onMenuTap share invitation', function () {
    test('无 token 应提示请先登录', function () {
      mockStorage['baby_diary_access_token'] = '';
      homeInstance.data.currentBaby = { id: 'baby-001', name: '小星星' };
      homeInstance.data.currentBabyId = 'baby-001';
      homeInstance.data.babies = [{ id: 'baby-001', name: '小星星' }];
      mockModalHandler = function (opts: any) { opts.success({ confirm: true }); };
      mockActionSheetHandler = function (opts: any) { opts.success({ tapIndex: 2 }); };
      homeInstance.onMenuTap({ currentTarget: { dataset: { id: 'm1' } } });
      expect(mockShowToastCalls[0].title).toBe('请先登录');
    });

    test('API 成功应邀请', function () {
      mockStorage['baby_diary_access_token'] = 'test-token';
      homeInstance.data.currentBaby = { id: 'baby-001', name: '小星星' };
      homeInstance.data.currentBabyId = 'baby-001';
      homeInstance.data.babies = [{ id: 'baby-001', name: '小星星' }];
      mockModalHandler = function (opts: any) { opts.success({ confirm: true }); };
      mockRequestHandler = function (opts: any) {
        opts.success({ statusCode: 201, data: {} });
      };
      mockActionSheetHandler = function (opts: any) { opts.success({ tapIndex: 2 }); };
      homeInstance.onMenuTap({ currentTarget: { dataset: { id: 'm1' } } });
      expect(mockShowToastCalls[0].title).toBe('邀请已发送');
    });

    test('API 返回失败应显示错误', function () {
      mockStorage['baby_diary_access_token'] = 'test-token';
      homeInstance.data.currentBaby = { id: 'baby-001', name: '小星星' };
      homeInstance.data.currentBabyId = 'baby-001';
      homeInstance.data.babies = [{ id: 'baby-001', name: '小星星' }];
      mockModalHandler = function (opts: any) { opts.success({ confirm: true }); };
      mockRequestHandler = function (opts: any) {
        opts.success({ statusCode: 400, data: { detail: 'bad request' } });
      };
      mockActionSheetHandler = function (opts: any) { opts.success({ tapIndex: 2 }); };
      homeInstance.onMenuTap({ currentTarget: { dataset: { id: 'm1' } } });
      expect(mockShowToastCalls[0].title).toBe('发送失败: bad request');
    });

    test('API 网络错误应显示错误', function () {
      mockStorage['baby_diary_access_token'] = 'test-token';
      homeInstance.data.currentBaby = { id: 'baby-001', name: '小星星' };
      homeInstance.data.currentBabyId = 'baby-001';
      homeInstance.data.babies = [{ id: 'baby-001', name: '小星星' }];
      mockModalHandler = function (opts: any) { opts.success({ confirm: true }); };
      mockRequestHandler = function (opts: any) {
        if (opts.url.indexOf('/share') >= 0 && opts.fail) { opts.fail({ errMsg: 'network error' }); }
        else { opts.success({ statusCode: 200, data: [] }); }
      };
      mockActionSheetHandler = function (opts: any) { opts.success({ tapIndex: 2 }); };
      homeInstance.onMenuTap({ currentTarget: { dataset: { id: 'm1' } } });
      expect(mockShowToastCalls[0].title).toBe('发送失败: network error');
    });
  });
});

export {};