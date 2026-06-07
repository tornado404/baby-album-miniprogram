// @ts-nocheck
// bottom-nav.ts - 底部导航组件
// Figma Bottom Nav v2: 👶成长历程 / 📦素材库 / ➕上传 / 👤我的

Component({
  properties: {
    current: {
      type: String,
      value: 'journey'
    }
  },

  data: {
    tabs: [
      { key: 'journey', icon: '👶', label: '成长历程' },
      { key: 'gallery', icon: '📦', label: '素材库' },
      { key: 'upload', icon: '➕', label: '上传' },
      { key: 'profile', icon: '👤', label: '我的' }
    ]
  },

  methods: {
    onTabTap(e) {
      var key = e.currentTarget.dataset.key;
      if (key === this.properties.current) return;

      var routes = {
        journey: '/pages/journey/journey',
        gallery: '/pages/gallery/gallery',
        upload: '/pages/upload/upload',
        profile: '/pages/settings/settings'
      };

      var url = routes[key];
      if (url) {
        wx.redirectTo({ url: url });
      }
    }
  }
});