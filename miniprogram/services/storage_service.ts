// storage_service.ts - 本地存储服务

import type { Baby, CreateBabyInput, UpdateBabyInput } from '../../typings/models/baby';
import type { Media, CreateMediaInput, MediaQuery } from '../../typings/models/media';

/**
 * 存储服务类
 * 提供本地数据存储和检索功能，支持宝宝和媒体数据的 CRUD 操作
 */
class StorageService {
  // 类属性 - 传统写法兼容 ES5
  private PREFIX: string;
  private VERSION: string;
  private CACHE_TTL: number;
  private keys: {
    babies: string;
    media: string;
    settings: string;
    version: string;
  };
  private cache: {
    babies?: Baby[];
    media?: Media[];
    lastFetchTime: number;
  };

  constructor() {
    this.PREFIX = 'album_';
    this.VERSION = 'v1';
    this.CACHE_TTL = 5 * 60 * 1000;
    this.keys = {
      babies: this.PREFIX + 'babies',
      media: this.PREFIX + 'media',
      settings: this.PREFIX + 'settings',
      version: this.PREFIX + 'version'
    };
    this.cache = {
      lastFetchTime: 0
    };
  }

  /**
   * 初始化存储服务
   */
  async init(): Promise<void> {
    await this.checkVersion();
  }

  /**
   * 检查存储版本并迁移
   */
  private async checkVersion(): Promise<void> {
    const version = wx.getStorageSync(this.keys.version);
    if (version !== this.VERSION) {
      await wx.setStorageSync(this.keys.version, this.VERSION);
    }
  }

  /**
   * 检查缓存是否有效
   */
  private isCacheValid(): boolean {
    return Date.now() - this.cache.lastFetchTime < this.CACHE_TTL;
  }

  /**
   * 保存数据到本地存储
   */
  private async setData<T>(key: string, data: T): Promise<void> {
    return new Promise((resolve) => {
      wx.setStorage({
        key: key,
        data: data,
        success: function() {
          resolve();
        }
      });
    });
  }

  /**
   * 从本地存储获取数据
   */
  private async getData<T>(key: string): Promise<T | null> {
    return new Promise((resolve) => {
      wx.getStorage({
        key: key,
        success: function(res) {
          resolve(res.data);
        },
        fail: function() {
          resolve(null);
        }
      });
    });
  }

  // ---- 宝宝相关操作 ----

  /**
   * 获取所有宝宝
   */
  async getBabies(): Promise<Baby[]> {
    if (this.cache.babies && this.isCacheValid()) {
      return this.cache.babies;
    }
    const babies = await this.getData<Baby[]>(this.keys.babies);
    this.cache.babies = babies || [];
    this.cache.lastFetchTime = Date.now();
    return this.cache.babies;
  }

  /**
   * 获取单个宝宝
   */
  async getBaby(id: string): Promise<Baby | null> {
    const babies = await this.getBabies();
    for (let i = 0; i < babies.length; i++) {
      if (babies[i].id === id) {
        return babies[i];
      }
    }
    return null;
  }

  /**
   * 创建宝宝
   */
  async createBaby(input: CreateBabyInput): Promise<Baby> {
    const babies = await this.getData<Baby[]>(this.keys.babies) || [];
    const now = new Date().toISOString();
    const baby: Baby = {
      id: this.generateUUID(),
      name: input.name,
      birthDate: input.birthDate,
      gender: input.gender,
      avatar: input.avatar,
      createdAt: now,
      updatedAt: now
    };
    babies.push(baby);
    await this.setData(this.keys.babies, babies);
    this.cache.babies = babies;
    return baby;
  }

  /**
   * 更新宝宝信息
   */
  async updateBaby(id: string, input: UpdateBabyInput): Promise<Baby> {
    const babies = await this.getData<Baby[]>(this.keys.babies) || [];
    let index = -1;
    for (let i = 0; i < babies.length; i++) {
      if (babies[i].id === id) {
        index = i;
        break;
      }
    }
    if (index === -1) {
      throw new Error('宝宝不存在');
    }
    const updatedBaby: Baby = {
      ...babies[index],
      ...input,
      updatedAt: new Date().toISOString()
    };
    babies[index] = updatedBaby;
    await this.setData(this.keys.babies, babies);
    this.cache.babies = babies;
    return updatedBaby;
  }

  /**
   * 删除宝宝
   */
  async deleteBaby(id: string): Promise<void> {
    const babies = await this.getData<Baby[]>(this.keys.babies) || [];
    const filtered: Baby[] = [];
    for (let i = 0; i < babies.length; i++) {
      if (babies[i].id !== id) {
        filtered.push(babies[i]);
      }
    }
    await this.setData(this.keys.babies, filtered);
    this.cache.babies = filtered;
  }

  // ---- 媒体相关操作 ----

