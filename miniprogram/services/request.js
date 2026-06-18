"use strict";
// services/request.ts - API HTTP 请求封装
// 统一鉴权 / Token 刷新 / 错误处理 / 离线降级
Object.defineProperty(exports, "__esModule", { value: true });
exports.tokenManager = exports.request = void 0;
var api_1 = require("../config/api");
// Token 存储键名
var ACCESS_TOKEN_KEY = 'baby_diary_access_token';
var REFRESH_TOKEN_KEY = 'baby_diary_refresh_token';
var USER_ID_KEY = 'baby_diary_user_id';
// 是否正在刷新 token（防止并发刷新）
var isRefreshing = false;
var refreshQueue = [];
/**
 * 获取存储的 accessToken
 */
function getAccessToken() {
    try {
        return wx.getStorageSync(ACCESS_TOKEN_KEY) || '';
    }
    catch (e) {
        return '';
    }
}
/**
 * 获取存储的 refreshToken
 */
function getRefreshToken() {
    try {
        return wx.getStorageSync(REFRESH_TOKEN_KEY) || '';
    }
    catch (e) {
        return '';
    }
}
/**
 * 保存 token
 */
function saveTokens(accessToken, refreshToken, userId) {
    try {
        wx.setStorageSync(ACCESS_TOKEN_KEY, accessToken);
        wx.setStorageSync(REFRESH_TOKEN_KEY, refreshToken);
        if (userId) {
            wx.setStorageSync(USER_ID_KEY, userId);
        }
    }
    catch (e) { }
}
/**
 * 清除 token（登录失效时调用）
 */
function clearTokens() {
    try {
        wx.removeStorageSync(ACCESS_TOKEN_KEY);
        wx.removeStorageSync(REFRESH_TOKEN_KEY);
        wx.removeStorageSync(USER_ID_KEY);
        wx.removeStorageSync('baby_diary_authed');
        wx.removeStorageSync('baby_diary_baby_profile');
        wx.removeStorageSync('album_babies');
        wx.removeStorageSync('baby_diary_current_baby_id');
    }
    catch (e) { }
}
/**
 * 刷新 accessToken
 */
function refreshAccessToken() {
    return new Promise(function (resolve, reject) {
        // 如果已在刷新，排队等待
        if (isRefreshing) {
            refreshQueue.push({ resolve: resolve, reject: reject });
            return;
        }
        isRefreshing = true;
        var refreshToken = getRefreshToken();
        if (!refreshToken) {
            isRefreshing = false;
            clearTokens();
            reject(new Error('No refresh token'));
            return;
        }
        wx.request({
            url: api_1.API_CONFIG.baseURL + '/auth/refresh',
            method: 'POST',
            data: { refreshToken: refreshToken },
            timeout: api_1.API_CONFIG.timeout,
            success: function (res) {
                isRefreshing = false;
                if (res.statusCode === 200 && res.data && res.data.accessToken) {
                    saveTokens(res.data.accessToken, res.data.refreshToken || refreshToken);
                    // 处理排队中的请求
                    refreshQueue.forEach(function (item) { item.resolve(res.data.accessToken); });
                    refreshQueue = [];
                    resolve(res.data.accessToken);
                }
                else {
                    clearTokens();
                    refreshQueue.forEach(function (item) { item.reject(new Error('Refresh failed')); });
                    refreshQueue = [];
                    reject(new Error('Refresh failed'));
                }
            },
            fail: function () {
                isRefreshing = false;
                clearTokens();
                refreshQueue.forEach(function (item) { item.reject(new Error('Network error')); });
                refreshQueue = [];
                reject(new Error('Network error'));
            },
        });
    });
}
/**
 * 核心 API 调用
 */
function apiCall(method, url, opts) {
    return new Promise(function (resolve, reject) {
        var token = getAccessToken();
        var header = {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
        };
        if (token) {
            header['Authorization'] = 'Bearer ' + token;
        }
        var fullUrl = url.startsWith('http') ? url : api_1.API_CONFIG.baseURL + url;
        wx.request({
            url: fullUrl,
            method: method,
            data: opts.data,
            header: header,
            timeout: api_1.API_CONFIG.timeout,
            success: function (res) {
                // token 过期，尝试刷新
                if (res.statusCode === 401) {
                    refreshAccessToken().then(function (newToken) {
                        // 刷新成功，重放原请求
                        header['Authorization'] = 'Bearer ' + newToken;
                        wx.request({
                            url: fullUrl,
                            method: method,
                            data: opts.data,
                            header: header,
                            timeout: api_1.API_CONFIG.timeout,
                            success: function (retryRes) {
                                if (retryRes.statusCode >= 200 && retryRes.statusCode < 300) {
                                    resolve(retryRes.data);
                                }
                                else {
                                    reject({ status: retryRes.statusCode, data: retryRes.data });
                                }
                            },
                            fail: function (retryErr) {
                                reject(retryErr);
                            },
                        });
                    }).catch(function () {
                        // 刷新失败，跳转登录
                        clearTokens();
                        wx.redirectTo({ url: '/pages/index/index' });
                        reject(new Error('Session expired'));
                    });
                    return;
                }
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    resolve(res.data);
                }
                else {
                    reject({ status: res.statusCode, data: res.data });
                }
            },
            fail: function (err) {
                // 网络错误，尝试本地缓存（调用方处理）
                reject({ status: 0, data: null, message: 'Network error', raw: err });
            },
        });
    });
}
/**
 * 导出请求方法
 */
exports.request = {
    get: function (url, params) {
        // 将 params 拼接到 URL
        var fullUrl = url;
        if (params) {
            var qs = [];
            for (var key in params) {
                if (params.hasOwnProperty(key)) {
                    qs.push(encodeURIComponent(key) + '=' + encodeURIComponent(params[key]));
                }
            }
            if (qs.length > 0) {
                fullUrl += (url.indexOf('?') === -1 ? '?' : '&') + qs.join('&');
            }
        }
        return apiCall('GET', fullUrl, {});
    },
    post: function (url, data) {
        return apiCall('POST', url, { data: data });
    },
    put: function (url, data) {
        return apiCall('PUT', url, { data: data });
    },
    delete: function (url) {
        return apiCall('DELETE', url, {});
    },
};
/**
 * 导出 token 管理工具
 */
exports.tokenManager = {
    getAccessToken: getAccessToken,
    getRefreshToken: getRefreshToken,
    saveTokens: saveTokens,
    clearTokens: clearTokens,
    refresh: refreshAccessToken,
};
