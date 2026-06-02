/**
 * 数据模型单元测试
 * 测试目标：T-02 宝宝信息数据模型 - 类型定义和类型守卫函数
 */

import {
  BabyGender,
  isBaby,
  isValidCreateBabyInput,
  Baby,
  CreateBabyInput,
  BabyAge
} from '../typings/models/baby';

import {
  MediaType,
  Media,
  MediaQuery,
  isMedia,
  isValidMediaQuery
} from '../typings/models/media';

// ==================== Baby 模型测试 ====================

describe('T-02 数据模型测试 - Baby', () => {
  describe('BabyGender 枚举', () => {
    test('BabyGender 应该包含 Male, Female, Unknown 三个值', () => {
      expect(BabyGender.Male).toBe('male');
      expect(BabyGender.Female).toBe('female');
      expect(BabyGender.Unknown).toBe('unknown');
    });
  });

  describe('isBaby 类型守卫', () => {
    test('应该正确识别有效的 Baby 对象', () => {
      const validBaby: Baby = {
        id: 'baby_123',
        name: '小明',
        birthDate: '2024-01-15',
        gender: BabyGender.Male,
        createdAt: '2024-01-15T10:00:00Z',
        updatedAt: '2024-01-15T10:00:00Z'
      };
      expect(isBaby(validBaby)).toBe(true);
    });

    test('应该拒绝 null', () => {
      expect(isBaby(null)).toBe(false);
    });

    test('应该拒绝 undefined', () => {
      expect(isBaby(undefined)).toBe(false);
    });

    test('应该拒绝不包含 id 字段的对象', () => {
      const obj = { name: 'test', birthDate: '2024-01-15' };
      expect(isBaby(obj)).toBe(false);
    });

    test('应该拒绝不包含 name 字段的对象', () => {
      const obj = { id: '123' };
      expect(isBaby(obj)).toBe(false);
    });

    test('应该接受带可选字段 avatar 的 Baby 对象', () => {
      const babyWithAvatar: Baby = {
        id: 'baby_123',
        name: '小明',
        birthDate: '2024-01-15',
        gender: BabyGender.Female,
        avatar: 'https://example.com/avatar.jpg',
        createdAt: '2024-01-15T10:00:00Z',
        updatedAt: '2024-01-15T10:00:00Z'
      };
      expect(isBaby(babyWithAvatar)).toBe(true);
    });
  });

  describe('isValidCreateBabyInput 输入验证', () => {
    test('应该接受有效的创建输入', () => {
      const validInput: CreateBabyInput = {
        name: '小明',
        birthDate: '2024-01-15',
        gender: BabyGender.Male
      };
      expect(isValidCreateBabyInput(validInput)).toBe(true);
    });

    test('应该拒绝空名字', () => {
      const invalidInput = {
        name: '',
        birthDate: '2024-01-15',
        gender: BabyGender.Male
      };
      expect(isValidCreateBabyInput(invalidInput)).toBe(false);
    });

    test('应该拒绝无效日期格式', () => {
      const invalidInput = {
        name: '小明',
        birthDate: '2024/01/15', // 错误格式
        gender: BabyGender.Male
      };
      expect(isValidCreateBabyInput(invalidInput)).toBe(false);
    });

    test('应该拒绝无效性别值', () => {
      const invalidInput = {
        name: '小明',
        birthDate: '2024-01-15',
        gender: 'invalid' as BabyGender
      };
      expect(isValidCreateBabyInput(invalidInput)).toBe(false);
    });

    test('应该拒绝 null', () => {
      expect(isValidCreateBabyInput(null)).toBe(false);
    });
  });
});

// ==================== Media 模型测试 ====================