  /**
   * 获取媒体列表
   */
  async getMediaList(query?: MediaQuery, babyBirthDate?: string): Promise<Media[]> {
    let mediaList = await this.getData<Media[]>(this.keys.media) || [];

    if (query) {
      if (query.babyId) {
        const filtered: Media[] = [];
        for (let i = 0; i < mediaList.length; i++) {
          if (mediaList[i].babyId === query.babyId) {
            filtered.push(mediaList[i]);
          }
        }
        mediaList = filtered;
      }
      if (query.type) {
        const filtered: Media[] = [];
        for (let i = 0; i < mediaList.length; i++) {
          if (mediaList[i].type === query.type) {
            filtered.push(mediaList[i]);
          }
        }
        mediaList = filtered;
      }
      if (query.startDate) {
        const filtered: Media[] = [];
        for (let i = 0; i < mediaList.length; i++) {
          if (mediaList[i].captureDate >= query.startDate) {
            filtered.push(mediaList[i]);
          }
        }
        mediaList = filtered;
      }
      if (query.endDate) {
        const filtered: Media[] = [];
        for (let i = 0; i < mediaList.length; i++) {
          if (mediaList[i].captureDate <= query.endDate) {
            filtered.push(mediaList[i]);
          }
        }
        mediaList = filtered;
      }
      if (query.page && query.pageSize) {
        const start = (query.page - 1) * query.pageSize;
        mediaList = mediaList.slice(start, start + query.pageSize);
      }
    }

    return mediaList;
  }

  /**
   * 获取单个媒体
   */
  async getMedia(id: string): Promise<Media | null> {
    const allMedia = await this.getData<Media[]>(this.keys.media) || [];
    for (let i = 0; i < allMedia.length; i++) {
      if (allMedia[i].id === id) {
        return allMedia[i];
      }
    }
    return null;
  }

  /**
   * 创建媒体
   */
  async createMedia(input: CreateMediaInput): Promise<Media> {
    const mediaList = await this.getData<Media[]>(this.keys.media) || [];
    const now = new Date().toISOString();
    const media: Media = {
      id: this.generateUUID(),
      babyId: input.babyId,
      type: input.type,
      url: input.url,
      thumbnailUrl: input.thumbnailUrl,
      width: input.width,
      height: input.height,
      size: input.size,
      title: input.title,
      captureDate: input.captureDate,
      tags: input.tags,
      createdAt: now,
      updatedAt: now
    };
    mediaList.push(media);
    await this.setData(this.keys.media, mediaList);
    this.cache.media = mediaList;
    return media;
  }

  /**
   * 更新媒体
   */
  async updateMedia(id: string, input: Partial<CreateMediaInput>): Promise<Media> {
    const mediaList = await this.getData<Media[]>(this.keys.media) || [];
    let index = -1;
    for (let i = 0; i < mediaList.length; i++) {
      if (mediaList[i].id === id) {
        index = i;
        break;
      }
    }
    if (index === -1) {
      throw new Error('媒体不存在');
    }
    const updatedMedia: Media = {
      ...mediaList[index],
      ...input,
      updatedAt: new Date().toISOString()
    };
    mediaList[index] = updatedMedia;
    await this.setData(this.keys.media, mediaList);
    this.cache.media = mediaList;
    return updatedMedia;
  }

  /**
   * 删除媒体
   */
  async deleteMedia(id: string): Promise<void> {
    const mediaList = await this.getData<Media[]>(this.keys.media) || [];
    const filtered: Media[] = [];
    for (let i = 0; i < mediaList.length; i++) {
      if (mediaList[i].id !== id) {
        filtered.push(mediaList[i]);
      }
    }
    await this.setData(this.keys.media, filtered);
    this.cache.media = filtered;
  }

  /**
   * 批量删除媒体
   */
  async deleteMediaByBaby(babyId: string): Promise<void> {
    const mediaList = await this.getData<Media[]>(this.keys.media) || [];
    const filtered: Media[] = [];
    for (let i = 0; i < mediaList.length; i++) {
      if (mediaList[i].babyId !== babyId) {
        filtered.push(mediaList[i]);
      }
    }
    await this.setData(this.keys.media, filtered);
    this.cache.media = filtered;
  }

  /**
   * 清除所有缓存
   */
  async clearCache(): Promise<void> {
    this.cache = { lastFetchTime: 0 };
    await this.setData(this.keys.babies, []);
    await this.setData(this.keys.media, []);
    await this.setData(this.keys.settings, {});
  }

  /**
   * 获取存储使用情况
   */
  async getStorageUsage(): Promise<{ used: number; limit: number }> {
    try {
      const info = wx.getStorageInfoSync();
      return {
        used: info.currentSize,
        limit: info.limitSize
      };
    } catch (e) {
      return { used: 0, limit: 0 };
    }
  }

  /**
   * 生成 UUID v4
   */
  private generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }
}

export const storageService = new StorageService();
