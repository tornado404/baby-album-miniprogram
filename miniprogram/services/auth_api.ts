// services/auth_api.ts - 认证相关 API 调用

import { request, tokenManager } from './request';

const authApi = {

  /**
   * 微信登录：wx.login 获取 code 后调后端
   */
  login: function (code: string): Promise<any> {
    return request.post('/auth/login', { code: code }).then(function (res: any) {
      // 登录成功自动保存 token
      if (res.accessToken) {
        tokenManager.saveTokens(res.accessToken, res.refreshToken, res.userId);
      }
      return res;
    });
  },

  /**
   * 刷新 token
   */
  refresh: function (): Promise<any> {
    return tokenManager.refresh();
  },

  /**
   * 获取当前用户信息
   */
  getProfile: function (): Promise<any> {
    return request.get('/auth/me');
  },

  /**
   * 检查登录状态：有有效 token 返回 true
   */
  isLoggedIn: function (): boolean {
    var token = tokenManager.getAccessToken();
    return !!token;
  },
};

export { authApi };
export default authApi;