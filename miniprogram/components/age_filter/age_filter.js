"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// @ts-nocheck
// age_filter.ts - 月龄筛选组件
var age_calculator_1 = require("../../utils/age_calculator");
Component({
    properties: {
        babyId: {
            type: String,
            value: ''
        },
        birthDate: {
            type: String,
            value: ''
        },
        value: {
            type: Number,
            value: null
        }
    },
    data: {
        currentAge: null,
        selectedValue: null,
        quickOptions: [
            { label: '全部', value: null },
            { label: '0-3月', value: 3, minAge: 0, maxAge: 3 },
            { label: '3-6月', value: 6, minAge: 3, maxAge: 6 },
            { label: '6-12月', value: 12, minAge: 6, maxAge: 12 },
            { label: '1-2岁', value: 24, minAge: 12, maxAge: 24 },
            { label: '2岁以上', value: -1, minAge: 24, maxAge: -1 }
        ],
        customVisible: false,
        customMin: 0,
        customMax: 36
    },
    lifetimes: {
        attached: function () {
            this.calculateCurrentAge();
            this.setData({ selectedValue: this.properties.value });
        }
    },
    observers: {
        'birthDate': function () {
            this.calculateCurrentAge();
        },
        'value': function (newVal) {
            this.setData({ selectedValue: newVal });
        }
    },
    methods: {
        calculateCurrentAge: function () {
            var birthDate = this.properties.birthDate;
            if (!birthDate) {
                this.setData({ currentAge: null });
                return;
            }
            var age = (0, age_calculator_1.calculateBabyAge)(birthDate);
            this.setData({ currentAge: age });
        },
        onQuickSelect: function (event) {
            var value = event.currentTarget.dataset.value;
            var option = this.data.quickOptions.find(function (o) { return o.value === value; });
            this.setData({ selectedValue: value });
            this.triggerEvent('change', {
                value: value,
                minAge: option ? option.minAge : null,
                maxAge: option ? option.maxAge : null
            });
        },
        onCustomTap: function () {
            this.setData({ customVisible: true });
        },
        onCustomCancel: function () {
            this.setData({ customVisible: false });
        },
        onCustomConfirm: function () {
            var _a = this.data, customMin = _a.customMin, customMax = _a.customMax;
            this.setData({
                customVisible: false,
                selectedValue: customMax
            });
            this.triggerEvent('change', {
                value: customMax,
                minAge: customMin,
                maxAge: customMax
            });
        },
        onMinChange: function (event) {
            this.setData({ customMin: event.detail.value });
        },
        onMaxChange: function (event) {
            this.setData({ customMax: event.detail.value });
        },
        formatAgeLabel: function (age) {
            return (0, age_calculator_1.formatAge)(age);
        }
    }
});
