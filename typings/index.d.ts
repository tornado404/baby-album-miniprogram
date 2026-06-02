/// <reference path="./types/index.d.ts" />

// 数据模型导出
export * from './models/baby';
export * from './models/media';

// 全局接口声明
declare global {
  interface IAppOption {
    globalData: {
      userInfo?: WechatMiniprogram.UserInfo,
    }
    userInfoReadyCallback?: WechatMiniprogram.GetUserInfoSuccessCallback,
  }
}