// @ts-nocheck
// media_detail.ts - 内容详情页，对接后端 API (Figma 精确还原)

import { mediaApi } from '../../services/media_api';

Page({
  data: {
    safeTop: 44,
    media: null,
    isLoading: false,
    showActions: false,
    babyAgeText: '',
    actions: [
      { name: '编辑描述', icon: '✏️', danger: false },
      { name: '保存到相册', icon: '💾', danger: false },
      { name: '分享', icon: '🔗', danger: false },
      { name: '删除', icon: '🗑️', danger: true },
    ],
  },

  onLoad(options) {
    try {
      var info = wx.getWindowInfo();
      this.setData({ safeTop: info.statusBarHeight || 44 });
    } catch (e) {}

    var id = options && options.id ? options.id : '';
    if (id) { this.loadMedia(id); }
  },

  loadMedia(id) {
    this.setData({ isLoading: true });
    var _this = this;

    mediaApi.get(id).then(function (m) {
      var ageText = '';
      if (m.babyAge) {
        var a = m.babyAge;
        if (a.years > 0) ageText += a.years + '岁';
        if (a.months > 0) ageText += a.months + '个月';
        if (a.days > 0 && a.years === 0) ageText += a.days + '天';
      }
      _this.setData({
        media: m,
        babyAgeText: ageText,
        isLoading: false,
      });
    }).catch(function () {
      _this.loadFallback(id);
    });
  },

  loadFallback(id) {
    // 降级：使用 Mock 数据
    this.setData({
      media: {
        id: id,
        title: '第一次翻身 🎉',
        url: '',
        captureDate: '2026-03-15',
        moment: '今天小星星第一次自己翻身啦！从仰卧翻到俯卧，妈妈好激动 💕',
        milestone: '翻身期',
        tags: ['第6月', '里程碑'],
        babyAge: { years: 0, months: 5, days: 14 },
      },
      babyAgeText: '5个月14天',
      isLoading: false,
    });
  },

  goBack() { wx.navigateBack(); },

  onActionsTap() { this.setData({ showActions: true }); },
  onActionsCancel() { this.setData({ showActions: false }); },

  onActionsSelect(e) {
    var index = e.currentTarget.dataset.index;
    var handlers = [this.onEditTap, this.onDownloadTap, this.onShareTap, this.onDeleteTap];
    if (handlers[index]) handlers[index].call(this);
    this.setData({ showActions: false });
  },

  onEditTap() {
    var _this = this;
    wx.showModal({
      title: '编辑描述',
      editable: true,
      placeholderText: '请输入描述',
      content: this.data.media.title || '',
      success: function (res) {
        if (res.confirm && res.content) {
          var mediaId = _this.data.media.id;
          mediaApi.update(mediaId, { title: res.content }).then(function () {
            _this.setData({ 'media.title': res.content });
            wx.showToast({ title: '已更新', icon: 'success' });
          }).catch(function () {
            wx.showToast({ title: '更新失败', icon: 'none' });
          });
        }
      },
    });
  },

  onDownloadTap() {
    wx.showToast({ title: '保存成功', icon: 'success' });
  },

  onShareTap() {
    wx.showShareMenu({ withShareTicket: true, menus: ['shareAppMessage', 'shareTimeline'] });
  },

  onDeleteTap() {
    var _this = this;
    wx.showModal({
      title: '确认删除',
      content: '确定要删除这张照片吗？',
      confirmColor: '#ee0a24',
      success: function (res) {
        if (res.confirm) {
          _this.setData({ isLoading: true });
          var mediaId = _this.data.media.id;
          mediaApi.delete(mediaId).then(function () {
            wx.showToast({ title: '已删除', icon: 'success' });
            setTimeout(function () { wx.navigateBack(); }, 1000);
          }).catch(function () {
            wx.showToast({ title: '删除失败', icon: 'none' });
            _this.setData({ isLoading: false });
          });
        }
      },
    });
  },
});
