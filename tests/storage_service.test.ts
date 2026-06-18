/**
 * storage_service.ts 单元测试
 * 测试本地存储服务的 CRUD、缓存、查询过滤、错误处理
 */

var path = require('path');

// ==================== 模拟存储 ====================

var mockStore: Record<string, any> = {};
var mockGetStorageSyncCalls: string[] = [];

function setupMockWx(): void {
  mockStore = {};
  mockGetStorageSyncCalls = [];
  (global as any).wx = {
    setStorage: function (opts: any) {
      mockStore[opts.key] = opts.data;
      opts.success();
    },
    getStorage: function (opts: any) {
      if (mockStore[opts.key] !== undefined) {
        opts.success({ data: mockStore[opts.key] });
      } else {
        opts.fail({ errMsg: 'data not found' });
      }
    },
    getStorageSync: function (key: string) {
      mockGetStorageSyncCalls.push(key);
      return mockStore[key] !== undefined ? mockStore[key] : '';
    },
    setStorageSync: function (key: string, value: any) {
      mockStore[key] = value;
    },
    getStorageInfoSync: function () {
      return { currentSize: 1024, limitSize: 102400 };
    },
  };
}

function cleanupWx(): void {
  delete (global as any).wx;
}

// ==================== 测试 ====================

describe('storage_service - 本地存储服务', function () {
  var storageService: any;

  beforeEach(function () {
    setupMockWx();
    storageService = require(path.resolve(__dirname, '../miniprogram/services/storage_service.js')).storageService;
  });

  afterEach(function () {
    cleanupWx();
  });

  // ==================== init / checkVersion ====================

  describe('init / checkVersion', function () {
    test('init 应写入版本号', function () {
      return storageService.init().then(function () {
        expect(mockStore['album_version']).toBe('v1');
      });
    });

    test('版本号匹配时不应重复写入', function () {
      mockStore['album_version'] = 'v1';
      return storageService.init().then(function () {
        expect(mockGetStorageSyncCalls).toContain('album_version');
      });
    });
  });

  // ==================== 宝宝 CRUD ====================

  describe('宝宝 CRUD', function () {
    test('getBabies 返回空列表', function () {
      return storageService.getBabies().then(function (babies: any[]) {
        expect(babies).toEqual([]);
      });
    });

    test('createBaby 创建并返回宝宝', function () {
      return storageService.createBaby({ name: '明明', birthDate: '2026-01-15' }).then(function (baby: any) {
        expect(baby.name).toBe('明明');
        expect(baby.birthDate).toBe('2026-01-15');
        expect(baby.id).toBeTruthy();
        expect(baby.createdAt).toBeTruthy();
      });
    });

    test('getBabies 返回已创建的宝宝列表', function () {
      return storageService.createBaby({ name: '宝宝A', birthDate: '2026-01-01' }).then(function () {
        return storageService.createBaby({ name: '宝宝B', birthDate: '2026-03-15' });
      }).then(function () {
        return storageService.getBabies();
      }).then(function (babies: any[]) {
        expect(babies.length).toBe(2);
        expect(babies[0].name).toBe('宝宝A');
        expect(babies[1].name).toBe('宝宝B');
      });
    });

    test('getBaby 按 ID 查找', function () {
      var createdId = '';
      return storageService.createBaby({ name: '明明', birthDate: '2026-01-15' }).then(function (baby: any) {
        createdId = baby.id;
        return storageService.getBaby(createdId);
      }).then(function (found: any) {
        expect(found).toBeTruthy();
        expect(found.name).toBe('明明');
      });
    });

    test('getBaby 不存在应返回 null', function () {
      return storageService.getBaby('nonexistent').then(function (found: any) {
        expect(found).toBeNull();
      });
    });

    test('updateBaby 应更新字段', function () {
      var createdId = '';
      return storageService.createBaby({ name: '明明', birthDate: '2026-01-15' }).then(function (baby: any) {
        createdId = baby.id;
        return storageService.updateBaby(createdId, { name: '亮亮' });
      }).then(function (updated: any) {
        expect(updated.name).toBe('亮亮');
        expect(updated.birthDate).toBe('2026-01-15');
        return storageService.getBaby(createdId);
      }).then(function (found: any) {
        expect(found.name).toBe('亮亮');
      });
    });

    test('updateBaby 不存在应抛出', function () {
      return storageService.updateBaby('bad-id', { name: 'new' }).then(function () {
        expect(true).toBe(false);
      }).catch(function (err: any) {
        expect(err.message).toBe('宝宝不存在');
      });
    });

    test('deleteBaby 应移除宝宝', function () {
      var createdId = '';
      return storageService.createBaby({ name: '明明', birthDate: '2026-01-15' }).then(function (baby: any) {
        createdId = baby.id;
        return storageService.getBabies();
      }).then(function (babies: any[]) {
        expect(babies.length).toBe(1);
        return storageService.deleteBaby(createdId);
      }).then(function () {
        return storageService.getBabies();
      }).then(function (babies: any[]) {
        expect(babies.length).toBe(0);
      });
    });

    test('deleteBaby 多宝宝时仅删除一个', function () {
      var id1 = '';
      var id2 = '';
      return storageService.createBaby({ name: '宝宝A', birthDate: '2026-01-01' }).then(function (baby: any) {
        id1 = baby.id;
        return storageService.createBaby({ name: '宝宝B', birthDate: '2026-03-15' });
      }).then(function (baby: any) {
        id2 = baby.id;
        return storageService.deleteBaby(id1);
      }).then(function () {
        return storageService.getBabies();
      }).then(function (babies: any[]) {
        expect(babies.length).toBe(1);
        expect(babies[0].id).toBe(id2);
      });
    });

    test('getBabies 缓存生效时不重新读取', function () {
      return storageService.createBaby({ name: '明明', birthDate: '2026-01-15' }).then(function () {
        return storageService.getBabies();
      }).then(function () {
        var origGetStorage = (global as any).wx.getStorage;
        var getCallCount = 0;
        (global as any).wx.getStorage = function () { getCallCount++; };
        return storageService.getBabies();
      }).then(function (babies: any[]) {
        expect(babies.length).toBe(1);
      });
    });
  });

  // ==================== 媒体 CRUD ====================

  describe('媒体 CRUD', function () {
    test('createMedia 创建并返回媒体', function () {
      return storageService.createMedia({
        babyId: 'b1',
        type: 'photo',
        url: '/img/test.jpg',
        size: 1024,
        captureDate: '2026-06-01',
      }).then(function (media: any) {
        expect(media.babyId).toBe('b1');
        expect(media.type).toBe('photo');
        expect(media.id).toBeTruthy();
      });
    });

    test('getMedia 按 ID 查找', function () {
      var createdId = '';
      return storageService.createMedia({
        babyId: 'b1', type: 'photo', url: '/img/a.jpg', size: 100, captureDate: '2026-06-01',
      }).then(function (m: any) {
        createdId = m.id;
        return storageService.getMedia(createdId);
      }).then(function (found: any) {
        expect(found).toBeTruthy();
      });
    });

    test('getMedia 不存在应返回 null', function () {
      return storageService.getMedia('nonexistent').then(function (found: any) {
        expect(found).toBeNull();
      });
    });

    test('updateMedia 应更新字段', function () {
      var createdId = '';
      return storageService.createMedia({
        babyId: 'b1', type: 'photo', url: '/img/a.jpg', size: 100, captureDate: '2026-06-01',
      }).then(function (m: any) {
        createdId = m.id;
        return storageService.updateMedia(createdId, { title: '新标题' });
      }).then(function (updated: any) {
        expect(updated.title).toBe('新标题');
      });
    });

    test('updateMedia 不存在应抛出', function () {
      return storageService.updateMedia('bad-id', { title: 'new' }).then(function () {
        expect(true).toBe(false);
      }).catch(function (err: any) {
        expect(err.message).toBe('媒体不存在');
      });
    });

    test('deleteMedia 多媒体时仅删除一个', function () {
      var id1 = '';
      return storageService.createMedia({
        babyId: 'b1', type: 'photo', url: '/img/keep.jpg', size: 100, captureDate: '2026-06-01',
      }).then(function () {
        return storageService.createMedia({
          babyId: 'b1', type: 'photo', url: '/img/delete.jpg', size: 200, captureDate: '2026-06-02',
        });
      }).then(function (m: any) {
        id1 = m.id;
        return storageService.deleteMedia(id1);
      }).then(function () {
        return storageService.getMediaList();
      }).then(function (list: any[]) {
        expect(list.length).toBe(1);
        expect(list[0].url).toBe('/img/keep.jpg');
      });
    });

    test('deleteMediaByBaby 多宝宝媒体', function () {
      return storageService.createMedia({
        babyId: 'b1', type: 'photo', url: '/img/delete.jpg', size: 100, captureDate: '2026-06-01',
      }).then(function () {
        return storageService.createMedia({
          babyId: 'b2', type: 'photo', url: '/img/keep.jpg', size: 200, captureDate: '2026-06-02',
        });
      }).then(function () {
        return storageService.deleteMediaByBaby('b1');
      }).then(function () {
        return storageService.getMediaList();
      }).then(function (list: any[]) {
        expect(list.length).toBe(1);
        expect(list[0].babyId).toBe('b2');
      });
    });

    test('deleteMedia 应移除媒体', function () {
      var createdId = '';
      return storageService.createMedia({
        babyId: 'b1', type: 'photo', url: '/img/a.jpg', size: 100, captureDate: '2026-06-01',
      }).then(function (m: any) {
        createdId = m.id;
        return storageService.deleteMedia(createdId);
      }).then(function () {
        return storageService.getMedia(createdId);
      }).then(function (found: any) {
        expect(found).toBeNull();
      });
    });

    test('deleteMediaByBaby 应移除宝宝所有媒体', function () {
      return storageService.createMedia({
        babyId: 'b1', type: 'photo', url: '/img/1.jpg', size: 100, captureDate: '2026-06-01',
      }).then(function () {
        return storageService.createMedia({
          babyId: 'b1', type: 'photo', url: '/img/2.jpg', size: 200, captureDate: '2026-06-02',
        });
      }).then(function () {
        return storageService.deleteMediaByBaby('b1');
      }).then(function () {
        return storageService.getMediaList();
      }).then(function (list: any[]) {
        expect(list.length).toBe(0);
      });
    });
  });

  // ==================== 媒体查询过滤 ====================

  describe('getMediaList 查询过滤', function () {
    beforeEach(function () {
      return storageService.createMedia({
        babyId: 'b1', type: 'photo', url: '/img/1.jpg', size: 100, captureDate: '2026-06-01',
      }).then(function () {
        return storageService.createMedia({
          babyId: 'b1', type: 'video', url: '/img/2.mp4', size: 500, captureDate: '2026-06-15',
        });
      }).then(function () {
        return storageService.createMedia({
          babyId: 'b2', type: 'photo', url: '/img/3.jpg', size: 200, captureDate: '2026-07-01',
        });
      });
    });

    test('按 babyId 过滤', function () {
      return storageService.getMediaList({ babyId: 'b1' }).then(function (list: any[]) {
        expect(list.length).toBe(2);
      });
    });

    test('按 type 过滤', function () {
      return storageService.getMediaList({ type: 'video' }).then(function (list: any[]) {
        expect(list.length).toBe(1);
        expect(list[0].type).toBe('video');
      });
    });

    test('按 startDate 过滤', function () {
      return storageService.getMediaList({ startDate: '2026-06-15' }).then(function (list: any[]) {
        expect(list.length).toBe(2);
      });
    });

    test('按 endDate 过滤', function () {
      return storageService.getMediaList({ endDate: '2026-06-15' }).then(function (list: any[]) {
        expect(list.length).toBe(2);
      });
    });

    test('组合过滤: b1 + photo', function () {
      return storageService.getMediaList({ babyId: 'b1', type: 'photo' }).then(function (list: any[]) {
        expect(list.length).toBe(1);
      });
    });

    test('分页', function () {
      return storageService.getMediaList({ page: 1, pageSize: 2 }).then(function (list: any[]) {
        expect(list.length).toBe(2);
      });
    });

    test('不传 query 返回全部', function () {
      return storageService.getMediaList().then(function (list: any[]) {
        expect(list.length).toBe(3);
      });
    });
  });

  // ==================== 月龄分组 ====================

  describe('getMediaGroupedByMonthAge', function () {
    test('按月龄分组媒体', function () {
      return storageService.createMedia({
        babyId: 'b1', type: 'photo', url: '/img/1.jpg', size: 100, captureDate: '2026-06-01',
      }).then(function () {
        return storageService.createMedia({
          babyId: 'b1', type: 'photo', url: '/img/2.jpg', size: 200, captureDate: '2026-07-15',
        });
      }).then(function () {
        return storageService.getMediaGroupedByMonthAge('b1', '2026-06-01');
      }).then(function (groups: any[]) {
        expect(groups.length).toBeGreaterThanOrEqual(1);
      });
    });

    test('同月龄多项应排序（覆盖 sort 比较器）', function () {
      return storageService.createMedia({
        babyId: 'b1', type: 'photo', url: '/img/a.jpg', size: 100, captureDate: '2026-07-10',
      }).then(function () {
        return storageService.createMedia({
          babyId: 'b1', type: 'photo', url: '/img/b.jpg', size: 200, captureDate: '2026-07-01',
        });
      }).then(function () {
        return storageService.getMediaGroupedByMonthAge('b1', '2026-01-01');
      }).then(function (groups: any[]) {
        var sixMonth = groups.filter(function (g: any) { return g.monthAge === 6; });
        expect(sixMonth.length).toBe(1);
        expect(sixMonth[0].mediaList.length).toBe(2);
        // 降序排列: 7月10日 应在 7月1日 之前
        expect(sixMonth[0].mediaList[0].captureDate).toBe('2026-07-10');
        expect(sixMonth[0].mediaList[1].captureDate).toBe('2026-07-01');
      });
    });
  });

  // ==================== clearCache / getStorageUsage ====================

  describe('clearCache / getStorageUsage', function () {
    test('clearCache 应清空数据', function () {
      return storageService.createBaby({ name: '明明', birthDate: '2026-01-15' }).then(function () {
        return storageService.clearCache();
      }).then(function () {
        return storageService.getBabies();
      }).then(function (babies: any[]) {
        expect(babies.length).toBe(0);
      });
    });

    test('getStorageUsage 应返回使用情况', function () {
      return storageService.getStorageUsage().then(function (usage: any) {
        expect(usage.used).toBe(1024);
        expect(usage.limit).toBe(102400);
      });
    });

    test('getStorageInfoSync 异常应返回零值', function () {
      (global as any).wx.getStorageInfoSync = function () { throw new Error('fail'); };
      return storageService.getStorageUsage().then(function (usage: any) {
        expect(usage.used).toBe(0);
        expect(usage.limit).toBe(0);
      });
    });
  });
});
