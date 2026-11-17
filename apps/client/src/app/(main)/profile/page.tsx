'use client';

import React, { useCallback, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, CheckCircle2, AlertCircle } from 'lucide-react';
import {
  ProfileSidebar,
  PersonalInfoSection,
  SecuritySection,
  DangerZoneSection,
} from '@/components/profile';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { extractUserApiError } from '@/services/users.api';
import type { DeleteAccountInput } from '@/types/user';

interface ToastState {
  variant: 'success' | 'error';
  message: string;
}

export default function ProfilePage() {
  const router = useRouter();
  const {
    user,
    isLoading,
    errorMessage,
    updateProfile,
    uploadAvatar,
    changePassword,
    deleteAccount,
    logout,
    refreshUser,
  } = useCurrentUser();

  const [toast, setToast] = useState<ToastState | null>(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const showToast = useCallback(
    (variant: 'success' | 'error', message: string) => {
      setToast({ variant, message });
      window.setTimeout(() => {
        setToast((prev) => (prev?.message === message ? null : prev));
      }, 3600);
    },
    [],
  );

  const handleSavePersonalInfo = async (data: { name: string }) => {
    try {
      await updateProfile({ name: data.name });
      showToast('success', 'Đã cập nhật thông tin cá nhân thành công.');
    } catch (error) {
      showToast(
        'error',
        extractUserApiError(error, 'Không thể cập nhật thông tin cá nhân.'),
      );
      throw error;
    }
  };

  const handleUploadAvatar = async (file: File) => {
    setIsUploadingAvatar(true);
    try {
      await uploadAvatar(file);
      showToast('success', 'Đã cập nhật ảnh đại diện thành công.');
    } catch (error) {
      showToast(
        'error',
        extractUserApiError(error, 'Không thể tải ảnh đại diện lên hệ thống.'),
      );
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handleUpdatePassword = async (data: {
    currentPassword?: string;
    newPassword: string;
  }) => {
    try {
      const res = await changePassword(data);
      showToast('success', res.message || 'Cập nhật mật khẩu thành công.');
    } catch (error) {
      showToast(
        'error',
        extractUserApiError(error, 'Không thể cập nhật mật khẩu.'),
      );
      throw error;
    }
  };

  const handleDeleteAccount = async (input: DeleteAccountInput) => {
    try {
      await deleteAccount(input);
      router.replace('/auth/login');
    } catch (error) {
      showToast(
        'error',
        extractUserApiError(error, 'Không thể xóa tài khoản. Vui lòng thử lại.'),
      );
      throw error;
    }
  };

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await logout();
      router.replace('/auth/login');
    } catch (error) {
      showToast(
        'error',
        extractUserApiError(error, 'Đăng xuất thất bại. Vui lòng thử lại.'),
      );
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <div className="relative w-full space-y-6">
      {/* Floating Toast Notification */}
      {toast && (
        <div
          role="status"
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-2.5 rounded-2xl border px-4 py-3 text-sm font-medium shadow-lg backdrop-blur-md transition-all ${
            toast.variant === 'success'
              ? 'border-emerald-200 bg-emerald-50/95 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-950/90 dark:text-emerald-200'
              : 'border-rose-200 bg-rose-50/95 text-rose-800 dark:border-rose-500/30 dark:bg-rose-950/90 dark:text-rose-200'
          }`}
        >
          {toast.variant === 'success' ? (
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
          ) : (
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400" />
          )}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Top Back Navigation */}
      <div>
        <Link
          href="/home"
          className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 dark:border-white/[0.1] bg-white dark:bg-[#12151C] px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-neutral-300 shadow-2xs transition-colors hover:text-indigo-600 dark:hover:text-indigo-400"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Quay lại Không gian học tập
        </Link>
      </div>

      {/* Page Title */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold font-heading tracking-tight text-gray-900 dark:text-neutral-100">
              Hồ sơ &amp; Cài đặt tài khoản
            </h1>
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold font-heading ${
                user?.isActive !== false
                  ? 'border-emerald-200 bg-emerald-100 text-emerald-700 dark:border-emerald-500/25 dark:bg-emerald-500/15 dark:text-emerald-300'
                  : 'border-gray-200 bg-gray-100 text-gray-600'
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  user?.isActive !== false ? 'bg-emerald-500' : 'bg-gray-400'
                }`}
              />
              {user?.isActive !== false
                ? 'Tài khoản đang hoạt động'
                : 'Tài khoản tạm khóa'}
            </span>
          </div>
          <p className="mt-1 text-sm text-gray-500 dark:text-neutral-400">
            Quản lý thông tin cá nhân, ảnh đại diện, phương thức bảo mật và dữ liệu tài khoản AI StudyMate.
          </p>
        </div>
        <span className="hidden shrink-0 rounded-lg border border-gray-100 dark:border-white/[0.08] bg-white dark:bg-[#12151C] px-3 py-1.5 text-xs font-medium text-gray-500 dark:text-neutral-400 shadow-2xs sm:inline-block">
          AI-StudyMate • v3.0
        </span>
      </div>

      {/* Error Banner */}
      {errorMessage && !user && (
        <div className="flex items-center justify-between rounded-2xl border border-rose-200 bg-rose-50 dark:border-rose-500/20 dark:bg-rose-950/20 p-4 text-sm text-rose-700 dark:text-rose-300">
          <span>{errorMessage}</span>
          <button
            type="button"
            onClick={() => {
              void refreshUser();
            }}
            className="rounded-lg bg-white dark:bg-white/[0.08] px-3 py-1 text-xs font-semibold text-rose-700 dark:text-rose-200 shadow-2xs cursor-pointer"
          >
            Thử lại
          </button>
        </div>
      )}

      {/* Loading Skeleton */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[290px_1fr] animate-pulse">
          <div className="h-[460px] rounded-2xl border border-gray-100 dark:border-white/[0.08] bg-white dark:bg-[#12151C]" />
          <div className="space-y-6">
            <div className="h-64 rounded-2xl border border-gray-100 dark:border-white/[0.08] bg-white dark:bg-[#12151C]" />
            <div className="h-72 rounded-2xl border border-gray-100 dark:border-white/[0.08] bg-white dark:bg-[#12151C]" />
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[290px_1fr]">
          {/* Left: Profile Card */}
          <div className="lg:sticky lg:top-6 lg:self-start">
            <ProfileSidebar
              user={user}
              isUploadingAvatar={isUploadingAvatar}
              isLoggingOut={isLoggingOut}
              onUploadAvatar={handleUploadAvatar}
              onAvatarValidationError={(msg) => showToast('error', msg)}
              onLogout={handleLogout}
            />
          </div>

          {/* Right: Settings Sections */}
          <div className="flex flex-col gap-6">
            <PersonalInfoSection
              defaultName={user?.name ?? ''}
              defaultEmail={user?.email ?? ''}
              emailVerified={user?.isVerified ?? false}
              onSave={handleSavePersonalInfo}
            />
            <SecuritySection
              provider={user?.provider ?? 'local'}
              email={user?.email ?? ''}
              isVerified={user?.isVerified ?? false}
              hasPassword={user?.hasPassword ?? true}
              onUpdatePassword={handleUpdatePassword}
            />
            <DangerZoneSection
              email={user?.email ?? ''}
              hasPassword={user?.hasPassword ?? true}
              onDeleteAccount={handleDeleteAccount}
            />
          </div>
        </div>
      )}
    </div>
  );
}
