"use strict";
// mock_cloud_service.ts - Mock 云存储服务
// 模拟 wx.cloud / COS 的上传下载行为，所有数据存储在本地
Object.defineProperty(exports, "__esModule", { value: true });
exports.mockCloudService = void 0;
var MockCloudService = /** @class */ (function () {
    function MockCloudService() {
        this.files = [];
        this.counter = 0;
    }
    /**
     * 模拟上传文件到云存储
     */
    MockCloudService.prototype.uploadFile = function (filePath, options) {
        var _this = this;
        return new Promise(function (resolve) {
            _this.counter++;
            var fileId = 'mock_cloud_' + Date.now() + '_' + _this.counter;
            var mockFile = {
                fileId: fileId,
                name: (options === null || options === void 0 ? void 0 : options.name) || 'photo_' + _this.counter + '.jpg',
                size: Math.floor(Math.random() * 5000000) + 100000,
                type: 'image/jpeg',
                createdAt: new Date().toISOString(),
                tempUrl: '' // Will be set below
            };
            mockFile.tempUrl = 'https://mock-cloud.example.com/' + fileId + '.jpg';
            _this.files.push(mockFile);
            wx.showToast({ title: '上传成功(mock)', icon: 'success', duration: 1000 });
            resolve({ fileId: fileId, url: mockFile.tempUrl });
        });
    };
    /**
     * 模拟获取文件临时 URL
     */
    MockCloudService.prototype.getTempUrl = function (fileId) {
        var _this = this;
        return new Promise(function (resolve) {
            for (var i = 0; i < _this.files.length; i++) {
                if (_this.files[i].fileId === fileId) {
                    resolve(_this.files[i].tempUrl);
                    return;
                }
            }
            resolve('https://mock-cloud.example.com/default.jpg');
        });
    };
    /**
     * 模拟删除云存储文件
     */
    MockCloudService.prototype.deleteFile = function (fileId) {
        var _this = this;
        return new Promise(function (resolve) {
            var filtered = [];
            for (var i = 0; i < _this.files.length; i++) {
                if (_this.files[i].fileId !== fileId) {
                    filtered.push(_this.files[i]);
                }
            }
            _this.files = filtered;
            resolve();
        });
    };
    return MockCloudService;
}());
exports.mockCloudService = new MockCloudService();
