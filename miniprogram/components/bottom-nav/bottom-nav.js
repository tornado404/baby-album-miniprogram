"use strict";
// bottom-nav.ts - 底部导航组件
// Claymorphism 风格 4个Tab: 首页 / 相册 / 上传 / 我的
Component({
    properties: {
        current: {
            type: String,
            value: 'home'
        }
    },
    data: {
        tabs: [
            { key: 'home', icon: '🏠', label: '首页' },
            { key: 'album', icon: '📖', label: '相册' },
            { key: 'upload', icon: '➕', label: '上传' },
            { key: 'profile', icon: '👤', label: '我的' }
        ]
    },
    methods: {
        onTabTap: function (e) {
            var key = e.currentTarget.dataset.key;
            if (key === this.properties.current)
                return;
            var pages = {
                home: '/pages/album_home/album_home',
                album: '/pages/album_home/album_home',
                upload: '/pages/upload/upload',
                profile: '/pages/settings/settings'
            };
            var url = pages[key];
            if (url) {
                wx.redirectTo({ url: url });
            }
        }
    }
});
