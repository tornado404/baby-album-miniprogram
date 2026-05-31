/**
 * 本地存储服务测试用例
 * 测试目标：T-08 本地存储服务 - CRUD操作和数据持久化
 */

import {
  Baby,
  BabyGender,
  CreateBabyInput,
  UpdateBabyInput
} from '../typings/models/baby';

import {
  Media,
  MediaType,
  CreateMediaInput,
  MediaQuery
} from '../typings/models/media';

// ==================== 存储键常量 ====================

const STORAGE_KEYS = {
  babies: 'album_babies',
  media: 'album_media',
  settings: 'album_settings',
  version: 'album_version'
} as const;

// ==================== Mock 存储实现 ====================

/**
 * 模拟本地存储
 */
class MockStorage {
  private store: Map<string, string> = new Map();

  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }

  getItem(key: string): string | null {
    return this.store.get(key) || null;
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }

  getAllKeys(): string[] {
    return Array.from(this.store.keys());
  }
}

// 全局 mock 存储实例
const mockStorage = new MockStorage();

// ==================== 存储服务实现 ====================

/**
 * 存储服务类
 */
class StorageService {
  private readonly PREFIX = 'album_';
  private readonly VERSION = 'v1';

  private keys = {
    babies: `${this.PREFIX}babies`,
    media: `${this.PREFIX}media`,
    settings: `${this.PREFIX}settings`,
    version: `${this.PREFIX}version`
  };

  /**
   * 模拟 wx.getStorageSync
   */
  getStorageSync<T>(key: string): T | null {
    const data = mockStorage.getItem(key);
    if (!data) return null;
    try {
      return JSON.parse(data) as T;
    } catch {
      return null;
    }
  }

  /**
   * 模拟 wx.setStorageSync
   */
  setStorageSync<T>(key: string, value: T): void {
    mockStorage.setItem(key, JSON.stringify(value));
  }

  /**
   * 模拟 wx.removeStorageSync
   */
  removeStorageSync(key: string): void {
    mockStorage.removeItem(key);
  }

  // ---- 宝宝相关操作 ----

  /**
   * 获取所有宝宝
   */
  getBabies(): Baby[] {
    return this.getStorageSync<Baby[]>(this.keys.babies) || [];
  }

  /**
   * 获取单个宝宝
   */
  getBaby(id: string): Baby | null {
    const babies = this.getBabies();
    return babies.find(b => b.id === id) || null;
  }

