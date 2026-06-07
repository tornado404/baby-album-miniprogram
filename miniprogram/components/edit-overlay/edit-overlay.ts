// @ts-nocheck
// edit-overlay.ts - 上传编辑浮层组件（GPS/标签/时刻/里程碑）

const API_BASE = 'http://101.126.41.146:8000/api/v1';

Component({
  properties: {
    show: { type: Boolean, value: false },
    fileList: { type: Array, value: [] },
    currentIndex: { type: Number, value: 0 },
    babyId: { type: String, value: '' },
  },

  data: {
    currentFile: null,
    locationName: '',
    locationLoading: false,
    tags: [] as string[],
    moment: '',
    milestone: '',
    uploadProgress: 0,
    totalFiles: 0,
    milestones: [
      { key: 'newborn', icon: '🍼', label: '新生儿' },
      { key: 'head_up', icon: '👶', label: '抬头期' },
      { key: 'explore', icon: '👐', label: '探索期' },
      { key: 'teething', icon: '🦷', label: '出牙期' },
      { key: 'toddler', icon: '🚶', label: '学步期' },
      { key: 'walking', icon: '🏃', label: '行走期' },
      { key: 'language', icon: '🗣️', label: '语言期' },
      { key: 'creative', icon: '🎨', label: '创造期' },
    ],
    presetTags: [
      { name: '第1月', color: '#dceaf1' },
      { name: '第3月', color: '#dceaf1' },
      { name: '第6月', color: '#dceaf1' },
      { name: '翻身', color: '#f1dce2' },
      { name: '会坐', color: '#f1dce2' },
      { name: '会爬', color: '#f1dce2' },
      { name: '吃饭', color: '#e2f1e6' },
      { name: '睡觉', color: '#e2f1e6' },
      { name: '玩耍', color: '#e2f1e6' },
      { name: '微笑', color: '#f4e6d6' },
      { name: '搞怪', color: '#f4e6d6' },
    ],
    customTagInput: '',
  },

  observers: {
    'show': function (show) {
      if (show) {
        this.initForCurrentFile();
      }
    },
    'currentIndex': function () {
      if (this.properties.show) {
        this.initForCurrentFile();
      }
    },
  },

  methods: {
    initForCurrentFile() {
      var idx = this.properties.currentIndex;
      var files = this.properties.fileList;
      this.setData({
        currentFile: files[idx] || null,
        totalFiles: files.length,
        locationLoading: true,
      });
      this.getLocation();
    },

    getLocation() {
      var _this = this;
      // 先尝试 EXIF GPS
      var file = this.data.currentFile;
      if (file && file.tempFilePath) {
        try {
          wx.getImageInfo({
            src: file.tempFilePath,
            success: function (info) {
              if (info.gpsLongitude && info.gpsLatitude) {
                _this.setData({
                  locationName: '📍 ' + info.gpsLongitude.toFixed(4) + ', ' + info.gpsLatitude.toFixed(4),
                  locationLoading: false,
                });
                return;
              }
              _this.getPhoneLocation();
            },
            fail: function () { _this.getPhoneLocation(); },
          });
        } catch (e) {
          _this.getPhoneLocation();
        }
      } else {
        this.getPhoneLocation();
      }
    },

    getPhoneLocation() {
      var _this = this;
      try {
        wx.getLocation({
          type: 'wgs84',
          success: function (loc) {
            _this.setData({
              locationName: '📍 位置已获取',
              locationLoading: false,
            });
          },
          fail: function () {
            _this.setData({
              locationName: '',
              locationLoading: false,
            });
          },
        });
      } catch (e) {
        this.setData({ locationLoading: false });
      }
    },

    onTagTap(e) {
      var tag = e.currentTarget.dataset.tag;
      var tags = this.data.tags.slice();
      var idx = tags.indexOf(tag);
      if (idx >= 0) { tags.splice(idx, 1); }
      else { tags.push(tag); }
      this.setData({ tags: tags });
    },

    onCustomTagInput(e) {
      this.setData({ customTagInput: e.detail.value });
    },

    onAddCustomTag() {
      var tag = this.data.customTagInput.trim();
      if (!tag) return;
      var tags = this.data.tags.slice();
      if (tags.indexOf(tag) >= 0) return;
      if (tags.length >= 10) {
        wx.showToast({ title: '最多 10 个标签', icon: 'none' });
        return;
      }
      tags.push(tag);
      this.setData({ tags: tags, customTagInput: '' });
    },

    onMomentInput(e) {
      this.setData({ moment: e.detail.value });
    },

    onMilestoneSelect(e) {
      var key = e.currentTarget.dataset.key;
      this.setData({
        milestone: key === this.data.milestone ? '' : key,
      });
    },

    onPrev() {
      if (this.properties.currentIndex > 0) {
        this.saveCurrent();
        this.triggerEvent('prev');
      }
    },

    onNext() {
      if (this.properties.currentIndex < this.properties.fileList.length - 1) {
        this.saveCurrent();
        this.triggerEvent('next');
      }
    },

    saveCurrent() {
      this.triggerEvent('save', {
        index: this.properties.currentIndex,
        data: {
          locationName: this.data.locationName,
          tags: this.data.tags,
          moment: this.data.moment,
          milestone: this.data.milestone,
        },
      });
    },

    onSaveAll() {
      this.saveCurrent();
      this.triggerEvent('saveAll', {
        items: this.properties.fileList.map((_, i) => ({
          index: i,
          data: {
            locationName: this.data.locationName,
            tags: this.data.tags,
            moment: this.data.moment,
            milestone: this.data.milestone,
          },
        })),
      });
      this.triggerEvent('close');
    },

    onClose() {
      this.triggerEvent('close');
    },
  },
});