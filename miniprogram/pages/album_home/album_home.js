"use strict";
// @ts-nocheck
// album_home.ts - 首页，对接后端 API
// 使用统一配置中心 API_CONFIG
Object.defineProperty(exports, "__esModule", { value: true });
var api_1 = require("../../config/api");
var storage_keys_1 = require("../../constants/storage_keys");
Page({
    data: {
        safeTop: 44,
        currentMonthLabel: '全部',
        currentBabyId: '',
        currentBaby: null,
        babies: [],
        mediaList: [],
        isEmpty: false,
        uploaderVisible: false,
        isLoading: false,
        hasMore: true,
        isLoadingMore: false,
        page: 1,
        pageSize: 20,
        filterMinAge: null,
        filterMaxAge: null,
        filterOptions: [
            { label: '全部', value: null, minAge: null, maxAge: null, active: true }
        ],
        babyAgeText: '',
        headerCollapsed: false,
        headerHeight: 136,
        // Lazy loading state
        visibleIds: {},
        _observer: null,
    },
    onLoad: function () {
        try {
            var info = wx.getWindowInfo();
            this.setData({ safeTop: info.statusBarHeight || 44 });
        }
        catch (e) { }
        // Read currentBabyId from storage
        try {
            var storedId = wx.getStorageSync(storage_keys_1.STORAGE_KEYS.currentBabyId) || '';
            this.setData({ currentBabyId: storedId });
        }
        catch (e) { }
        // 优先由 loadBabies 驱动数据初始化，避免在 currentBabyId 无效时发重复请求
        this.loadBabies();
    },
    onShow: function () {
        // 从其他页面返回时刷新数据（如上传完成后返回）
        var babyId = '';
        try {
            babyId = wx.getStorageSync(storage_keys_1.STORAGE_KEYS.currentBabyId) || '';
        }
        catch (e) { }
        if (babyId && babyId !== this.data.currentBabyId) {
            this.setData({ currentBabyId: babyId });
            this.loadBabies();
            this.fetchBabyInfo(babyId);
            this.fetchMediaList(babyId, 1);
        }
        else if (babyId) {
            // babyId 没变但也刷新数据（确保最新）
            this.fetchBabyInfo(babyId);
            this.fetchMediaList(babyId, 1);
        }
        else {
            // 没有当前宝宝 ID，显示空状态引导
            this.setData({ isEmpty: true });
        }
    },
    initPage: function () {
        var _this = this;
        var babyId = this.data.currentBabyId || '';
        this.setData({ isLoading: true });
        // 1. 尝试从 API 加载宝宝信息
        this.fetchBabyInfo(babyId);
        // 2. 尝试从 API 加载媒体列表
        this.fetchMediaList(babyId, 1);
    },
    getToken: function () {
        try {
            return wx.getStorageSync('baby_diary_access_token') || '';
        }
        catch (e) {
            return '';
        }
    },
    fetchBabyInfo: function (babyId) {
        var _this = this;
        var token = this.getToken();
        if (!babyId || !token) {
            this.fallbackBabyInfo(babyId);
            return;
        }
        wx.request({
            url: api_1.API_CONFIG.baseURL + '/babies/' + babyId,
            method: 'GET',
            header: { 'Authorization': 'Bearer ' + token },
            timeout: 8000,
            success: function (res) {
                if (res.statusCode === 200 && res.data) {
                    var b = res.data;
                    _this.setData({
                        currentBaby: b,
                        babyAgeText: b.birthDate ? _this.calcAge(b.birthDate) + ' · ' + (b.gender === 'male' ? '男宝' : '女宝') : '',
                        isLoading: false,
                    });
                }
                else {
                    _this.fallbackBabyInfo(babyId);
                }
            },
            fail: function () { _this.fallbackBabyInfo(babyId); },
        });
    },
    fallbackBabyInfo: function (babyId) {
        // 从本地缓存读取
        var babies = [];
        try {
            var stored = wx.getStorageSync('album_babies');
            if (Array.isArray(stored))
                babies = stored;
        }
        catch (e) { }
        var currentBaby = null;
        for (var i = 0; i < babies.length; i++) {
            if (babies[i].id === babyId) {
                currentBaby = babies[i];
                break;
            }
        }
        if (!currentBaby && babies.length > 0) {
            currentBaby = babies[0];
        }
        this.setData({
            currentBaby: currentBaby,
            babyAgeText: currentBaby ? (currentBaby.birthDate ? '未知年龄' : '') : '',
            isLoading: false,
        });
    },
    fetchMediaList: function (babyId, page) {
        var _this = this;
        var token = this.getToken();
        if (!babyId || !token) {
            this.fallbackMediaList();
            return;
        }
        wx.request({
            url: api_1.API_CONFIG.baseURL + '/media/',
            method: 'GET',
            data: { babyId: babyId, page: page },
            header: { 'Authorization': 'Bearer ' + token },
            timeout: 8000,
            success: function (res) {
                if (res.statusCode === 200 && res.data && res.data.length > 0) {
                    var items = res.data.map(function (m) {
                        return {
                            id: m.id, title: m.title || '', url: m.cosUrl || '',
                            thumbnailUrl: m.thumbnailUrl || m.cosUrl || '',
                            cardColor: _this.getCardColor(m.id),
                            captureDate: m.captureDate,
                        };
                    });
                    _this.setData({
                        mediaList: items,
                        isEmpty: items.length === 0,
                        isLoading: false,
                        visibleIds: {},
                    });
                    // Setup lazy loading observer after data update
                    setTimeout(function () { _this.setupLazyObserver(); }, 100);
                }
                else {
                    _this.fallbackMediaList();
                }
            },
            fail: function () { _this.fallbackMediaList(); },
        });
    },
    fallbackMediaList: function () {
        // 从本地缓存读取媒体列表
        var mediaList = [];
        try {
            var stored = wx.getStorageSync('album_media');
            if (Array.isArray(stored) && stored.length > 0)
                mediaList = stored;
        }
        catch (e) { }
        if (mediaList.length === 0) {
            mediaList = this.getMockMediaList();
        }
        this.setData({
            mediaList: mediaList,
            isEmpty: mediaList.length === 0,
            isLoading: false,
        });
    },
    getMockMediaList: function () {
        return [
            { id: 'm1', title: '第一次翻身', url: '', thumbnailUrl: '', cardColor: 'pink', captureDate: '2026-05-01' },
            { id: 'm2', title: '学坐啦', url: '', thumbnailUrl: '', cardColor: 'blue', captureDate: '2026-05-10' },
            { id: 'm3', title: '今天会笑了', url: '', thumbnailUrl: '', cardColor: 'beige', captureDate: '2026-05-15' },
            { id: 'm4', title: '新玩具', url: '', thumbnailUrl: '', cardColor: 'mint', captureDate: '2026-05-20' },
        ];
    },
    loadBabies: function () {
        var _this = this;
        var token = this.getToken();
        wx.request({
            url: api_1.API_CONFIG.baseURL + '/babies/',
            method: 'GET',
            header: { 'Authorization': 'Bearer ' + token },
            timeout: 8000,
            success: function (res) {
                if (res.statusCode === 200 && Array.isArray(res.data)) {
                    var babies = res.data;
                    _this.setData({ babies: babies, isEmpty: babies.length === 0 });
                    // 缓存到本地
                    if (babies.length > 0) {
                        try {
                            wx.setStorageSync('album_babies', babies);
                        }
                        catch (e) { }
                        var currentId = _this.data.currentBabyId;
                        var found = false;
                        for (var i = 0; i < babies.length; i++) {
                            if (babies[i].id === currentId) {
                                found = true;
                                break;
                            }
                        }
                        if (!currentId || !found) {
                            // 没有当前宝宝或当前宝宝不在列表中，自动选第一个
                            var firstBaby = babies[0];
                            _this.setData({ currentBabyId: firstBaby.id, currentBaby: firstBaby });
                            try {
                                wx.setStorageSync(storage_keys_1.STORAGE_KEYS.currentBabyId, firstBaby.id);
                            }
                            catch (e) { }
                        }
                        // 加载当前选中宝宝的详情和媒体（无论是否刚切换）
                        var targetId = _this.data.currentBabyId;
                        if (targetId) {
                            _this.fetchBabyInfo(targetId);
                            _this.fetchMediaList(targetId, 1);
                        }
                    }
                    else {
                        // 没有宝宝数据，显示空状态
                        _this.setData({ isEmpty: true, isLoading: false });
                    }
                }
                else {
                    _this.fallbackBabies();
                }
            },
            fail: function () { _this.fallbackBabies(); },
        });
    },
    fallbackBabies: function () {
        var _this = this;
        try {
            var stored = wx.getStorageSync('album_babies');
            if (Array.isArray(stored) && stored.length > 0) {
                _this.setData({ babies: stored, isEmpty: false });
                // auto-select if needed
                var currentId = _this.data.currentBabyId;
                var found = false;
                for (var i = 0; i < stored.length; i++) {
                    if (stored[i].id === currentId) {
                        found = true;
                        break;
                    }
                }
                if (!currentId || !found) {
                    var firstBaby = stored[0];
                    _this.setData({ currentBabyId: firstBaby.id, currentBaby: firstBaby });
                    try {
                        wx.setStorageSync(storage_keys_1.STORAGE_KEYS.currentBabyId, firstBaby.id);
                    }
                    catch (e) { }
                }
                return;
            }
        }
        catch (e) { }
        // 无任何宝宝数据，显示空状态
        this.setData({ babies: [], isEmpty: true });
    },
    calcAge: function (birthDate) {
        if (!birthDate)
            return '';
        var parts = birthDate.split('-');
        var birth = new Date(parts[0], parts[1] - 1, parts[2]);
        var now = new Date();
        var months = (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth());
        if (months < 0)
            months = 0;
        return months + '个月';
    },
    getCardColor: function (id) {
        var colors = ['pink', 'blue', 'beige', 'mint'];
        var hash = 0;
        for (var i = 0; i < id.length; i++) {
            hash = ((hash << 5) - hash) + id.charCodeAt(i);
        }
        return colors[Math.abs(hash) % colors.length];
    },
    onContentScroll: function (e) {
        var scrollTop = e.scrollTop || 0;
        var collapsed = scrollTop > 60;
        if (collapsed !== this.data.headerCollapsed) {
            this.setData({ headerCollapsed: collapsed });
        }
    },
    onBabyStripTap: function (e) {
        var babyId = e.currentTarget.dataset.id;
        var babies = this.data.babies;
        var currentBaby = null;
        for (var i = 0; i < babies.length; i++) {
            if (babies[i].id === babyId) {
                currentBaby = babies[i];
                break;
            }
        }
        if (currentBaby) {
            this.setData({
                currentBabyId: babyId, currentBaby: currentBaby, headerCollapsed: false
            });
            try {
                wx.setStorageSync(storage_keys_1.STORAGE_KEYS.currentBabyId, babyId);
            }
            catch (e) { }
            // 重新加载媒体列表
            this.fetchMediaList(babyId, 1);
        }
    },
    onAddBabyTap: function () { wx.navigateTo({ url: '/pages/baby_onboarding/baby_onboarding' }); },
    onFilterSelect: function (e) {
        var value = e.currentTarget.dataset.value;
        var opts = this.data.filterOptions.map(function (o) { o.active = o.value === value; return o; });
        this.setData({ filterOptions: opts });
    },
    onBabySelect: function () { wx.navigateTo({ url: '/pages/baby_profile/baby_profile' }); },
    onMediaTap: function (e) { wx.navigateTo({ url: '/pages/media_detail/media_detail?id=' + e.currentTarget.dataset.id }); },
    goToSettings: function () { wx.redirectTo({ url: '/pages/settings/settings' }); },
    goToBabyProfile: function () { wx.navigateTo({ url: '/pages/baby_profile/baby_profile' }); },
    // ========== Lazy Loading with IntersectionObserver ==========
    setupLazyObserver: function () {
        // Disconnect previous observer
        this.disconnectLazyObserver();
        var _this = this;
        try {
            var observer = wx.createIntersectionObserver(this, {
                thresholds: [0.1],
                observeAll: true,
            });
            observer.relativeToViewport({ bottom: 300 }).observe('.lazy-media-card', function (res) {
                if (res.intersectionRatio > 0) {
                    var id = res.id || res.dataset && res.dataset.id;
                    if (id) {
                        var visibleIds = _this.data.visibleIds;
                        if (!visibleIds[id]) {
                            visibleIds[id] = true;
                            _this.setData({ visibleIds: visibleIds });
                        }
                    }
                }
            });
            this.setData({ _observer: observer });
        }
        catch (e) {
            // IntersectionObserver not supported, show all images
            var allVisible = {};
            var list = this.data.mediaList;
            for (var i = 0; i < list.length; i++) {
                allVisible[list[i].id] = true;
            }
            this.setData({ visibleIds: allVisible });
        }
    },
    disconnectLazyObserver: function () {
        var observer = this.data._observer;
        if (observer) {
            try {
                observer.disconnect();
            }
            catch (e) { }
            this.setData({ _observer: null });
        }
    },
    onUnload: function () {
        this.disconnectLazyObserver();
    },
});
