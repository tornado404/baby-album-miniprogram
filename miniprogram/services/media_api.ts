// services/media_api.ts - 媒体相关 API 调用

import { request } from './request';

const mediaApi = {

  /**
   * 获取媒体列表（分页）
   */
  list: function (babyId: string, page?: number): Promise<any> {
    return request.get('/media/', { babyId: babyId, page: page || 1 });
  },

  /**
   * 创建媒体记录（上传完成后调用）
   */
  create: function (data: { babyId: string; title: string; type: string; cosKey: string; captureDate: string }): Promise<any> {
    return request.post('/media/', data);
  },

  /**
   * 删除媒体
   */
  delete: function (mediaId: string): Promise<any> {
    return request.delete('/media/' + mediaId);
  },

  /**
   * 获取上传签名（STS 临时密钥）
   */
  getUploadSign: function (fileName: string, fileType: string, babyId: string): Promise<any> {
    return request.post('/upload/sign', {
      fileName: fileName,
      fileType: fileType,
      babyId: babyId,
    });
  },
};

export { mediaApi };
export default mediaApi;