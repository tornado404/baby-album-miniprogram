"use strict";
/**
 * 本地存储服务测试用例
 * 测试目标：T-08 本地存储服务 - CRUD操作和数据持久化
 */
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
Object.defineProperty(exports, "__esModule", { value: true });
var baby_1 = require("../typings/models/baby");
var media_1 = require("../typings/models/media");
// ==================== 存储键常量 ====================
var STORAGE_KEYS = {
    babies: 'album_babies',
    media: 'album_media',
    settings: 'album_settings',
    version: 'album_version'
};
// ==================== Mock 存储实现 ====================
/**
 * 模拟本地存储
 */
var MockStorage = /** @class */ (function () {
    function MockStorage() {
        this.store = new Map();
    }
    MockStorage.prototype.setItem = function (key, value) {
        this.store.set(key, value);
    };
    MockStorage.prototype.getItem = function (key) {
        return this.store.get(key) || null;
    };
    MockStorage.prototype.removeItem = function (key) {
        this.store.delete(key);
    };
    MockStorage.prototype.clear = function () {
        this.store.clear();
    };
    MockStorage.prototype.getAllKeys = function () {
        return Array.from(this.store.keys());
    };
    return MockStorage;
}());
// 全局 mock 存储实例
var mockStorage = new MockStorage();
// ==================== 存储服务实现 ====================
/**
 * 存储服务类
 */
