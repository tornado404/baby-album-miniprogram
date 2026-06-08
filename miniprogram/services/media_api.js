"use strict";
// services/media_api.ts - 媒体相关 API 调用
Object.defineProperty(exports, "__esModule", { value: true });
exports.mediaApi = void 0;
var request_1 = require("./request");
var mediaApi = {
    /**
     * 获取媒体列表（分页）
     */
    list: function (babyId, page) {
        return request_1.request.get('/media/', { babyId: babyId, page: page || 1 });
    },
    /**
     * 创建媒体记录（上传完成后调用）
     */
    create: function (data) {
        return request_1.request.post('/media/', data);
    },
    /**
     * 删除媒体
     */
    delete: function (mediaId) {
        return request_1.request.delete('/media/' + mediaId);
    },
    /**
     * 获取上传签名（STS 临时密钥）
     */
    getUploadSign: function (fileName, fileType, babyId) {
        return request_1.request.post('/upload/sign', {
            fileName: fileName,
            fileType: fileType,
            babyId: babyId,
        });
    },
};
exports.mediaApi = mediaApi;
exports.default = mediaApi;
