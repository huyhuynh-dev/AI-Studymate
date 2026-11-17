import axios, { isAxiosError } from 'axios';
import { axiosClient } from '@/lib/axios.client';
import type {
  AvatarUploadTicket,
  ChangePasswordInput,
  DeleteAccountInput,
  RequestAvatarUploadInput,
  UpdateUserProfileInput,
  UserProfile,
} from '@/types/user';

interface RawUserStatsResponse {
  subjects_count?: number;
  conversations_count?: number;
  documents_count?: number;
  flashcard_decks_count?: number;
  quizzes_count?: number;
}

interface RawUserProfileResponse {
  id: string;
  email: string;
  name: string;
  avatar_url?: string | null;
  avatar_storage_key?: string | null;
  role?: string;
  is_active?: boolean;
  is_verified?: boolean;
  provider?: string | null;
  has_password?: boolean;
  created_at: string | Date;
  updated_at: string | Date;
  stats?: RawUserStatsResponse;
}

function toIsoString(value: string | Date | undefined): string {
  if (!value) return new Date().toISOString();
  if (typeof value === 'string') return value;
  return value.toISOString();
}

function mapUserProfile(raw: RawUserProfileResponse): UserProfile {
  return {
    id: raw.id,
    email: raw.email,
    name: raw.name,
    avatarUrl: raw.avatar_url ?? null,
    avatarStorageKey: raw.avatar_storage_key ?? null,
    role: raw.role ?? 'user',
    isActive: Boolean(raw.is_active ?? true),
    isVerified: Boolean(raw.is_verified ?? false),
    provider: raw.provider ?? null,
    hasPassword: Boolean(raw.has_password),
    createdAt: toIsoString(raw.created_at),
    updatedAt: toIsoString(raw.updated_at),
    stats: {
      subjectsCount: Number(raw.stats?.subjects_count ?? 0),
      conversationsCount: Number(raw.stats?.conversations_count ?? 0),
      documentsCount: Number(raw.stats?.documents_count ?? 0),
      flashcardDecksCount: Number(raw.stats?.flashcard_decks_count ?? 0),
      quizzesCount: Number(raw.stats?.quizzes_count ?? 0),
    },
  };
}

export function extractUserApiError(
  error: unknown,
  fallback = 'Có lỗi xảy ra. Vui lòng thử lại sau.',
): string {
  if (isAxiosError(error)) {
    const data = error.response?.data as
      | { message?: string | string[]; error?: string }
      | undefined;
    if (data?.message) {
      return Array.isArray(data.message) ? data.message.join(', ') : data.message;
    }
    if (data?.error) {
      return data.error;
    }
    return error.message || fallback;
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
}

export const usersApi = {
  getMe: async (): Promise<UserProfile> => {
    const res = await axiosClient.get<RawUserProfileResponse>('/users/me');
    return mapUserProfile(res.data);
  },

  updateProfile: async (
    input: UpdateUserProfileInput,
  ): Promise<UserProfile> => {
    const res = await axiosClient.patch<RawUserProfileResponse>(
      '/users/me',
      input,
    );
    return mapUserProfile(res.data);
  },

  requestAvatarUploadUrl: async (
    input: RequestAvatarUploadInput,
  ): Promise<AvatarUploadTicket> => {
    const res = await axiosClient.post<AvatarUploadTicket>(
      '/users/me/avatar-upload-url',
      input,
    );
    return res.data;
  },

  uploadAvatarFileToR2: async (
    uploadUrl: string,
    file: File,
  ): Promise<void> => {
    await axios.put(uploadUrl, file, {
      headers: {
        'Content-Type': file.type || 'image/png',
      },
    });
  },

  uploadAndSaveAvatar: async (file: File): Promise<UserProfile> => {
    const ticket = await usersApi.requestAvatarUploadUrl({
      fileName: file.name,
      mimeType: file.type,
      fileSize: file.size,
    });
    await usersApi.uploadAvatarFileToR2(ticket.uploadUrl, file);
    return usersApi.updateProfile({ avatarStorageKey: ticket.storageKey });
  },

  changePassword: async (
    input: ChangePasswordInput,
  ): Promise<{ message: string }> => {
    const res = await axiosClient.patch<{ message: string }>(
      '/users/me/password',
      input,
    );
    return res.data;
  },

  deleteAccount: async (
    input: DeleteAccountInput,
  ): Promise<{ success: boolean; message: string }> => {
    const res = await axiosClient.delete<{ success: boolean; message: string }>(
      '/users/me',
      { data: input },
    );
    return res.data;
  },

  logout: async (): Promise<void> => {
    await axios.post('/api/auth/logout');
  },
};
