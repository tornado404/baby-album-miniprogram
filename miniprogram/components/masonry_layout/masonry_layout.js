"use strict";
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
        columns: [],
        columnHeights: []
    },
    lifetimes: {
        attached: function () {
            this.recalculateColumns();
        }
    },
    methods: {
        /**
         * 重新计算列布局 - 瀑布流核心算法
         * 使用贪心算法，将每个项分配到当前最短的列
         * 时间复杂度: O(n * columnCount)，但通过记录最短列索引优化
         */
        recalculateColumns: function () {
            var _this = this;
            var _a = this.properties, list = _a.list, columnCount = _a.columnCount, columnGap = _a.columnGap, itemGap = _a.itemGap;
            if (!list || list.length === 0) {
                this.setData({ columns: [], columnHeights: [] });
                return;
            }
            // 初始化列
            var columns = Array.from({ length: columnCount }, function () { return []; });
            var columnHeights = Array(columnCount).fill(0);
            // 贪心算法：将每个项分配到最短的列
            list.forEach(function (item) {
                // 找到最短列
                var minCol = 0;
                for (var i = 1; i < columnCount; i++) {
                    if (columnHeights[i] < columnHeights[minCol]) {
                        minCol = i;
                    }
                }
                // 获取项的高度
                var itemHeight = _this.getItemHeight(item);
                // 添加到最短列
                columns[minCol].push(item);
                columnHeights[minCol] += itemHeight + itemGap;
            });
            this.setData({ columns: columns, columnHeights: columnHeights });
        },
        /**
         * 获取项的高度
         * 如果项有height属性则使用，否则根据宽高比计算
         * 默认宽高比 4:3，对应宽度100%时高度为150
         */
        getItemHeight: function (item) {
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
         * 懒加载功能由 image 组件的 lazy-load 属性负责
         */
        onScrollToLower: function () {
            this.triggerEvent('scrolltolower');
        }
    },
    observers: {
        'list, columnCount, columnGap, itemGap': function () {
            this.recalculateColumns();
        }
    }
});
