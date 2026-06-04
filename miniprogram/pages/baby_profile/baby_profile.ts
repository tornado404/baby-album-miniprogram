// baby_profile.ts - 宝宝档案编辑页面
// Claymorphism 设计风格，支持头像上传

Page({
  data: {
    safeTop: 44,
    nickname: '小星星',
    gender: 'female',
    birthDate: '2025-12-01',
    dueDate: '2025-11-24',
    birthDateArray: [],
    dueDateArray: [],
    weight: '7.2',
    height: '65',
    avatarUrl: '',
    avatarEmoji: '👶'
  },

  onLoad: function () {
    var sysInfo = wx.getSystemInfoSync();
    this.setData({ safeTop: sysInfo.statusBarHeight || 44 });

    // Load baby profile from storage if editing existing
    var babyId = '';
    try {
      babyId = wx.getStorageSync('baby_diary_current_baby_id') || '';
    } catch (e) {}

    if (babyId) {
      var storedBabies = [];
      try {
        storedBabies = wx.getStorageSync('album_babies') || [];
      } catch (e) {}

      for (var i = 0; i < storedBabies.length; i++) {
        if (storedBabies[i].id === babyId) {
          var baby = storedBabies[i];
          var avatar = baby.avatar || '';
          this.setData({
            nickname: baby.name || '小星星',
            gender: baby.gender || 'female',
            birthDate: baby.birthDate || '2025-12-01',
            avatarUrl: avatar.indexOf('http') === 0 ? avatar : '',
            avatarEmoji: avatar.indexOf('http') !== 0 && avatar ? avatar : '👶'
          });
          break;
        }
      }
    }

    if (this.data.birthDate) {
      this.setData({ birthDateArray: this.dateToArray(this.data.birthDate) });
    }
    if (this.data.dueDate) {
      this.setData({ dueDateArray: this.dateToArray(this.data.dueDate) });
    }
  },

  dateToArray: function (dateStr) {
    var parts = dateStr.split('-');
    return parts.map(function (p) { return parseInt(p); });
  },

  arrayToDate: function (arr) {
    return arr.map(function (n) { return String(n).padStart(2, '0'); }).join('-');
  },

  onAvatarTap: function () {
    var _this = this;
    wx.showActionSheet({
      itemList: ['拍照', '从相册选择'],
      success: function (res) {
        wx.chooseMedia({
          count: 1,
          mediaType: ['image'],
          sourceType: [res.tapIndex === 0 ? 'camera' : 'album'],
          success: function (mediaRes) {
            var tempFile = mediaRes.tempFiles[0];
            if (tempFile) {
              _this.setData({
                avatarUrl: tempFile.tempFilePath || '',
                avatarEmoji: ''
              });
            }
          }
        });
      }
    });
  },

  onBack: function () {
    wx.navigateBack();
  },

  onSave: function () {
    // Save to storage
    var babyProfile = {
      name: this.data.nickname,
      gender: this.data.gender,
      birthDate: this.data.birthDate,
      avatar: this.data.avatarUrl || this.data.avatarEmoji
    };

    try {
      var babyId = wx.getStorageSync('baby_diary_current_baby_id') || '';
      var storedBabies = wx.getStorageSync('album_babies') || [];

      // Try to find and update existing baby
      var found = false;
      for (var i = 0; i < storedBabies.length; i++) {
        if (storedBabies[i].id === babyId) {
          storedBabies[i] = Object.assign(storedBabies[i], babyProfile);
          found = true;
          break;
        }
      }

      if (!found) {
        // Create new baby entry
        babyProfile['id'] = babyId || 'baby_' + Date.now();
        storedBabies.push(babyProfile);
      }

      wx.setStorageSync('album_babies', storedBabies);
    } catch (e) {}

    wx.showToast({ title: '保存成功', icon: 'success' });
    wx.navigateBack();
  },

  onNicknameInput: function (e) {
    this.setData({ nickname: e.detail.value });
  },

  onGenderSelect: function (e) {
    var gender = e.currentTarget.dataset.gender;
    this.setData({ gender: gender });
  },

  onBirthDateChange: function (e) {
    var val = e.detail.value;
    var dateStr = this.arrayToDate(val);
    this.setData({ birthDate: dateStr, birthDateArray: val });
  },

  onDueDateChange: function (e) {
    var val = e.detail.value;
    var dateStr = this.arrayToDate(val);
    this.setData({ dueDate: dateStr, dueDateArray: val });
  },

  onWeightMinus: function () {
    var w = parseFloat(this.data.weight) - 0.1;
    if (w >= 0) this.setData({ weight: w.toFixed(1) });
  },

  onWeightPlus: function () {
    var w = parseFloat(this.data.weight) + 0.1;
    this.setData({ weight: w.toFixed(1) });
  },

  onHeightMinus: function () {
    var h = parseInt(this.data.height) - 1;
    if (h >= 0) this.setData({ height: String(h) });
  },

  onHeightPlus: function () {
    var h = parseInt(this.data.height) + 1;
    this.setData({ height: String(h) });
  }
});