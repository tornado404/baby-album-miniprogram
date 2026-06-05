// services/baby_api.ts - 宝宝相关 API 调用

import { request } from './request';

const babyApi = {

  /**
   * 获取宝宝列表
   */
  list: function (): Promise<any> {
    return request.get('/babies/');
  },

  /**
   * 获取单个宝宝详情
   */
  get: function (babyId: string): Promise<any> {
    return request.get('/babies/' + babyId);
  },

  /**
   * 创建宝宝
   */
  create: function (data: { name: string; gender?: string; birthDate?: string; avatar?: string }): Promise<any> {
    return request.post('/babies/', data);
  },

  /**
   * 更新宝宝信息
   */
  update: function (babyId: string, data: any): Promise<any> {
    return request.put('/babies/' + babyId, data);
  },

  /**
   * 删除宝宝
   */
  delete: function (babyId: string): Promise<any> {
    return request.delete('/babies/' + babyId);
  },
};

export { babyApi };
export default babyApi;