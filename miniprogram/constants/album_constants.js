"use strict";
// album_constants.ts - 相册相关常量
Object.defineProperty(exports, "__esModule", { value: true });
exports.AGE_FILTER_OPTIONS = exports.DEFAULT_PAGE_SIZE = exports.IMAGE_COMPRESS_QUALITY = exports.MAX_IMAGE_WIDTH = exports.DEFAULT_ITEM_GAP = exports.DEFAULT_COLUMN_GAP = exports.DEFAULT_COLUMN_COUNT = exports.MediaType = exports.ViewMode = void 0;
/**
 * 相册视图模式
 */
var ViewMode;
(function (ViewMode) {
    ViewMode["Timeline"] = "timeline";
    ViewMode["Masonry"] = "masonry";
})(ViewMode || (exports.ViewMode = ViewMode = {}));
/**
 * 媒体类型
 */
var MediaType;
(function (MediaType) {
    MediaType["Photo"] = "photo";
    MediaType["Video"] = "video";
})(MediaType || (exports.MediaType = MediaType = {}));
/**
 * 默认列数
 */
exports.DEFAULT_COLUMN_COUNT = 2;
/**
 * 列间距
 */
exports.DEFAULT_COLUMN_GAP = 8;
/**
 * 项间距
 */
exports.DEFAULT_ITEM_GAP = 8;
/**
 * 图片最大宽度
 */
exports.MAX_IMAGE_WIDTH = 1920;
/**
 * 图片压缩质量
 */
exports.IMAGE_COMPRESS_QUALITY = 80;
/**
 * 每页加载数量
 */
exports.DEFAULT_PAGE_SIZE = 20;
/**
 * 月龄快捷筛选选项
 */
exports.AGE_FILTER_OPTIONS = [
    { label: '全部', value: null },
    { label: '0-3月', value: 3, minAge: 0, maxAge: 3 },
    { label: '3-6月', value: 6, minAge: 3, maxAge: 6 },
    { label: '6-12月', value: 12, minAge: 6, maxAge: 12 },
    { label: '1-2岁', value: 24, minAge: 12, maxAge: 24 },
    { label: '2岁以上', value: -1, minAge: 24, maxAge: Infinity }
];
