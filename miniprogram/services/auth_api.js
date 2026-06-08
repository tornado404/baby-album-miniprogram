"use strict";
// services/auth_api.ts - 认证相关 API 调用
Object.defineProperty(exports, "__esModule", { value: true });
exports.authApi = void 0;
var request_1 = require("./request");
var authApi = {
    /**
     * 微信登录：wx.login 获取 code 后调后端
     */
    login: function (code) {
        return request_1.request.post('/auth/login', { code: code }).then(function (res) {
            // 登录成功自动保存 token
            if (res.accessToken) {
                request_1.tokenManager.saveTokens(res.accessToken, res.refreshToken, res.userId);
            }
            return res;
        });
    },
    /**
     * 刷新 token
     */
    refresh: function () {
        return request_1.tokenManager.refresh();
    },
    /**
     * 获取当前用户信息
     */
    getProfile: function () {
        return request_1.request.get('/auth/me');
    },
    /**
     * 检查登录状态：有有效 token 返回 true
     */
    isLoggedIn: function () {
        var token = request_1.tokenManager.getAccessToken();
        return !!token;
    },
};
exports.authApi = authApi;
exports.default = authApi;
