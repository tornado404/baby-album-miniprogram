// image_utils.ts - 图片处理工具

export interface ImageInfo {
  width: number;
  height: number;
  size: number;
  path: string;
}

/**
 * 压缩图片
 * @param filePath 文件路径
 * @param quality 压缩质量 0-100
 * @param targetWidth 目标宽度
 * @returns 压缩后的临时文件路径
 */
export async function compressImage(
  filePath: string,
  quality: number = 80,
  targetWidth: number = 1920
): Promise<string> {
  return new Promise((resolve, reject) => {
    wx.compressImage({
      src: filePath,
      quality,
      success: (res) => {
        resolve(res.tempFilePath);
      },
      fail: (err) => {
        reject(err);
      }
    });
  });
}

/**
 * 选择图片
 * @param count 选择数量
 * @param mediaType mediaType 图片或视频
 * @returns 选择的结果
 */
export async function chooseMedia(
  count: number = 9,
  mediaType: 'image' | 'video' = 'image'
): Promise<any[]> {
  return new Promise((resolve, reject) => {
    wx.chooseMedia({
      count,
      mediaType: [mediaType],
      sourceType: ['album', 'camera'],
      success: (res) => {
        resolve(res.tempFiles);
      },
      fail: (err) => {
        reject(err);
      }
    });
  });
}

/**
 * 获取图片信息
 * @param filePath 文件路径
 * @returns 图片信息
 */
export async function getImageInfo(filePath: string): Promise<ImageInfo> {
  return new Promise((resolve, reject) => {
    wx.getImageInfo({
      src: filePath,
      success: (res) => {
        resolve({
          width: res.width,
          height: res.height,
          size: 0,
          path: res.path
        });
      },
      fail: reject
    });
  });
}

/**
 * 预览图片
 * @param urls 图片URL列表
 * @param current 当前显示的图片索引
 */
export function previewImage(urls: string[], current: number = 0): void {
  wx.previewImage({
    urls,
    current: urls[current]
  });
}

/**
 * 保存图片到相册
 * @param filePath 文件路径
 */
export async function saveImageToAlbum(filePath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    wx.saveImageToPhotosAlbum({
      filePath,
      success: () => resolve(),
      fail: reject
    });
  });
}