"use strict";
// media_service.ts - 媒体服务
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.mediaService = void 0;
var storage_service_1 = require("./storage_service");
var age_calculator_1 = require("../utils/age_calculator");
/**
 * 媒体服务类
 */
var MediaService = /** @class */ (function () {
    function MediaService() {
    }
    /**
     * 获取媒体列表（带计算月龄）
     * @param query 查询参数，支持 minAge/maxAge 月龄筛选
     * @param babyBirthDate 宝宝出生日期，用于计算月龄
     */
    MediaService.prototype.getMediaListWithAge = function (query, babyBirthDate) {
        return __awaiter(this, void 0, void 0, function () {
            var mediaList;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, storage_service_1.storageService.getMediaList(query, babyBirthDate)];
                    case 1:
                        mediaList = _a.sent();
                        // 为每个媒体添加月龄信息
                        if (babyBirthDate) {
                            return [2 /*return*/, mediaList.map(function (media) { return (__assign(__assign({}, media), { babyAge: (0, age_calculator_1.calculateBabyAge)(babyBirthDate, media.captureDate) })); })];
                        }
                        return [2 /*return*/, mediaList];
                }
            });
        });
    };
    /**
     * 上传媒体
     */
    MediaService.prototype.uploadMedia = function (input) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, storage_service_1.storageService.createMedia(input)];
            });
        });
    };
    /**
     * 删除媒体
     */
    MediaService.prototype.deleteMedia = function (id) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, storage_service_1.storageService.deleteMedia(id)];
            });
        });
    };
    /**
     * 更新媒体
     */
    MediaService.prototype.updateMedia = function (id, input) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, storage_service_1.storageService.updateMedia(id, input)];
            });
        });
    };
    /**
     * 获取媒体详情
     */
    MediaService.prototype.getMediaDetail = function (id, babyBirthDate) {
        return __awaiter(this, void 0, void 0, function () {
            var media;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, storage_service_1.storageService.getMedia(id)];
                    case 1:
                        media = _a.sent();
                        if (media && babyBirthDate) {
                            return [2 /*return*/, __assign(__assign({}, media), { babyAge: (0, age_calculator_1.calculateBabyAge)(babyBirthDate, media.captureDate) })];
                        }
                        return [2 /*return*/, media];
                }
            });
        });
    };
    return MediaService;
}());
exports.mediaService = new MediaService();
