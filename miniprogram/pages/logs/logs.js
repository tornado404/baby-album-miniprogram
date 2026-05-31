"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// @ts-nocheck
// logs.ts
// const util = require('../../utils/util.js')
var util_1 = require("../../utils/util");
Component({
    data: {
        logs: [],
    },
    lifetimes: {
        attached: function () {
            this.setData({
                logs: (wx.getStorageSync('logs') || []).map(function (log) {
                    return {
                        date: (0, util_1.formatTime)(new Date(log)),
                        timeStamp: log
                    };
                }),
            });
        }
    },
});