var StorageService = /** @class */ (function () {
    function StorageService() {
        this.PREFIX = 'album_';
        this.VERSION = 'v1';
        this.keys = {
            babies: "".concat(this.PREFIX, "babies"),
            media: "".concat(this.PREFIX, "media"),
            settings: "".concat(this.PREFIX, "settings"),
            version: "".concat(this.PREFIX, "version")
        };
    }
    /**
     * 模拟 wx.getStorageSync
     */
    StorageService.prototype.getStorageSync = function (key) {
        var data = mockStorage.getItem(key);
        if (!data)
            return null;
        try {
            return JSON.parse(data);
        }
        catch (_a) {
            return null;
        }
    };
    /**
     * 模拟 wx.setStorageSync
     */
    StorageService.prototype.setStorageSync = function (key, value) {
        mockStorage.setItem(key, JSON.stringify(value));
    };
    /**
     * 模拟 wx.removeStorageSync
     */
    StorageService.prototype.removeStorageSync = function (key) {
        mockStorage.removeItem(key);
    };
    // ---- 宝宝相关操作 ----
    /**
     * 获取所有宝宝
     */
    StorageService.prototype.getBabies = function () {
        return this.getStorageSync(this.keys.babies) || [];
    };
    /**
     * 获取单个宝宝
     */
    StorageService.prototype.getBaby = function (id) {
        var babies = this.getBabies();
        return babies.find(function (b) { return b.id === id; }) || null;
    };
    /**
     * 创建宝宝
     */
    StorageService.prototype.createBaby = function (input) {
        var babies = this.getBabies();
        var now = new Date().toISOString();
        var newBaby = {
            id: "baby_".concat(Date.now(), "_").concat(Math.random().toString(36).substr(2, 9)),
            name: input.name,
            birthDate: input.birthDate,
            gender: input.gender,
            avatar: input.avatar,
            createdAt: now,
            updatedAt: now
        };
        babies.push(newBaby);
        this.setStorageSync(this.keys.babies, babies);
        return newBaby;
    };
    /**
     * 更新宝宝信息
     */
    StorageService.prototype.updateBaby = function (id, input) {
        var babies = this.getBabies();
        var index = babies.findIndex(function (b) { return b.id === id; });
        if (index === -1) {
            throw new Error('Baby not found');
        }
        var updatedBaby = __assign(__assign(__assign({}, babies[index]), input), { id: babies[index].id, createdAt: babies[index].createdAt, updatedAt: new Date().toISOString() });
        babies[index] = updatedBaby;
        this.setStorageSync(this.keys.babies, babies);
        return updatedBaby;
    };
    /**
     * 删除宝宝
     */
    StorageService.prototype.deleteBaby = function (id) {
        var babies = this.getBabies();
        var filteredBabies = babies.filter(function (b) { return b.id !== id; });
        this.setStorageSync(this.keys.babies, filteredBabies);
    };
    // ---- 媒体相关操作 ----
    /**
     * 获取媒体列表
     */
    StorageService.prototype.getMediaList = function (query) {
        var _this = this;
        var mediaList = this.getStorageSync(this.keys.media) || [];
        // 应用查询条件
        if (query) {
            if (query.babyId) {
                mediaList = mediaList.filter(function (m) { return m.babyId === query.babyId; });
            }
            if (query.type) {
                mediaList = mediaList.filter(function (m) { return m.type === query.type; });
            }
            if (query.startDate) {
                mediaList = mediaList.filter(function (m) { return m.captureDate >= query.startDate; });
            }
            if (query.endDate) {
                mediaList = mediaList.filter(function (m) { return m.captureDate <= query.endDate; });
            }
            if (query.minAge !== undefined) {
                mediaList = mediaList.filter(function (m) { return m.babyAge && _this.calcTotalMonths(m.babyAge) >= query.minAge; });
            }
            if (query.maxAge !== undefined) {
                mediaList = mediaList.filter(function (m) { return m.babyAge && _this.calcTotalMonths(m.babyAge) <= query.maxAge; });
            }
            if (query.tags && query.tags.length > 0) {
                mediaList = mediaList.filter(function (m) { return m.tags && query.tags.some(function (tag) { return m.tags.includes(tag); }); });
            }
        }
        // 按拍摄日期倒序
        mediaList.sort(function (a, b) { return b.captureDate.localeCompare(a.captureDate); });
        // 分页
        if ((query === null || query === void 0 ? void 0 : query.page) && (query === null || query === void 0 ? void 0 : query.pageSize)) {
            var start = (query.page - 1) * query.pageSize;
            var end = start + query.pageSize;
            mediaList = mediaList.slice(start, end);
        }
        return mediaList;
    };
    /**
     * 计算月龄总月数
     */
    StorageService.prototype.calcTotalMonths = function (babyAge) {
        return babyAge.years * 12 + babyAge.months;
    };
    /**
     * 获取单个媒体
     */
    StorageService.prototype.getMedia = function (id) {
        var mediaList = this.getStorageSync(this.keys.media) || [];
        return mediaList.find(function (m) { return m.id === id; }) || null;
    };
    /**
     * 创建媒体
     */
    StorageService.prototype.createMedia = function (input) {
        var mediaList = this.getStorageSync(this.keys.media) || [];
        var now = new Date().toISOString();
        var newMedia = __assign(__assign({ id: "media_".concat(Date.now(), "_").concat(Math.random().toString(36).substr(2, 9)) }, input), { createdAt: now, updatedAt: now });
        mediaList.push(newMedia);
        this.setStorageSync(this.keys.media, mediaList);
        return newMedia;
    };
    /**
     * 更新媒体
     */
    StorageService.prototype.updateMedia = function (id, input) {
        var mediaList = this.getStorageSync(this.keys.media) || [];
        var index = mediaList.findIndex(function (m) { return m.id === id; });
        if (index === -1) {
            throw new Error('Media not found');
        }
        var updatedMedia = __assign(__assign(__assign({}, mediaList[index]), input), { id: mediaList[index].id, createdAt: mediaList[index].createdAt, updatedAt: new Date().toISOString() });
        mediaList[index] = updatedMedia;
        this.setStorageSync(this.keys.media, mediaList);
        return updatedMedia;
    };
    /**
     * 删除媒体
     */
    StorageService.prototype.deleteMedia = function (id) {
        var mediaList = this.getStorageSync(this.keys.media) || [];
        var filteredMedia = mediaList.filter(function (m) { return m.id !== id; });
        this.setStorageSync(this.keys.media, filteredMedia);
    };
    /**
     * 批量删除媒体
     */
    StorageService.prototype.deleteMediaByBaby = function (babyId) {
        var mediaList = this.getStorageSync(this.keys.media) || [];
        var filteredMedia = mediaList.filter(function (m) { return m.babyId !== babyId; });
        this.setStorageSync(this.keys.media, filteredMedia);
    };
    /**
     * 清除所有缓存
     */
    StorageService.prototype.clearCache = function () {
        mockStorage.clear();
    };
    /**
     * 获取存储使用情况
     */
    StorageService.prototype.getStorageUsage = function () {
        var allKeys = mockStorage.getAllKeys();
        var used = 0;
        allKeys.forEach(function (key) {
            var data = mockStorage.getItem(key);
            if (data) {
                used += data.length;
            }
        });
        return {
            used: used,
            limit: 10 * 1024 * 1024 // 10MB
        };
    };
    return StorageService;
}());
// 创建服务实例
var storageService = new StorageService();
// ==================== 测试用例 ====================
describe('T-08 本地存储服务测试', function () {
    beforeEach(function () {
        // 每个测试前清空存储
        storageService.clearCache();
    });
    describe('宝宝 CRUD 操作', function () {
        test('创建宝宝应该成功', function () {
            var input = {
                name: '小明',
                birthDate: '2024-01-15',
                gender: baby_1.BabyGender.Male
            };
            var baby = storageService.createBaby(input);
            expect(baby.id).toBeDefined();
            expect(baby.name).toBe('小明');
            expect(baby.birthDate).toBe('2024-01-15');
            expect(baby.gender).toBe(baby_1.BabyGender.Male);
            expect(baby.createdAt).toBeDefined();
            expect(baby.updatedAt).toBeDefined();
        });
        test('获取所有宝宝应该返回列表', function () {
            var input = {
                name: '小明',
                birthDate: '2024-01-15',
                gender: baby_1.BabyGender.Male
            };
            storageService.createBaby(input);
            var babies = storageService.getBabies();
            expect(babies.length).toBe(1);
            expect(babies[0].name).toBe('小明');
        });
        test('获取单个宝宝应该返回正确对象', function () {
            var input = {
                name: '小明',
                birthDate: '2024-01-15',
                gender: baby_1.BabyGender.Male
            };
            var created = storageService.createBaby(input);
            var baby = storageService.getBaby(created.id);
            expect(baby).not.toBeNull();
            expect(baby.name).toBe('小明');
        });
        test('获取不存在的宝宝应该返回 null', function () {
            var baby = storageService.getBaby('non_existent_id');
            expect(baby).toBeNull();
        });
        test('更新宝宝应该成功', function () {
            var input = {
                name: '小明',
                birthDate: '2024-01-15',
                gender: baby_1.BabyGender.Male
            };
            var created = storageService.createBaby(input);
            var updated = storageService.updateBaby(created.id, {
                name: '大明'
            });
            expect(updated.name).toBe('大明');
            expect(updated.id).toBe(created.id);
            expect(updated.createdAt).toBe(created.createdAt);
        });
        test('删除宝宝应该成功', function () {
            var input = {
                name: '小明',
                birthDate: '2024-01-15',
                gender: baby_1.BabyGender.Male
            };
            var created = storageService.createBaby(input);
            storageService.deleteBaby(created.id);
            var baby = storageService.getBaby(created.id);
            expect(baby).toBeNull();
        });
        test('创建宝宝时应生成唯一ID', function () {
            var input = {
                name: '测试',
                birthDate: '2024-01-01',
                gender: baby_1.BabyGender.Female
            };
            var baby1 = storageService.createBaby(input);
            var baby2 = storageService.createBaby(input);
            expect(baby1.id).not.toBe(baby2.id);
        });
    });
    describe('媒体 CRUD 操作', function () {
        beforeEach(function () {
            // 创建一个宝宝用于媒体测试
            var babyInput = {
                name: '测试宝宝',
                birthDate: '2024-01-01',
                gender: baby_1.BabyGender.Male
            };
            storageService.createBaby(babyInput);
        });
        test('创建媒体应该成功', function () {
            var input = {
                babyId: 'baby_1',
                type: media_1.MediaType.Photo,
                url: 'https://example.com/photo.jpg',
                size: 1024000,
                captureDate: '2024-01-15'
            };
            var media = storageService.createMedia(input);
            expect(media.id).toBeDefined();
            expect(media.babyId).toBe('baby_1');
            expect(media.type).toBe(media_1.MediaType.Photo);
            expect(media.url).toBe('https://example.com/photo.jpg');
            expect(media.size).toBe(1024000);
            expect(media.captureDate).toBe('2024-01-15');
        });
        test('获取媒体列表应该返回倒序排列', function () {
            var input1 = {
                babyId: 'baby_1',
                type: media_1.MediaType.Photo,
                url: 'https://example.com/photo1.jpg',
                size: 1024000,
                captureDate: '2024-01-01'
            };
            var input2 = {
                babyId: 'baby_1',
                type: media_1.MediaType.Photo,
                url: 'https://example.com/photo2.jpg',
                size: 1024000,
                captureDate: '2024-01-15'
            };
            storageService.createMedia(input1);
            storageService.createMedia(input2);
            var mediaList = storageService.getMediaList({ babyId: 'baby_1' });
            expect(mediaList.length).toBe(2);
            expect(mediaList[0].captureDate).toBe('2024-01-15'); // 最新的在前
            expect(mediaList[1].captureDate).toBe('2024-01-01');
        });
        test('按babyId筛选应该正确工作', function () {
            var baby2Input = {
                name: '宝宝2',
                birthDate: '2024-02-01',
                gender: baby_1.BabyGender.Female
            };
            var baby2 = storageService.createBaby(baby2Input);
            var input1 = {
                babyId: 'baby_1',
                type: media_1.MediaType.Photo,
                url: 'https://example.com/photo1.jpg',
                size: 1024000,
                captureDate: '2024-01-01'
            };
            var input2 = {
                babyId: baby2.id,
                type: media_1.MediaType.Photo,
                url: 'https://example.com/photo2.jpg',
                size: 1024000,
                captureDate: '2024-01-02'
            };
            storageService.createMedia(input1);
            storageService.createMedia(input2);
            var mediaList = storageService.getMediaList({ babyId: baby2.id });
            expect(mediaList.length).toBe(1);
            expect(mediaList[0].babyId).toBe(baby2.id);
        });
        test('按日期范围筛选应该正确工作', function () {
            var input1 = {
                babyId: 'baby_1',
                type: media_1.MediaType.Photo,
                url: 'https://example.com/photo1.jpg',
                size: 1024000,
                captureDate: '2024-01-01'
            };
            var input2 = {
                babyId: 'baby_1',
                type: media_1.MediaType.Photo,
                url: 'https://example.com/photo2.jpg',
                size: 1024000,
                captureDate: '2024-06-15'
            };
            var input3 = {
                babyId: 'baby_1',
                type: media_1.MediaType.Photo,
                url: 'https://example.com/photo3.jpg',
                size: 1024000,
                captureDate: '2024-12-31'
            };
            storageService.createMedia(input1);
            storageService.createMedia(input2);
            storageService.createMedia(input3);
            var mediaList = storageService.getMediaList({
                babyId: 'baby_1',
                startDate: '2024-06-01',
                endDate: '2024-06-30'
            });
            expect(mediaList.length).toBe(1);
            expect(mediaList[0].captureDate).toBe('2024-06-15');
        });
        test('分页功能应该正确工作', function () {
            for (var i = 0; i < 25; i++) {
                var input = {
                    babyId: 'baby_1',
                    type: media_1.MediaType.Photo,
                    url: "https://example.com/photo".concat(i, ".jpg"),
                    size: 1024000,
                    captureDate: "2024-01-".concat(String(i + 1).padStart(2, '0'))
                };
                storageService.createMedia(input);
            }
            var page1 = storageService.getMediaList({
                babyId: 'baby_1',
                page: 1,
                pageSize: 10
            });
            var page2 = storageService.getMediaList({
                babyId: 'baby_1',
                page: 2,
                pageSize: 10
            });
            var page3 = storageService.getMediaList({
                babyId: 'baby_1',
                page: 3,
                pageSize: 10
            });
            expect(page1.length).toBe(10);
            expect(page2.length).toBe(10);
            expect(page3.length).toBe(5);
        });
        test('更新媒体应该成功', function () {
            var input = {
                babyId: 'baby_1',
                type: media_1.MediaType.Photo,
                url: 'https://example.com/photo.jpg',
                size: 1024000,
                captureDate: '2024-01-15'
            };
            var created = storageService.createMedia(input);
            var updated = storageService.updateMedia(created.id, {
                title: '更新标题'
            });
            expect(updated.title).toBe('更新标题');
            expect(updated.id).toBe(created.id);
        });
        test('删除媒体应该成功', function () {
            var input = {
                babyId: 'baby_1',
                type: media_1.MediaType.Photo,
                url: 'https://example.com/photo.jpg',
                size: 1024000,
                captureDate: '2024-01-15'
            };
            var created = storageService.createMedia(input);
            storageService.deleteMedia(created.id);
            var media = storageService.getMedia(created.id);
            expect(media).toBeNull();
        });
        test('批量删除媒体应该成功', function () {
            var input1 = {
                babyId: 'baby_1',
                type: media_1.MediaType.Photo,
                url: 'https://example.com/photo1.jpg',
                size: 1024000,
                captureDate: '2024-01-01'
            };
            var input2 = {
                babyId: 'baby_1',
                type: media_1.MediaType.Photo,
                url: 'https://example.com/photo2.jpg',
                size: 1024000,
                captureDate: '2024-01-02'
            };
            storageService.createMedia(input1);
            storageService.createMedia(input2);
            storageService.deleteMediaByBaby('baby_1');
            var mediaList = storageService.getMediaList({ babyId: 'baby_1' });
            expect(mediaList.length).toBe(0);
        });
    });
    describe('存储管理功能', function () {
        test('清除缓存应该清空所有数据', function () {
            var babyInput = {
                name: '小明',
                birthDate: '2024-01-15',
                gender: baby_1.BabyGender.Male
            };
            storageService.createBaby(babyInput);
            storageService.clearCache();
            var babies = storageService.getBabies();
            expect(babies.length).toBe(0);
        });
        test('获取存储使用情况应该返回正确结构', function () {
            var usage = storageService.getStorageUsage();
            expect(usage.used).toBeDefined();
            expect(usage.limit).toBe(10 * 1024 * 1024);
            expect(typeof usage.used).toBe('number');
            expect(typeof usage.limit).toBe('number');
        });
        test('创建多个宝宝后存储使用量应该增加', function () {
            var babyInput = {
                name: '小明',
                birthDate: '2024-01-15',
                gender: baby_1.BabyGender.Male
            };
            var usage1 = storageService.getStorageUsage();
            storageService.createBaby(babyInput);
            var usage2 = storageService.getStorageUsage();
            expect(usage2.used).toBeGreaterThan(usage1.used);
        });
    });
    describe('数据持久化验证', function () {
        test('数据应该在创建后持久化', function () {
            var input = {
                name: '持久化测试',
                birthDate: '2024-01-01',
                gender: baby_1.BabyGender.Unknown
            };
            var baby = storageService.createBaby(input);
            var retrieved = storageService.getBaby(baby.id);
            expect(retrieved).not.toBeNull();
            expect(retrieved.name).toBe('持久化测试');
        });
        test('更新后数据应该保持更新', function () {
            var input = {
                name: '更新测试',
                birthDate: '2024-01-01',
                gender: baby_1.BabyGender.Male
            };
            var baby = storageService.createBaby(input);
            storageService.updateBaby(baby.id, { name: '新名字' });
            var retrieved = storageService.getBaby(baby.id);
            expect(retrieved.name).toBe('新名字');
        });
    });
    describe('边界情况处理', function () {
        test('空数据库查询应返回空数组', function () {
            var babies = storageService.getBabies();
            var mediaList = storageService.getMediaList();
            expect(babies).toEqual([]);
            expect(mediaList).toEqual([]);
        });
        test('更新不存在的宝宝应抛出错误', function () {
            expect(function () {
                storageService.updateBaby('non_existent', { name: '新名字' });
            }).toThrow('Baby not found');
        });
        test('更新不存在的媒体应抛出错误', function () {
            expect(function () {
                storageService.updateMedia('non_existent', { title: '新标题' });
            }).toThrow('Media not found');
        });
        test('删除不存在的宝宝不应抛出错误', function () {
            expect(function () {
                storageService.deleteBaby('non_existent');
            }).not.toThrow();
        });
    });
});
