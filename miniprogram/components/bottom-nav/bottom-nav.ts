// @ts-nocheck
// bottom-nav.ts - v2 底部导航 (3 Tab: 成长/记录/我的)

Component({
  properties: {
    current: {
      type: String,
      value: 'growth'
    }
  },

  data: {
    tabs: [
      { key: 'growth', icon: '🌱', label: '成长' },
      { key: 'record', icon: '📷', label: '记录' },
      { key: 'profile', icon: '👤', label: '我的' }
    ]
  },

  methods: {
    onTabTap: function (e) {
      var key = e.currentTarget.dataset.key;
      if (key === this.properties.current) return;

      var routes = {
        growth: '/pages/album_home/album_home',
        record: '/pages/upload/upload',
        profile: '/pages/settings/settings'
      };

      var url = routes[key];
      if (url) {
        wx.redirectTo({ url: url });
      }
    }
  }
});