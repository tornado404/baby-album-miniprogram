"use strict";
/**
 * 数据模型单元测试
 * 测试目标：T-02 宝宝信息数据模型 - 类型定义和类型守卫函数
 */
Object.defineProperty(exports, "__esModule", { value: true });
var baby_1 = require("../typings/models/baby");
var media_1 = require("../typings/models/media");
// ==================== Baby 模型测试 ====================
describe('T-02 数据模型测试 - Baby', function () {
    describe('BabyGender 枚举', function () {
        test('BabyGender 应该包含 Male, Female, Unknown 三个值', function () {
            expect(baby_1.BabyGender.Male).toBe('male');
            expect(baby_1.BabyGender.Female).toBe('female');
            expect(baby_1.BabyGender.Unknown).toBe('unknown');
        });
    });
    describe('isBaby 类型守卫', function () {
        test('应该正确识别有效的 Baby 对象', function () {
            var validBaby = {
                id: 'baby_123',
                name: '小明',
                birthDate: '2024-01-15',
                gender: baby_1.BabyGender.Male,
                createdAt: '2024-01-15T10:00:00Z',
                updatedAt: '2024-01-15T10:00:00Z'
            };
            expect((0, baby_1.isBaby)(validBaby)).toBe(true);
        });
        test('应该拒绝 null', function () {
            expect((0, baby_1.isBaby)(null)).toBe(false);
        });
        test('应该拒绝 undefined', function () {
            expect((0, baby_1.isBaby)(undefined)).toBe(false);
        });
        test('应该拒绝不包含 id 字段的对象', function () {
            var obj = { name: 'test', birthDate: '2024-01-15' };
            expect((0, baby_1.isBaby)(obj)).toBe(false);
        });
        test('应该拒绝不包含 name 字段的对象', function () {
            var obj = { id: '123' };
            expect((0, baby_1.isBaby)(obj)).toBe(false);
        });
        test('应该接受带可选字段 avatar 的 Baby 对象', function () {
            var babyWithAvatar = {
                id: 'baby_123',
                name: '小明',
                birthDate: '2024-01-15',
                gender: baby_1.BabyGender.Female,
                avatar: 'https://example.com/avatar.jpg',
                createdAt: '2024-01-15T10:00:00Z',
                updatedAt: '2024-01-15T10:00:00Z'
            };
            expect((0, baby_1.isBaby)(babyWithAvatar)).toBe(true);
        });
    });
    describe('isValidCreateBabyInput 输入验证', function () {
        test('应该接受有效的创建输入', function () {
            var validInput = {
                name: '小明',
                birthDate: '2024-01-15',
                gender: baby_1.BabyGender.Male
            };
            expect((0, baby_1.isValidCreateBabyInput)(validInput)).toBe(true);
        });
        test('应该拒绝空名字', function () {
            var invalidInput = {
                name: '',
                birthDate: '2024-01-15',
                gender: baby_1.BabyGender.Male
            };
            expect((0, baby_1.isValidCreateBabyInput)(invalidInput)).toBe(false);
        });
        test('应该拒绝无效日期格式', function () {
            var invalidInput = {
                name: '小明',
                birthDate: '2024/01/15', // 错误格式
                gender: baby_1.BabyGender.Male
            };
            expect((0, baby_1.isValidCreateBabyInput)(invalidInput)).toBe(false);
        });
        test('应该拒绝无效性别值', function () {
            var invalidInput = {
                name: '小明',
                birthDate: '2024-01-15',
                gender: 'invalid'
            };
            expect((0, baby_1.isValidCreateBabyInput)(invalidInput)).toBe(false);
        });
        test('应该拒绝 null', function () {
            expect((0, baby_1.isValidCreateBabyInput)(null)).toBe(false);
        });
    });
});
// ==================== Media 模型测试 ====================
describe('T-02 数据模型测试 - Media', function () {
    describe('MediaType 枚举', function () {
        test('MediaType 应该包含 Photo 和 Video 两个值', function () {
            expect(media_1.MediaType.Photo).toBe('photo');
            expect(media_1.MediaType.Video).toBe('video');
        });
    });
    describe('isMedia 类型守卫', function () {
        test('应该正确识别有效的 Media 对象', function () {
            var validMedia = {
                id: 'media_123',
                babyId: 'baby_456',
                type: media_1.MediaType.Photo,
                url: 'https://example.com/photo.jpg',
                size: 1024000,
                captureDate: '2024-01-15',
                createdAt: '2024-01-15T10:00:00Z',
                updatedAt: '2024-01-15T10:00:00Z'
            };
            expect((0, media_1.isMedia)(validMedia)).toBe(true);
        });
        test('应该拒绝 null', function () {
            expect((0, media_1.isMedia)(null)).toBe(false);
        });
        test('应该拒绝 undefined', function () {
            expect((0, media_1.isMedia)(undefined)).toBe(false);
        });
        test('应该拒绝不包含 id 字段的对象', function () {
            var obj = { babyId: '123', type: media_1.MediaType.Photo };
            expect((0, media_1.isMedia)(obj)).toBe(false);
        });
        test('应该拒绝不包含 babyId 字段的对象', function () {
            var obj = { id: '123', type: media_1.MediaType.Photo };
            expect((0, media_1.isMedia)(obj)).toBe(false);
        });
        test('应该接受带可选字段的完整 Media 对象', function () {
            var fullMedia = {
                id: 'media_123',
                babyId: 'baby_456',
                type: media_1.MediaType.Photo,
                url: 'https://example.com/photo.jpg',
                thumbnailUrl: 'https://example.com/thumb.jpg',
                width: 1920,
                height: 1080,
                size: 1024000,
                title: '宝宝第一次走路',
                captureDate: '2024-01-15',
                babyAge: { years: 1, months: 2, days: 15 },
                tags: ['里程碑', '走路'],
                createdAt: '2024-01-15T10:00:00Z',
                updatedAt: '2024-01-15T10:00:00Z'
            };
            expect((0, media_1.isMedia)(fullMedia)).toBe(true);
        });
    });
    describe('isValidMediaQuery 查询验证', function () {
        test('应该接受有效的查询参数', function () {
            var validQuery = {
                babyId: 'baby_123',
                page: 1,
                pageSize: 20
            };
            expect((0, media_1.isValidMediaQuery)(validQuery)).toBe(true);
        });
        test('应该接受空查询对象', function () {
            expect((0, media_1.isValidMediaQuery)({})).toBe(true);
        });
        test('应该拒绝无效页码（0）', function () {
            var invalidQuery = { page: 0 };
            expect((0, media_1.isValidMediaQuery)(invalidQuery)).toBe(false);
        });
        test('应该拒绝无效页码（负数）', function () {
            var invalidQuery = { page: -1 };
            expect((0, media_1.isValidMediaQuery)(invalidQuery)).toBe(false);
        });
        test('应该拒绝非整数字页码', function () {
            var invalidQuery = { page: 1.5 };
            expect((0, media_1.isValidMediaQuery)(invalidQuery)).toBe(false);
        });
        test('应该拒绝无效 pageSize', function () {
            var invalidQuery = { pageSize: 0 };
            expect((0, media_1.isValidMediaQuery)(invalidQuery)).toBe(false);
        });
        test('应该接受正确的分页参数', function () {
            var validQuery = {
                page: 2,
                pageSize: 10
            };
            expect((0, media_1.isValidMediaQuery)(validQuery)).toBe(true);
        });
    });
});
// ==================== 边界情况测试 ====================
describe('T-02 数据模型边界情况', function () {
    test('Baby 出生日期格式验证', function () {
        var validBaby = {
            id: 'baby_1',
            name: '测试',
            birthDate: '2024-12-31',
            gender: baby_1.BabyGender.Unknown,
            createdAt: '2024-01-01T00:00:00Z',
            updatedAt: '2024-01-01T00:00:00Z'
        };
        expect(validBaby.birthDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
    test('Media 文件大小使用 bytes 单位', function () {
        var media = {
            id: 'media_1',
            babyId: 'baby_1',
            type: media_1.MediaType.Photo,
            url: 'test.jpg',
            size: 0, // bytes
            captureDate: '2024-01-01',
            createdAt: '2024-01-01T00:00:00Z',
            updatedAt: '2024-01-01T00:00:00Z'
        };
        expect(typeof media.size).toBe('number');
        expect(media.size).toBeGreaterThanOrEqual(0);
    });
    test('BabyAge 月龄信息结构', function () {
        var age = {
            years: 1,
            months: 6,
            days: 15
        };
        expect(age.years).toBeGreaterThanOrEqual(0);
        expect(age.months).toBeGreaterThanOrEqual(0);
        expect(age.days).toBeGreaterThanOrEqual(0);
    });
});
