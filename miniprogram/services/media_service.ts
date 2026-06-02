// media_service.ts - 媒体服务

import { storageService } from './storage_service';
import type { Media, CreateMediaInput, MediaQuery } from '../../typings/models/media';
import { calculateBabyAge } from '../utils/age_calculator';

/**
 * 媒体服务类
 */
class MediaService {
  /**
   * 获取媒体列表（带计算月龄）
   * @param query 查询参数，支持 minAge/maxAge 月龄筛选
   * @param babyBirthDate 宝宝出生日期，用于计算月龄
   */
  async getMediaListWithAge(query?: MediaQuery, babyBirthDate?: string): Promise<Media[]> {
    // 调用 storageService.getMediaList，传入 babyBirthDate 用于月龄筛选
    const mediaList = await storageService.getMediaList(query, babyBirthDate);

    // 为每个媒体添加月龄信息
    if (babyBirthDate) {
      return mediaList.map(media => ({
        ...media,
        babyAge: calculateBabyAge(babyBirthDate, media.captureDate)
      }));
    }

    return mediaList;
  }

  /**
   * 上传媒体
   */
  async uploadMedia(input: CreateMediaInput): Promise<Media> {
    return storageService.createMedia(input);
  }

  /**
   * 删除媒体
   */
  async deleteMedia(id: string): Promise<void> {
    return storageService.deleteMedia(id);
  }

  /**
   * 更新媒体
   */
  async updateMedia(id: string, input: Partial<CreateMediaInput>): Promise<Media> {
    return storageService.updateMedia(id, input);
  }

  /**
   * 获取媒体详情
   */
  async getMediaDetail(id: string, babyBirthDate?: string): Promise<Media | null> {
    const media = await storageService.getMedia(id);
    if (media && babyBirthDate) {
      return {
        ...media,
        babyAge: calculateBabyAge(babyBirthDate, media.captureDate)
      };
    }
    return media;
  }
}

export const mediaService = new MediaService();