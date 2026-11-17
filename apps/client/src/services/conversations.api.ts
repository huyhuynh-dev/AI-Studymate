import axios from "axios";
import { axiosClient } from "@/lib/axios.client";
import { Conversation } from "@/types";

export const conversationsApi = {
  getBySubjectId: async (subjectId: string): Promise<Conversation[]> => {
    try {
      const res = await axiosClient.get(`/subjects/${subjectId}/conversations`);
      return Array.isArray(res.data) ? res.data : [];
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        return [];
      }
      throw error;
    }
  },
  create: async (data: { subject_id: string; title: string }): Promise<Conversation> => {
    const res = await axiosClient.post("/conversations", data);
    return res.data;
  },
  updateTitle: async (id: string, title: string): Promise<Conversation> => {
    const res = await axiosClient.put(`/conversations/${id}`, { title });
    return res.data;
  },
  delete: async (id: string): Promise<Conversation> => {
    const res = await axiosClient.delete(`/conversations/${id}`);
    return res.data;
  },
};
