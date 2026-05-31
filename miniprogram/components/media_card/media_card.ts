// @ts-nocheck
// media_card.ts - 媒体卡片组件
Component({
  properties: {
    media: {
      type: Object,
      value: {}
    },
    index: {
      type: Number,
      value: 0
    }
  },

  data: {},

  methods: {
    onTap(): void {
      this.triggerEvent('tap', {
        id: this.data.media.id,
        index: this.data.index
      });
    }
  }
});