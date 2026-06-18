"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// growth_compare.ts - 成长对比页
var api_1 = require("../../config/api");
Page({
    data: {
        safeTop: 44,
        milestones: [],
        currentMilestoneIndex: 0,
        currentMilestone: null,
        latestPhoto: null,
        hasData: false,
        i18n: {
            title: '成长对比',
            photos: '张照片',
            empty: '暂无对比数据',
            emptyHint: '为照片标记里程碑后来查看吧',
            years: '岁',
            months: '月',
            days: '天',
        },
    },
    onLoad: function (options) {
        try {
            var info = wx.getWindowInfo();
            this.setData({ safeTop: info.statusBarHeight || 44 });
        }
        catch (e) { }
        // 获取当前选中的宝宝 ID
        var babyId = '';
        try {
            babyId = wx.getStorageSync('baby_diary_current_baby_id') || '';
        }
        catch (e) { }
        if (babyId) {
            this.loadGrowthCompare(babyId);
        }
        else {
            // 尝试获取宝宝列表，取第一个
            this.loadFirstBaby();
        }
    },
    loadFirstBaby: function () {
        var _this = this;
        var token = '';
        try {
            token = wx.getStorageSync('baby_diary_access_token') || '';
        }
        catch (e) { }
        if (!token)
            return;
        wx.request({
            url: api_1.API_CONFIG.baseURL + '/babies/',
            method: 'GET',
            header: { 'Authorization': 'Bearer ' + token },
            timeout: 8000,
            success: function (res) {
                if (res.statusCode === 200 && res.data && res.data.length > 0) {
                    var babyId = res.data[0].id;
                    try {
                        wx.setStorageSync('baby_diary_current_baby_id', babyId);
                    }
                    catch (e) { }
                    _this.loadGrowthCompare(babyId);
                }
            },
            fail: function () { },
        });
    },
    loadGrowthCompare: function (babyId) {
        var _this = this;
        var token = '';
        try {
            token = wx.getStorageSync('baby_diary_access_token') || '';
        }
        catch (e) { }
        if (!token) {
            return;
        }
        wx.request({
            url: api_1.API_CONFIG.baseURL + '/analytics/growth-compare?baby_id=' + babyId,
            method: 'GET',
            header: { 'Authorization': 'Bearer ' + token },
            timeout: 10000,
            success: function (res) {
                if (res.statusCode === 200 && res.data && res.data.data) {
                    var d = res.data.data;
                    var milestones = d.milestones || [];
                    var hasData = milestones.length > 0 && d.latestPhoto != null;
                    _this.setData({
                        milestones: milestones,
                        latestPhoto: d.latestPhoto,
                        hasData: hasData,
                        currentMilestoneIndex: 0,
                        currentMilestone: milestones.length > 0 ? milestones[0] : null,
                    });
                }
            },
            fail: function () {
                wx.showToast({ title: '网络错误', icon: 'none' });
            },
        });
    },
    onMilestoneTap: function (e) {
        var index = parseInt(e.currentTarget.dataset.index, 10);
        if (index >= 0 && index < this.data.milestones.length) {
            this.setData({
                currentMilestoneIndex: index,
                currentMilestone: this.data.milestones[index],
            });
        }
    },
    goBack: function () {
        wx.navigateBack({ delta: 1 });
    },
});
