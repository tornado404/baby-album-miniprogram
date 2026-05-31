// @ts-nocheck
// age_filter.ts - 月龄筛选组件
import { calculateBabyAge, formatAge } from '../../utils/age_calculator';
import type { BabyAge } from '../../../typings/models';

Component({
  properties: {
    babyId: {
      type: String,
      value: ''
    },
    birthDate: {
      type: String,
      value: ''
    },
    value: {
      type: Number,
      value: null
    }
  },

  data: {
    currentAge: null as BabyAge | null,
    selectedValue: null as number | null,
    quickOptions: [
      { label: '全部', value: null },
      { label: '0-3月', value: 3, minAge: 0, maxAge: 3 },
      { label: '3-6月', value: 6, minAge: 3, maxAge: 6 },
      { label: '6-12月', value: 12, minAge: 6, maxAge: 12 },
      { label: '1-2岁', value: 24, minAge: 12, maxAge: 24 },
      { label: '2岁以上', value: -1, minAge: 24, maxAge: -1 }
    ],
    customVisible: false,
    customMin: 0,
    customMax: 36
  },

  lifetimes: {
    attached(): void {
      this.calculateCurrentAge();
      this.setData({ selectedValue: this.properties.value });
    }
  },

  observers: {
    'birthDate': function() {
      this.calculateCurrentAge();
    },
    'value': function(newVal) {
      this.setData({ selectedValue: newVal });
    }
  },

  methods: {
    calculateCurrentAge(): void {
      const { birthDate } = this.properties;
      if (!birthDate) {
        this.setData({ currentAge: null });
        return;
      }
      const age = calculateBabyAge(birthDate);
      this.setData({ currentAge: age });
    },

    onQuickSelect(event: any): void {
      const { value } = event.currentTarget.dataset;
      const option = this.data.quickOptions.find(o => o.value === value);
      this.setData({ selectedValue: value });
      this.triggerEvent('change', {
        value,
        minAge: option ? option.minAge : null,
        maxAge: option ? option.maxAge : null
      });
    },

    onCustomTap(): void {
      this.setData({ customVisible: true });
    },

    onCustomCancel(): void {
      this.setData({ customVisible: false });
    },

    onCustomConfirm(): void {
      const { customMin, customMax } = this.data;
      this.setData({
        customVisible: false,
        selectedValue: customMax
      });
      this.triggerEvent('change', {
        value: customMax,
        minAge: customMin,
        maxAge: customMax
      });
    },

    onMinChange(event: any): void {
      this.setData({ customMin: event.detail.value });
    },

    onMaxChange(event: any): void {
      this.setData({ customMax: event.detail.value });
    },

    formatAgeLabel(age: BabyAge): string {
      return formatAge(age);
    }
  }
});