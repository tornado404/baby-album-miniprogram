// baby_list.ts - 宝宝列表页
// 展示所有宝宝卡片，点击进入编辑页，底部添加新宝宝

const BABIES_KEY = 'baby_diary_baby_profile';

Page({
  data: {
    safeTop: 44,
    babies: [] as any[],
    isLoading: false
  },

  onLoad() {
    try {
      const info = wx.getSystemInfoSync();
      this.setData({ safeTop: info.statusBarHeight || 44 });
    } catch (e) {}
    this.loadBabies();
  },

  onShow() {
    // Refresh list when returning from add/edit page
    this.loadBabies();
  },

  loadBabies() {
    this.setData({ isLoading: true });

    try {
      // Try to get from storage first
      var stored = wx.getStorageSync(BABIES_KEY);
      var babies = [];

      if (stored) {
        // Single baby or array
        if (Array.isArray(stored)) {
          babies = stored;
        } else {
          babies = [stored];
        }
      }

      // If no babies in storage, use mock data
      if (babies.length === 0) {
        babies = this.getMockBabies();
      }

      this.setData({ babies: babies, isLoading: false });
    } catch (e) {
      // Fallback to mock data
      this.setData({
        babies: this.getMockBabies(),
        isLoading: false
      });
    }
  },

  getMockBabies() {
    return [
      {
        id: 'baby_demo_1',
        name: '小星星 ✨',
        avatar: '👶',
        gender: 'female',
        ageText: '6个月3天 · 女宝',
        birthDate: '2025-12-01'
      },
      {
        id: 'baby_demo_2',
        name: '小月亮 🌙',
        avatar: '👧',
        gender: 'male',
        ageText: '2个月15天 · 男宝',
        birthDate: '2026-03-20'
      }
    ];
  },

  onBabyTap(e: any) {
    var id = e.currentTarget.dataset.id;
    // Set as current baby
    try {
      wx.setStorageSync('baby_diary_current_baby_id', id);
    } catch (e) {}
    wx.navigateTo({
      url: '/pages/baby_profile/baby_profile?id=' + id
    });
  },

  onAddBaby() {
    wx.navigateTo({
      url: '/pages/baby_onboarding/baby_onboarding'
    });
  },

  onBack() {
    wx.navigateBack();
  }
});