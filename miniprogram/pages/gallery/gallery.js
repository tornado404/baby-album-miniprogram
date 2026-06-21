"use strict";
// @ts-nocheck
// gallery.ts - 素材库页面
Object.defineProperty(exports, "__esModule", { value: true });
var api_1 = require("../../config/api");
var tokenManager = require('../../services/request').tokenManager;
Page({
    data: {
        safeTop: 44,
        isLoading: false,
        mediaList: [],
        page: 1,
        hasMore: true,
        filterIndex: 0,
        filters: ['全部', '未归档', '已归档'],
        selectMode: false,
        selectedIds: [],
        allSelected: false,
        _firstShow: true,
    },
    onLoad: function () {
        try {
            var info = wx.getWindowInfo();
            this.setData({ safeTop: info.statusBarHeight || 44 });
        }
        catch (e) { }
        this.loadMedia();
    },
    onShow: function () {
        if (this.data._firstShow) {
            this.data._firstShow = false;
            return;
        }
        this.loadMedia();
    },
    getToken: function () {
        return tokenManager.getAccessToken();
    },
    loadMedia: function () {
        this.setData({ isLoading: true });
        var _this = this;
        var token = this.getToken();
        var filterIdx = this.data.filterIndex;
        var babyId = '';
        try {
            babyId = wx.getStorageSync('baby_diary_current_baby_id') || '';
        }
        catch (e) { }
        if (!babyId || !token) {
            this.loadFallback();
            return;
        }
        var params = { babyId: babyId, page: this.data.page };
        if (filterIdx === 2)
            params['archived'] = 'true';
        else if (filterIdx === 1)
            params['archived'] = 'false';
        wx.request({
            url: api_1.API_CONFIG.baseURL + '/media/',
            method: 'GET',
            data: params,
            header: { 'Authorization': 'Bearer ' + token },
            success: function (res) {
                if (res.statusCode === 200 && Array.isArray(res.data)) {
                    _this.setData({ mediaList: res.data, isLoading: false, hasMore: res.data.length >= 20 });
                }
                else {
                    _this.loadFallback();
                }
            },
            fail: function () { _this.loadFallback(); },
        });
    },
    loadFallback: function () {
        var list = [];
        try {
            var c = wx.getStorageSync('album_media');
            if (Array.isArray(c))
                list = c;
        }
        catch (e) { }
        if (list.length === 0) {
            list = [
                { id: 'm1', title: '北京公园', type: 'image', locationName: '📍 北京', tags: ['外出'], captureDate: '2026-06-01', cardColor: 'pink' },
                { id: 'm2', title: '第一次翻身', type: 'image', locationName: '📍 家里', tags: ['里程碑'], moment: '翻身啦 🎉', captureDate: '2026-05-15', cardColor: 'blue' },
            ];
        }
        this.setData({ mediaList: list, isLoading: false });
    },
    onFilterTap: function (e) {
        var idx = parseInt(e.currentTarget.dataset.index);
        this.setData({ filterIndex: idx, mediaList: [], page: 1 }, function () { this.loadMedia(); });
    },
    onMediaTap: function (e) {
        if (this.data.selectMode) {
            this.toggleSelect(e);
            return;
        }
        var id = e.currentTarget.dataset.id;
        wx.navigateTo({ url: '/pages/media_detail/media_detail?id=' + id });
    },
    onLongPress: function (e) {
        var id = e.currentTarget.dataset.id;
        this.setData({ selectMode: true, selectedIds: [id] });
    },
    toggleSelect: function (e) {
        var id = e.currentTarget.dataset.id;
        var selected = this.data.selectedIds.slice();
        var idx = selected.indexOf(id);
        if (idx >= 0)
            selected.splice(idx, 1);
        else
            selected.push(id);
        this.setData({ selectedIds: selected, allSelected: false });
    },
    onSelectAll: function () {
        var all = this.data.mediaList.map(function (m) { return m.id; });
        this.setData({
            selectedIds: this.data.allSelected ? [] : all,
            allSelected: !this.data.allSelected,
        });
    },
    onBatchArchive: function () {
        var ids = this.data.selectedIds;
        if (ids.length === 0) {
            wx.showToast({ title: '请先选择照片', icon: 'none' });
            return;
        }
        var _this = this;
        wx.request({
            url: api_1.API_CONFIG.baseURL + '/media/batch-archive',
            method: 'PUT',
            header: { 'Authorization': 'Bearer ' + this.getToken(), 'Content-Type': 'application/json' },
            data: { ids: ids, archived: true },
            success: function () {
                wx.showToast({ title: '已归档 ' + ids.length + ' 项', icon: 'success' });
                _this.exitSelectMode();
                _this.loadMedia();
            },
            fail: function () { wx.showToast({ title: '归档失败', icon: 'none' }); },
        });
    },
    onBatchTag: function () {
        wx.showToast({ title: '批量标签-功能开发中', icon: 'none' });
    },
    onBatchDelete: function () {
        var ids = this.data.selectedIds;
        if (ids.length === 0)
            return;
        var _this = this;
        wx.showModal({
            title: '确认删除', content: '确定要删除选中的 ' + ids.length + ' 项吗？',
            success: function (r) {
                if (!r.confirm)
                    return;
                var token = _this.getToken();
                var done = 0;
                for (var i = 0; i < ids.length; i++) {
                    wx.request({
                        url: api_1.API_CONFIG.baseURL + '/media/' + ids[i],
                        method: 'DELETE',
                        header: { 'Authorization': 'Bearer ' + token },
                        success: function () { done++; if (done >= ids.length) {
                            wx.showToast({ title: '已删除', icon: 'success' });
                            _this.exitSelectMode();
                            _this.loadMedia();
                        } },
                        fail: function () { done++; },
                    });
                }
            },
        });
    },
    onCancelSelect: function () { this.exitSelectMode(); },
    exitSelectMode: function () {
        this.setData({ selectMode: false, selectedIds: [], allSelected: false });
    },
});
