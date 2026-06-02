// @ts-nocheck
// media_uploader.ts - 媒体上传组件
import { chooseMedia, compressImage } from '../../utils/image_utils';
import { storageService } from '../../services/storage_service';
import type { MediaType } from '../../../typings/models';

interface UploadFile {
  url: string;
  name: string;
  status: 'pending' | 'uploading' | 'success' | 'failed';
  index: number;
  retryCount: number;
}

Component({
  properties: {
    visible: {
      type: Boolean,
      value: false
    },
    babyId: {
      type: String,
      value: ''
    },
    maxCount: {
      type: Number,
      value: 9
    }
  },

  data: {
    fileList: [] as UploadFile[],
    uploadLoading: false,
    captureDate: '',
    title: '',
    fabMenuVisible: false,
    uploadProgress: 0
  },

  lifetimes: {
    attached(): void {
      // 组件创建
    },
    detached(): void {
      // 组件销毁时清理临时文件
      this.cleanupTempFiles();
    }
  },

  methods: {
    onClose(): void {
      this.resetForm();
      this.triggerEvent('close');
    },

    async onSelectTap(): Promise<void> {
      try {
        const remainingCount = this.properties.maxCount - this.data.fileList.length;
        if (remainingCount <= 0) {
          wx.showToast({ title: `最多上传${this.properties.maxCount}张`, icon: 'none' });
          return;
        }

        const files = await chooseMedia(remainingCount, 'image');
        const newFiles: UploadFile[] = files.map((file: any, index: number) => ({
          url: file.tempFilePath,
          name: file.tempFilePath.split('/').pop() || 'image',
          status: 'pending' as const,
          index: this.data.fileList.length + index,
          retryCount: 0
        }));

        this.setData({
          fileList: [...this.data.fileList, ...newFiles]
        });
      } catch (error) {
        console.error('选择图片失败:', error);
      }
    },

    toggleFabMenu(): void {
      this.setData({ fabMenuVisible: !this.data.fabMenuVisible });
    },

    onFabMenuClose(): void {
      this.setData({ fabMenuVisible: false });
    },

    async onFabCameraTap(): Promise<void> {
      this.setData({ fabMenuVisible: false });
      await this.onSelectTap('camera');
    },

    async onFabAlbumTap(): Promise<void> {
      this.setData({ fabMenuVisible: false });
      await this.onSelectTap('album');
    },

    // van-uploader 的 after-read 回调（兼容处理，不影响自有选择逻辑）
    onAfterRead(event: any): void {
      // 由 van-uploader 自行处理，此处仅为兼容绑定
      console.log('van-uploader after-read:', event.detail);
    },

    onDeleteItem(event: any): void {
      const { index } = event.detail;
      const fileToDelete = this.data.fileList[index];
      if (fileToDelete) {
        // 清理单个临时文件
        this.deleteTempFile(fileToDelete.url);
      }
      const newFileList = this.data.fileList.filter((_: any, i: number) => i !== index);
      this.setData({
        fileList: newFileList.map((item: UploadFile, i: number) => ({
          ...item,
          index: i
        }))
      });
    },

    onDateChange(): void {
      const now = new Date();
      const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      this.setData({ captureDate: dateStr });
    },

    onTitleInput(event: any): void {
      this.setData({ title: event.detail });
    },

    async onConfirm(): Promise<void> {
      const { fileList, captureDate, title, uploadLoading } = this.data;
      if (uploadLoading) return;

      if (fileList.length === 0) {
        wx.showToast({ title: '请选择图片', icon: 'none' });
        return;
      }

      this.setData({ uploadLoading: true });

      let successCount = 0;
      let failCount = 0;

      for (const file of fileList) {
        if (file.status === 'success') continue;

        try {
          // 更新状态为上传中
          this.updateFileStatus(file.index, 'uploading');

          // 压缩图片
          const compressedPath = await compressImage(file.url, 80, 1920);

          // 保存到存储服务
          await storageService.createMedia({
            babyId: this.properties.babyId,
            type: 'photo' as MediaType,
            url: compressedPath,
            size: 0,
            captureDate: captureDate || new Date().toISOString().split('T')[0],
            title: title
          });

          // 更新状态为成功
          this.updateFileStatus(file.index, 'success');
          successCount++;
        } catch (error) {
          console.error('上传失败:', error);
          // 重试逻辑：最多重试3次
          if (file.retryCount < 3) {
            file.retryCount++;
            file.status = 'pending';
            this.setData({ fileList: [...this.data.fileList] });
          } else {
            this.updateFileStatus(file.index, 'failed');
            failCount++;
          }
        }
      }

      this.setData({ uploadLoading: false });

      if (failCount > 0) {
        wx.showToast({
          title: `${successCount}张成功，${failCount}张失败`,
          icon: 'none'
        });
      } else {
        wx.showToast({ title: '上传成功', icon: 'success' });
        this.resetForm();
        this.triggerEvent('success');
        this.triggerEvent('close');
      }
    },

    onCancel(): void {
      this.resetForm();
      this.triggerEvent('close');
    },

    resetForm(): void {
      // 先清理临时文件
      this.cleanupTempFiles();
      this.setData({
        fileList: [],
        uploadLoading: false,
        captureDate: '',
        title: ''
      });
    },

    updateFileStatus(index: number, status: UploadFile['status']): void {
      const newFileList = this.data.fileList.map((item: UploadFile, i: number) =>
        i === index ? { ...item, status } : item
      );
      this.setData({ fileList: newFileList });
    },

    cleanupTempFiles(): void {
      // 清理所有临时文件
      this.data.fileList.forEach((file: UploadFile) => {
        this.deleteTempFile(file.url);
      });
    },

    deleteTempFile(filePath: string): void {
      if (filePath && filePath.startsWith('http://tmp') || filePath.startsWith('wxfile://')) {
        wx.getFileSystemManager().unlink({
          filePath,
          fail: () => {}
        });
      }
    }
  }
});