"use strict";
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
// @ts-nocheck
// album_home.ts - 相册首页
var storage_service_1 = require("../../services/storage_service");
var media_service_1 = require("../../services/media_service");
Page({
    data: {
        currentBabyId: '',
        currentBaby: null,
        babies: [],
        mediaList: [],
        viewMode: 'masonry',
        isLoading: false,
        isEmpty: false,
        uploaderVisible: false,
        filterMinAge: null,
        filterMaxAge: null
    },
    onLoad: function () {
        this.initPage();
    },
    onShow: function () {
        // 每次显示时检查数据更新
        if (this.data.currentBabyId) {
            this.loadMediaList();
        }
    },
    onPullDownRefresh: function () {
        // 下拉刷新
        this.loadMediaList().then(function () {
            wx.stopPullDownRefresh();
        });
    },
    initPage: function () {
        return __awaiter(this, void 0, void 0, function () {
            var babies, firstBaby, error_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        this.setData({ isLoading: true });
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 6, 7, 8]);
                        return [4 /*yield*/, storage_service_1.storageService.getBabies()];
                    case 2:
                        babies = _a.sent();
                        this.setData({ babies: babies });
                        if (!(babies.length > 0)) return [3 /*break*/, 4];
                        firstBaby = babies[0];
                        this.setData({
                            currentBabyId: firstBaby.id,
                            currentBaby: firstBaby
                        });
                        return [4 /*yield*/, this.loadMediaList()];
                    case 3:
                        _a.sent();
                        return [3 /*break*/, 5];
                    case 4:
                        this.setData({ isEmpty: true });
                        _a.label = 5;
                    case 5: return [3 /*break*/, 8];
                    case 6:
                        error_1 = _a.sent();
                        console.error('初始化失败:', error_1);
                        return [3 /*break*/, 8];
                    case 7:
                        this.setData({ isLoading: false });
                        return [7 /*endfinally*/];
                    case 8: return [2 /*return*/];
                }
            });
        });
    },
    loadMediaList: function () {
        return __awaiter(this, void 0, void 0, function () {
            var _a, currentBabyId, filterMinAge, filterMaxAge, currentBaby, babyBirthDate, mediaList, error_2;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _a = this.data, currentBabyId = _a.currentBabyId, filterMinAge = _a.filterMinAge, filterMaxAge = _a.filterMaxAge, currentBaby = _a.currentBaby;
                        if (!currentBabyId) {
                            this.setData({ mediaList: [] });
                            return [2 /*return*/];
                        }
                        _b.label = 1;
                    case 1:
                        _b.trys.push([1, 3, , 4]);
                        babyBirthDate = currentBaby ? currentBaby.birthDate : null;
                        return [4 /*yield*/, media_service_1.mediaService.getMediaListWithAge({
                                babyId: currentBabyId,
                                minAge: filterMinAge !== null ? filterMinAge : undefined,
                                maxAge: filterMaxAge !== null ? filterMaxAge : undefined
                            }, babyBirthDate)];
                    case 2:
                        mediaList = _b.sent();
                        this.setData({ mediaList: mediaList, isEmpty: mediaList.length === 0 });
                        return [3 /*break*/, 4];
                    case 3:
                        error_2 = _b.sent();
                        console.error('加载媒体列表失败:', error_2);
                        return [3 /*break*/, 4];
                    case 4: return [2 /*return*/];
                }
            });
        });
    },
    onBabySelect: function () {
        var _this = this;
        // 显示宝宝选择器
        var babies = this.data.babies;
        if (babies.length === 0) {
            return;
        }
        var babyNames = babies.map(function (b) { return b.name; });
        wx.showActionSheet({
            itemList: babyNames,
            success: function (res) {
                var selectedBaby = babies[res.tapIndex];
                _this.setData({
                    currentBabyId: selectedBaby.id,
                    currentBaby: selectedBaby
                });
                _this.loadMediaList();
            }
        });
    },
    onAgeFilterChange: function (event) {
        var _a = event.detail, value = _a.value, minAge = _a.minAge, maxAge = _a.maxAge;
        this.setData({
            filterMinAge: minAge,
            filterMaxAge: maxAge
        });
        this.loadMediaList();
    },
    switchViewMode: function () {
        // 切换视图模式
        var newMode = this.data.viewMode === 'masonry' ? 'timeline' : 'masonry';
        this.setData({ viewMode: newMode });
    },
    onMediaTap: function (e) {
        var id = e.currentTarget.dataset.id;
        wx.navigateTo({
            url: '/pages/media_detail/media_detail?id=' + id
        });
    },
    onScrollToLower: function () {
        // 触底加载更多 - 预留，后续实现分页
        wx.showToast({
            title: '正在加载更多...',
            icon: 'none'
        });
    },
    onUploadTap: function () {
        // 显示上传组件
        if (!this.data.currentBabyId) {
            wx.showToast({ title: '请先选择宝宝', icon: 'none' });
            return;
        }
        this.setData({ uploaderVisible: true });
    },
    onUploaderClose: function () {
        this.setData({ uploaderVisible: false });
    },
    onUploaderSuccess: function () {
        // 上传成功后刷新列表
        this.loadMediaList();
    },
    goHome: function () {
        wx.navigateBack();
    }
});
