'use client';

import React, { useState } from 'react';
import {
  User,
  Mail,
  CheckCircle2,
  AlertCircle,
  Pencil,
  Check,
  Loader2,
} from 'lucide-react';

export interface PersonalInfoSectionProps {
  defaultName?: string;
  defaultEmail?: string;
  emailVerified?: boolean;
  onSave?: (data: { name: string }) => Promise<void>;
}

export default function PersonalInfoSection({
  defaultName = '',
  defaultEmail = '',
  emailVerified = false,
  onSave,
}: PersonalInfoSectionProps) {
  const [name, setName] = useState(defaultName);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const displayedName = isEditing ? name : defaultName;

  const handleStartEdit = () => {
    setValidationError(null);
    setName(defaultName);
    setIsEditing(true);
  };

  const handleCancel = () => {
    setValidationError(null);
    setName(defaultName);
    setIsEditing(false);
  };

  const handleSave = async () => {
    const trimmed = name.trim();
    if (trimmed.length < 2) {
      setValidationError('Họ và tên phải có ít nhất 2 ký tự.');
      return;
    }
    if (trimmed.length > 100) {
      setValidationError('Họ và tên không được vượt quá 100 ký tự.');
      return;
    }

    setValidationError(null);
    setIsSaving(true);
    try {
      await onSave?.({ name: trimmed });
      setIsEditing(false);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="rounded-2xl border border-gray-100 dark:border-white/[0.08] bg-white dark:bg-[#12151C] p-6 shadow-sm">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-100 dark:bg-violet-500/15">
            <User className="h-5 w-5 text-violet-600 dark:text-violet-400" />
          </div>
          <div>
            <h2 className="text-base font-bold font-heading text-gray-900 dark:text-neutral-100">
              Thông tin cá nhân
            </h2>
            <p className="mt-0.5 text-xs text-gray-400">
              Cập nhật danh xưng hiển thị và kiểm tra trạng thái xác thực email.
            </p>
          </div>
        </div>
        <span className="text-xs font-medium font-heading text-gray-400">
          MỤC 01 / 03
        </span>
      </div>

      {/* Form */}
      <div className="space-y-5">
        {/* Full Name */}
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label
              className="text-sm font-medium text-gray-700 dark:text-neutral-200"
              htmlFor="profile-name"
            >
              Họ và tên
            </label>
            <span className="text-xs text-gray-400">Bắt buộc</span>
          </div>
          <div className="relative">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-gray-400">
              <User className="h-4 w-4" />
            </div>
            <input
              readOnly={!isEditing || isSaving}
              id="profile-name"
              type="text"
              value={displayedName}
              onChange={(e) => {
                setName(e.target.value);
                if (validationError) setValidationError(null);
              }}
              placeholder="Nhập họ và tên của bạn"
              className={`w-full rounded-xl border py-2.5 pl-10 pr-4 text-sm outline-none transition-all ${
                isEditing
                  ? 'border-indigo-300 dark:border-indigo-500/60 bg-white dark:bg-[#0E1118] text-gray-900 dark:text-neutral-100 ring-3 ring-indigo-500/10'
                  : 'border-gray-200 dark:border-white/[0.08] bg-gray-50 dark:bg-white/[0.03] text-gray-800 dark:text-neutral-200'
              }`}
            />
          </div>
          {validationError && (
            <p className="mt-1.5 text-xs font-medium text-rose-600 dark:text-rose-400">
              {validationError}
            </p>
          )}
          <p className="mt-1.5 text-xs text-gray-400">
            Tên hiển thị trên không gian học tập, thanh điều hướng và các học liệu cá nhân.
          </p>
        </div>

        {/* Email */}
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label
              className="text-sm font-medium text-gray-700 dark:text-neutral-200"
              htmlFor="profile-email"
            >
              Địa chỉ Email
            </label>
            {emailVerified ? (
              <span className="flex items-center gap-1 rounded-full border border-emerald-100 dark:border-emerald-500/20 bg-emerald-50 dark:bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="h-3 w-3" />
                Đã xác thực
              </span>
            ) : (
              <span className="flex items-center gap-1 rounded-full border border-amber-100 dark:border-amber-500/20 bg-amber-50 dark:bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-600 dark:text-amber-400">
                <AlertCircle className="h-3 w-3" />
                Chưa xác thực
              </span>
            )}
          </div>
          <div className="relative">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-gray-400">
              <Mail className="h-4 w-4" />
            </div>
            <input
              readOnly
              id="profile-email"
              type="email"
              value={defaultEmail}
              className="w-full rounded-xl border border-gray-200 dark:border-white/[0.08] bg-gray-50 dark:bg-white/[0.03] py-2.5 pl-10 pr-4 text-sm text-gray-500 dark:text-neutral-400 outline-none cursor-not-allowed"
            />
          </div>
          <p className="mt-1.5 text-xs text-gray-400">
            Email định danh chính dùng để đăng nhập và khôi phục tài khoản (không thể thay đổi).
          </p>
        </div>
      </div>

      {/* Actions */}
      <div className="mt-6 flex items-center justify-end gap-3">
        {isEditing ? (
          <>
            <button
              type="button"
              disabled={isSaving}
              onClick={handleCancel}
              className="rounded-xl px-4 py-2 text-sm font-medium text-gray-600 dark:text-neutral-300 transition-colors hover:bg-gray-100 dark:hover:bg-white/[0.06] disabled:opacity-50 cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="button"
              disabled={isSaving}
              onClick={() => {
                void handleSave();
              }}
              className="flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-indigo-700 active:scale-95 disabled:opacity-60 cursor-pointer"
            >
              {isSaving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="h-4 w-4" />
              )}
              {isSaving ? 'Đang lưu...' : 'Lưu thay đổi'}
            </button>
          </>
        ) : (
          <button
            type="button"
            disabled={!defaultEmail}
            onClick={handleStartEdit}
            className="flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-indigo-700 active:scale-95 disabled:opacity-50 cursor-pointer"
          >
            <Pencil className="h-4 w-4" />
            Chỉnh sửa
          </button>
        )}
      </div>
    </div>
  );
}

export { PersonalInfoSection };
