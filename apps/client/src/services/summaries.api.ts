import { axiosClient } from '@/lib/axios.client';
import {
  SummaryItem,
  CreateSummaryRequest,
  UpdateSummaryRequest,
  RefineSummaryRequest,
} from '@/types';

export const summariesApi = {
  getByConversationId: async (conversationId: string): Promise<SummaryItem[]> => {
    const res = await axiosClient.get(`/conversations/${conversationId}/summaries`);
    return res.data;
  },

  getById: async (summaryId: string): Promise<SummaryItem> => {
    const res = await axiosClient.get(`/summaries/${summaryId}`);
    return res.data;
  },

  create: async (conversationId: string, data: CreateSummaryRequest): Promise<SummaryItem> => {
    const res = await axiosClient.post(`/conversations/${conversationId}/summaries`, data);
    return res.data;
  },

  update: async (summaryId: string, data: UpdateSummaryRequest): Promise<SummaryItem> => {
    const res = await axiosClient.patch(`/summaries/${summaryId}`, data);
    return res.data;
  },

  refine: async (summaryId: string, data: RefineSummaryRequest): Promise<SummaryItem> => {
    const res = await axiosClient.post(`/summaries/${summaryId}/refine`, data);
    return res.data;
  },

  exportPdf: async (summaryId: string): Promise<{ downloadUrl: string }> => {
    const res = await axiosClient.post(`/summaries/${summaryId}/export-pdf`);
    return res.data;
  },

  delete: async (summaryId: string): Promise<{ success: boolean; message: string }> => {
    const res = await axiosClient.delete(`/summaries/${summaryId}`);
    return res.data;
  },
};
