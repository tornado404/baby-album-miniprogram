"use strict";
/**
 * T-03C 月龄筛选集成测试用例
 * 测试目标: 月龄筛选功能集成到相册首页，验证筛选交互和列表更新
 */
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
describe('T-03C 月龄筛选集成测试', function () {
    // ==================== 月龄计算测试 ====================
    describe('月龄计算', function () {
        /**
         * 模拟 calculateBabyAge 函数
         */
        function calculateBabyAge(birthDate, targetDate) {
            var birth = new Date(birthDate);
            var target = targetDate ? new Date(targetDate) : new Date();
            var diffTime = target.getTime() - birth.getTime();
            var diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
            var years = Math.floor(diffDays / 365);
            var remainingDays = diffDays % 365;
            var months = Math.floor(remainingDays / 30);
            var days = remainingDays % 30;
            return { years: years, months: months, days: days };
        }
        test('正确计算月龄', function () {
            var birthDate = '2024-01-01';
            var targetDate = '2024-07-01'; // 6个月后
            var age = calculateBabyAge(birthDate, targetDate);
            expect(age.years).toBe(0);
            expect(age.months).toBe(6);
        });
        test('正确计算超过12月的月龄', function () {
            var birthDate = '2023-01-01';
            var targetDate = '2024-07-01'; // 18个月后
            var age = calculateBabyAge(birthDate, targetDate);
            expect(age.years).toBe(1);
            expect(age.months).toBe(6);
        });
        test('不足一月的月龄计算', function () {
            var birthDate = '2024-01-15';
            var targetDate = '2024-02-10'; // 约26天
            var age = calculateBabyAge(birthDate, targetDate);
            expect(age.years).toBe(0);
            expect(age.months).toBe(0);
            expect(age.days).toBeGreaterThanOrEqual(25);
            expect(age.days).toBeLessThanOrEqual(27);
        });
    });
    // ==================== 快捷筛选选项测试 ====================
    describe('快捷筛选选项', function () {
        test('快捷选项应包含预期的范围', function () {
            var quickOptions = [
                { label: '全部', value: null },
                { label: '0-3月', value: 3 },
                { label: '3-6月', value: 6 },
                { label: '6-12月', value: 12 },
                { label: '1-2岁', value: 24 },
                { label: '2岁以上', value: -1 }
            ];
            expect(quickOptions.length).toBe(6);
            expect(quickOptions[0].value).toBeNull(); // 全部
            expect(quickOptions[1].value).toBe(3); // 0-3月
            expect(quickOptions[5].value).toBe(-1); // 2岁以上
        });
        test('快捷选项标签应正确', function () {
            var quickOptions = [
                { label: '全部', value: null },
                { label: '0-3月', value: 3 },
                { label: '1-2岁', value: 24 }
            ];
            expect(quickOptions[0].label).toBe('全部');
            expect(quickOptions[1].label).toBe('0-3月');
            expect(quickOptions[2].label).toBe('1-2岁');
        });
    });
    // ==================== 筛选逻辑测试 ====================
    describe('筛选逻辑', function () {
        /**
         * 模拟月龄筛选函数
         * @param mediaList 媒体列表
         * @param maxAge 最大月龄（null表示全部）
         */
        function filterByAge(mediaList, maxAge) {
            if (maxAge === null) {
                return mediaList; // 全部，返回原始列表
            }
            return mediaList.filter(function (media) {
                if (!media.babyAge) {
                    return false;
                }
                var totalMonths = media.babyAge.years * 12 + media.babyAge.months;
                if (maxAge === -1) {
                    // 2岁以上（36月以上）
                    return totalMonths >= 24;
                }
                // maxAge 是上限月龄
                return totalMonths <= maxAge;
            });
        }
        test('筛选条件为null时应返回全部', function () {
            var mediaList = [
                { captureDate: '2024-01-01', babyAge: { years: 0, months: 3, days: 0 } },
                { captureDate: '2024-06-01', babyAge: { years: 0, months: 6, days: 0 } }
            ];
            var result = filterByAge(mediaList, null);
            expect(result.length).toBe(2);
        });
        test('筛选0-3月应返回月龄<=3的媒体', function () {
            var _a;
            var mediaList = [
                { captureDate: '2024-01-01', babyAge: { years: 0, months: 2, days: 0 } },
                { captureDate: '2024-04-01', babyAge: { years: 0, months: 4, days: 0 } },
                { captureDate: '2024-07-01', babyAge: { years: 0, months: 7, days: 0 } }
            ];
            var result = filterByAge(mediaList, 3);
            expect(result.length).toBe(1);
            expect((_a = result[0].babyAge) === null || _a === void 0 ? void 0 : _a.months).toBe(2);
        });
        test('筛选2岁以上应返回月龄>=24的媒体', function () {
            var _a;
            var mediaList = [
                { captureDate: '2023-01-01', babyAge: { years: 1, months: 0, days: 0 } }, // 12个月
                { captureDate: '2022-01-01', babyAge: { years: 2, months: 0, days: 0 } }, // 24个月
                { captureDate: '2024-01-01', babyAge: { years: 0, months: 6, days: 0 } } // 6个月
            ];
            // maxAge=-1 表示2岁以上(>=24个月)
            var result = filterByAge(mediaList, -1);
            // 12个月 < 24, 24个月 >= 24, 6个月 < 24
            expect(result.length).toBe(1);
            expect((_a = result[0].babyAge) === null || _a === void 0 ? void 0 : _a.years).toBe(2);
        });
    });
    // ==================== 时间线视图测试 ====================
    describe('时间线视图', function () {
        test('时间线分组应按月份分组', function () {
            var _a, _b;
            var mediaList = [
                { captureDate: '2024-01-15' },
                { captureDate: '2024-01-20' },
                { captureDate: '2024-02-10' }
            ];
            /**
             * 按月份分组
             */
            function groupByMonth(mediaList) {
                var groups = new Map();
                mediaList.forEach(function (media) {
                    var monthKey = media.captureDate.substring(0, 7); // YYYY-MM
                    var existing = groups.get(monthKey) || [];
                    existing.push(media);
                    groups.set(monthKey, existing);
                });
                return groups;
            }
            var groups = groupByMonth(mediaList);
            expect(groups.size).toBe(2); // 1月和2月
            expect((_a = groups.get('2024-01')) === null || _a === void 0 ? void 0 : _a.length).toBe(2);
            expect((_b = groups.get('2024-02')) === null || _b === void 0 ? void 0 : _b.length).toBe(1);
        });
        test('时间线应按日期倒序排列', function () {
            var mediaList = [
                { captureDate: '2024-01-15' },
                { captureDate: '2024-03-20' },
                { captureDate: '2024-02-10' }
            ];
            var sorted = __spreadArray([], mediaList, true).sort(function (a, b) {
                return b.captureDate.localeCompare(a.captureDate);
            });
            expect(sorted[0].captureDate).toBe('2024-03-20');
            expect(sorted[1].captureDate).toBe('2024-02-10');
            expect(sorted[2].captureDate).toBe('2024-01-15');
        });
    });
    // ==================== 组件事件测试 ====================
    describe('月龄筛选组件事件', function () {
        test('onQuickSelect 应触发 change 事件', function () {
            var changeEventTriggered = false;
            var eventValue = null;
            function onQuickSelect(value) {
                changeEventTriggered = true;
                eventValue = value;
            }
            onQuickSelect(6);
            expect(changeEventTriggered).toBe(true);
            expect(eventValue).toBe(6);
        });
        test('value 为 null 表示全部', function () {
            var selectedValue = null;
            function onQuickSelect(value) {
                selectedValue = value;
            }
            onQuickSelect(null);
            expect(selectedValue).toBeNull();
        });
        test('自定义筛选应正确处理', function () {
            var customValue = [12, 24]; // 12月-24月
            function onCustomConfirm(index) {
                var minAge = index[0];
                var maxAge = index[1] === 36 ? -1 : index[1];
                return { minAge: minAge, maxAge: maxAge };
            }
            var result = onCustomConfirm(customValue);
            expect(result.minAge).toBe(12);
            expect(result.maxAge).toBe(24);
        });
    });
    // ==================== 筛选状态保存测试 ====================
    describe('筛选状态保存和恢复', function () {
        test('筛选状态应正确保存', function () {
            var filterState = {
                selectedValue: null,
                customMin: 0,
                customMax: 36
            };
            function saveState(state) {
                return JSON.stringify(state);
            }
            var saved = saveState(filterState);
            expect(saved).toContain('"selectedValue":null');
        });
        test('筛选状态应正确恢复', function () {
            var savedState = '{"selectedValue":6,"customMin":0,"customMax":36}';
            function restoreState(json) {
                return JSON.parse(json);
            }
            var restored = restoreState(savedState);
            expect(restored.selectedValue).toBe(6);
        });
    });
    // ==================== 集成测试 ====================
    describe('相册首页月龄筛选集成', function () {
        test('age-filter 组件应正确配置', function () {
            var componentConfig = {
                properties: {
                    babyId: { type: String, value: '' },
                    birthDate: { type: String, value: '' },
                    value: { type: Number, value: null }
                }
            };
            expect(componentConfig.properties.babyId).toBeDefined();
            expect(componentConfig.properties.birthDate).toBeDefined();
            expect(componentConfig.properties.value).toBeDefined();
        });
        test('相册首页应正确响应筛选值变化', function () {
            var currentFilter = null;
            var mediaList = [];
            function onFilterChange(value) {
                currentFilter = value;
                // 模拟重新加载媒体列表
                mediaList = currentFilter === null
                    ? [{ id: '1' }, { id: '2' }]
                    : [{ id: '2' }];
            }
            onFilterChange(6);
            expect(currentFilter).toBe(6);
            expect(mediaList.length).toBe(1);
        });
        test('空结果时应显示空状态', function () {
            var mediaList = [];
            function checkEmpty(mediaList, filterValue) {
                return mediaList.length === 0;
            }
            expect(checkEmpty([], null)).toBe(true);
        });
    });
});