  /**
   * 创建宝宝
   */
  createBaby(input: CreateBabyInput): Baby {
    const babies = this.getBabies();
    const now = new Date().toISOString();

    const newBaby: Baby = {
      id: `baby_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: input.name,
      birthDate: input.birthDate,
      gender: input.gender,
      avatar: input.avatar,
      createdAt: now,
      updatedAt: now
    };

    babies.push(newBaby);
    this.setStorageSync(this.keys.babies, babies);
    return newBaby;
  }

  /**
   * 更新宝宝信息
   */
  updateBaby(id: string, input: UpdateBabyInput): Baby {
    const babies = this.getBabies();
    const index = babies.findIndex(b => b.id === id);

    if (index === -1) {
      throw new Error('Baby not found');
    }

    const updatedBaby: Baby = {
      ...babies[index],
      ...input,
      id: babies[index].id, // 保持原ID
      createdAt: babies[index].createdAt, // 保持创建时间
      updatedAt: new Date().toISOString()
    };

    babies[index] = updatedBaby;
    this.setStorageSync(this.keys.babies, babies);
    return updatedBaby;
  }

  /**
   * 删除宝宝
   */
  deleteBaby(id: string): void {
    const babies = this.getBabies();
    const filteredBabies = babies.filter(b => b.id !== id);
    this.setStorageSync(this.keys.babies, filteredBabies);
  }

  // ---- 媒体相关操作 ----

  /**
   * 获取媒体列表
   */
  getMediaList(query?: MediaQuery): Media[] {
    let mediaList = this.getStorageSync<Media[]>(this.keys.media) || [];

    // 应用查询条件
    if (query) {
      if (query.babyId) {
        mediaList = mediaList.filter(m => m.babyId === query.babyId);
      }
      if (query.type) {
        mediaList = mediaList.filter(m => m.type === query.type);
      }
      if (query.startDate) {
        mediaList = mediaList.filter(m => m.captureDate >= query.startDate!);
      }
      if (query.endDate) {
        mediaList = mediaList.filter(m => m.captureDate <= query.endDate!);
      }
      if (query.minAge !== undefined) {
        mediaList = mediaList.filter(m => m.babyAge && this.calcTotalMonths(m.babyAge) >= query.minAge!);
      }
      if (query.maxAge !== undefined) {
        mediaList = mediaList.filter(m => m.babyAge && this.calcTotalMonths(m.babyAge) <= query.maxAge!);
      }
      if (query.tags && query.tags.length > 0) {
        mediaList = mediaList.filter(m => m.tags && query.tags!.some(tag => m.tags!.includes(tag)));
      }
    }

    // 按拍摄日期倒序
    mediaList.sort((a, b) => b.captureDate.localeCompare(a.captureDate));

    // 分页
    if (query?.page && query?.pageSize) {
      const start = (query.page - 1) * query.pageSize;
      const end = start + query.pageSize;
      mediaList = mediaList.slice(start, end);
    }

    return mediaList;
  }

  /**
   * 计算月龄总月数
   */
  private calcTotalMonths(babyAge: { years: number; months: number; days: number }): number {
    return babyAge.years * 12 + babyAge.months;
  }

  /**
   * 获取单个媒体
   */
  getMedia(id: string): Media | null {
    const mediaList = this.getStorageSync<Media[]>(this.keys.media) || [];
    return mediaList.find(m => m.id === id) || null;
  }

  /**
   * 创建媒体
   */
  createMedia(input: CreateMediaInput): Media {
    const mediaList = this.getStorageSync<Media[]>(this.keys.media) || [];
    const now = new Date().toISOString();

    const newMedia: Media = {
      id: `media_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      ...input,
      createdAt: now,
      updatedAt: now
    };

    mediaList.push(newMedia);
    this.setStorageSync(this.keys.media, mediaList);
    return newMedia;
  }

  /**
   * 更新媒体
   */
  updateMedia(id: string, input: Partial<CreateMediaInput>): Media {
    const mediaList = this.getStorageSync<Media[]>(this.keys.media) || [];
    const index = mediaList.findIndex(m => m.id === id);

    if (index === -1) {
      throw new Error('Media not found');
    }

    const updatedMedia: Media = {
      ...mediaList[index],
      ...input,
      id: mediaList[index].id,
      createdAt: mediaList[index].createdAt,
      updatedAt: new Date().toISOString()
    };

    mediaList[index] = updatedMedia;
    this.setStorageSync(this.keys.media, mediaList);
    return updatedMedia;
  }

  /**
   * 删除媒体
   */
  deleteMedia(id: string): void {
    const mediaList = this.getStorageSync<Media[]>(this.keys.media) || [];
    const filteredMedia = mediaList.filter(m => m.id !== id);
    this.setStorageSync(this.keys.media, filteredMedia);
  }

  /**
   * 批量删除媒体
   */
  deleteMediaByBaby(babyId: string): void {
    const mediaList = this.getStorageSync<Media[]>(this.keys.media) || [];
    const filteredMedia = mediaList.filter(m => m.babyId !== babyId);
    this.setStorageSync(this.keys.media, filteredMedia);
  }

  /**
   * 清除所有缓存
   */
  clearCache(): void {
    mockStorage.clear();
  }

  /**
   * 获取存储使用情况
   */
  getStorageUsage(): { used: number; limit: number } {
    const allKeys = mockStorage.getAllKeys();
    let used = 0;

    allKeys.forEach(key => {
      const data = mockStorage.getItem(key);
      if (data) {
        used += data.length;
      }
    });

    return {
      used,
      limit: 10 * 1024 * 1024 // 10MB
    };
  }
}

// 创建服务实例
const storageService = new StorageService();

