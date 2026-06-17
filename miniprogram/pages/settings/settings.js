"use strict";
// settings.ts - 我的/设置页面，对接后端 API
// 使用统一配置中心 API_CONFIG，支持运行时环境切换
Object.defineProperty(exports, "__esModule", { value: true });
var api_1 = require("../../config/api");
var config_service_1 = require("../../services/config_service");
var i18n_1 = require("../../utils/i18n");
Page({
    data: {
        safeTop: 44,
        userName: '星星妈妈',
        recordDays: 0,
        photoCount: 0,
        videoCount: 0,
        modelCount: 0,
        achievementCount: 0,
        // Dark mode
        themeMode: 'auto', // 'auto' | 'light' | 'dark'
        themeAttr: '',
        // i18n
        i18n: {},
        currentLocale: 'zh-CN',
        showLocalePicker: false,
        availableLocales: [],
        // 开发者面板
        envName: '',
        envDesc: '',
        environments: [],
        showEnvPicker: false,
        selectedEnv: '',
    },
    onLoad: function () {
        try {
            var info = wx.getWindowInfo();
            this.setData({ safeTop: info.statusBarHeight || 44 });
        }
        catch (e) { }
        this.loadThemeMode();
        this.applyI18n();
        this.loadStats();
    },
    onShow: function () {
        this.loadEnvInfo();
        this.applyI18n();
    },
    // ========== 数据加载 ==========
    loadStats: function () {
        var _this = this;
        var token = '';
        try {
            token = wx.getStorageSync('baby_diary_access_token') || '';
        }
        catch (e) { }
        // 加载统计数据
        wx.request({
            url: api_1.API_CONFIG.baseURL + '/analytics/stats',
            method: 'GET',
            header: { 'Authorization': 'Bearer ' + token },
            timeout: 8000,
            success: function (res) {
                if (res.statusCode === 200 && res.data && res.data.data) {
                    var d = res.data.data;
                    _this.setData({
                        photoCount: d.photoCount || 0,
                        videoCount: d.videoCount || 0,
                        modelCount: d.modelCount || 0,
                        recordDays: d.recordDays || 0,
                    });
                }
            },
            fail: function () { },
        });
        // 加载成就
        wx.request({
            url: api_1.API_CONFIG.baseURL + '/analytics/achievements',
            method: 'GET',
            header: { 'Authorization': 'Bearer ' + token },
            timeout: 8000,
            success: function (res) {
                if (res.statusCode === 200 && res.data && res.data.data) {
                    var unlocked = (res.data.data.badges || []).filter(function (b) { return b.unlocked; });
                    _this.setData({ achievementCount: unlocked.length });
                }
            },
            fail: function () { },
        });
    },
    loadEnvInfo: function () {
        var currentEnv = config_service_1.configService.getCurrentEnv();
        var envName = config_service_1.configService.getCurrentEnvName();
        var envs = config_service_1.configService.getAvailableEnvs();
        this.setData({
            envName: envName || currentEnv,
            environments: envs,
            selectedEnv: currentEnv,
        });
    },
    // ========== 菜单导航 ==========
    onMenuTap: function (e) {
        var key = e.currentTarget.dataset.key;
        var routes = {
            baby_manage: '/pages/baby_list/baby_list',
            growth_compare: '',
            achievements: '',
            storage: '',
            share: '/pages/share_settings/share_settings',
            about: '/pages/about/about',
            export_data: '',
            export_report: '',
        };
        var url = routes[key];
        if (url) {
            wx.navigateTo({ url: url });
        }
        else if (key === 'export_data') {
            this.onExportData();
        }
        else if (key === 'export_report') {
            this.onExportReport();
        }
        else {
            wx.showToast({ title: '功能开发中', icon: 'none' });
        }
    },
    // ========== 环境切换（开发者面板） ==========
    onEnvSwitchTap: function () {
        this.loadEnvInfo();
        this.setData({ showEnvPicker: true });
    },
    onEnvPickerClose: function () {
        this.setData({ showEnvPicker: false });
    },
    onEnvSelect: function (e) {
        var env = e.currentTarget.dataset.env;
        this.setData({ selectedEnv: env });
    },
    onConfirmSwitch: function () {
        var env = this.data.selectedEnv;
        var _this = this;
        var success = config_service_1.configService.switchTo(env);
        if (!success) {
            wx.showToast({ title: '切换失败', icon: 'none' });
            return;
        }
        this.setData({ showEnvPicker: false });
        // 显示切换成功提示
        var envName = '';
        var envs = this.data.environments;
        for (var i = 0; i < envs.length; i++) {
            if (envs[i].key === env) {
                envName = envs[i].name;
                break;
            }
        }
        wx.showModal({
            title: '环境已切换',
            content: '当前环境：' + envName + '\n是否立即重启小程序使配置生效？',
            confirmText: '立即重启',
            cancelText: '稍后重启',
            success: function (res) {
                if (res.confirm) {
                    try {
                        wx.exitMiniProgram();
                    }
                    catch (e) {
                        wx.showToast({
                            title: '请手动关闭小程序重启',
                            icon: 'none',
                            duration: 3000,
                        });
                    }
                }
            },
        });
    },
    // ========== Dark Mode ==========
    loadThemeMode: function () {
        var mode = 'auto';
        try {
            mode = wx.getStorageSync('baby_diary_theme_mode') || 'auto';
        }
        catch (e) { }
        this.setData({ themeMode: mode });
        this.applyTheme(mode);
    },
    onThemeTap: function () {
        var modes = ['auto', 'light', 'dark'];
        var current = this.data.themeMode;
        var nextIndex = 0;
        for (var i = 0; i < modes.length; i++) {
            if (modes[i] === current) {
                nextIndex = (i + 1) % modes.length;
                break;
            }
        }
        var nextMode = modes[nextIndex];
        this.setData({ themeMode: nextMode });
        try {
            wx.setStorageSync('baby_diary_theme_mode', nextMode);
        }
        catch (e) { }
        this.applyTheme(nextMode);
    },
    applyTheme: function (mode) {
        var pages = getCurrentPages();
        var currentPage = pages[pages.length - 1];
        if (currentPage) {
            if (mode === 'dark') {
                currentPage.setData({ themeAttr: 'dark' });
            }
            else if (mode === 'light') {
                currentPage.setData({ themeAttr: 'light' });
            }
            else {
                // auto - remove manual override, let system preference take over
                currentPage.setData({ themeAttr: '' });
            }
        }
    },
    // ========== i18n (OPT-07) ==========
    applyI18n: function () {
        var i18nData = {
            title: (0, i18n_1.t)('settings.title'),
            photos: (0, i18n_1.t)('settings.photos'),
            videos: (0, i18n_1.t)('settings.videos'),
            models: (0, i18n_1.t)('settings.models'),
            babyManage: (0, i18n_1.t)('settings.babyManage'),
            babyManageDesc: (0, i18n_1.t)('settings.babyManageDesc'),
            growthCompare: (0, i18n_1.t)('settings.growthCompare'),
            growthCompareDesc: (0, i18n_1.t)('settings.growthCompareDesc'),
            achievements: (0, i18n_1.t)('settings.achievements'),
            achievementsDesc: (0, i18n_1.t)('settings.achievementsDesc'),
            storage: (0, i18n_1.t)('settings.storage'),
            storageDesc: (0, i18n_1.t)('settings.storageDesc'),
            share: (0, i18n_1.t)('settings.share'),
            shareDesc: (0, i18n_1.t)('settings.shareDesc'),
            about: (0, i18n_1.t)('settings.about'),
            aboutDesc: (0, i18n_1.t)('settings.aboutDesc'),
            theme: (0, i18n_1.t)('settings.theme'),
            exportData: (0, i18n_1.t)('settings.exportData'),
            exportDataDesc: (0, i18n_1.t)('settings.exportDataDesc'),
            exportReport: (0, i18n_1.t)('settings.exportReport'),
            exportReportDesc: (0, i18n_1.t)('settings.exportReportDesc'),
            devSettings: (0, i18n_1.t)('settings.devSettings'),
        };
        var currentLocale = (0, i18n_1.getLocale)();
        var availableLocales = (0, i18n_1.getAvailableLocales)();
        this.setData({
            i18n: i18nData,
            currentLocale: currentLocale,
            availableLocales: availableLocales,
        });
    },
    onLocaleTap: function () {
        this.setData({ showLocalePicker: true });
    },
    onLocalePickerClose: function () {
        this.setData({ showLocalePicker: false });
    },
    onLocaleSelect: function (e) {
        var locale = e.currentTarget.dataset.locale;
        var success = (0, i18n_1.setLocale)(locale);
        if (success) {
            this.setData({ showLocalePicker: false });
            this.applyI18n();
            wx.showToast({ title: locale === 'zh-CN' ? '已切换为中文' : 'Switched to English', icon: 'success' });
        }
    },
    // ========== Data Export (OPT-08) ==========
    onExportData: function () {
        var token = '';
        try {
            token = wx.getStorageSync('baby_diary_access_token') || '';
        }
        catch (e) { }
        if (!token) {
            wx.showToast({ title: '请先登录', icon: 'none' });
            return;
        }
        wx.showLoading({ title: '导出中...' });
        wx.request({
            url: api_1.API_CONFIG.baseURL + '/export/data',
            method: 'POST',
            header: { 'Authorization': 'Bearer ' + token },
            timeout: 30000,
            success: function (res) {
                wx.hideLoading();
                if (res.statusCode === 200 && res.data) {
                    // Save exported data to clipboard for now
                    var jsonStr = JSON.stringify(res.data, null, 2);
                    wx.setClipboardData({
                        data: jsonStr,
                        success: function () {
                            wx.showToast({ title: '数据已复制到剪贴板', icon: 'success', duration: 2000 });
                        },
                    });
                }
                else {
                    wx.showToast({ title: '导出失败', icon: 'none' });
                }
            },
            fail: function () {
                wx.hideLoading();
                wx.showToast({ title: '网络错误', icon: 'none' });
            },
        });
    },
    onExportReport: function () {
        var token = '';
        try {
            token = wx.getStorageSync('baby_diary_access_token') || '';
        }
        catch (e) { }
        if (!token) {
            wx.showToast({ title: '请先登录', icon: 'none' });
            return;
        }
        wx.showLoading({ title: '生成报告中...' });
        wx.request({
            url: api_1.API_CONFIG.baseURL + '/export/report',
            method: 'GET',
            header: { 'Authorization': 'Bearer ' + token },
            timeout: 30000,
            success: function (res) {
                wx.hideLoading();
                if (res.statusCode === 200 && res.data) {
                    var jsonStr = JSON.stringify(res.data, null, 2);
                    wx.setClipboardData({
                        data: jsonStr,
                        success: function () {
                            wx.showToast({ title: '报告已复制到剪贴板', icon: 'success', duration: 2000 });
                        },
                    });
                }
                else {
                    wx.showToast({ title: '生成失败', icon: 'none' });
                }
            },
            fail: function () {
                wx.hideLoading();
                wx.showToast({ title: '网络错误', icon: 'none' });
            },
        });
    },
});
