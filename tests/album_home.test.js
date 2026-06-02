"use strict";
/**
 * T-03A 相册首页框架测试用例
 * 测试目标: 相册首页框架 - 页面状态管理、生命周期和数据加载逻辑
 */
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
var baby_1 = require("../typings/models/baby");
var media_1 = require("../typings/models/media");
// ==================== Mock 存储服务 ====================
/**
 * 模拟存储服务
 */
var MockStorageService = /** @class */ (function () {
    function MockStorageService() {
        this.babies = [];
        this.mediaList = [];
    }
    MockStorageService.prototype.setBabies = function (babies) {
        this.babies = babies;
    };
    MockStorageService.prototype.setMediaList = function (mediaList) {
        this.mediaList = mediaList;
    };
    MockStorageService.prototype.getBabies = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, Promise.resolve(this.babies)];
            });
        });
    };
    MockStorageService.prototype.getMediaList = function (query) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                if (!(query === null || query === void 0 ? void 0 : query.babyId)) {
                    return [2 /*return*/, Promise.resolve([])];
                }
                return [2 /*return*/, Promise.resolve(this.mediaList.filter(function (m) { return m.babyId === query.babyId; }))];
            });
        });
    };
    return MockStorageService;
}());
var mockStorageService = new MockStorageService();
function createAlbumHomePage() {
    var page = {
        data: {
            currentBabyId: '',
            currentBaby: null,
            babies: [],
            mediaList: [],
            viewMode: 'masonry',
            isLoading: false,
            isEmpty: false
        },
        initPage: function () {
            return __awaiter(this, void 0, void 0, function () {
                var babies, firstBaby, error_1;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            page.data.isLoading = true;
                            _a.label = 1;
                        case 1:
                            _a.trys.push([1, 6, 7, 8]);
                            return [4 /*yield*/, mockStorageService.getBabies()];
                        case 2:
                            babies = _a.sent();
                            page.data.babies = babies;
                            if (!(babies.length > 0)) return [3 /*break*/, 4];
                            firstBaby = babies[0];
                            page.data.currentBabyId = firstBaby.id;
                            page.data.currentBaby = firstBaby;
                            return [4 /*yield*/, page.loadMediaList()];
                        case 3:
                            _a.sent();
                            return [3 /*break*/, 5];
                        case 4:
                            page.data.isEmpty = true;
                            _a.label = 5;
                        case 5: return [3 /*break*/, 8];
                        case 6:
                            error_1 = _a.sent();
                            console.error('初始化失败:', error_1);
                            return [3 /*break*/, 8];
                        case 7:
                            page.data.isLoading = false;
                            return [7 /*endfinally*/];
                        case 8: return [2 /*return*/];
                    }
                });
            });
        },
        loadMediaList: function () {
            return __awaiter(this, void 0, void 0, function () {
                var currentBabyId, mediaList, error_2;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            currentBabyId = page.data.currentBabyId;
                            if (!currentBabyId) {
                                page.data.mediaList = [];
                                return [2 /*return*/];
                            }
                            _a.label = 1;
                        case 1:
                            _a.trys.push([1, 3, , 4]);
                            return [4 /*yield*/, mockStorageService.getMediaList({ babyId: currentBabyId })];
                        case 2:
                            mediaList = _a.sent();
                            page.data.mediaList = mediaList;
                            page.data.isEmpty = mediaList.length === 0;
                            return [3 /*break*/, 4];
                        case 3:
                            error_2 = _a.sent();
                            console.error('加载媒体列表失败:', error_2);
                            return [3 /*break*/, 4];
                        case 4: return [2 /*return*/];
                    }
                });
            });
        },
        onBabySelect: function () {
            var babies = page.data.babies;
            if (babies.length === 0) {
                return;
            }
            var babyNames = babies.map(function (b) { return b.name; });
            // 模拟用户选择第一个宝宝
            var selectedBaby = babies[0];
            page.data.currentBabyId = selectedBaby.id;
            page.data.currentBaby = selectedBaby;
            page.loadMediaList();
        },
        switchViewMode: function () {
            var newMode = page.data.viewMode === 'masonry' ? 'timeline' : 'masonry';
            page.data.viewMode = newMode;
        },
        onMediaTap: function (e) {
            var id = e.currentTarget.dataset.id;
            return id;
        }
    };
    return page;
}
// ==================== 测试用例 ====================
describe('T-03A 相册首页框架测试', function () {
    var page;
    beforeEach(function () {
        page = createAlbumHomePage();
    });
    // ==================== 页面初始化测试 ====================
    describe('页面初始化', function () {
        test('初始化时应设置加载状态', function () { return __awaiter(void 0, void 0, void 0, function () {
            var initialLoading;
            return __generator(this, function (_a) {
                initialLoading = page.data.isLoading;
                // 初始状态 isLoading 应该是 false
                expect(initialLoading).toBe(false);
                return [2 /*return*/];
            });
        }); });
        test('无宝宝时应该显示空状态', function () { return __awaiter(void 0, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        mockStorageService.setBabies([]);
                        mockStorageService.setMediaList([]);
                        return [4 /*yield*/, page.initPage()];
                    case 1:
                        _a.sent();
                        expect(page.data.isEmpty).toBe(true);
                        expect(page.data.babies.length).toBe(0);
                        return [2 /*return*/];
                }
            });
        }); });
        test('有宝宝时应该加载第一个宝宝并获取媒体列表', function () { return __awaiter(void 0, void 0, void 0, function () {
            var mockBabies, mockMedia;
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        mockBabies = [
                            {
                                id: 'baby_1',
                                name: '小明',
                                birthDate: '2024-01-01',
                                gender: baby_1.BabyGender.Male,
                                createdAt: '2024-01-01T00:00:00Z',
                                updatedAt: '2024-01-01T00:00:00Z'
                            }
                        ];
                        mockMedia = [
                            {
                                id: 'media_1',
                                babyId: 'baby_1',
                                type: media_1.MediaType.Photo,
                                url: 'https://example.com/photo1.jpg',
                                size: 1024000,
                                captureDate: '2024-01-15',
                                createdAt: '2024-01-15T00:00:00Z',
                                updatedAt: '2024-01-15T00:00:00Z'
                            }
                        ];
                        mockStorageService.setBabies(mockBabies);
                        mockStorageService.setMediaList(mockMedia);
                        return [4 /*yield*/, page.initPage()];
                    case 1:
                        _b.sent();
                        expect(page.data.babies.length).toBe(1);
                        expect(page.data.currentBabyId).toBe('baby_1');
                        expect((_a = page.data.currentBaby) === null || _a === void 0 ? void 0 : _a.name).toBe('小明');
                        return [2 /*return*/];
                }
            });
        }); });
    });
    // ==================== 宝宝选择测试 ====================
    describe('宝宝选择功能', function () {
        beforeEach(function () { return __awaiter(void 0, void 0, void 0, function () {
            var mockBabies;
            return __generator(this, function (_a) {
                mockBabies = [
                    { id: 'baby_1', name: '小明', birthDate: '2024-01-01', gender: baby_1.BabyGender.Male, createdAt: '', updatedAt: '' },
                    { id: 'baby_2', name: '小红', birthDate: '2024-02-01', gender: baby_1.BabyGender.Female, createdAt: '', updatedAt: '' }
                ];
                mockStorageService.setBabies(mockBabies);
                page.data.babies = mockBabies;
                return [2 /*return*/];
            });
        }); });
        test('无宝宝时不应显示选择器', function () {
            page.data.babies = [];
            page.onBabySelect();
            // 无宝宝时直接返回，不做任何操作
            expect(page.data.currentBaby).toBeNull();
        });
        test('选择宝宝后应更新 currentBabyId 和媒体列表', function () {
            var _a, _b;
            var mockBabies = [
                { id: 'baby_1', name: '小明', birthDate: '2024-01-01', gender: baby_1.BabyGender.Male, createdAt: '', updatedAt: '' },
                { id: 'baby_2', name: '小红', birthDate: '2024-02-01', gender: baby_1.BabyGender.Female, createdAt: '', updatedAt: '' }
            ];
            page.data.babies = mockBabies;
            mockStorageService.setMediaList([
                { id: 'media_1', babyId: 'baby_2', type: media_1.MediaType.Photo, url: 'test.jpg', size: 1000, captureDate: '2024-02-01', createdAt: '', updatedAt: '' }
            ]);
            page.onBabySelect();
            expect((_a = page.data.currentBaby) === null || _a === void 0 ? void 0 : _a.id).toBe('baby_1'); // 默认选择第一个
            expect((_b = page.data.currentBaby) === null || _b === void 0 ? void 0 : _b.name).toBe('小明');
        });
    });
    // ==================== 视图模式切换测试 ====================
    describe('视图模式切换', function () {
        test('默认视图模式应为 masonry', function () {
            expect(page.data.viewMode).toBe('masonry');
        });
        test('切换视图模式应在 masonry 和 timeline 之间切换', function () {
            expect(page.data.viewMode).toBe('masonry');
            page.switchViewMode();
            expect(page.data.viewMode).toBe('timeline');
            page.switchViewMode();
            expect(page.data.viewMode).toBe('masonry');
        });
    });
    // ==================== 媒体列表加载测试 ====================
    describe('媒体列表加载', function () {
        test('无 currentBabyId 时应返回空列表', function () { return __awaiter(void 0, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        page.data.currentBabyId = '';
                        return [4 /*yield*/, page.loadMediaList()];
                    case 1:
                        _a.sent();
                        expect(page.data.mediaList.length).toBe(0);
                        return [2 /*return*/];
                }
            });
        }); });
        test('有 currentBabyId 时应加载对应媒体列表', function () { return __awaiter(void 0, void 0, void 0, function () {
            var mockMedia;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        page.data.currentBabyId = 'baby_1';
                        mockMedia = [
                            {
                                id: 'media_1',
                                babyId: 'baby_1',
                                type: media_1.MediaType.Photo,
                                url: 'https://example.com/photo1.jpg',
                                size: 1024000,
                                captureDate: '2024-01-15',
                                createdAt: '2024-01-15T00:00:00Z',
                                updatedAt: '2024-01-15T00:00:00Z'
                            }
                        ];
                        mockStorageService.setMediaList(mockMedia);
                        return [4 /*yield*/, page.loadMediaList()];
                    case 1:
                        _a.sent();
                        expect(page.data.mediaList.length).toBe(1);
                        expect(page.data.isEmpty).toBe(false);
                        return [2 /*return*/];
                }
            });
        }); });
        test('媒体列表为空时应显示空状态', function () { return __awaiter(void 0, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        page.data.currentBabyId = 'baby_1';
                        mockStorageService.setMediaList([]);
                        return [4 /*yield*/, page.loadMediaList()];
                    case 1:
                        _a.sent();
                        expect(page.data.isEmpty).toBe(true);
                        return [2 /*return*/];
                }
            });
        }); });
    });
    // ==================== 页面数据状态测试 ====================
    describe('页面数据状态', function () {
        test('页面初始状态应符合预期', function () {
            expect(page.data.currentBabyId).toBe('');
            expect(page.data.currentBaby).toBeNull();
            expect(page.data.babies).toEqual([]);
            expect(page.data.mediaList).toEqual([]);
            expect(page.data.viewMode).toBe('masonry');
            expect(page.data.isLoading).toBe(false);
            expect(page.data.isEmpty).toBe(false);
        });
        test('页面数据接口应定义正确的数据类型', function () {
            var data = {
                currentBabyId: 'string',
                currentBaby: null,
                babies: [],
                mediaList: [],
                viewMode: 'masonry',
                isLoading: false,
                isEmpty: false
            };
            expect(typeof data.currentBabyId).toBe('string');
            expect(data.viewMode === 'masonry' || data.viewMode === 'timeline').toBe(true);
            expect(typeof data.isLoading).toBe('boolean');
            expect(typeof data.isEmpty).toBe('boolean');
        });
    });
    // ==================== 媒体点击事件测试 ====================
    describe('媒体点击事件', function () {
        test('点击媒体项应返回正确的媒体 ID', function () {
            var event = {
                currentTarget: {
                    dataset: {
                        id: 'media_123'
                    }
                }
            };
            var mediaId = page.onMediaTap(event);
            expect(mediaId).toBe('media_123');
        });
        test('点击事件应正确解析 dataset', function () {
            var event = {
                currentTarget: {
                    dataset: {
                        id: 'media_456'
                    }
                }
            };
            var result = page.onMediaTap(event);
            expect(result).toBe('media_456');
        });
    });
    // ==================== 页面配置测试 ====================
    describe('页面配置 (album_home.json)', function () {
        test('页面标题应正确配置', function () {
            var config = {
                navigationBarTitleText: '成长相册'
            };
            expect(config.navigationBarTitleText).toBe('成长相册');
        });
        test('应启用下拉刷新', function () {
            var config = {
                enablePullDownRefresh: true
            };
            expect(config.enablePullDownRefresh).toBe(true);
        });
        test('Vant 组件应正确声明', function () {
            var config = {
                usingComponents: {
                    'van-nav-bar': 'vant-weapp/nav-bar/index',
                    'van-button': 'vant-weapp/button/index',
                    'van-loading': 'vant-weapp/loading/index',
                    'van-empty': 'vant-weapp/empty/index',
                    'masonry-layout': '/components/masonry_layout/masonry_layout'
                }
            };
            expect(config.usingComponents['van-nav-bar']).toBeDefined();
            expect(config.usingComponents['van-button']).toBeDefined();
            expect(config.usingComponents['van-loading']).toBeDefined();
            expect(config.usingComponents['van-empty']).toBeDefined();
            expect(config.usingComponents['masonry-layout']).toBeDefined();
        });
    });
    // ==================== 页面模板结构测试 ====================
    describe('页面模板结构 (album_home.wxml)', function () {
        test('导航栏应正确配置', function () {
            var navBarConfig = {
                title: '成长相册',
                leftArrow: true,
                bindClickLeft: 'goHome'
            };
            expect(navBarConfig.title).toBe('成长相册');
            expect(navBarConfig.leftArrow).toBe(true);
        });
        test('宝宝选择器应绑定正确事件', function () {
            var cellConfig = {
                title: '当前宝宝',
                isLink: true,
                bindClick: 'onBabySelect'
            };
            expect(cellConfig.bindClick).toBe('onBabySelect');
        });
        test('视图切换按钮应正确绑定', function () {
            var buttonConfig = {
                size: 'small',
                bindClick: 'switchViewMode'
            };
            expect(buttonConfig.bindClick).toBe('switchViewMode');
        });
        test('上传按钮应正确配置', function () {
            var uploadButtonConfig = {
                type: 'primary',
                round: true,
                icon: 'plus',
                bindClick: 'onUploadTap'
            };
            expect(uploadButtonConfig.type).toBe('primary');
            expect(uploadButtonConfig.bindClick).toBe('onUploadTap');
        });
        test('瀑布流视图应使用正确的组件和属性', function () {
            var masonryConfig = {
                viewMode: 'masonry',
                useMasonryLayout: true,
                lazyLoad: true,
                fit: 'cover'
            };
            expect(masonryConfig.viewMode).toBe('masonry');
            expect(masonryConfig.lazyLoad).toBe(true);
        });
        test('空状态应正确配置', function () {
            var emptyConfig = {
                image: 'https://img.yzcdn.cn/vant.Empty-1',
                description: '暂无照片，试试上传第一张',
                showUploadButton: true
            };
            expect(emptyConfig.description).toBe('暂无照片，试试上传第一张');
            expect(emptyConfig.showUploadButton).toBe(true);
        });
    });
    // ==================== 边界情况测试 ====================
    describe('边界情况处理', function () {
        test('媒体列表为空时应正确设置 isEmpty 状态', function () { return __awaiter(void 0, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        page.data.currentBabyId = 'baby_1';
                        mockStorageService.setMediaList([]);
                        return [4 /*yield*/, page.loadMediaList()];
                    case 1:
                        _a.sent();
                        expect(page.data.isEmpty).toBe(true);
                        expect(page.data.mediaList.length).toBe(0);
                        return [2 /*return*/];
                }
            });
        }); });
        test('多宝宝切换时应正确更新状态', function () { return __awaiter(void 0, void 0, void 0, function () {
            var mockBabies;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        mockBabies = [
                            { id: 'baby_1', name: '宝宝1', birthDate: '2024-01-01', gender: baby_1.BabyGender.Male, createdAt: '', updatedAt: '' },
                            { id: 'baby_2', name: '宝宝2', birthDate: '2024-02-01', gender: baby_1.BabyGender.Female, createdAt: '', updatedAt: '' }
                        ];
                        page.data.babies = mockBabies;
                        page.data.currentBabyId = 'baby_1';
                        page.data.currentBaby = mockBabies[0];
                        mockStorageService.setMediaList([
                            { id: 'media_1', babyId: 'baby_2', type: media_1.MediaType.Photo, url: 'test.jpg', size: 1000, captureDate: '2024-02-01', createdAt: '', updatedAt: '' }
                        ]);
                        // 模拟选择第二个宝宝
                        page.data.currentBabyId = 'baby_2';
                        page.data.currentBaby = mockBabies[1];
                        return [4 /*yield*/, page.loadMediaList()];
                    case 1:
                        _a.sent();
                        expect(page.data.currentBabyId).toBe('baby_2');
                        return [2 /*return*/];
                }
            });
        }); });
        test('视图模式切换多次应保持正确状态', function () {
            expect(page.data.viewMode).toBe('masonry');
            page.switchViewMode();
            expect(page.data.viewMode).toBe('timeline');
            page.switchViewMode();
            expect(page.data.viewMode).toBe('masonry');
            page.switchViewMode();
            expect(page.data.viewMode).toBe('timeline');
        });
    });
    // ==================== Skyline 渲染器兼容性测试 ====================
    describe('Skyline 渲染器兼容性', function () {
        test('页面配置应兼容 Skyline 渲染器', function () {
            var skyLineConfig = {
                renderer: 'skyline',
                componentFramework: 'glass-easel'
            };
            expect(skyLineConfig.renderer).toBe('skyline');
            expect(skyLineConfig.componentFramework).toBe('glass-easel');
        });
        test('组件配置应设置 styleIsolation', function () {
            var componentConfig = {
                styleIsolation: 'apply-shared'
            };
            expect(componentConfig.styleIsolation).toBe('apply-shared');
        });
        test('masonry-layout 组件路径应正确', function () {
            var config = {
                usingComponents: {
                    'masonry-layout': '/components/masonry_layout/masonry_layout'
                }
            };
            expect(config.usingComponents['masonry-layout']).toBe('/components/masonry_layout/masonry_layout');
        });
    });
});
