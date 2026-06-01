"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
// @ts-nocheck
// media_uploader.ts - 媒体上传组件
var image_utils_1 = require("../../utils/image_utils");
var storage_service_1 = require("../../services/storage_service");
Component({
    properties: {
        visible: {
            type: Boolean,
            value: false
        },
        babyId: {
            type: String,
            value: ''
        },
        maxCount: {
            type: Number,
            value: 9
        }
    },
    data: {
        fileList: [],
        uploadLoading: false,
        captureDate: '',
        title: '',
        fabMenuVisible: false,
        uploadProgress: 0
    },
    lifetimes: {
        attached: function () {
            // 组件创建
        },
        detached: function () {
            // 组件销毁时清理临时文件
            this.cleanupTempFiles();
        }
    },
    methods: {
        onClose: function () {
            this.resetForm();
            this.triggerEvent('close');
        },
        onSelectTap: function () {
            return __awaiter(this, void 0, void 0, function () {
                var remainingCount, files, newFiles, error_1;
                var _this = this;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            _a.trys.push([0, 2, , 3]);
                            remainingCount = this.properties.maxCount - this.data.fileList.length;
                            if (remainingCount <= 0) {
                                wx.showToast({ title: "\u6700\u591A\u4E0A\u4F20".concat(this.properties.maxCount, "\u5F20"), icon: 'none' });
                                return [2 /*return*/];
                            }
                            return [4 /*yield*/, (0, image_utils_1.chooseMedia)(remainingCount, 'image')];
                        case 1:
                            files = _a.sent();
                            newFiles = files.map(function (file, index) { return ({
                                url: file.tempFilePath,
                                name: file.tempFilePath.split('/').pop() || 'image',
                                status: 'pending',
                                index: _this.data.fileList.length + index,
                                retryCount: 0
                            }); });
                            this.setData({
                                fileList: __spreadArray(__spreadArray([], this.data.fileList, true), newFiles, true)
                            });
                            return [3 /*break*/, 3];
                        case 2:
                            error_1 = _a.sent();
                            console.error('选择图片失败:', error_1);
                            return [3 /*break*/, 3];
                        case 3: return [2 /*return*/];
                    }
                });
            });
        },
        toggleFabMenu: function () {
            this.setData({ fabMenuVisible: !this.data.fabMenuVisible });
        },
        onFabMenuClose: function () {
            this.setData({ fabMenuVisible: false });
        },
        onFabCameraTap: function () {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            this.setData({ fabMenuVisible: false });
                            return [4 /*yield*/, this.onSelectTap('camera')];
                        case 1:
                            _a.sent();
                            return [2 /*return*/];
                    }
                });
            });
        },
        onFabAlbumTap: function () {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            this.setData({ fabMenuVisible: false });
                            return [4 /*yield*/, this.onSelectTap('album')];
                        case 1:
                            _a.sent();
                            return [2 /*return*/];
                    }
                });
            });
        },
        // van-uploader 的 after-read 回调（兼容处理，不影响自有选择逻辑）
        onAfterRead: function (event) {
            // 由 van-uploader 自行处理，此处仅为兼容绑定
            console.log('van-uploader after-read:', event.detail);
        },
        onDeleteItem: function (event) {
            var index = event.detail.index;
            var fileToDelete = this.data.fileList[index];
            if (fileToDelete) {
                // 清理单个临时文件
                this.deleteTempFile(fileToDelete.url);
            }
            var newFileList = this.data.fileList.filter(function (_, i) { return i !== index; });
            this.setData({
                fileList: newFileList.map(function (item, i) { return (__assign(__assign({}, item), { index: i })); })
            });
        },
        onDateChange: function () {
            var now = new Date();
            var dateStr = "".concat(now.getFullYear(), "-").concat(String(now.getMonth() + 1).padStart(2, '0'), "-").concat(String(now.getDate()).padStart(2, '0'));
            this.setData({ captureDate: dateStr });
        },
        onTitleInput: function (event) {
            this.setData({ title: event.detail });
        },
        onConfirm: function () {
            return __awaiter(this, void 0, void 0, function () {
                var _a, fileList, captureDate, title, uploadLoading, successCount, failCount, _i, fileList_1, file, compressedPath, error_2;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0:
                            _a = this.data, fileList = _a.fileList, captureDate = _a.captureDate, title = _a.title, uploadLoading = _a.uploadLoading;
                            if (uploadLoading)
                                return [2 /*return*/];
                            if (fileList.length === 0) {
                                wx.showToast({ title: '请选择图片', icon: 'none' });
                                return [2 /*return*/];
                            }
                            this.setData({ uploadLoading: true });
                            successCount = 0;
                            failCount = 0;
                            _i = 0, fileList_1 = fileList;
                            _b.label = 1;
                        case 1:
                            if (!(_i < fileList_1.length)) return [3 /*break*/, 7];
                            file = fileList_1[_i];
                            if (file.status === 'success')
                                return [3 /*break*/, 6];
                            _b.label = 2;
                        case 2:
                            _b.trys.push([2, 5, , 6]);
                            // 更新状态为上传中
                            this.updateFileStatus(file.index, 'uploading');
                            return [4 /*yield*/, (0, image_utils_1.compressImage)(file.url, 80, 1920)];
                        case 3:
                            compressedPath = _b.sent();
                            // 保存到存储服务
                            return [4 /*yield*/, storage_service_1.storageService.createMedia({
                                    babyId: this.properties.babyId,
                                    type: 'photo',
                                    url: compressedPath,
                                    size: 0,
                                    captureDate: captureDate || new Date().toISOString().split('T')[0],
                                    title: title
                                })];
                        case 4:
                            // 保存到存储服务
                            _b.sent();
                            // 更新状态为成功
                            this.updateFileStatus(file.index, 'success');
                            successCount++;
                            return [3 /*break*/, 6];
                        case 5:
                            error_2 = _b.sent();
                            console.error('上传失败:', error_2);
                            // 重试逻辑：最多重试3次
                            if (file.retryCount < 3) {
                                file.retryCount++;
                                file.status = 'pending';
                                this.setData({ fileList: __spreadArray([], this.data.fileList, true) });
                            }
                            else {
                                this.updateFileStatus(file.index, 'failed');
                                failCount++;
                            }
                            return [3 /*break*/, 6];
                        case 6:
                            _i++;
                            return [3 /*break*/, 1];
                        case 7:
                            this.setData({ uploadLoading: false });
                            if (failCount > 0) {
                                wx.showToast({
                                    title: "".concat(successCount, "\u5F20\u6210\u529F\uFF0C").concat(failCount, "\u5F20\u5931\u8D25"),
                                    icon: 'none'
                                });
                            }
                            else {
                                wx.showToast({ title: '上传成功', icon: 'success' });
                                this.resetForm();
                                this.triggerEvent('success');
                                this.triggerEvent('close');
                            }
                            return [2 /*return*/];
                    }
                });
            });
        },
        onCancel: function () {
            this.resetForm();
            this.triggerEvent('close');
        },
        resetForm: function () {
            // 先清理临时文件
            this.cleanupTempFiles();
            this.setData({
                fileList: [],
                uploadLoading: false,
                captureDate: '',
                title: ''
            });
        },
        updateFileStatus: function (index, status) {
            var newFileList = this.data.fileList.map(function (item, i) {
                return i === index ? __assign(__assign({}, item), { status: status }) : item;
            });
            this.setData({ fileList: newFileList });
        },
        cleanupTempFiles: function () {
            var _this = this;
            // 清理所有临时文件
            this.data.fileList.forEach(function (file) {
                _this.deleteTempFile(file.url);
            });
        },
        deleteTempFile: function (filePath) {
            if (filePath && filePath.startsWith('http://tmp') || filePath.startsWith('wxfile://')) {
                wx.getFileSystemManager().unlink({
                    filePath: filePath,
                    fail: function () { }
                });
            }
        }
    }
});
