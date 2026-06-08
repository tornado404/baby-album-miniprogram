"use strict";
// services/baby_api.ts - 宝宝相关 API 调用
Object.defineProperty(exports, "__esModule", { value: true });
exports.babyApi = void 0;
var request_1 = require("./request");
var babyApi = {
    /**
     * 获取宝宝列表
     */
    list: function () {
        return request_1.request.get('/babies/');
    },
    /**
     * 获取单个宝宝详情
     */
    get: function (babyId) {
        return request_1.request.get('/babies/' + babyId);
    },
    /**
     * 创建宝宝
     */
    create: function (data) {
        return request_1.request.post('/babies/', data);
    },
    /**
     * 更新宝宝信息
     */
    update: function (babyId, data) {
        return request_1.request.put('/babies/' + babyId, data);
    },
    /**
     * 删除宝宝
     */
    delete: function (babyId) {
        return request_1.request.delete('/babies/' + babyId);
    },
};
exports.babyApi = babyApi;
exports.default = babyApi;
