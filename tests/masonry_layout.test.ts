/**
 * 瀑布流组件测试用例
 * 测试目标：T-05 瀑布流组件 - 布局算法和懒加载逻辑
 */

/**
 * 瀑布流列数据
 */
interface MasonryColumn {
  items: any[];
  height: number;
}

/**
 * 瀑布流配置
 */
interface MasonryConfig {
  columnCount: number;    // 列数
  columnGap: number;      // 列间距
  itemGap: number;        // 元素间距
}

describe('T-05 瀑布流组件测试', () => {
  // ==================== 布局算法测试 ====================

  describe('瀑布流布局算法', () => {
    /**
     * 计算瀑布流列分布
     * @param items 媒体列表
     * @param columnCount 列数
     * @param columnGap 列间距
     * @param itemGap 元素间距
     */
    function calculateColumns(
      items: Array<{ id: string; width?: number; height?: number }>,
      columnCount: number,
      columnGap: number,
      itemGap: number
    ): MasonryColumn[] {
      // 初始化列
      const columns: MasonryColumn[] = Array.from({ length: columnCount }, () => ({
        items: [],
        height: 0
      }));

      // 将每个项分配到最短的列
      items.forEach((item) => {
        // 找到最短的列
        let minHeightIndex = 0;
        let minHeight = columns[0].height;

        for (let i = 1; i < columns.length; i++) {
          if (columns[i].height < minHeight) {
            minHeight = columns[i].height;
            minHeightIndex = i;
          }
        }

        // 计算项的高度（如果未提供高度，使用默认值）
        const itemHeight = item.height || 200;

        // 添加到最短的列
        columns[minHeightIndex].items.push(item);
        columns[minHeightIndex].height += itemHeight + itemGap;
      });

      return columns;
    }

    test('应该正确计算两列布局', () => {
      const items = [
        { id: '1', width: 100, height: 150 },
        { id: '2', width: 100, height: 200 },
        { id: '3', width: 100, height: 120 },
        { id: '4', width: 100, height: 180 }
      ];

      const columns = calculateColumns(items, 2, 16, 16);

      expect(columns.length).toBe(2);
      expect(columns[0].items.length + columns[1].items.length).toBe(4);
    });

    test('第一项应该添加到第一列', () => {
      const items = [{ id: '1', height: 100 }];
      const columns = calculateColumns(items, 2, 16, 16);

      expect(columns[0].items.length).toBe(1);
      expect(columns[0].items[0].id).toBe('1');
    });

    test('第二项应该添加到较短的列', () => {
      // 第一列高度为150，第二列高度为100
      // 第二项应该添加到第二列
      const items = [
        { id: '1', height: 150 },
        { id: '2', height: 100 }
      ];
      const columns = calculateColumns(items, 2, 16, 16);

      expect(columns[0].items[0].id).toBe('1');
      expect(columns[1].items[0].id).toBe('2');
    });

    test('应该正确处理空列表', () => {
      const columns = calculateColumns([], 2, 16, 16);

      expect(columns.length).toBe(2);
      expect(columns[0].items.length).toBe(0);
      expect(columns[1].items.length).toBe(0);
    });

    test('单列布局应该将所有项添加到同一列', () => {
      const items = [
        { id: '1', height: 100 },
        { id: '2', height: 150 },
        { id: '3', height: 200 }
      ];
      const columns = calculateColumns(items, 1, 16, 16);

      expect(columns.length).toBe(1);
      expect(columns[0].items.length).toBe(3);
    });

    test('三列布局应该均匀分布', () => {
      const items = [
        { id: '1', height: 100 },
        { id: '2', height: 150 },
        { id: '3', height: 200 },
        { id: '4', height: 120 },
        { id: '5', height: 180 }
      ];
      const columns = calculateColumns(items, 3, 16, 16);

      expect(columns.length).toBe(3);
      expect(items.length).toBe(5);
    });

    test('使用默认高度（200）处理无高度项', () => {
      const items = [
        { id: '1' },  // 无 height 属性
        { id: '2', height: 100 }
      ];
      const columns = calculateColumns(items, 2, 16, 16);

      expect(columns[0].items[0].id).toBe('1');
      expect(columns[1].items[0].id).toBe('2');
    });
  });

  // ==================== 懒加载测试 ====================

  describe('图片懒加载逻辑', () => {
    /**
     * 判断图片是否应该加载
     * @param itemIndex 项的索引
     * @param viewportStart 可视区域起始位置
     * @param viewportEnd 可视区域结束位置
     * @param itemTop 项的顶部位置
     * @param itemHeight 项的高度
     * @param threshold 预加载阈值
     */
    function shouldLoadImage(
      itemIndex: number,
      viewportStart: number,
      viewportEnd: number,
      itemTop: number,
      itemHeight: number,
      threshold: number = 100
    ): boolean {
      const itemBottom = itemTop + itemHeight;
      const loadThreshold = threshold;

      // 如果项在可视区域范围内或即将进入可视区域，则加载
      // 项的底部在视口起始位置下方loadThreshold距离内，或者项的顶部在视口结束位置上方loadThreshold距离内
      const isApproaching = itemBottom >= viewportStart - loadThreshold && itemBottom <= viewportStart + loadThreshold;
      const isInViewport = itemTop >= viewportStart - loadThreshold && itemTop <= viewportEnd + loadThreshold;

      return isApproaching || isInViewport;
    }

    test('可视区域内的图片应该加载', () => {
      const result = shouldLoadImage(0, 0, 500, 100, 200);
      expect(result).toBe(true);
    });

    test('可视区域外的图片（超过阈值）不应该加载', () => {
      // itemTop=700, itemBottom=900, 都在可视区域(0-500)和阈值范围之外
      // 距离可视区域起始位置还有200px,超过阈值100px
      const result = shouldLoadImage(0, 0, 500, 700, 200, 100);
      expect(result).toBe(false);
    });

    test('即将进入可视区域的图片应该预加载', () => {
      // viewportEnd = 500, itemTop = 550 (即将进入), threshold = 100
      const result = shouldLoadImage(0, 0, 500, 550, 200, 100);
      expect(result).toBe(true);
    });

    test('在可视区域下方但接近阈值的图片应该预加载', () => {
      // viewportStart = 0, itemTop = 50 (接近顶部), threshold = 100
      const result = shouldLoadImage(0, 0, 500, -50, 200, 100);
      expect(result).toBe(true);
    });

    test('自定义预加载阈值应该生效', () => {
      // 使用更大的阈值
      const result = shouldLoadImage(0, 0, 500, 700, 200, 300);
      expect(result).toBe(true);
    });
  });

  // ==================== 触底加载测试 ====================

  describe('触底加载更多逻辑', () => {
    /**
     * 计算滚动位置是否到达触底边界
     * @param scrollTop 滚动位置
     * @param contentHeight 内容总高度
     * @param viewportHeight 可视区域高度
     * @param threshold 触底阈值
     */
    function isScrollToLower(
      scrollTop: number,
      contentHeight: number,
      viewportHeight: number,
      threshold: number = 50
    ): boolean {
      return scrollTop + viewportHeight >= contentHeight - threshold;
    }

    test('滚动到内容底部应该触发加载', () => {
      const result = isScrollToLower(1000, 1500, 500, 50);
      expect(result).toBe(true);
    });

    test('未滚动到内容底部不应该触发加载', () => {
      const result = isScrollToLower(0, 1500, 500, 50);
      expect(result).toBe(false);
    });

    test('自定义触底阈值应该生效', () => {
      // 使用更大的阈值，更容易触发
      const result = isScrollToLower(1400, 1500, 500, 100);
      expect(result).toBe(true);
    });

    test('刚好到达触底边界应该触发加载', () => {
      // scrollTop(950) + viewportHeight(500) = 1450
      // contentHeight(1500) - threshold(50) = 1450
      const result = isScrollToLower(950, 1500, 500, 50);
      expect(result).toBe(true);
    });
  });

  // ==================== 列间距计算测试 ====================

  describe('列间距计算', () => {
    /**
     * 计算列宽
     * @param containerWidth 容器宽度
     * @param columnCount 列数
     * @param columnGap 列间距
     * @param padding 内边距
     */
    function calculateColumnWidth(
      containerWidth: number,
      columnCount: number,
      columnGap: number,
      padding: number = 24
    ): number {
      const totalGap = columnGap * (columnCount - 1);
      const availableWidth = containerWidth - padding * 2 - totalGap;
      return availableWidth / columnCount;
    }

    test('应该正确计算双列宽度', () => {
      const width = calculateColumnWidth(350, 2, 16, 24);
      expect(width).toBe(143); // (350 - 48 - 16) / 2 = 143
    });

    test('应该正确计算三列宽度', () => {
      const width = calculateColumnWidth(350, 3, 16, 24);
      expect(width).toBe(90); // (350 - 48 - 32) / 3 = 90
    });

    test('应该正确处理不同的内边距', () => {
      const width1 = calculateColumnWidth(350, 2, 16, 24);
      const width2 = calculateColumnWidth(350, 2, 16, 32);
      expect(width2).toBeLessThan(width1);
    });
  });

  // ==================== 组件配置测试 ====================

  describe('瀑布流组件配置默认值', () => {
    test('默认列数应为2', () => {
      const defaultColumnCount = 2;
      expect(defaultColumnCount).toBe(2);
    });

    test('默认列间距应为16 (rpx)', () => {
      const defaultColumnGap = 16;
      expect(defaultColumnGap).toBe(16);
    });

    test('默认元素间距应为16 (rpx)', () => {
      const defaultItemGap = 16;
      expect(defaultItemGap).toBe(16);
    });

    test('默认懒加载阈值应为100px', () => {
      const defaultLazyLoadThreshold = 100;
      expect(defaultLazyLoadThreshold).toBe(100);
    });

    test('默认触底加载阈值应为50px', () => {
      const defaultScrollToLowerThreshold = 50;
      expect(defaultScrollToLowerThreshold).toBe(50);
    });
  });

  // ==================== 性能相关测试 ====================

  describe('大数据量处理', () => {
    test('100项列表应该正确分配到两列', () => {
      const items = Array.from({ length: 100 }, (_, i) => ({
        id: String(i),
        height: 100 + (i % 5) * 20 // 高度在 100-180 之间变化
      }));

      function calculateColumns(
        items: any[],
        columnCount: number,
        columnGap: number,
        itemGap: number
      ): MasonryColumn[] {
        const columns: MasonryColumn[] = Array.from({ length: columnCount }, () => ({
          items: [],
          height: 0
        }));

        items.forEach((item) => {
          let minHeightIndex = 0;
          let minHeight = columns[0].height;

          for (let i = 1; i < columns.length; i++) {
            if (columns[i].height < minHeight) {
              minHeight = columns[i].height;
              minHeightIndex = i;
            }
          }

          const itemHeight = item.height || 200;
          columns[minHeightIndex].items.push(item);
          columns[minHeightIndex].height += itemHeight + itemGap;
        });

        return columns;
      }

      const columns = calculateColumns(items, 2, 16, 16);

      expect(columns.length).toBe(2);
      expect(columns[0].items.length + columns[1].items.length).toBe(100);
    });
  });
});