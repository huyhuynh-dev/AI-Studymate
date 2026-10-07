import { isAxiosError } from 'axios';
import { axiosClient } from '@/lib/axios.client';

export interface Subject {
  id: string;
  name: string;
  color: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateSubjectDto {
  name: string;
  color?: string;
}

export interface UpdateSubjectDto {
  name?: string;
  color?: string;
}

export interface ApiErrorResponse {
  statusCode?: number;
  message?: string | string[];
  error?: string;
}

export function extractApiErrorMessage(error: unknown, defaultMessage = 'Đã có lỗi xảy ra'): string {
  if (isAxiosError(error)) {
    const data = error.response?.data as ApiErrorResponse | undefined;
    if (data?.message) {
      return Array.isArray(data.message) ? data.message.join(', ') : data.message;
    }
    if (data?.error) {
      return data.error;
    }
    return error.message || defaultMessage;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return defaultMessage;
}

export const subjectsApi = {
  /**
   * Lấy danh sách tất cả không gian học tập của người dùng hiện tại
   */
  async getAllSubjects(): Promise<Subject[]> {
    const response = await axiosClient.get<Subject[]>('/subjects');
    return response.data;
  },

  /**
   * Lấy thông tin chi tiết một không gian học tập theo ID
   */
  async getSubjectById(subjectId: string): Promise<Subject> {
    const response = await axiosClient.get<Subject>(`/subjects/${subjectId}`);
    return response.data;
  },

  /**
   * Tạo một không gian học tập mới
   */
  async createSubject(data: CreateSubjectDto): Promise<Subject> {
    const response = await axiosClient.post<Subject>('/subjects', data);
    return response.data;
  },

  /**
   * Cập nhật thông tin không gian học tập (PATCH)
   */
  async updateSubject(subjectId: string, data: UpdateSubjectDto): Promise<Subject> {
    const response = await axiosClient.patch<Subject>(`/subjects/${subjectId}`, data);
    return response.data;
  },

  /**
   * Xóa một không gian học tập theo ID
   */
  async deleteSubject(subjectId: string): Promise<Subject> {
    const response = await axiosClient.delete<Subject>(`/subjects/${subjectId}`);
    return response.data;
  },
};
