"use strict";
// baby_profile.ts - 宝宝档案编辑页面
// Claymorphism 设计风格
Page({
    data: {
        safeTop: 44,
        nickname: '小星星',
        gender: 'female',
        birthDate: '2025-12-01',
        dueDate: '2025-11-24',
        birthDateArray: [],
        dueDateArray: [],
        weight: '7.2',
        height: '65'
    },
    onLoad: function () {
        var sysInfo = wx.getSystemInfoSync();
        this.setData({ safeTop: sysInfo.statusBarHeight || 44 });
        // 初始化日期数组
        if (this.data.birthDate) {
            this.setData({ birthDateArray: this.dateToArray(this.data.birthDate) });
        }
        if (this.data.dueDate) {
            this.setData({ dueDateArray: this.dateToArray(this.data.dueDate) });
        }
    },
    dateToArray: function (dateStr) {
        var parts = dateStr.split('-');
        return parts.map(function (p) { return parseInt(p); });
    },
    arrayToDate: function (arr) {
        return arr.map(function (n) { return String(n).padStart(2, '0'); }).join('-');
    },
    onBack: function () {
        wx.navigateBack();
    },
    onSave: function () {
        wx.showToast({ title: '保存成功', icon: 'success' });
        wx.navigateBack();
    },
    onNicknameInput: function (e) {
        this.setData({ nickname: e.detail.value });
    },
    onGenderSelect: function (e) {
        var gender = e.currentTarget.dataset.gender;
        this.setData({ gender: gender });
    },
    onBirthDateChange: function (e) {
        var val = e.detail.value;
        var dateStr = this.arrayToDate(val);
        this.setData({ birthDate: dateStr, birthDateArray: val });
    },
    onDueDateChange: function (e) {
        var val = e.detail.value;
        var dateStr = this.arrayToDate(val);
        this.setData({ dueDate: dateStr, dueDateArray: val });
    },
    onWeightMinus: function () {
        var w = parseFloat(this.data.weight) - 0.1;
        if (w >= 0)
            this.setData({ weight: w.toFixed(1) });
    },
    onWeightPlus: function () {
        var w = parseFloat(this.data.weight) + 0.1;
        this.setData({ weight: w.toFixed(1) });
    },
    onHeightMinus: function () {
        var h = parseInt(this.data.height) - 1;
        if (h >= 0)
            this.setData({ height: String(h) });
    },
    onHeightPlus: function () {
        var h = parseInt(this.data.height) + 1;
        this.setData({ height: String(h) });
    }
});
