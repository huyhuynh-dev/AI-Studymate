'use client';

import React, { useState } from 'react';
import { AlertTriangle, Trash2, Loader2 } from 'lucide-react';
import type { DeleteAccountInput } from '@/types/user';

export interface DangerZoneSectionProps {
  email?: string;
  hasPassword?: boolean;
  onDeleteAccount?: (input: DeleteAccountInput) => Promise<void>;
}

export default function DangerZoneSection({
  email = '',
  hasPassword = true,
  onDeleteAccount,
}: DangerZoneSectionProps) {
  const [isConfirming, setIsConfirming] = useState(false);
  const [confirmInput, setConfirmInput] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleConfirmDelete = async () => {
    setValidationError(null);
    const trimmed = confirmInput.trim();

    if (hasPassword) {
      if (!trimmed) {
        setValidationError(
          'Vui lòng nhập mật khẩu hiện tại để xác nhận xóa tài khoản.',
        );
        return;
      }
    } else if (trimmed.toLowerCase() !== email.trim().toLowerCase()) {
      setValidationError(
        `Vui lòng nhập chính xác địa chỉ email (${email}) để xác nhận.`,
      );
      return;
    }

    setIsDeleting(true);
    try {
      await onDeleteAccount?.(
        hasPassword ? { currentPassword: trimmed } : { confirmEmail: trimmed },
      );
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCancel = () => {
    setIsConfirming(false);
    setConfirmInput('');
    setValidationError(null);
  };

  return (
    <div className="rounded-2xl border border-red-100 dark:border-red-500/20 bg-white dark:bg-[#12151C] p-6 shadow-sm">
      {/* Header */}
      <div className="mb-5 flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-100 dark:bg-red-500/15">
            <AlertTriangle className="h-5 w-5 text-red-500" />
          </div>
          <div>
            <h2 className="text-base font-bold font-heading text-gray-900 dark:text-neutral-100">
              Vùng nguy hiểm
            </h2>
            <p className="mt-0.5 text-xs text-gray-400">
              Hành động vĩnh viễn không thể khôi phục dữ liệu đã lưu trữ.
            </p>
          </div>
        </div>
        <span className="text-xs font-semibold font-heading uppercase tracking-wide text-red-500">
          CẢNH BÁO
        </span>
      </div>

      {/* Delete Account Card */}
      <div className="rounded-xl border border-red-100 dark:border-red-500/20 bg-red-50/50 dark:bg-red-500/5 p-4">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm font-semibold font-heading text-gray-800 dark:text-neutral-100">
              Xóa tài khoản vĩnh viễn
            </p>
            <p className="mt-1 text-xs text-gray-500 dark:text-neutral-400">
              Mọi môn học, tài liệu tải lên, tóm tắt bài giảng AI, bộ flashcards SM-2 và lịch sử bài kiểm tra sẽ bị xóa hoàn toàn khỏi hệ thống.
            </p>
          </div>
          {!isConfirming && (
            <button
              type="button"
              onClick={() => setIsConfirming(true)}
              className="shrink-0 flex items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-red-700 active:scale-95 cursor-pointer"
            >
              <Trash2 className="h-4 w-4" />
              Xóa tài khoản
            </button>
          )}
        </div>

        {isConfirming && (
          <div className="mt-4 space-y-3 rounded-xl border border-red-200 dark:border-red-500/30 bg-white dark:bg-[#0E1118] p-4">
            <p className="text-xs font-medium text-red-700 dark:text-red-300">
              {hasPassword
                ? 'Hành động này không thể hoàn tác. Nhập mật khẩu hiện tại của bạn để xác nhận xóa vĩnh viễn:'
                : `Hành động này không thể hoàn tác. Nhập chính xác email "${email}" để xác nhận xóa vĩnh viễn:`}
            </p>
            <input
              type={hasPassword ? 'password' : 'email'}
              value={confirmInput}
              onChange={(e) => {
                setConfirmInput(e.target.value);
                if (validationError) setValidationError(null);
              }}
              placeholder={
                hasPassword ? 'Nhập mật khẩu hiện tại' : email || 'Nhập email xác nhận'
              }
              className="w-full rounded-xl border border-red-200 dark:border-red-500/30 bg-red-50/40 dark:bg-red-950/20 px-3.5 py-2 text-sm text-gray-900 dark:text-neutral-100 outline-none focus:border-red-400 focus:ring-3 focus:ring-red-500/10"
            />
            {validationError && (
              <p className="text-xs font-medium text-rose-600 dark:text-rose-400">
                {validationError}
              </p>
            )}
            <div className="flex items-center justify-end gap-2.5 pt-1">
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleCancel}
                className="rounded-xl px-3.5 py-2 text-xs font-medium text-gray-600 dark:text-neutral-300 hover:bg-gray-100 dark:hover:bg-white/[0.06] cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => {
                  void handleConfirmDelete();
                }}
                className="flex items-center gap-2 rounded-xl bg-red-700 px-4 py-2 text-xs font-semibold text-white shadow-sm transition-all hover:bg-red-800 disabled:opacity-50 cursor-pointer"
              >
                {isDeleting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Trash2 className="h-3.5 w-3.5" />
                )}
                {isDeleting ? 'Đang xóa...' : 'Xác nhận xóa vĩnh viễn'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export { DangerZoneSection };
