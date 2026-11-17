'use client';

import React, { useState } from 'react';
import {
  Lock,
  Eye,
  EyeOff,
  KeyRound,
  Info,
  Mail,
  Loader2,
} from 'lucide-react';

export interface SecuritySectionProps {
  provider?: string | null;
  email?: string;
  isVerified?: boolean;
  hasPassword?: boolean;
  onUpdatePassword?: (data: {
    currentPassword?: string;
    newPassword: string;
  }) => Promise<void>;
}

const PASSWORD_REGEX = /^(?=.*[A-Za-z])(?=.*\d).{8,128}$/;

export default function SecuritySection({
  provider = 'local',
  email = '',
  isVerified = false,
  hasPassword = true,
  onUpdatePassword,
}: SecuritySectionProps) {
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const isGoogleProvider = provider === 'google';

  const handleUpdate = async () => {
    setValidationError(null);

    if (hasPassword && !currentPassword) {
      setValidationError('Vui lòng nhập mật khẩu hiện tại.');
      return;
    }

    if (!PASSWORD_REGEX.test(newPassword)) {
      setValidationError(
        'Mật khẩu mới phải có tối thiểu 8 ký tự, bao gồm cả chữ cái và chữ số.',
      );
      return;
    }

    if (newPassword !== confirmPassword) {
      setValidationError('Mật khẩu xác nhận không khớp với mật khẩu mới.');
      return;
    }

    setIsUpdating(true);
    let succeeded = false;
    try {
      await onUpdatePassword?.({
        ...(hasPassword ? { currentPassword } : {}),
        newPassword,
      });
      succeeded = true;
    } finally {
      setIsUpdating(false);
      if (succeeded) {
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      }
    }
  };

  return (
    <div className="rounded-2xl border border-gray-100 dark:border-white/[0.08] bg-white dark:bg-[#12151C] p-6 shadow-sm">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 dark:bg-amber-500/15">
            <Lock className="h-5 w-5 text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <h2 className="text-base font-bold font-heading text-gray-900 dark:text-neutral-100">
              Bảo mật &amp; Phương thức đăng nhập
            </h2>
            <p className="mt-0.5 text-xs text-gray-400">
              Kiểm tra phương thức xác thực và cập nhật mật khẩu truy cập tài khoản.
            </p>
          </div>
        </div>
        <span className="text-xs font-medium font-heading text-gray-400">
          MỤC 02 / 03
        </span>
      </div>

      {/* Connected Auth Method */}
      <div className="mb-6">
        <p className="mb-3 text-sm font-semibold font-heading text-gray-700 dark:text-neutral-200">
          Phương thức đăng nhập hiện tại
        </p>
        <div className="flex items-center justify-between rounded-xl border border-gray-100 dark:border-white/[0.08] bg-gray-50 dark:bg-white/[0.03] px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-100 dark:border-white/[0.1] bg-white dark:bg-[#181C26] shadow-2xs">
              {isGoogleProvider ? (
                <svg viewBox="0 0 24 24" className="h-4 w-4">
                  <path
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    fill="#4285F4"
                  />
                  <path
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    fill="#34A853"
                  />
                  <path
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    fill="#FBBC05"
                  />
                  <path
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    fill="#EA4335"
                  />
                </svg>
              ) : (
                <Mail className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-gray-800 dark:text-neutral-100">
                  {isGoogleProvider
                    ? 'Đăng nhập qua Google OAuth'
                    : 'Đăng nhập bằng Email & Mật khẩu'}
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                    isVerified
                      ? 'bg-emerald-100 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                      : 'bg-amber-100 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300'
                  }`}
                >
                  {isVerified ? 'Đang hoạt động' : 'Chưa xác thực'}
                </span>
              </div>
              <p className="text-xs text-gray-400">{email || '—'}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Change / Set Password */}
      <div>
        <p className="text-sm font-semibold font-heading text-gray-700 dark:text-neutral-200">
          {hasPassword
            ? 'Đổi mật khẩu tài khoản'
            : 'Thiết lập mật khẩu đăng nhập bổ sung'}
        </p>
        <p className="mb-4 text-xs text-gray-400">
          {hasPassword
            ? 'Xác nhận mật khẩu hiện tại trước khi thay đổi sang mật khẩu mới an toàn hơn.'
            : 'Tài khoản Google của bạn chưa có mật khẩu riêng. Thiết lập mật khẩu để có thể đăng nhập trực tiếp bằng Email.'}
        </p>

        <div className="space-y-4">
          {hasPassword && (
            <div>
              <label
                className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-neutral-200"
                htmlFor="current-password"
              >
                Mật khẩu hiện tại
              </label>
              <div className="relative">
                <input
                  id="current-password"
                  type={showCurrent ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={(e) => {
                    setCurrentPassword(e.target.value);
                    if (validationError) setValidationError(null);
                  }}
                  placeholder="Nhập mật khẩu hiện tại"
                  className="w-full rounded-xl border border-gray-200 dark:border-white/[0.08] bg-gray-50 dark:bg-white/[0.03] py-2.5 pl-4 pr-10 text-sm text-gray-800 dark:text-neutral-100 placeholder-gray-400 outline-none transition-all hover:border-gray-300 focus:border-indigo-400 focus:bg-white dark:focus:bg-[#0E1118] focus:ring-3 focus:ring-indigo-500/10"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrent(!showCurrent)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-gray-400 hover:text-gray-600 cursor-pointer"
                >
                  {showCurrent ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>
          )}

          {/* New & Confirm Password */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label
                className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-neutral-200"
                htmlFor="new-password"
              >
                Mật khẩu mới
              </label>
              <div className="relative">
                <input
                  id="new-password"
                  type={showNew ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => {
                    setNewPassword(e.target.value);
                    if (validationError) setValidationError(null);
                  }}
                  placeholder="Mật khẩu mới"
                  className="w-full rounded-xl border border-gray-200 dark:border-white/[0.08] bg-gray-50 dark:bg-white/[0.03] py-2.5 pl-4 pr-10 text-sm text-gray-800 dark:text-neutral-100 placeholder-gray-400 outline-none transition-all hover:border-gray-300 focus:border-indigo-400 focus:bg-white dark:focus:bg-[#0E1118] focus:ring-3 focus:ring-indigo-500/10"
                />
                <button
                  type="button"
                  onClick={() => setShowNew(!showNew)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-gray-400 hover:text-gray-600 cursor-pointer"
                >
                  {showNew ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            <div>
              <label
                className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-neutral-200"
                htmlFor="confirm-password"
              >
                Xác nhận mật khẩu mới
              </label>
              <div className="relative">
                <input
                  id="confirm-password"
                  type={showConfirm ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    if (validationError) setValidationError(null);
                  }}
                  placeholder="Nhập lại mật khẩu mới"
                  className="w-full rounded-xl border border-gray-200 dark:border-white/[0.08] bg-gray-50 dark:bg-white/[0.03] py-2.5 pl-4 pr-10 text-sm text-gray-800 dark:text-neutral-100 placeholder-gray-400 outline-none transition-all hover:border-gray-300 focus:border-indigo-400 focus:bg-white dark:focus:bg-[#0E1118] focus:ring-3 focus:ring-indigo-500/10"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-gray-400 hover:text-gray-600 cursor-pointer"
                >
                  {showConfirm ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>
          </div>

          {validationError && (
            <p className="text-xs font-medium text-rose-600 dark:text-rose-400">
              {validationError}
            </p>
          )}

          <p className="flex items-center gap-1.5 text-xs text-gray-400">
            <Info className="h-3.5 w-3.5 text-indigo-400" />
            Tối thiểu 8 ký tự bao gồm chữ cái và chữ số.
          </p>
        </div>

        {/* Submit */}
        <div className="mt-5 flex justify-end">
          <button
            type="button"
            disabled={isUpdating}
            onClick={() => {
              void handleUpdate();
            }}
            className="flex items-center gap-2 rounded-xl border border-gray-200 dark:border-white/[0.1] bg-gray-100 dark:bg-white/[0.06] px-5 py-2 text-sm font-semibold text-gray-700 dark:text-neutral-100 shadow-2xs transition-all hover:bg-gray-200 dark:hover:bg-white/[0.1] active:scale-95 disabled:opacity-50 cursor-pointer"
          >
            {isUpdating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <KeyRound className="h-4 w-4" />
            )}
            {isUpdating
              ? 'Đang cập nhật...'
              : hasPassword
                ? 'Cập nhật mật khẩu'
                : 'Thiết lập mật khẩu'}
          </button>
        </div>
      </div>
    </div>
  );
}

export { SecuritySection };