describe('T-02 数据模型测试 - Media', () => {
  describe('MediaType 枚举', () => {
    test('MediaType 应该包含 Photo 和 Video 两个值', () => {
      expect(MediaType.Photo).toBe('photo');
      expect(MediaType.Video).toBe('video');
    });
  });

  describe('isMedia 类型守卫', () => {
    test('应该正确识别有效的 Media 对象', () => {
      const validMedia: Media = {
        id: 'media_123',
        babyId: 'baby_456',
        type: MediaType.Photo,
        url: 'https://example.com/photo.jpg',
        size: 1024000,
        captureDate: '2024-01-15',
        createdAt: '2024-01-15T10:00:00Z',
        updatedAt: '2024-01-15T10:00:00Z'
      };
      expect(isMedia(validMedia)).toBe(true);
    });

    test('应该拒绝 null', () => {
      expect(isMedia(null)).toBe(false);
    });

    test('应该拒绝 undefined', () => {
      expect(isMedia(undefined)).toBe(false);
    });

    test('应该拒绝不包含 id 字段的对象', () => {
      const obj = { babyId: '123', type: MediaType.Photo };
      expect(isMedia(obj)).toBe(false);
    });

    test('应该拒绝不包含 babyId 字段的对象', () => {
      const obj = { id: '123', type: MediaType.Photo };
      expect(isMedia(obj)).toBe(false);
    });

    test('应该接受带可选字段的完整 Media 对象', () => {
      const fullMedia: Media = {
        id: 'media_123',
        babyId: 'baby_456',
        type: MediaType.Photo,
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
      expect(isMedia(fullMedia)).toBe(true);
    });
  });

  describe('isValidMediaQuery 查询验证', () => {
    test('应该接受有效的查询参数', () => {
      const validQuery: MediaQuery = {
        babyId: 'baby_123',
        page: 1,
        pageSize: 20
      };
      expect(isValidMediaQuery(validQuery)).toBe(true);
    });

    test('应该接受空查询对象', () => {
      expect(isValidMediaQuery({})).toBe(true);
    });

    test('应该拒绝无效页码（0）', () => {
      const invalidQuery = { page: 0 };
      expect(isValidMediaQuery(invalidQuery)).toBe(false);
    });

    test('应该拒绝无效页码（负数）', () => {
      const invalidQuery = { page: -1 };
      expect(isValidMediaQuery(invalidQuery)).toBe(false);
    });

    test('应该拒绝非整数字页码', () => {
      const invalidQuery = { page: 1.5 };
      expect(isValidMediaQuery(invalidQuery)).toBe(false);
    });

    test('应该拒绝无效 pageSize', () => {
      const invalidQuery = { pageSize: 0 };
      expect(isValidMediaQuery(invalidQuery)).toBe(false);
    });

    test('应该接受正确的分页参数', () => {
      const validQuery: MediaQuery = {
        page: 2,
        pageSize: 10
      };
      expect(isValidMediaQuery(validQuery)).toBe(true);
    });
  });
});

// ==================== 边界情况测试 ====================

describe('T-02 数据模型边界情况', () => {
  test('Baby 出生日期格式验证', () => {
    const validBaby: Baby = {
      id: 'baby_1',
      name: '测试',
      birthDate: '2024-12-31',
      gender: BabyGender.Unknown,
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z'
    };
    expect(validBaby.birthDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  test('Media 文件大小使用 bytes 单位', () => {
    const media: Media = {
      id: 'media_1',
      babyId: 'baby_1',
      type: MediaType.Photo,
      url: 'test.jpg',
      size: 0, // bytes
      captureDate: '2024-01-01',
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z'
    };
    expect(typeof media.size).toBe('number');
    expect(media.size).toBeGreaterThanOrEqual(0);
  });

  test('BabyAge 月龄信息结构', () => {
    const age: BabyAge = {
      years: 1,
      months: 6,
      days: 15
    };
    expect(age.years).toBeGreaterThanOrEqual(0);
    expect(age.months).toBeGreaterThanOrEqual(0);
    expect(age.days).toBeGreaterThanOrEqual(0);
  });
});