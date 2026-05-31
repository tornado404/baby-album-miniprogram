// @ts-nocheck
// masonry_layout.ts - 瀑布流布局组件
Component({
  properties: {
    columnCount: {
      type: Number,
      value: 2
    },
    columnGap: {
      type: Number,
      value: 8
    },
    itemGap: {
      type: Number,
      value: 8
    },
    list: {
      type: Array,
      value: []
    }
  },

  data: {
    columns: [] as any[][],
    columnHeights: [] as number[]
  },

  lifetimes: {
    attached(): void {
      this.recalculateColumns();
    }
  },

  methods: {
    /**
     * 重新计算列布局 - 瀑布流核心算法
     * 使用贪心算法，将每个项分配到当前最短的列
     * 时间复杂度: O(n * columnCount)，但通过记录最短列索引优化
     */
    recalculateColumns(): void {
      const { list, columnCount } = this.properties;
      if (!list || list.length === 0) {
        this.setData({ columns: [], columnHeights: [] });
        return;
      }

      // 初始化列数据和列高度
      const columns: any[][] = Array.from({ length: columnCount }, () => []);
      const columnHeights: number[] = Array(columnCount).fill(0);

      // 使用单个变量追踪最短列，避免每次遍历
      let minColumnIndex = 0;

      // 将每个项分配到最短的列
      list.forEach((item: any) => {
        // 找到最短列的索引（已在上一轮更新）
        const itemHeight = this.getItemHeight(item);
        const itemGap = this.properties.itemGap;

        // 将项添加到最短列
        columns[minColumnIndex].push(item);
        // 更新列高度
        columnHeights[minColumnIndex] += itemHeight + itemGap;

        // 找到新的最短列索引（简化：线性搜索，因为列数通常<=4）
        minColumnIndex = 0;
        for (let i = 1; i < columnCount; i++) {
          if (columnHeights[i] < columnHeights[minColumnIndex]) {
            minColumnIndex = i;
          }
        }
      });

      this.setData({ columns, columnHeights });
    },

    /**
     * 获取项的高度
     * 如果项有height属性则使用，否则根据宽高比计算
     * 默认宽高比 4:3，对应宽度100%时高度为150
     */
    getItemHeight(item: any): number {
      if (item.height) {
        return Number(item.height);
      }
      if (item.imageHeight) {
        return Number(item.imageHeight);
      }
      // 根据宽高比计算，默认 4:3
      if (item.width && item.height === undefined) {
        return (Number(item.width) / 4) * 3;
      }
      // 默认占位高度
      return 150;
    },

    /**
     * 触底加载更多事件
     * 懒加载功能由 van-image 组件的 lazy-load 属性负责
     */
    onScrollToLower(): void {
      this.triggerEvent('scrolltolower');
    }
  },

  observers: {
    'list, columnCount, columnGap, itemGap': function() {
      this.recalculateColumns();
    }
  }
});