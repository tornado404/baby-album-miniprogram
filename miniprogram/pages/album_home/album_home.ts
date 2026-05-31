// @ts-nocheck
// album_home.ts - 相册首页
import { storageService } from '../../services/storage_service';
import { mediaService } from '../../services/media_service';
import type { Baby, Media } from '../../../typings/models';

Page({
  data: {
    currentBabyId: '',
    currentBaby: null as Baby | null,
    babies: [] as Baby[],
    mediaList: [] as Media[],
    viewMode: 'masonry' as 'timeline' | 'masonry',
    isLoading: false,
    isEmpty: false,
    uploaderVisible: false,
    filterMinAge: null as number | null,
    filterMaxAge: null as number | null,
    isAuthorized: false
  },

  onLoad() {
    this.checkAuthorization();
  },

  onShow() {
    // 每次显示时检查数据更新
    if (this.data.currentBabyId) {
      this.loadMediaList();
    }
  },

  onPullDownRefresh() {
    this.loadMediaList().then(() => {
      wx.stopPullDownRefresh();
    });
  },

  // 检查授权状态
  checkAuthorization() {
    wx.getSetting({
      success: (res) => {
        if (res.authSetting['scope.userInfo']) {
          // 已授权，获取用户信息
          this.setData({ isAuthorized: true });
          this.initPage();
        } else {
          // 未授权，提示用户授权
          this.setData({ isAuthorized: false });
          this.showAuthTip();
        }
      },
      fail: () => {
        // 获取设置失败，默认进入
        this.setData({ isAuthorized: true });
        this.initPage();
      }
    });
  },

  // 显示授权提示
  showAuthTip() {
    wx.showModal({
      title: '授权提示',
      content: '成长相册需要获取您的头像和昵称信息，请先授权',
      confirmText: '去授权',
      cancelText: '暂不授权',
      success: (res) => {
        if (res.confirm) {
          // 跳转回首页授权
          wx.switchTab({
            url: '/pages/index/index'
          });
        }
      }
    });
  },

  async initPage() {
    this.setData({ isLoading: true });
    try {
      const babies = await storageService.getBabies();
      this.setData({ babies });

      if (babies.length > 0) {
        const firstBaby = babies[0];
        this.setData({
          currentBabyId: firstBaby.id,
          currentBaby: firstBaby
        });
        await this.loadMediaList();
      } else {
        this.setData({ isEmpty: true });
      }
    } catch (error) {
      console.error('初始化失败:', error);
    } finally {
      this.setData({ isLoading: false });
    }
  },

  async loadMediaList() {
    const { currentBabyId, filterMinAge, filterMaxAge, currentBaby } = this.data;
    if (!currentBabyId) {
      this.setData({ mediaList: [] });
      return;
    }

    try {
      const babyBirthDate = currentBaby ? currentBaby.birthDate : null;
      const mediaList = await mediaService.getMediaListWithAge(
        {
          babyId: currentBabyId,
          minAge: filterMinAge !== null ? filterMinAge : undefined,
          maxAge: filterMaxAge !== null ? filterMaxAge : undefined
        },
        babyBirthDate
      );
      this.setData({ mediaList, isEmpty: mediaList.length === 0 });
    } catch (error) {
      console.error('加载媒体列表失败:', error);
    }
  },

  onBabySelect() {
    const { babies } = this.data;
    if (babies.length === 0) {
      return;
    }

    const babyNames = babies.map(b => b.name);
    wx.showActionSheet({
      itemList: babyNames,
      success: (res) => {
        const selectedBaby = babies[res.tapIndex];
        this.setData({
          currentBabyId: selectedBaby.id,
          currentBaby: selectedBaby
        });
        this.loadMediaList();
      }
    });
  },

  onAgeFilterChange(event: any) {
    const { value, minAge, maxAge } = event.detail;
    this.setData({
      filterMinAge: minAge,
      filterMaxAge: maxAge
    });
    this.loadMediaList();
  },

  switchViewMode() {
    const newMode = this.data.viewMode === 'masonry' ? 'timeline' : 'masonry';
    this.setData({ viewMode: newMode });
  },

  onMediaTap(e: any) {
    const { id } = e.currentTarget.dataset;
    wx.navigateTo({
      url: '/pages/media_detail/media_detail?id=' + id
    });
  },

  onScrollToLower() {
    wx.showToast({
      title: '正在加载更多...',
      icon: 'none'
    });
  },

  onUploadTap() {
    if (!this.data.currentBabyId) {
      wx.showToast({ title: '请先选择宝宝', icon: 'none' });
      return;
    }
    this.setData({ uploaderVisible: true });
  },

  onUploaderClose() {
    this.setData({ uploaderVisible: false });
  },

  onUploaderSuccess() {
    this.loadMediaList();
  },

  goHome() {
    wx.navigateBack();
  }
});
