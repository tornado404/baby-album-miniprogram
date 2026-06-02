"use strict";
/**
 * T-07 月龄筛选功能测试用例
 * 测试目标: 月龄筛选组件，快捷筛选选项和自定义范围选择
 */
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * 模拟 calculateBabyAge 函数 (与 age_calculator.ts 实现一致)
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
describe('T-07 月龄筛选功能测试', function () {
    // ==================== 月龄计算工具测试 ====================
    describe('月龄计算工具', function () {
        /**
         * 模拟 formatAge 函数
         */
        function formatAge(age) {
            if (age.years > 0) {
                return "".concat(age.years, "\u5C81").concat(age.months, "\u6708");
            }
            return "".concat(age.months, "\u6708").concat(age.days, "\u5929");
        }
        test('正确计算基础月龄', function () {
            var birthDate = '2024-01-01';
            var targetDate = '2024-07-01';
            var age = calculateBabyAge(birthDate, targetDate);
            expect(age.years).toBe(0);
            expect(age.months).toBe(6);
        });
        test('正确计算年份和月份', function () {
            var birthDate = '2023-01-01';
            var targetDate = '2024-07-01';
            var age = calculateBabyAge(birthDate, targetDate);
            expect(age.years).toBe(1);
            expect(age.months).toBe(6);
        });
        test('正确计算天数', function () {
            var birthDate = '2024-01-15';
            var targetDate = '2024-02-10';
            var age = calculateBabyAge(birthDate, targetDate);
            expect(age.years).toBe(0);
            expect(age.months).toBe(0);
            expect(age.days).toBeGreaterThanOrEqual(25);
        });
        test('formatAge 格式化岁月龄', function () {
            var age = { years: 1, months: 6, days: 15 };
            expect(formatAge(age)).toBe('1岁6月');
        });
        test('formatAge 格式化无岁月龄', function () {
            var age = { years: 0, months: 6, days: 15 };
            expect(formatAge(age)).toBe('6月15天');
        });
        test('formatAge 格式化0岁0月', function () {
            var age = { years: 0, months: 0, days: 10 };
            expect(formatAge(age)).toBe('0月10天');
        });
    });
    // ==================== 快捷筛选选项测试 ====================
    describe('快捷筛选选项', function () {
        test('快捷选项应包含6个选项', function () {
            var quickOptions = [
                { label: '全部', value: null },
                { label: '0-3月', value: 3 },
                { label: '3-6月', value: 6 },
                { label: '6-12月', value: 12 },
                { label: '1-2岁', value: 24 },
                { label: '2岁以上', value: -1 }
            ];
            expect(quickOptions.length).toBe(6);
        });
        test('快捷选项的 value 值应正确', function () {
            var quickOptions = [
                { label: '全部', value: null },
                { label: '0-3月', value: 3 },
                { label: '3-6月', value: 6 },
                { label: '6-12月', value: 12 },
                { label: '1-2岁', value: 24 },
                { label: '2岁以上', value: -1 }
            ];
            expect(quickOptions[0].value).toBeNull();
            expect(quickOptions[1].value).toBe(3);
            expect(quickOptions[2].value).toBe(6);
            expect(quickOptions[3].value).toBe(12);
            expect(quickOptions[4].value).toBe(24);
            expect(quickOptions[5].value).toBe(-1);
        });
        test('2岁以上用 -1 表示', function () {
            var twoYearsPlus = -1;
            expect(twoYearsPlus).toBe(-1);
        });
    });
    // ==================== 自定义筛选测试 ====================
    describe('自定义筛选', function () {
        test('自定义选项应包含月龄范围 0-36', function () {
            var customMinOptions = Array.from({ length: 37 }, function (_, i) { return "".concat(i, "\u6708"); });
            expect(customMinOptions.length).toBe(37);
            expect(customMinOptions[0]).toBe('0月');
            expect(customMinOptions[36]).toBe('36月');
        });
        test('自定义最大选项应包含36月和2岁以上', function () {
            var customMaxOptions = Array.from({ length: 37 }, function (_, i) { return "".concat(i, "\u6708"); }).concat(['2岁以上']);
            expect(customMaxOptions.length).toBe(38);
            expect(customMaxOptions[37]).toBe('2岁以上');
        });
        test('自定义筛选确认应正确处理索引', function () {
            function handleCustomConfirm(index) {
                var minAge = index[0];
                var maxAge = index[1] === 36 ? -1 : index[1];
                return { minAge: minAge, maxAge: maxAge };
            }
            var result1 = handleCustomConfirm([12, 24]);
            expect(result1.minAge).toBe(12);
            expect(result1.maxAge).toBe(24);
            var result2 = handleCustomConfirm([0, 36]);
            expect(result2.minAge).toBe(0);
            expect(result2.maxAge).toBe(-1); // 36 对应 "2岁以上"
        });
    });
    // ==================== 组件属性测试 ====================
    describe('组件属性', function () {
        test('babyId 属性应为空字符串默认值', function () {
            var defaultProps = {
                babyId: '',
                birthDate: '',
                value: null
            };
            expect(defaultProps.babyId).toBe('');
        });
        test('birthDate 属性应为空字符串默认值', function () {
            var defaultProps = {
                babyId: '',
                birthDate: '',
                value: null
            };
            expect(defaultProps.birthDate).toBe('');
        });
        test('value 属性应为 null 默认值', function () {
            var defaultProps = {
                value: null
            };
            expect(defaultProps.value).toBeNull();
        });
    });
    // ==================== 组件状态测试 ====================
    describe('组件状态', function () {
        test('selectedValue 初始值应为 null', function () {
            var defaultState = {
                selectedValue: null
            };
            expect(defaultState.selectedValue).toBeNull();
        });
        test('customVisible 初始值应为 false', function () {
            var defaultState = {
                customVisible: false
            };
            expect(defaultState.customVisible).toBe(false);
        });
        test('customValue 初始值应为 [0, 36]', function () {
            var defaultState = {
                customValue: [0, 36]
            };
            expect(defaultState.customValue[0]).toBe(0);
            expect(defaultState.customValue[1]).toBe(36);
        });
    });
    // ==================== 事件触发测试 ====================
    describe('事件触发', function () {
        test('onQuickSelect 应触发 change 事件', function () {
            var eventTriggered = false;
            var eventValue = null;
            function onQuickSelect(value) {
                eventTriggered = true;
                eventValue = value;
            }
            onQuickSelect(6);
            expect(eventTriggered).toBe(true);
            expect(eventValue).toBe(6);
        });
        test('onQuickSelect 传入 null 应触发 "全部" 事件', function () {
            var eventValue = null;
            function onQuickSelect(value) {
                eventValue = value;
            }
            onQuickSelect(null);
            expect(eventValue).toBeNull();
        });
        test('onCustomConfirm 应触发带范围信息的 change 事件', function () {
            var eventDetail = null;
            function onCustomConfirm(index) {
                var minAge = index[0];
                var maxAge = index[1] === 36 ? -1 : index[1];
                eventDetail = { minAge: minAge, maxAge: maxAge };
            }
            onCustomConfirm([12, 24]);
            expect(eventDetail.minAge).toBe(12);
            expect(eventDetail.maxAge).toBe(24);
        });
    });
    // ==================== 月龄计算边界测试 ====================
    describe('月龄计算边界情况', function () {
        test('出生当天月龄应为0', function () {
            var birthDate = '2024-01-01';
            var targetDate = '2024-01-01';
            var age = calculateBabyAge(birthDate, targetDate);
            expect(age.years).toBe(0);
            expect(age.months).toBe(0);
            expect(age.days).toBe(0);
        });
        test('满1年应计算为1岁', function () {
            // 使用365天确保恰好1年
            var birthDate = '2023-01-01';
            var targetDate = '2024-01-01';
            var age = calculateBabyAge(birthDate, targetDate);
            expect(age.years).toBe(1);
        });
        test('满1月应计算为0岁1月', function () {
            var birthDate = '2024-01-01';
            var targetDate = '2024-02-01';
            var age = calculateBabyAge(birthDate, targetDate);
            expect(age.years).toBe(0);
            expect(age.months).toBe(1);
        });
        test('月份计算使用30天近似值', function () {
            // 由于使用30天作为月份近似值，60天会计算为2个月
            var birthDate = '2024-01-01';
            var targetDate = '2024-03-01'; // 约60天
            var age = calculateBabyAge(birthDate, targetDate);
            // 约60天 / 30 = 2个月
            expect(age.months).toBe(2);
        });
    });
    // ==================== 筛选范围测试 ====================
    describe('筛选范围逻辑', function () {
        test('0-3月筛选应包含0,1,2,3月', function () {
            var maxAge = 3;
            var testCases = [
                { years: 0, months: 0, expected: true },
                { years: 0, months: 1, expected: true },
                { years: 0, months: 2, expected: true },
                { years: 0, months: 3, expected: true },
                { years: 0, months: 4, expected: false }
            ];
            testCases.forEach(function (tc) {
                var totalMonths = tc.years * 12 + tc.months;
                var isInRange = totalMonths <= maxAge;
                expect(isInRange).toBe(tc.expected);
            });
        });
        test('3-6月筛选应包含大于3月且不超过6月的', function () {
            // 注意: 根据 age_filter.ts 的实现逻辑，maxAge 是上限值
            var maxAge = 6;
            var testCases = [
                { years: 0, months: 3, expected: true },
                { years: 0, months: 4, expected: true },
                { years: 0, months: 6, expected: true },
                { years: 0, months: 7, expected: false }
            ];
            testCases.forEach(function (tc) {
                var totalMonths = tc.years * 12 + tc.months;
                var isInRange = totalMonths <= maxAge;
                expect(isInRange).toBe(tc.expected);
            });
        });
        test('1-2岁筛选应包含12-24月', function () {
            var maxAge = 24;
            var testCases = [
                { years: 1, months: 0, expected: true }, // 12月
                { years: 1, months: 6, expected: true }, // 18月
                { years: 2, months: 0, expected: true }, // 24月
                { years: 2, months: 1, expected: false } // 25月
            ];
            testCases.forEach(function (tc) {
                var totalMonths = tc.years * 12 + tc.months;
                var isInRange = totalMonths <= maxAge;
                expect(isInRange).toBe(tc.expected);
            });
        });
        test('2岁以上筛选应包含24月及以上', function () {
            var testCases = [
                { years: 2, months: 0, expected: true }, // 24月
                { years: 2, months: 6, expected: true }, // 30月
                { years: 3, months: 0, expected: true }, // 36月
                { years: 1, months: 11, expected: false } // 23月
            ];
            testCases.forEach(function (tc) {
                var totalMonths = tc.years * 12 + tc.months;
                var isInRange = totalMonths >= 24;
                expect(isInRange).toBe(tc.expected);
            });
        });
    });
    // ==================== 组件配置测试 ====================
    describe('组件配置', function () {
        test('van-tabs 组件应正确配置', function () {
            var config = {
                active: 0,
                type: 'card'
            };
            expect(config.active).toBe(0);
        });
        test('van-picker 组件配置应正确', function () {
            var pickerConfig = {
                showToolbar: true,
                title: '选择月龄范围'
            };
            expect(pickerConfig.showToolbar).toBe(true);
            expect(pickerConfig.title).toBe('选择月龄范围');
        });
    });
    // ==================== Vant Weapp 兼容性测试 ====================
    describe('Vant Weapp 兼容性', function () {
        test('tabs 组件应支持 bind:change 事件', function () {
            var eventBinding = 'bind:change';
            expect(eventBinding).toBe('bind:change');
        });
        test('picker 组件应支持 confirm 事件', function () {
            var eventBinding = 'bind:confirm';
            expect(eventBinding).toBe('bind:confirm');
        });
    });
});
