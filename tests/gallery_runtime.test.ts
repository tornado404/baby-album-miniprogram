/**
 * gallery_runtime.test.ts - 素材库页运行时测试
 *
 * 覆盖：
 * - 页面创建与初始 data
 * - onLoad / onShow
 * - loadMedia（API 成功/失败→降级/网络错误→降级）
 * - loadFallback（有存储/无存储→默认数据）
 * - onFilterTap
 * - onMediaTap（普通、选择模式）
 * - onLongPress → 进入选择模式
 * - toggleSelect（添加/移除）
 * - onSelectAll（全选/取消全选）
 * - onBatchArchive（无选中→提示；成功→toast）
 * - onBatchTag
 * - onBatchDelete（确认/取消）
 * - onCancelSelect / exitSelectMode
 */

var mockStorage: Record<string, any> = {};
var mockPageConfig: Record<string, any> = {};
var mockRequests: Array<{ url: string; method: string; data?: any; header?: any }> = [];
var mockShowToastCalls: Array<{ title: string; icon?: string }> = [];
var mockShowModalCalls: Array<{ title: string; content?: string }> = [];
var mockNavigateToUrl = '';

function clearMockStorage(): void {
  for (var key in mockStorage) {
    if (mockStorage.hasOwnProperty(key)) {
      delete mockStorage[key];
    }
  }
}

var mockRequestHandler: ((opts: any) => void) | null = null;
var mockModalHandler: ((opts: any) => void) | null = null;
var galleryInstance: any = null;
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
      mockRequests.push({ url: opts.url, method: opts.method, data: opts.data, header: opts.header });
      if (typeof mockRequestHandler === 'function') { mockRequestHandler(opts); }
      else { opts.success({ statusCode: 200, data: [] }); }
    },
    showToast: function (opts: any) { mockShowToastCalls.push({ title: opts.title, icon: opts.icon }); },
    showModal: function (opts: any) {
      mockShowModalCalls.push({ title: opts.title, content: opts.content });
      if (typeof mockModalHandler === 'function') { mockModalHandler(opts); }
      else { opts.success({ confirm: false }); }
    },
    navigateTo: function (opts: any) { mockNavigateToUrl = opts.url; },
    navigateBack: function () {},
    showLoading: function () {},
    hideLoading: function () {},
  };
}

