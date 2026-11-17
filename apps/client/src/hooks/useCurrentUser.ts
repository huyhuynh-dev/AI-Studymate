'use client';

import { useCallback } from 'react';
import useSWR from 'swr';
import { extractUserApiError, usersApi } from '@/services/users.api';
import type {
  ChangePasswordInput,
  DeleteAccountInput,
  UpdateUserProfileInput,
  UserProfile,
} from '@/types/user';

export const CURRENT_USER_CACHE_KEY = '/users/me';

export function useCurrentUser() {
  const { data, error, isLoading, isValidating, mutate } = useSWR<UserProfile>(
    CURRENT_USER_CACHE_KEY,
    () => usersApi.getMe(),
    {
      revalidateOnFocus: false,
      dedupingInterval: 10000,
    },
  );

  const updateProfile = useCallback(
    async (input: UpdateUserProfileInput): Promise<UserProfile> => {
      const updated = await usersApi.updateProfile(input);
      await mutate(updated, { revalidate: false });
      return updated;
    },
    [mutate],
  );

  const uploadAvatar = useCallback(
    async (file: File): Promise<UserProfile> => {
      const updated = await usersApi.uploadAndSaveAvatar(file);
      await mutate(updated, { revalidate: false });
      return updated;
    },
    [mutate],
  );

  const changePassword = useCallback(
    async (input: ChangePasswordInput): Promise<{ message: string }> => {
      const res = await usersApi.changePassword(input);
      await mutate();
      return res;
    },
    [mutate],
  );

  const deleteAccount = useCallback(
    async (
      input: DeleteAccountInput,
    ): Promise<{ success: boolean; message: string }> => {
      const res = await usersApi.deleteAccount(input);
      await usersApi.logout().catch(() => {});
      await mutate(undefined, { revalidate: false });
      return res;
    },
    [mutate],
  );

  const logout = useCallback(async (): Promise<void> => {
    await usersApi.logout();
    await mutate(undefined, { revalidate: false });
  }, [mutate]);

  const refreshUser = useCallback(async () => {
    await mutate();
  }, [mutate]);

  return {
    user: data ?? null,
    isLoading: Boolean(isLoading && !data),
    isValidating,
    errorMessage: error
      ? extractUserApiError(error, 'Không thể tải thông tin tài khoản')
      : null,
    updateProfile,
    uploadAvatar,
    changePassword,
    deleteAccount,
    logout,
    refreshUser,
  };
}
