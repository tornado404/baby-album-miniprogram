// media.ts - 媒体数据模型

import type { BabyAge } from './baby';

/**
 * 媒体类型枚举
 */
export enum MediaType {
  Photo = 'photo',
  Video = 'video'
}

/**
 * 媒体数据模型
 */
export interface Media {
  id: string;                    // 唯一标识符
  babyId: string;                // 关联宝宝ID
  type: MediaType;               // 媒体类型
  url: string;                   // 媒体URL
  thumbnailUrl?: string;         // 缩略图URL
  width?: number;                // 原始宽度
  height?: number;               // 原始高度
  size: number;                  // 文件大小(bytes)
  title?: string;                // 标题/描述
  captureDate: string;           // 拍摄日期 (YYYY-MM-DD)
  babyAge?: BabyAge;             // 拍摄时宝宝月龄
  tags?: string[];                // 标签
  createdAt: string;             // 创建时间 ISO8601
  updatedAt: string;             // 更新时间 ISO8601
}

/**
 * 创建媒体的输入参数
 */
export interface CreateMediaInput {
  babyId: string;
  type: MediaType;
  url: string;
  thumbnailUrl?: string;
  width?: number;
  height?: number;
  size: number;
  title?: string;
  captureDate: string;
  tags?: string[];
}

/**
 * 媒体查询参数
 */
export interface MediaQuery {
  babyId?: string;
  type?: MediaType;
  startDate?: string;
  endDate?: string;
  minAge?: number;               // 最小月龄（月）
  maxAge?: number;               // 最大月龄（月）
  tags?: string[];
  page?: number;
  pageSize?: number;
}

/**
 * 媒体分组实体 - 按月龄分组的媒体列表
 */
export interface MediaGroup {
  monthAge: number;              // 月龄（0, 1, 2, ...）
  monthLabel: string;            // 显示标签，如 "0月"、"1月"、"12月+"
  mediaList: Media[];            // 该月龄的媒体列表
  mediaCount: number;            // 该月龄的照片数量
}

/**
 * 类型守卫函数 - 判断对象是否为Media类型
 */
export function isMedia(obj: unknown): obj is Media {
  return obj !== null && typeof obj === 'object' && 'id' in obj && 'babyId' in obj;
}

/**
 * 类型守卫函数 - 判断对象是否为MediaQuery类型
 */
export function isMediaQuery(obj: unknown): obj is MediaQuery {
  if (obj === null || typeof obj !== 'object') {
    return false;
  }
  const q = obj as Record<string, unknown>;
  // page 和 pageSize 必须为正整数
  if (q.page !== undefined && (typeof q.page !== 'number' || q.page < 1 || !Number.isInteger(q.page))) {
    return false;
  }
  if (q.pageSize !== undefined && (typeof q.pageSize !== 'number' || q.pageSize < 1 || !Number.isInteger(q.pageSize))) {
    return false;
  }
  return true;
}

/**
 * 验证MediaQuery对象的基本有效字段（别名，保持向后兼容）
 */
export function isValidMediaQuery(query: unknown): query is MediaQuery {
  return isMediaQuery(query);
}