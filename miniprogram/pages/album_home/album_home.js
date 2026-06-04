"use strict";
// @ts-nocheck
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
        // Header animation
        headerCollapsed: false,
        headerHeight: 136
    },
    onLoad: function () {
        try {
            var info = wx.getSystemInfoSync();
            this.setData({ safeTop: info.statusBarHeight || 44 });
        }
        catch (e) { }
        // Read currentBabyId from storage
        var storedId = '';
        try {
            storedId = wx.getStorageSync('baby_diary_current_baby_id') || '';
        }
        catch (e) { }
        this.setData({ currentBabyId: storedId });
        this.initPage();
        this.loadBabies();
    },
    initPage: function () {
        // Try to load media from storage, fallback to mock data
        var _this = this;
        var babyId = this.data.currentBabyId || 'demo-1';
        var allMedia = [];
        try {
            var storedMedia = wx.getStorageSync('album_media');
            if (storedMedia && Array.isArray(storedMedia) && storedMedia.length > 0) {
                allMedia = storedMedia;
            }
        }
        catch (e) { }
        // If no media in storage, use mock seeded data
        if (allMedia.length === 0) {
            allMedia = this.getMockMediaList();
            // Seed into storage for future reads
            try {
                wx.setStorageSync('album_media', allMedia);
            }
            catch (e) { }
        }
        // Ensure babies are in storage too
        try {
            var storedBabies = wx.getStorageSync('album_babies');
            if (!storedBabies || storedBabies.length === 0) {
                wx.setStorageSync('album_babies', [
                    { id: 'demo-1', name: '小星星', avatar: '👶', gender: 'female', birthDate: '2025-12-01' },
                    { id: 'demo-2', name: '小月亮', avatar: '👧', gender: 'male', birthDate: '2026-03-20' }
                ]);
            }
        }
        catch (e) { }
        // Set currentBaby from storage
        var currentBaby = null;
        for (var i = 0; i < _this.data.babies.length; i++) {
            if (_this.data.babies[i].id === babyId) {
                currentBaby = _this.data.babies[i];
                break;
            }
        }
        if (!currentBaby) {
            currentBaby = { id: 'demo-1', name: '小星星', avatar: '👶', gender: 'female', birthDate: '2025-12-01' };
        }
        this.setData({
            currentBabyId: babyId,
            currentBaby: currentBaby,
            babyAgeText: babyId === 'demo-1' ? '6个月3天 · 女宝' : '2个月15天 · 男宝',
            mediaList: allMedia,
            filterOptions: [
                { label: '全部', value: null, active: true },
                { label: '7个月', value: 7, active: false },
                { label: '6个月', value: 6, active: false },
                { label: '5个月', value: 5, active: false },
                { label: '4个月', value: 4, active: false },
                { label: '3个月', value: 3, active: false }
            ],
            isLoading: false,
            isEmpty: allMedia.length === 0
        });
    },
    getMockMediaList: function () {
        return [
            { id: 'm1', title: '第一次翻身', url: '', thumbnailUrl: '', cardColor: 'pink', captureDate: '2026-05-01', cardColorIndex: 0 },
            { id: 'm2', title: '学坐啦', url: '', thumbnailUrl: '', cardColor: 'blue', captureDate: '2026-05-10', cardColorIndex: 1 },
            { id: 'm3', title: '今天会笑了', url: '', thumbnailUrl: '', cardColor: 'beige', captureDate: '2026-05-15', cardColorIndex: 2 },
            { id: 'm4', title: '新玩具', url: '', thumbnailUrl: '', cardColor: 'mint', captureDate: '2026-05-20', cardColorIndex: 3 }
        ];
    },
    loadBabies: function () {
        // Mock babies list (from storage or mock)
        var babies = [
            { id: 'demo-1', name: '小星星', avatar: '👶', gender: 'female', birthDate: '2025-12-01' },
            { id: 'demo-2', name: '小月亮', avatar: '👧', gender: 'male', birthDate: '2026-03-20' }
        ];
        this.setData({ babies: babies });
    },
    // ---- Scroll-triggered Header Collapse ----
    onPageScroll: function (e) {
        var scrollTop = e.scrollTop || 0;
        var threshold = 60;
        var collapsed = scrollTop > threshold;
        if (collapsed !== this.data.headerCollapsed) {
            this.setData({ headerCollapsed: collapsed });
        }
    },
    onBabyStripTap: function (e) {
        var babyId = e.currentTarget.dataset.id;
        var babies = this.data.babies;
        var currentBaby = null;
        var babyAgeText = '';
        for (var i = 0; i < babies.length; i++) {
            if (babies[i].id === babyId) {
                currentBaby = babies[i];
                break;
            }
        }
        if (currentBaby) {
            // Different age text per baby (mock)
            if (babyId === 'demo-1') {
                babyAgeText = '6个月3天 · 女宝';
            }
            else if (babyId === 'demo-2') {
                babyAgeText = '2个月15天 · 男宝';
            }
            this.setData({
                currentBabyId: babyId,
                currentBaby: currentBaby,
                babyAgeText: babyAgeText,
                headerCollapsed: false // Expand header on baby switch
            });
            // Persist to storage
            try {
                wx.setStorageSync('baby_diary_current_baby_id', babyId);
            }
            catch (e) { }
        }
    },
    onAddBabyTap: function () {
        wx.navigateTo({ url: '/pages/baby_list/baby_list' });
    },
    onFilterSelect: function (e) {
        var value = e.currentTarget.dataset.value;
        var opts = this.data.filterOptions.map(function (o) {
            o.active = o.value === value;
            return o;
        });
        this.setData({ filterOptions: opts });
    },
    onBabySelect: function () {
        wx.navigateTo({ url: '/pages/baby_profile/baby_profile' });
    },
    onMediaTap: function (e) {
        var id = e.currentTarget.dataset.id;
        wx.navigateTo({ url: '/pages/media_detail/media_detail?id=' + id });
    },
    onUploadTap: function () {
        wx.showToast({ title: '功能开发中', icon: 'none' });
    },
    goToSettings: function () {
        wx.redirectTo({ url: '/pages/settings/settings' });
    },
    goToBabyProfile: function () {
        wx.navigateTo({ url: '/pages/baby_profile/baby_profile' });
    }
});