describe('素材库页运行时测试', function () {
  beforeAll(function () {
    setupWxMock();
    mockStorage['baby_diary_access_token'] = 'test-token';
    mockStorage['baby_diary_current_baby_id'] = 'baby-001';

    require('../miniprogram/pages/gallery/gallery');
    galleryInstance = mockPageConfig;
    initialDataSnapshot = JSON.parse(JSON.stringify(galleryInstance.data));
  });

  beforeEach(function () {
    clearMockStorage();
    mockStorage['baby_diary_access_token'] = 'test-token';
    mockStorage['baby_diary_current_baby_id'] = 'baby-001';

    mockRequests = [];
    mockShowToastCalls = [];
    mockShowModalCalls = [];
    mockNavigateToUrl = '';
    mockRequestHandler = null;
    mockModalHandler = null;

    // 恢复默认 wx 函数
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
    (global as any).wx.navigateTo = function (opts: any) { mockNavigateToUrl = opts.url; };

    // 重置 data
    if (initialDataSnapshot) {
      var keys = Object.keys(galleryInstance.data);
      for (var i = 0; i < keys.length; i++) { delete galleryInstance.data[keys[i]]; }
      Object.assign(galleryInstance.data, JSON.parse(JSON.stringify(initialDataSnapshot)));
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
      navigateTo: function () {},
      navigateBack: function () {},
      showLoading: function () {},
      hideLoading: function () {},
    };
  });

  describe('页面创建', function () {
    test('应包含初始 data', function () {
      expect(galleryInstance.data.safeTop).toBe(44);
      expect(galleryInstance.data.isLoading).toBe(false);
      expect(Array.isArray(galleryInstance.data.mediaList)).toBe(true);
      expect(galleryInstance.data.page).toBe(1);
      expect(galleryInstance.data.hasMore).toBe(true);
      expect(galleryInstance.data.filterIndex).toBe(0);
      expect(galleryInstance.data.filters.length).toBe(3);
      expect(galleryInstance.data.selectMode).toBe(false);
    });

    test('应有所有方法', function () {
      expect(typeof galleryInstance.onLoad).toBe('function');
      expect(typeof galleryInstance.onShow).toBe('function');
      expect(typeof galleryInstance.loadMedia).toBe('function');
      expect(typeof galleryInstance.loadFallback).toBe('function');
      expect(typeof galleryInstance.onFilterTap).toBe('function');
      expect(typeof galleryInstance.onMediaTap).toBe('function');
      expect(typeof galleryInstance.onLongPress).toBe('function');
      expect(typeof galleryInstance.toggleSelect).toBe('function');
      expect(typeof galleryInstance.onSelectAll).toBe('function');
      expect(typeof galleryInstance.onBatchArchive).toBe('function');
      expect(typeof galleryInstance.onBatchTag).toBe('function');
      expect(typeof galleryInstance.onBatchDelete).toBe('function');
      expect(typeof galleryInstance.onCancelSelect).toBe('function');
      expect(typeof galleryInstance.exitSelectMode).toBe('function');
    });
  });

  describe('onLoad / onShow', function () {
    test('onLoad 应加载媒体', function () {
      mockRequestHandler = function (opts: any) {
        opts.success({ statusCode: 200, data: [{ id: 'm1', title: 'test' }] });
      };
      galleryInstance.onLoad();
      expect(mockRequests.length).toBeGreaterThan(0);
      expect(galleryInstance.data.mediaList.length).toBe(1);
    });

    test('statusBarHeight 为 0 时应使用默认值 44', function () {
      (global as any).wx.getWindowInfo = function () { return { statusBarHeight: 0 }; };
      galleryInstance.onLoad();
      expect(galleryInstance.data.safeTop).toBe(44);
      (global as any).wx.getWindowInfo = function () { return { statusBarHeight: 44 }; };
    });

    test('onShow 应加载媒体', function () {
      mockRequestHandler = function (opts: any) {
        opts.success({ statusCode: 200, data: [{ id: 'm2' }] });
      };
      galleryInstance.onShow();
      expect(mockRequests.length).toBeGreaterThan(0);
    });
  });

  describe('loadMedia', function () {
    test('无 babyId 应调用 loadFallback', function () {
      mockStorage['baby_diary_current_baby_id'] = '';
      delete mockStorage['album_media'];
      galleryInstance.loadMedia();
      // 无存储时走默认降级数据
      expect(galleryInstance.data.mediaList.length).toBeGreaterThan(0);
      expect(galleryInstance.data.isLoading).toBe(false);
    });

    test('API 成功应设置 mediaList', function () {
      mockRequestHandler = function (opts: any) {
        opts.success({ statusCode: 200, data: [{ id: 'm1', title: '北京公园' }, { id: 'm2', title: '第一次翻身' }] });
      };
      galleryInstance.loadMedia();
      expect(galleryInstance.data.mediaList.length).toBe(2);
      expect(galleryInstance.data.isLoading).toBe(false);
    });

    test('非 200 应调用 loadFallback', function () {
      mockRequestHandler = function (opts: any) { opts.success({ statusCode: 500, data: {} }); };
      galleryInstance.loadMedia();
      expect(galleryInstance.data.mediaList.length).toBeGreaterThan(0);
      expect(galleryInstance.data.isLoading).toBe(false);
    });

    test('网络错误应调用 loadFallback', function () {
      mockRequestHandler = function (opts: any) { if (opts.fail) opts.fail({ errMsg: 'timeout' }); };
      galleryInstance.loadMedia();
      expect(galleryInstance.data.mediaList.length).toBeGreaterThan(0);
      expect(galleryInstance.data.isLoading).toBe(false);
    });

    test('filterIndex=1 应传 archived=false', function () {
      galleryInstance.data.filterIndex = 1;
      mockRequestHandler = function (opts: any) {
        expect(opts.data.archived).toBe('false');
        opts.success({ statusCode: 200, data: [] });
      };
      galleryInstance.loadMedia();
    });

    test('filterIndex=2 应传 archived=true', function () {
      galleryInstance.data.filterIndex = 2;
      mockRequestHandler = function (opts: any) {
        expect(opts.data.archived).toBe('true');
        opts.success({ statusCode: 200, data: [] });
      };
      galleryInstance.loadMedia();
    });
  });

  describe('loadFallback', function () {
    test('有本地存储应使用存储数据', function () {
      mockStorage['album_media'] = [{ id: 'local1', title: '本地照片' }];
      galleryInstance.loadFallback();
      expect(galleryInstance.data.mediaList.length).toBe(1);
      expect(galleryInstance.data.mediaList[0].id).toBe('local1');
    });

    test('无存储应使用默认数据', function () {
      delete mockStorage['album_media'];
      galleryInstance.loadFallback();
      expect(galleryInstance.data.mediaList.length).toBeGreaterThan(0);
      expect(galleryInstance.data.mediaList[0].title).toBe('北京公园');
    });
  });

  describe('onFilterTap', function () {
    test('应切换筛选并重新加载', function () {
      mockRequestHandler = function (opts: any) {
        opts.success({ statusCode: 200, data: [] });
      };
      galleryInstance.onFilterTap({ currentTarget: { dataset: { index: 1 } } });
      expect(galleryInstance.data.filterIndex).toBe(1);
      expect(galleryInstance.data.mediaList).toEqual([]);
      expect(galleryInstance.data.page).toBe(1);
    });
  });

  describe('onMediaTap', function () {
    test('普通模式应跳转到 media_detail', function () {
      galleryInstance.data.selectMode = false;
      galleryInstance.onMediaTap({ currentTarget: { dataset: { id: 'm1' } } });
      expect(mockNavigateToUrl).toContain('/pages/media_detail/media_detail?id=m1');
    });

    test('选择模式应调用 toggleSelect', function () {
      galleryInstance.data.selectMode = true;
      galleryInstance.data.mediaList = [{ id: 'm1' }, { id: 'm2' }];
      galleryInstance.onMediaTap({ currentTarget: { dataset: { id: 'm2' } } });
      expect(galleryInstance.data.selectedIds).toContain('m2');
    });
  });

  describe('onLongPress', function () {
    test('应进入选择模式并选中该图片', function () {
      galleryInstance.onLongPress({ currentTarget: { dataset: { id: 'm3' } } });
      expect(galleryInstance.data.selectMode).toBe(true);
      expect(galleryInstance.data.selectedIds).toEqual(['m3']);
    });
  });

  describe('toggleSelect', function () {
    test('未选中应添加', function () {
      galleryInstance.toggleSelect({ currentTarget: { dataset: { id: 'm1' } } });
      expect(galleryInstance.data.selectedIds).toContain('m1');
    });

    test('已选中应移除', function () {
      galleryInstance.data.selectedIds = ['m1', 'm2'];
      galleryInstance.toggleSelect({ currentTarget: { dataset: { id: 'm1' } } });
      expect(galleryInstance.data.selectedIds).not.toContain('m1');
      expect(galleryInstance.data.selectedIds).toContain('m2');
    });
  });

  describe('onSelectAll', function () {
    test('allSelected=false 应全选', function () {
      galleryInstance.data.mediaList = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
      galleryInstance.data.allSelected = false;
      galleryInstance.onSelectAll();
      expect(galleryInstance.data.selectedIds.length).toBe(3);
      expect(galleryInstance.data.allSelected).toBe(true);
    });

    test('allSelected=true 应取消全选', function () {
      galleryInstance.data.mediaList = [{ id: 'a' }, { id: 'b' }];
      galleryInstance.data.allSelected = true;
      galleryInstance.onSelectAll();
      expect(galleryInstance.data.selectedIds.length).toBe(0);
      expect(galleryInstance.data.allSelected).toBe(false);
    });
  });

  describe('onBatchArchive', function () {
    test('无选中项应提示', function () {
      galleryInstance.data.selectedIds = [];
      galleryInstance.onBatchArchive();
      expect(mockShowToastCalls[0].title).toBe('请先选择照片');
    });

    test('成功应显示 toast 并退出选择模式', function () {
      galleryInstance.data.selectedIds = ['m1'];
      mockRequestHandler = function (opts: any) {
        opts.success({ statusCode: 200, data: {} });
      };
      galleryInstance.onBatchArchive();
      expect(mockShowToastCalls[0].title).toBe('已归档 1 项');
      expect(galleryInstance.data.selectMode).toBe(false);
    });

    test('失败应显示归档失败', function () {
      galleryInstance.data.selectedIds = ['m1'];
      mockRequestHandler = function (opts: any) {
        if (opts.fail) opts.fail({ errMsg: 'timeout' });
      };
      galleryInstance.onBatchArchive();
      expect(mockShowToastCalls[0].title).toBe('归档失败');
    });
  });

  describe('onBatchTag', function () {
    test('应提示功能开发中', function () {
      galleryInstance.onBatchTag();
      expect(mockShowToastCalls[0].title).toBe('批量标签-功能开发中');
    });
  });

  describe('onBatchDelete', function () {
    test('确认删除应调用 API', function () {
      galleryInstance.data.selectedIds = ['m1', 'm2'];
      var deleteCount = 0;
      mockModalHandler = function (opts: any) { opts.success({ confirm: true }); };
      mockRequestHandler = function (opts: any) {
        if (opts.method === 'DELETE') {
          deleteCount++;
          opts.success({ statusCode: 200, data: {} });
        } else {
          opts.success({ statusCode: 200, data: [] });
        }
      };
      galleryInstance.onBatchDelete();
      expect(deleteCount).toBe(2);
    });

    test('取消不应删除', function () {
      galleryInstance.data.selectedIds = ['m1'];
      mockModalHandler = function (opts: any) { opts.success({ confirm: false }); };
      galleryInstance.onBatchDelete();
      expect(mockRequests.length).toBe(0);
    });

    test('API 失败应计数并完成', function () {
      galleryInstance.data.selectedIds = ['m1', 'm2'];
      mockModalHandler = function (opts: any) { opts.success({ confirm: true }); };
      var deleteCount = 0;
      mockRequestHandler = function (opts: any) {
        if (opts.method === 'DELETE') {
          deleteCount++;
          if (opts.fail) opts.fail({ errMsg: 'delete fail' });
        }
      };
      galleryInstance.onBatchDelete();
      expect(deleteCount).toBe(2);
    });
  });

  describe('取消选择', function () {
    test('onCancelSelect 应退出选择模式', function () {
      galleryInstance.data.selectMode = true;
      galleryInstance.data.selectedIds = ['m1'];
      galleryInstance.onCancelSelect();
      expect(galleryInstance.data.selectMode).toBe(false);
      expect(galleryInstance.data.selectedIds).toEqual([]);
    });

    test('exitSelectMode 应重置选择状态', function () {
      galleryInstance.data.selectMode = true;
      galleryInstance.data.selectedIds = ['m1', 'm2'];
      galleryInstance.data.allSelected = true;
      galleryInstance.exitSelectMode();
      expect(galleryInstance.data.selectMode).toBe(false);
      expect(galleryInstance.data.selectedIds).toEqual([]);
      expect(galleryInstance.data.allSelected).toBe(false);
    });
  });
});

export {};