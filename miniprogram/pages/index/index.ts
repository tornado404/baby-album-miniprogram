// @ts-nocheck
// index.ts - 入口路由页
// 直接进入 album_home 首页，让页面自己处理无 token 场景
// 登录延迟到用户需要数据操作时再触发（浏览优先，授权后置）

Page({
  onLoad: function () {
    wx.reLaunch({ url: '/pages/album_home/album_home' });
  },
});
