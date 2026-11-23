import { isAxiosError } from 'axios';
import { axiosClient } from '@/lib/axios.client';
import { Subject, CreateSubjectDto, UpdateSubjectDto } from '@/types';

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

interface RawSubjectResponse {
  id: string;
  name: string;
  color: string | null;
  exam_date?: string | Date | null;
  target_score?: number | null;
  created_at: string | Date;
  updated_at: string | Date;
}

function toIso(value: string | Date | undefined): string {
  if (!value) return new Date().toISOString();
  return typeof value === 'string' ? value : value.toISOString();
}

function toDateOnly(value: string | Date | null | undefined): string | null {
  if (!value) return null;
  const iso = typeof value === 'string' ? value : value.toISOString();
  return iso.slice(0, 10);
}

function mapSubject(raw: RawSubjectResponse): Subject {
  return {
    id: raw.id,
    name: raw.name,
    color: raw.color ?? null,
    examDate: toDateOnly(raw.exam_date),
    targetScore:
      typeof raw.target_score === 'number' && Number.isFinite(raw.target_score)
        ? raw.target_score
        : null,
    created_at: toIso(raw.created_at),
    updated_at: toIso(raw.updated_at),
  };
}

export const subjectsApi = {
  /**
   * Lấy danh sách tất cả không gian học tập của người dùng hiện tại
   */
  async getAllSubjects(): Promise<Subject[]> {
    const response = await axiosClient.get<RawSubjectResponse[]>('/subjects');
    return Array.isArray(response.data) ? response.data.map(mapSubject) : [];
  },

  /**
   * Lấy thông tin chi tiết một không gian học tập theo ID
   */
  async getSubjectById(subjectId: string): Promise<Subject> {
    const response = await axiosClient.get<RawSubjectResponse>(`/subjects/${subjectId}`);
    return mapSubject(response.data);
  },

  /**
   * Tạo một không gian học tập mới
   */
  async createSubject(data: CreateSubjectDto): Promise<Subject> {
    const response = await axiosClient.post<RawSubjectResponse>('/subjects', data);
    return mapSubject(response.data);
  },

  /**
   * Cập nhật thông tin không gian học tập (PATCH)
   */
  async updateSubject(subjectId: string, data: UpdateSubjectDto): Promise<Subject> {
    const response = await axiosClient.patch<RawSubjectResponse>(`/subjects/${subjectId}`, data);
    return mapSubject(response.data);
  },

  /**
   * Xóa một không gian học tập theo ID
   */
  async deleteSubject(subjectId: string): Promise<Subject> {
    const response = await axiosClient.delete<RawSubjectResponse>(`/subjects/${subjectId}`);
    return mapSubject(response.data);
  },
};
