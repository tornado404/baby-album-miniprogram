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
// media_detail.ts - Claymorphism 风格媒体详情页
var media_service_1 = require("../../services/media_service");
Page({
    data: {
        safeTop: 44,
        media: null,
        mediaList: [],
        currentIndex: 0,
        isLoading: false,
        showActions: false,
        scale: 1,
        minScale: 1,
        maxScale: 3,
        isZooming: false,
        initialPinchDistance: 0,
        babyAgeText: '',
        actions: [
            { name: '编辑描述', icon: '✏️', danger: false },
            { name: '保存到相册', icon: '💾', danger: false },
            { name: '分享', icon: '🔗', danger: false },
            { name: '删除', icon: '🗑️', danger: true }
        ]
    },
    onLoad: function (options) {
        var sysInfo = wx.getSystemInfoSync();
        this.setData({ safeTop: sysInfo.statusBarHeight || 44 });
        var id = options.id;
        if (id) {
            this.loadMediaDetail(id);
        }
    },
    onTouchStart: function (e) {
        if (e.touches.length === 2) {
            this.setData({ isZooming: true });
            var touch1 = e.touches[0];
            var touch2 = e.touches[1];
            var initialDistance = Math.sqrt(Math.pow(touch2.clientX - touch1.clientX, 2) +
                Math.pow(touch2.clientY - touch1.clientY, 2));
            this.setData({ initialPinchDistance: initialDistance });
        }
    },
    onTouchMove: function (e) {
        if (!this.data.isZooming || e.touches.length !== 2)
            return;
        var touch1 = e.touches[0];
        var touch2 = e.touches[1];
        var currentDistance = Math.sqrt(Math.pow(touch2.clientX - touch1.clientX, 2) +
            Math.pow(touch2.clientY - touch1.clientY, 2));
        var _a = this.data, initialPinchDistance = _a.initialPinchDistance, scale = _a.scale, minScale = _a.minScale, maxScale = _a.maxScale;
        var delta = currentDistance / initialPinchDistance;
        var newScale = scale * delta;
        newScale = Math.max(minScale, Math.min(maxScale, newScale));
        this.setData({ scale: newScale });
    },
    onTouchEnd: function () {
        this.setData({ isZooming: false });
        if (this.data.scale <= this.data.minScale) {
            this.setData({ scale: 1 });
        }
    },
    loadMediaDetail: function (id) {
        return __awaiter(this, void 0, void 0, function () {
            var media, ageText, error_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        this.setData({ isLoading: true });
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, 4, 5]);
                        return [4 /*yield*/, media_service_1.mediaService.getMediaDetail(id)];
                    case 2:
                        media = _a.sent();
                        if (media) {
                            ageText = this.formatBabyAge(media);
                            this.setData({
                                media: media,
                                mediaList: [media],
                                babyAgeText: ageText
                            });
                        }
                        return [3 /*break*/, 5];
                    case 3:
                        error_1 = _a.sent();
                        console.error('加载媒体详情失败:', error_1);
                        wx.showToast({ title: '加载失败', icon: 'none' });
                        return [3 /*break*/, 5];
                    case 4:
                        this.setData({ isLoading: false });
                        return [7 /*endfinally*/];
                    case 5: return [2 /*return*/];
                }
            });
        });
    },
    formatBabyAge: function (media) {
        if (media && media.babyAge) {
            var age = media.babyAge;
            var text = '';
            if (age.years > 0)
                text += age.years + '岁';
            if (age.months > 0)
                text += age.months + '个月';
            if (age.days > 0 && age.years === 0)
                text += age.days + '天';
            return text;
        }
        return '';
    },
    onSwiperChange: function (e) {
        var current = e.detail.current;
        var media = this.data.mediaList[current];
        this.setData({
            currentIndex: current,
            media: media,
            babyAgeText: this.formatBabyAge(media)
        });
    },
    onActionsTap: function () {
        this.setData({ showActions: true });
    },
    onActionsSelect: function (e) {
        var index = e.currentTarget.dataset.index;
        switch (index) {
            case 0:
                this.onEditTap();
                break;
            case 1:
                this.onDownloadTap();
                break;
            case 2:
                this.onShareTap();
                break;
            case 3:
                this.onDeleteTap();
                break;
        }
        this.setData({ showActions: false });
    },
    onActionsCancel: function () {
        this.setData({ showActions: false });
    },
    onEditTap: function () {
        var _this = this;
        var media = this.data.media;
        if (!media)
            return;
        wx.showModal({
            title: '编辑描述',
            editable: true,
            placeholderText: '请输入描述',
            content: media.title || '',
            success: function (res) { return __awaiter(_this, void 0, void 0, function () {
                var error_2;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            if (!(res.confirm && res.content !== media.title)) return [3 /*break*/, 4];
                            _a.label = 1;
                        case 1:
                            _a.trys.push([1, 3, , 4]);
                            return [4 /*yield*/, media_service_1.mediaService.updateMedia(media.id, { title: res.content })];
                        case 2:
                            _a.sent();
                            this.setData({ 'media.title': res.content });
                            wx.showToast({ title: '更新成功', icon: 'success' });
                            return [3 /*break*/, 4];
                        case 3:
                            error_2 = _a.sent();
                            wx.showToast({ title: '更新失败', icon: 'none' });
                            return [3 /*break*/, 4];
                        case 4: return [2 /*return*/];
                    }
                });
            }); }
        });
    },
    onDeleteTap: function () {
        return __awaiter(this, void 0, void 0, function () {
            var media;
            var _this = this;
            return __generator(this, function (_a) {
                media = this.data.media;
                if (!media)
                    return [2 /*return*/];
                wx.showModal({
                    title: '确认删除',
                    content: '确定要删除这张照片吗？删除后无法恢复。',
                    confirmColor: '#ee0a24',
                    success: function (res) { return __awaiter(_this, void 0, void 0, function () {
                        var error_3;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0:
                                    if (!res.confirm) return [3 /*break*/, 4];
                                    _a.label = 1;
                                case 1:
                                    _a.trys.push([1, 3, , 4]);
                                    return [4 /*yield*/, media_service_1.mediaService.deleteMedia(media.id)];
                                case 2:
                                    _a.sent();
                                    wx.showToast({ title: '删除成功', icon: 'success' });
                                    setTimeout(function () { return wx.navigateBack(); }, 1000);
                                    return [3 /*break*/, 4];
                                case 3:
                                    error_3 = _a.sent();
                                    wx.showToast({ title: '删除失败', icon: 'none' });
                                    return [3 /*break*/, 4];
                                case 4: return [2 /*return*/];
                            }
                        });
                    }); }
                });
                return [2 /*return*/];
            });
        });
    },
    onDownloadTap: function () {
        var media = this.data.media;
        if (!media)
            return;
        wx.saveImageToPhotosAlbum({
            filePath: media.url,
            success: function () { return wx.showToast({ title: '保存成功', icon: 'success' }); },
            fail: function () { return wx.showToast({ title: '保存失败', icon: 'none' }); }
        });
    },
    onShareTap: function () {
        wx.showShareMenu({
            withShareTicket: true,
            menus: ['shareAppMessage', 'shareTimeline']
        });
    },
    goBack: function () {
        wx.navigateBack();
    }
});
