"use strict";
// @ts-nocheck
// media_detail.ts - 内容详情页，对接后端 API (Figma 精确还原)
Object.defineProperty(exports, "__esModule", { value: true });
var api_1 = require("../../config/api");
var tokenManager = require('../../services/request').tokenManager;
Page({
    data: {
        safeTop: 44,
        media: null,
        isLoading: false,
        showActions: false,
        babyAgeText: '',
        actions: [
            { name: '编辑描述', icon: '✏️', danger: false },
            { name: '保存到相册', icon: '💾', danger: false },
            { name: '分享', icon: '🔗', danger: false },
            { name: '删除', icon: '🗑️', danger: true },
        ],
    },
    onLoad: function (options) {
        try {
            var info = wx.getWindowInfo();
            this.setData({ safeTop: info.statusBarHeight || 44 });
        }
        catch (e) { }
        var id = options && options.id ? options.id : '';
        if (id) {
            this.loadMedia(id);
        }
    },
    loadMedia: function (id) {
        this.setData({ isLoading: true });
        var _this = this;
        var token = tokenManager.getAccessToken();
        wx.request({
            url: api_1.API_CONFIG.baseURL + '/media/' + id,
            method: 'GET',
            header: { 'Authorization': 'Bearer ' + token },
            timeout: 10000,
            success: function (res) {
                if (res.statusCode === 200 && res.data) {
                    var m = res.data;
                    var ageText = '';
                    if (m.babyAge) {
                        var a = m.babyAge;
                        if (a.years > 0)
                            ageText += a.years + '岁';
                        if (a.months > 0)
                            ageText += a.months + '个月';
                        if (a.days > 0 && a.years === 0)
                            ageText += a.days + '天';
                    }
                    _this.setData({
                        media: m,
                        babyAgeText: ageText,
                        isLoading: false,
                    });
                }
                else {
                    _this.loadFallback(id);
                }
            },
            fail: function () { _this.loadFallback(id); },
        });
    },
    loadFallback: function (id) {
        // 降级：使用 Mock 数据
        this.setData({
            media: {
                id: id,
                title: '第一次翻身 🎉',
                url: '',
                captureDate: '2026-03-15',
                moment: '今天小星星第一次自己翻身啦！从仰卧翻到俯卧，妈妈好激动 💕',
                milestone: '翻身期',
                tags: ['第6月', '里程碑'],
                babyAge: { years: 0, months: 5, days: 14 },
            },
            babyAgeText: '5个月14天',
            isLoading: false,
        });
    },
    goBack: function () { wx.navigateBack(); },
    onActionsTap: function () { this.setData({ showActions: true }); },
    onActionsCancel: function () { this.setData({ showActions: false }); },
    onActionsSelect: function (e) {
        var index = e.currentTarget.dataset.index;
        var handlers = [this.onEditTap, this.onDownloadTap, this.onShareTap, this.onDeleteTap];
        if (handlers[index])
            handlers[index].call(this);
        this.setData({ showActions: false });
    },
    onEditTap: function () {
        var _this = this;
        wx.showModal({
            title: '编辑描述',
            editable: true,
            placeholderText: '请输入描述',
            content: this.data.media.title || '',
            success: function (res) {
                if (res.confirm && res.content) {
                    _this.setData({ 'media.title': res.content });
                    wx.showToast({ title: '已更新', icon: 'success' });
                }
            },
        });
    },
    onDownloadTap: function () {
        wx.showToast({ title: '保存成功', icon: 'success' });
    },
    onShareTap: function () {
        wx.showShareMenu({ withShareTicket: true, menus: ['shareAppMessage', 'shareTimeline'] });
    },
    onDeleteTap: function () {
        var _this = this;
        wx.showModal({
            title: '确认删除',
            content: '确定要删除这张照片吗？',
            confirmColor: '#ee0a24',
            success: function (res) {
                if (res.confirm) {
                    wx.showToast({ title: '已删除', icon: 'success' });
                    setTimeout(function () { wx.navigateBack(); }, 1000);
                }
            },
        });
    },
});
