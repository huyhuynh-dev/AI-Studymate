import axios from 'axios';
import { axiosClient } from '@/lib/axios.client';
import {
  DocumentItem,
  InitUploadRequest,
  InitUploadResponse,
  CompleteUploadRequest,
} from '@/types';

export const documentsApi = {
  getByConversationId: async (conversationId: string): Promise<DocumentItem[]> => {
    const res = await axiosClient.get(`/conversations/${conversationId}/documents`);
    return res.data;
  },

  getById: async (documentId: string): Promise<DocumentItem> => {
    const res = await axiosClient.get(`/documents/${documentId}`);
    return res.data;
  },

  initUpload: async (data: InitUploadRequest): Promise<InitUploadResponse> => {
    const res = await axiosClient.post('/documents/init-upload', data);
    return res.data;
  },

  uploadToR2: async (
    uploadUrl: string,
    file: File,
    onProgress?: (percent: number) => void
  ): Promise<void> => {
    // Tải trực tiếp lên Cloudflare R2 qua Presigned PUT URL không qua Proxy
    await axios.put(uploadUrl, file, {
      headers: {
        'Content-Type': file.type,
      },
      onUploadProgress: (progressEvent) => {
        if (progressEvent.total) {
          const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          onProgress?.(percent);
        }
      },
    });
  },

  completeUpload: async (
    documentId: string,
    data: CompleteUploadRequest
  ): Promise<DocumentItem> => {
    const res = await axiosClient.post(`/documents/${documentId}/complete`, data);
    return res.data;
  },

  getDownloadUrl: async (documentId: string): Promise<{ downloadUrl: string }> => {
    const res = await axiosClient.get(`/documents/${documentId}/download`);
    return res.data;
  },

  getViewUrl: async (documentId: string): Promise<{ downloadUrl: string }> => {
    const res = await axiosClient.get(`/documents/${documentId}/download?inline=true`);
    return res.data;
  },

  delete: async (documentId: string): Promise<{ success: boolean; message: string }> => {
    const res = await axiosClient.delete(`/documents/${documentId}`);
    return res.data;
  },
};
