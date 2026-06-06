// @ts-nocheck
// media_detail.ts - Claymorphism 风格媒体详情页
import { mediaService } from '../../services/media_service';
import type { Media } from '../../../typings/models';

Page({
  data: {
    safeTop: 44,
    media: null as Media | null,
    mediaList: [] as Media[],
    currentIndex: 0,
    isLoading: false,
    showActions: false,
    scale: 1,
    minScale: 1,
    maxScale: 3,
    isZooming: false,
    initialPinchDistance: 0,
    babyAgeText: '',
    actions: [
      { name: '编辑描述', icon: '✏️', danger: false },
      { name: '保存到相册', icon: '💾', danger: false },
      { name: '分享', icon: '🔗', danger: false },
      { name: '删除', icon: '🗑️', danger: true }
    ]
  },

  onLoad(options: any) {
    const sysInfo = wx.getWindowInfo();
    this.setData({ safeTop: sysInfo.statusBarHeight || 44 });

    const { id } = options;
    if (id) {
      this.loadMediaDetail(id);
    }
  },

  onTouchStart(e: any) {
    if (e.touches.length === 2) {
      this.setData({ isZooming: true });
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const initialDistance = Math.sqrt(
        Math.pow(touch2.clientX - touch1.clientX, 2) +
        Math.pow(touch2.clientY - touch1.clientY, 2)
      );
      this.setData({ initialPinchDistance: initialDistance });
    }
  },

  onTouchMove(e: any) {
    if (!this.data.isZooming || e.touches.length !== 2) return;

    const touch1 = e.touches[0];
    const touch2 = e.touches[1];
    const currentDistance = Math.sqrt(
      Math.pow(touch2.clientX - touch1.clientX, 2) +
      Math.pow(touch2.clientY - touch1.clientY, 2)
    );

    const { initialPinchDistance, scale, minScale, maxScale } = this.data;
    const delta = currentDistance / initialPinchDistance;
    let newScale = scale * delta;

    newScale = Math.max(minScale, Math.min(maxScale, newScale));
    this.setData({ scale: newScale });
  },

  onTouchEnd() {
    this.setData({ isZooming: false });
    if (this.data.scale <= this.data.minScale) {
      this.setData({ scale: 1 });
    }
  },

  async loadMediaDetail(id: string) {
    this.setData({ isLoading: true });
    try {
      const media = await mediaService.getMediaDetail(id);
      if (media) {
        const ageText = this.formatBabyAge(media);
        this.setData({
          media,
          mediaList: [media],
          babyAgeText: ageText
        });
      }
    } catch (error) {
      console.error('加载媒体详情失败:', error);
      wx.showToast({ title: '加载失败', icon: 'none' });
    } finally {
      this.setData({ isLoading: false });
    }
  },

  formatBabyAge(media: any): string {
    if (media && media.babyAge) {
      const age = media.babyAge;
      let text = '';
      if (age.years > 0) text += age.years + '岁';
      if (age.months > 0) text += age.months + '个月';
      if (age.days > 0 && age.years === 0) text += age.days + '天';
      return text;
    }
    return '';
  },

  onSwiperChange(e: any) {
    const { current } = e.detail;
    const media = this.data.mediaList[current];
    this.setData({
      currentIndex: current,
      media: media,
      babyAgeText: this.formatBabyAge(media)
    });
  },

  onActionsTap() {
    this.setData({ showActions: true });
  },

  onActionsSelect(e: any) {
    const { index } = e.currentTarget.dataset;
    switch (index) {
      case 0: this.onEditTap(); break;
      case 1: this.onDownloadTap(); break;
      case 2: this.onShareTap(); break;
      case 3: this.onDeleteTap(); break;
    }
    this.setData({ showActions: false });
  },

  onActionsCancel() {
    this.setData({ showActions: false });
  },

  onEditTap() {
    const { media } = this.data;
    if (!media) return;

    wx.showModal({
      title: '编辑描述',
      editable: true,
      placeholderText: '请输入描述',
      content: media.title || '',
      success: async (res) => {
        if (res.confirm && res.content !== media.title) {
          try {
            await mediaService.updateMedia(media.id, { title: res.content });
            this.setData({ 'media.title': res.content });
            wx.showToast({ title: '更新成功', icon: 'success' });
          } catch (error) {
            wx.showToast({ title: '更新失败', icon: 'none' });
          }
        }
      }
    });
  },

  async onDeleteTap() {
    const { media } = this.data;
    if (!media) return;

    wx.showModal({
      title: '确认删除',
      content: '确定要删除这张照片吗？删除后无法恢复。',
      confirmColor: '#ee0a24',
      success: async (res) => {
        if (res.confirm) {
          try {
            await mediaService.deleteMedia(media.id);
            wx.showToast({ title: '删除成功', icon: 'success' });
            setTimeout(() => wx.navigateBack(), 1000);
          } catch (error) {
            wx.showToast({ title: '删除失败', icon: 'none' });
          }
        }
      }
    });
  },

  onDownloadTap() {
    const { media } = this.data;
    if (!media) return;

    wx.saveImageToPhotosAlbum({
      filePath: media.url,
      success: () => wx.showToast({ title: '保存成功', icon: 'success' }),
      fail: () => wx.showToast({ title: '保存失败', icon: 'none' })
    });
  },

  onShareTap() {
    wx.showShareMenu({
      withShareTicket: true,
      menus: ['shareAppMessage', 'shareTimeline']
    });
  },

  goBack() {
    wx.navigateBack();
  }
});