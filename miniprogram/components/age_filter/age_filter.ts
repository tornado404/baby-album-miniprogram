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
    quickOptions: [] as Array<{label: string; value: number; minAge: number; maxAge: number}>,
    customVisible: false,
    customMin: 0,
    customMax: 36
  },

  lifetimes: {
    attached(): void {
      this.calculateCurrentAge();
      this.generateMonthLabels();
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

    generateMonthLabels(): void {
      const { birthDate } = this.properties;
      if (!birthDate) {
        this.setData({ quickOptions: [{ label: '全部', value: null, minAge: null, maxAge: null }] });
        return;
      }

      const currentAge = calculateBabyAge(birthDate);
      const maxMonthAge = currentAge.years * 12 + currentAge.months;

      const options: Array<{label: string; value: number; minAge: number; maxAge: number}> = [
        { label: '全部', value: null, minAge: null, maxAge: null }
      ];

      // 生成从 0 到当前月龄的标签
      for (let i = 0; i <= maxMonthAge && i <= 12; i++) {
        options.push({
          label: `${i}月`,
          value: i,
          minAge: i,
          maxAge: i
        });
      }

      // 如果超过12月，显示 "12月+"
      if (maxMonthAge > 12) {
        options.push({
          label: '12月+',
          value: 12,
          minAge: 12,
          maxAge: -1
        });
      }

      this.setData({ quickOptions: options });
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