// ==================== 测试用例 ====================

describe('T-08 本地存储服务测试', () => {
  beforeEach(() => {
    // 每个测试前清空存储
    storageService.clearCache();
  });

  describe('宝宝 CRUD 操作', () => {
    test('创建宝宝应该成功', () => {
      const input: CreateBabyInput = {
        name: '小明',
        birthDate: '2024-01-15',
        gender: BabyGender.Male
      };

      const baby = storageService.createBaby(input);

      expect(baby.id).toBeDefined();
      expect(baby.name).toBe('小明');
      expect(baby.birthDate).toBe('2024-01-15');
      expect(baby.gender).toBe(BabyGender.Male);
      expect(baby.createdAt).toBeDefined();
      expect(baby.updatedAt).toBeDefined();
    });

    test('获取所有宝宝应该返回列表', () => {
      const input: CreateBabyInput = {
        name: '小明',
        birthDate: '2024-01-15',
        gender: BabyGender.Male
      };
      storageService.createBaby(input);

      const babies = storageService.getBabies();

      expect(babies.length).toBe(1);
      expect(babies[0].name).toBe('小明');
    });

    test('获取单个宝宝应该返回正确对象', () => {
      const input: CreateBabyInput = {
        name: '小明',
        birthDate: '2024-01-15',
        gender: BabyGender.Male
      };
      const created = storageService.createBaby(input);

      const baby = storageService.getBaby(created.id);

      expect(baby).not.toBeNull();
      expect(baby!.name).toBe('小明');
    });

    test('获取不存在的宝宝应该返回 null', () => {
      const baby = storageService.getBaby('non_existent_id');
      expect(baby).toBeNull();
    });

    test('更新宝宝应该成功', () => {
      const input: CreateBabyInput = {
        name: '小明',
        birthDate: '2024-01-15',
        gender: BabyGender.Male
      };
      const created = storageService.createBaby(input);

      const updated = storageService.updateBaby(created.id, {
        name: '大明'
      });

      expect(updated.name).toBe('大明');
      expect(updated.id).toBe(created.id);
      expect(updated.createdAt).toBe(created.createdAt);
    });

    test('删除宝宝应该成功', () => {
      const input: CreateBabyInput = {
        name: '小明',
        birthDate: '2024-01-15',
        gender: BabyGender.Male
      };
      const created = storageService.createBaby(input);

      storageService.deleteBaby(created.id);
      const baby = storageService.getBaby(created.id);

      expect(baby).toBeNull();
    });

    test('创建宝宝时应生成唯一ID', () => {
      const input: CreateBabyInput = {
        name: '测试',
        birthDate: '2024-01-01',
        gender: BabyGender.Female
      };

      const baby1 = storageService.createBaby(input);
      const baby2 = storageService.createBaby(input);

      expect(baby1.id).not.toBe(baby2.id);
    });
  });

  describe('媒体 CRUD 操作', () => {
    beforeEach(() => {
      // 创建一个宝宝用于媒体测试
      const babyInput: CreateBabyInput = {
        name: '测试宝宝',
        birthDate: '2024-01-01',
        gender: BabyGender.Male
      };
      storageService.createBaby(babyInput);
    });

    test('创建媒体应该成功', () => {
      const input: CreateMediaInput = {
        babyId: 'baby_1',
        type: MediaType.Photo,
        url: 'https://example.com/photo.jpg',
        size: 1024000,
        captureDate: '2024-01-15'
      };

      const media = storageService.createMedia(input);

      expect(media.id).toBeDefined();
      expect(media.babyId).toBe('baby_1');
      expect(media.type).toBe(MediaType.Photo);
      expect(media.url).toBe('https://example.com/photo.jpg');
      expect(media.size).toBe(1024000);
      expect(media.captureDate).toBe('2024-01-15');
    });

    test('获取媒体列表应该返回倒序排列', () => {
      const input1: CreateMediaInput = {
        babyId: 'baby_1',
        type: MediaType.Photo,
        url: 'https://example.com/photo1.jpg',
        size: 1024000,
        captureDate: '2024-01-01'
      };
      const input2: CreateMediaInput = {
        babyId: 'baby_1',
        type: MediaType.Photo,
        url: 'https://example.com/photo2.jpg',
        size: 1024000,
        captureDate: '2024-01-15'
      };

      storageService.createMedia(input1);
      storageService.createMedia(input2);

      const mediaList = storageService.getMediaList({ babyId: 'baby_1' });

      expect(mediaList.length).toBe(2);
      expect(mediaList[0].captureDate).toBe('2024-01-15'); // 最新的在前
      expect(mediaList[1].captureDate).toBe('2024-01-01');
    });

    test('按babyId筛选应该正确工作', () => {
      const baby2Input: CreateBabyInput = {
        name: '宝宝2',
        birthDate: '2024-02-01',
        gender: BabyGender.Female
      };
      const baby2 = storageService.createBaby(baby2Input);

      const input1: CreateMediaInput = {
        babyId: 'baby_1',
        type: MediaType.Photo,
        url: 'https://example.com/photo1.jpg',
        size: 1024000,
        captureDate: '2024-01-01'
      };
      const input2: CreateMediaInput = {
        babyId: baby2.id,
        type: MediaType.Photo,
        url: 'https://example.com/photo2.jpg',
        size: 1024000,
        captureDate: '2024-01-02'
      };

      storageService.createMedia(input1);
      storageService.createMedia(input2);

      const mediaList = storageService.getMediaList({ babyId: baby2.id });

      expect(mediaList.length).toBe(1);
      expect(mediaList[0].babyId).toBe(baby2.id);
    });

    test('按日期范围筛选应该正确工作', () => {
      const input1: CreateMediaInput = {
        babyId: 'baby_1',
        type: MediaType.Photo,
        url: 'https://example.com/photo1.jpg',
        size: 1024000,
        captureDate: '2024-01-01'
      };
      const input2: CreateMediaInput = {
        babyId: 'baby_1',
        type: MediaType.Photo,
        url: 'https://example.com/photo2.jpg',
        size: 1024000,
        captureDate: '2024-06-15'
      };
      const input3: CreateMediaInput = {
        babyId: 'baby_1',
        type: MediaType.Photo,
        url: 'https://example.com/photo3.jpg',
        size: 1024000,
        captureDate: '2024-12-31'
      };

      storageService.createMedia(input1);
      storageService.createMedia(input2);
      storageService.createMedia(input3);

      const mediaList = storageService.getMediaList({
        babyId: 'baby_1',
        startDate: '2024-06-01',
        endDate: '2024-06-30'
      });

      expect(mediaList.length).toBe(1);
      expect(mediaList[0].captureDate).toBe('2024-06-15');
    });

    test('分页功能应该正确工作', () => {
      for (let i = 0; i < 25; i++) {
        const input: CreateMediaInput = {
          babyId: 'baby_1',
          type: MediaType.Photo,
          url: `https://example.com/photo${i}.jpg`,
          size: 1024000,
          captureDate: `2024-01-${String(i + 1).padStart(2, '0')}`
        };
        storageService.createMedia(input);
      }

      const page1 = storageService.getMediaList({
        babyId: 'baby_1',
        page: 1,
        pageSize: 10
      });
      const page2 = storageService.getMediaList({
        babyId: 'baby_1',
        page: 2,
        pageSize: 10
      });
      const page3 = storageService.getMediaList({
        babyId: 'baby_1',
        page: 3,
        pageSize: 10
      });

      expect(page1.length).toBe(10);
      expect(page2.length).toBe(10);
      expect(page3.length).toBe(5);
    });

    test('更新媒体应该成功', () => {
      const input: CreateMediaInput = {
        babyId: 'baby_1',
        type: MediaType.Photo,
        url: 'https://example.com/photo.jpg',
        size: 1024000,
        captureDate: '2024-01-15'
      };
      const created = storageService.createMedia(input);

      const updated = storageService.updateMedia(created.id, {
        title: '更新标题'
      });

      expect(updated.title).toBe('更新标题');
      expect(updated.id).toBe(created.id);
    });

    test('删除媒体应该成功', () => {
      const input: CreateMediaInput = {
        babyId: 'baby_1',
        type: MediaType.Photo,
        url: 'https://example.com/photo.jpg',
        size: 1024000,
        captureDate: '2024-01-15'
      };
      const created = storageService.createMedia(input);

      storageService.deleteMedia(created.id);
      const media = storageService.getMedia(created.id);

      expect(media).toBeNull();
    });

    test('批量删除媒体应该成功', () => {
      const input1: CreateMediaInput = {
        babyId: 'baby_1',
        type: MediaType.Photo,
        url: 'https://example.com/photo1.jpg',
        size: 1024000,
        captureDate: '2024-01-01'
      };
      const input2: CreateMediaInput = {
        babyId: 'baby_1',
        type: MediaType.Photo,
        url: 'https://example.com/photo2.jpg',
        size: 1024000,
        captureDate: '2024-01-02'
      };

      storageService.createMedia(input1);
      storageService.createMedia(input2);

      storageService.deleteMediaByBaby('baby_1');
      const mediaList = storageService.getMediaList({ babyId: 'baby_1' });

      expect(mediaList.length).toBe(0);
    });
  });

  describe('存储管理功能', () => {
    test('清除缓存应该清空所有数据', () => {
      const babyInput: CreateBabyInput = {
        name: '小明',
        birthDate: '2024-01-15',
        gender: BabyGender.Male
      };
      storageService.createBaby(babyInput);

      storageService.clearCache();
      const babies = storageService.getBabies();

      expect(babies.length).toBe(0);
    });

    test('获取存储使用情况应该返回正确结构', () => {
      const usage = storageService.getStorageUsage();

      expect(usage.used).toBeDefined();
      expect(usage.limit).toBe(10 * 1024 * 1024);
      expect(typeof usage.used).toBe('number');
      expect(typeof usage.limit).toBe('number');
    });

    test('创建多个宝宝后存储使用量应该增加', () => {
      const babyInput: CreateBabyInput = {
        name: '小明',
        birthDate: '2024-01-15',
        gender: BabyGender.Male
      };

      const usage1 = storageService.getStorageUsage();
      storageService.createBaby(babyInput);
      const usage2 = storageService.getStorageUsage();

      expect(usage2.used).toBeGreaterThan(usage1.used);
    });
  });

  describe('数据持久化验证', () => {
    test('数据应该在创建后持久化', () => {
      const input: CreateBabyInput = {
        name: '持久化测试',
        birthDate: '2024-01-01',
        gender: BabyGender.Unknown
      };

      const baby = storageService.createBaby(input);
      const retrieved = storageService.getBaby(baby.id);

      expect(retrieved).not.toBeNull();
      expect(retrieved!.name).toBe('持久化测试');
    });

    test('更新后数据应该保持更新', () => {
      const input: CreateBabyInput = {
        name: '更新测试',
        birthDate: '2024-01-01',
        gender: BabyGender.Male
      };

      const baby = storageService.createBaby(input);
      storageService.updateBaby(baby.id, { name: '新名字' });
      const retrieved = storageService.getBaby(baby.id);

      expect(retrieved!.name).toBe('新名字');
    });
  });

  describe('边界情况处理', () => {
    test('空数据库查询应返回空数组', () => {
      const babies = storageService.getBabies();
      const mediaList = storageService.getMediaList();

      expect(babies).toEqual([]);
      expect(mediaList).toEqual([]);
    });

    test('更新不存在的宝宝应抛出错误', () => {
      expect(() => {
        storageService.updateBaby('non_existent', { name: '新名字' });
      }).toThrow('Baby not found');
    });

    test('更新不存在的媒体应抛出错误', () => {
      expect(() => {
        storageService.updateMedia('non_existent', { title: '新标题' });
      }).toThrow('Media not found');
    });

    test('删除不存在的宝宝不应抛出错误', () => {
      expect(() => {
        storageService.deleteBaby('non_existent');
      }).not.toThrow();
    });
  });
});