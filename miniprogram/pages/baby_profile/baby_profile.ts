// baby_profile.ts - 宝宝档案编辑页面
// Claymorphism 设计风格

Page({
  data: {
    safeTop: 44,
    nickname: '小星星',
    gender: 'female' as 'male' | 'female',
    birthDate: '2025-12-01',
    dueDate: '2025-11-24',
    birthDateArray: [] as number[],
    dueDateArray: [] as number[],
    weight: '7.2',
    height: '65'
  },

  onLoad() {
    const sysInfo = wx.getSystemInfoSync();
    this.setData({ safeTop: sysInfo.statusBarHeight || 44 });

    // 初始化日期数组
    if (this.data.birthDate) {
      this.setData({ birthDateArray: this.dateToArray(this.data.birthDate) });
    }
    if (this.data.dueDate) {
      this.setData({ dueDateArray: this.dateToArray(this.data.dueDate) });
    }
  },

  dateToArray(dateStr: string): number[] {
    const parts = dateStr.split('-');
    return parts.map(p => parseInt(p));
  },

  arrayToDate(arr: number[]): string {
    return arr.map(n => String(n).padStart(2, '0')).join('-');
  },

  onBack() {
    wx.navigateBack();
  },

  onSave() {
    wx.showToast({ title: '保存成功', icon: 'success' });
    wx.navigateBack();
  },

  onNicknameInput(e: any) {
    this.setData({ nickname: e.detail.value });
  },

  onGenderSelect(e: any) {
    const { gender } = e.currentTarget.dataset;
    this.setData({ gender });
  },

  onBirthDateChange(e: any) {
    const val = e.detail.value;
    const dateStr = this.arrayToDate(val);
    this.setData({ birthDate: dateStr, birthDateArray: val });
  },

  onDueDateChange(e: any) {
    const val = e.detail.value;
    const dateStr = this.arrayToDate(val);
    this.setData({ dueDate: dateStr, dueDateArray: val });
  },

  onWeightMinus() {
    const w = parseFloat(this.data.weight) - 0.1;
    if (w >= 0) this.setData({ weight: w.toFixed(1) });
  },

  onWeightPlus() {
    const w = parseFloat(this.data.weight) + 0.1;
    this.setData({ weight: w.toFixed(1) });
  },

  onHeightMinus() {
    const h = parseInt(this.data.height) - 1;
    if (h >= 0) this.setData({ height: String(h) });
  },

  onHeightPlus() {
    const h = parseInt(this.data.height) + 1;
    this.setData({ height: String(h) });
  }
});