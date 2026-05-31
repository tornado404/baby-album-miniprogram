// @ts-nocheck
// media_detail.ts - 媒体详情页
import { mediaService } from '../../services/media_service';
import type { Media } from '../../../typings/models';

Page({
  data: {
    media: null as Media | null,
    mediaList: [] as Media[],
    currentIndex: 0,
    isLoading: false,
    showActions: false,
    actions: [
      { name: '编辑', icon: 'edit' },
      { name: '下载', icon: 'down' },
      { name: '分享', icon: 'share' },
      { name: '删除', icon: 'delete', color: '#ee0a24' }
    ]
  },

  onLoad(options: any) {
    const { id } = options;
    if (id) {
      this.loadMediaDetail(id);
    }
  },

  async loadMediaDetail(id: string) {
    this.setData({ isLoading: true });
    try {
      const media = await mediaService.getMediaDetail(id);
      if (media) {
        this.setData({
          media,
          mediaList: [media]
        });
      }
    } catch (error) {
      console.error('加载媒体详情失败:', error);
      wx.showToast({ title: '加载失败', icon: 'none' });
    } finally {
      this.setData({ isLoading: false });
    }
  },

  onSwiperChange(e: any) {
    const { current } = e.detail;
    this.setData({
      currentIndex: current,
      media: this.data.mediaList[current]
    });
  },

  onActionsTap() {
    this.setData({ showActions: true });
  },

  onActionsSelect(e: any) {
    const { index } = e.detail;
    switch (index) {
      case 0:
        this.onEditTap();
        break;
      case 1:
        this.onDownloadTap();
        break;
      case 2:
        this.onShareTap();
        break;
      case 3:
        this.onDeleteTap();
        break;
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
            this.setData({
              'media.title': res.content
            });
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
            setTimeout(() => {
              wx.navigateBack();
            }, 1000);
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
      success: () => {
        wx.showToast({ title: '保存成功', icon: 'success' });
      },
      fail: (err) => {
        console.error('保存失败:', err);
        wx.showToast({ title: '保存失败', icon: 'none' });
      }
    });
  },

  onShareTap() {
    const { media } = this.data;
    if (!media) return;

    wx.showShareMenu({
      withShareTicket: true,
      menus: ['shareAppMessage', 'shareTimeline']
    });
  },

  onPreviewTap() {
    const { media } = this.data;
    if (!media) return;

    wx.previewImage({
      urls: [media.url],
      current: media.url
    });
  },

  goBack() {
    wx.navigateBack();
  }
});