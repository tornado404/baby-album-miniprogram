"use strict";
// storage_service.ts - 本地存储服务
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
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.storageService = void 0;
/**
 * 存储服务类
 * 提供本地数据存储和检索功能，支持宝宝和媒体数据的 CRUD 操作
 */
var StorageService = /** @class */ (function () {
    function StorageService() {
        this.PREFIX = 'album_';
        this.VERSION = 'v1';
        // 内存缓存层 - 减少频繁的 Storage 操作
        this.cache = {
            lastFetchTime: 0
        };
        // 缓存有效期（毫秒）- 5分钟
        this.CACHE_TTL = 5 * 60 * 1000;
        // 存储键名
        this.keys = {
            babies: "".concat(this.PREFIX, "babies"),
            media: "".concat(this.PREFIX, "media"),
            settings: "".concat(this.PREFIX, "settings"),
            version: "".concat(this.PREFIX, "version")
        };
    }
    /**
     * 初始化存储服务
     */
    StorageService.prototype.init = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.checkVersion()];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    /**
     * 检查存储版本并迁移
     * TODO: 实现完整的迁移逻辑，支持多版本升级
     */
    StorageService.prototype.checkVersion = function () {
        return __awaiter(this, void 0, void 0, function () {
            var version;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        version = wx.getStorageSync(this.keys.version);
                        if (!(version !== this.VERSION)) return [3 /*break*/, 2];
                        // TODO: 实现迁移逻辑
                        // 例如: if (version === 'v0') { migrateFromV0ToV1(); }
                        return [4 /*yield*/, wx.setStorageSync(this.keys.version, this.VERSION)];
                    case 1:
                        // TODO: 实现迁移逻辑
                        // 例如: if (version === 'v0') { migrateFromV0ToV1(); }
                        _a.sent();
                        _a.label = 2;
                    case 2: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * 检查缓存是否有效
     */
    StorageService.prototype.isCacheValid = function () {
        return Date.now() - this.cache.lastFetchTime < this.CACHE_TTL;
    };
    /**
     * 保存数据到本地存储
     */
    StorageService.prototype.setData = function (key, data) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, new Promise(function (resolve) {
                        wx.setStorage({
                            key: key,
                            data: data,
                            success: function () { return resolve(); }
                        });
                    })];
            });
        });
    };
    /**
     * 从本地存储获取数据
     */
    StorageService.prototype.getData = function (key) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, new Promise(function (resolve) {
                        wx.getStorage({
                            key: key,
                            success: function (res) { return resolve(res.data); },
                            fail: function () { return resolve(null); }
                        });
                    })];
            });
        });
    };
    // ---- 宝宝相关操作 ----
    /**
     * 获取所有宝宝
     */
    StorageService.prototype.getBabies = function () {
        return __awaiter(this, void 0, void 0, function () {
            var babies;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (this.cache.babies && this.isCacheValid()) {
                            return [2 /*return*/, this.cache.babies];
                        }
                        return [4 /*yield*/, this.getData(this.keys.babies)];
                    case 1:
                        babies = _a.sent();
                        this.cache.babies = babies || [];
                        this.cache.lastFetchTime = Date.now();
                        return [2 /*return*/, this.cache.babies];
                }
            });
        });
    };
    /**
     * 获取单个宝宝
     */
    StorageService.prototype.getBaby = function (id) {
        return __awaiter(this, void 0, void 0, function () {
            var babies;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.getBabies()];
                    case 1:
                        babies = _a.sent();
                        return [2 /*return*/, babies.find(function (b) { return b.id === id; }) || null];
                }
            });
        });
    };
    /**
     * 创建宝宝
     */
    StorageService.prototype.createBaby = function (input) {
        return __awaiter(this, void 0, void 0, function () {
            var babies, now, baby;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.getData(this.keys.babies)];
                    case 1:
                        babies = (_a.sent()) || [];
                        now = new Date().toISOString();
                        baby = {
                            id: this.generateUUID(),
                            name: input.name,
                            birthDate: input.birthDate,
                            gender: input.gender,
                            avatar: input.avatar,
                            createdAt: now,
                            updatedAt: now
                        };
                        babies.push(baby);
                        return [4 /*yield*/, this.setData(this.keys.babies, babies)];
                    case 2:
                        _a.sent();
                        // 更新缓存
                        this.cache.babies = babies;
                        return [2 /*return*/, baby];
                }
            });
        });
    };
    /**
     * 更新宝宝信息
     */
    StorageService.prototype.updateBaby = function (id, input) {
        return __awaiter(this, void 0, void 0, function () {
            var babies, index, updatedBaby;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.getData(this.keys.babies)];
                    case 1:
                        babies = (_a.sent()) || [];
                        index = babies.findIndex(function (b) { return b.id === id; });
                        if (index === -1) {
                            throw new Error('宝宝不存在');
                        }
                        updatedBaby = __assign(__assign(__assign({}, babies[index]), input), { updatedAt: new Date().toISOString() });
                        babies[index] = updatedBaby;
                        return [4 /*yield*/, this.setData(this.keys.babies, babies)];
                    case 2:
                        _a.sent();
                        // 更新缓存
                        this.cache.babies = babies;
                        return [2 /*return*/, updatedBaby];
                }
            });
        });
    };
    /**
     * 删除宝宝
     */
    StorageService.prototype.deleteBaby = function (id) {
        return __awaiter(this, void 0, void 0, function () {
            var babies, filtered;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.getData(this.keys.babies)];
                    case 1:
                        babies = (_a.sent()) || [];
                        filtered = babies.filter(function (b) { return b.id !== id; });
                        return [4 /*yield*/, this.setData(this.keys.babies, filtered)];
                    case 2:
                        _a.sent();
                        // 更新缓存
                        this.cache.babies = filtered;
                        return [2 /*return*/];
                }
            });
        });
    };
    // ---- 媒体相关操作 ----
    /**
     * 获取媒体列表
     * @param query 查询参数
     * @param babyBirthDate 宝宝出生日期（用于计算月龄筛选）
     */
    StorageService.prototype.getMediaList = function (query, babyBirthDate) {
        return __awaiter(this, void 0, void 0, function () {
            var mediaList, calculateBabyAge_1, start;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.getData(this.keys.media)];
                    case 1:
                        mediaList = (_a.sent()) || [];
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
                            // 月龄筛选
                            if (query.minAge !== undefined || query.maxAge !== undefined) {
                                calculateBabyAge_1 = require('../utils/age_calculator').calculateBabyAge;
                                mediaList = mediaList.filter(function (m) {
                                    if (!babyBirthDate)
                                        return true;
                                    var age = calculateBabyAge_1(babyBirthDate, m.captureDate);
                                    var totalMonths = age.years * 12 + age.months;
                                    if (query.minAge !== undefined && totalMonths < query.minAge) {
                                        return false;
                                    }
                                    if (query.maxAge !== undefined && query.maxAge !== -1 && totalMonths > query.maxAge) {
                                        return false;
                                    }
                                    return true;
                                });
                            }
                            if (query.page && query.pageSize) {
                                start = (query.page - 1) * query.pageSize;
                                mediaList = mediaList.slice(start, start + query.pageSize);
                            }
                        }
                        return [2 /*return*/, mediaList];
                }
            });
        });
    };
    /**
     * 获取单个媒体 - 直接读取存储而非获取整个列表
     */
    StorageService.prototype.getMedia = function (id) {
        return __awaiter(this, void 0, void 0, function () {
            var allMedia;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.getData(this.keys.media)];
                    case 1:
                        allMedia = (_a.sent()) || [];
                        return [2 /*return*/, allMedia.find(function (m) { return m.id === id; }) || null];
                }
            });
        });
    };
    /**
     * 创建媒体
     */
    StorageService.prototype.createMedia = function (input) {
        return __awaiter(this, void 0, void 0, function () {
            var mediaList, now, media;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.getData(this.keys.media)];
                    case 1:
                        mediaList = (_a.sent()) || [];
                        now = new Date().toISOString();
                        media = {
                            id: this.generateUUID(),
                            babyId: input.babyId,
                            type: input.type,
                            url: input.url,
                            thumbnailUrl: input.thumbnailUrl,
                            width: input.width,
                            height: input.height,
                            size: input.size,
                            title: input.title,
                            captureDate: input.captureDate,
                            tags: input.tags,
                            createdAt: now,
                            updatedAt: now
                        };
                        mediaList.push(media);
                        return [4 /*yield*/, this.setData(this.keys.media, mediaList)];
                    case 2:
                        _a.sent();
                        // 更新缓存
                        this.cache.media = mediaList;
                        return [2 /*return*/, media];
                }
            });
        });
    };
    /**
     * 更新媒体
     */
    StorageService.prototype.updateMedia = function (id, input) {
        return __awaiter(this, void 0, void 0, function () {
            var mediaList, index, updatedMedia;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.getData(this.keys.media)];
                    case 1:
                        mediaList = (_a.sent()) || [];
                        index = mediaList.findIndex(function (m) { return m.id === id; });
                        if (index === -1) {
                            throw new Error('媒体不存在');
                        }
                        updatedMedia = __assign(__assign(__assign({}, mediaList[index]), input), { updatedAt: new Date().toISOString() });
                        mediaList[index] = updatedMedia;
                        return [4 /*yield*/, this.setData(this.keys.media, mediaList)];
                    case 2:
                        _a.sent();
                        // 更新缓存
                        this.cache.media = mediaList;
                        return [2 /*return*/, updatedMedia];
                }
            });
        });
    };
    /**
     * 删除媒体
     */
    StorageService.prototype.deleteMedia = function (id) {
        return __awaiter(this, void 0, void 0, function () {
            var mediaList, filtered;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.getData(this.keys.media)];
                    case 1:
                        mediaList = (_a.sent()) || [];
                        filtered = mediaList.filter(function (m) { return m.id !== id; });
                        return [4 /*yield*/, this.setData(this.keys.media, filtered)];
                    case 2:
                        _a.sent();
                        // 更新缓存
                        this.cache.media = filtered;
                        return [2 /*return*/];
                }
            });
        });
    };
    /**
     * 批量删除媒体
     */
    StorageService.prototype.deleteMediaByBaby = function (babyId) {
        return __awaiter(this, void 0, void 0, function () {
            var mediaList, filtered;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.getData(this.keys.media)];
                    case 1:
                        mediaList = (_a.sent()) || [];
                        filtered = mediaList.filter(function (m) { return m.babyId !== babyId; });
                        return [4 /*yield*/, this.setData(this.keys.media, filtered)];
                    case 2:
                        _a.sent();
                        // 更新缓存
                        this.cache.media = filtered;
                        return [2 /*return*/];
                }
            });
        });
    };
    // ---- 缓存管理 ----
    /**
     * 清除所有缓存
     */
    StorageService.prototype.clearCache = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        this.cache = { lastFetchTime: 0 };
                        return [4 /*yield*/, this.setData(this.keys.babies, [])];
                    case 1:
                        _a.sent();
                        return [4 /*yield*/, this.setData(this.keys.media, [])];
                    case 2:
                        _a.sent();
                        return [4 /*yield*/, this.setData(this.keys.settings, {})];
                    case 3:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    /**
     * 获取存储使用情况
     */
    StorageService.prototype.getStorageUsage = function () {
        return __awaiter(this, void 0, void 0, function () {
            var info, _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _b.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, wx.getStorageInfoSync()];
                    case 1:
                        info = _b.sent();
                        return [2 /*return*/, {
                                used: info.currentSize,
                                limit: info.limitSize
                            }];
                    case 2:
                        _a = _b.sent();
                        return [2 /*return*/, { used: 0, limit: 0 }];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * 生成 UUID v4
     */
    StorageService.prototype.generateUUID = function () {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
            var r = Math.random() * 16 | 0;
            var v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    };
    return StorageService;
}());
exports.storageService = new StorageService();
