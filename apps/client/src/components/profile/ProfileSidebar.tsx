'use client';

import React, { useRef, useState } from 'react';
import Image from 'next/image';
import {
  Camera,
  Calendar,
  Copy,
  Check,
  LogOut,
  Loader2,
  BookOpen,
  MessageSquare,
  FileText,
  Layers,
} from 'lucide-react';
import type { UserProfile } from '@/types/user';

export interface ProfileSidebarProps {
  user: UserProfile | null;
  isUploadingAvatar?: boolean;
  isLoggingOut?: boolean;
  onUploadAvatar?: (file: File) => Promise<void>;
  onAvatarValidationError?: (message: string) => void;
  onLogout?: () => Promise<void>;
}

const ALLOWED_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);
const MAX_AVATAR_BYTES = 5 * 1024 * 1024;

function getInitials(name?: string): string {
  if (!name) return 'U';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'U';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function formatCreatedAt(isoDate?: string): string {
  if (!isoDate) return '—';
  const parsed = new Date(isoDate);
  if (Number.isNaN(parsed.getTime())) return '—';
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(parsed);
}

export default function ProfileSidebar({
  user,
  isUploadingAvatar = false,
  isLoggingOut = false,
  onUploadAvatar,
  onAvatarValidationError,
  onLogout,
}: ProfileSidebarProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [copiedId, setCopiedId] = useState(false);

  const handleCopyId = async () => {
    if (!user?.id) return;
    try {
      await navigator.clipboard.writeText(user.id);
      setCopiedId(true);
      window.setTimeout(() => setCopiedId(false), 2000);
    } catch {
      // Ignore clipboard permission errors
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
      onAvatarValidationError?.(
        'Vui lòng chọn ảnh định dạng JPG, PNG, WEBP hoặc GIF.',
      );
      return;
    }

    if (file.size > MAX_AVATAR_BYTES) {
      onAvatarValidationError?.(
        'Dung lượng ảnh đại diện tối đa cho phép là 5MB.',
      );
      return;
    }

    await onUploadAvatar?.(file);
  };

  const roleLabel =
    user?.role === 'admin' ? 'Quản trị viên' : 'Thành viên cá nhân';
  const studyItemsCount =
    (user?.stats.flashcardDecksCount ?? 0) + (user?.stats.quizzesCount ?? 0);

  return (
    <div className="flex w-full flex-col items-center gap-4 rounded-2xl border border-gray-100 dark:border-white/[0.08] bg-white dark:bg-[#12151C] p-6 shadow-sm">
      {/* Avatar */}
      <div className="relative">
        <div className="relative flex h-24 w-24 items-center justify-center overflow-hidden rounded-full border-4 border-white dark:border-[#1E222D] bg-gradient-to-br from-indigo-500 to-violet-600 text-2xl font-bold font-heading text-white shadow-md">
          {user?.avatarUrl ? (
            <Image
              src={user.avatarUrl}
              alt={user.name}
              width={96}
              height={96}
              unoptimized
              className="h-full w-full object-cover"
            />
          ) : (
            <span>{getInitials(user?.name)}</span>
          )}
          {isUploadingAvatar && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/45 backdrop-blur-2xs">
              <Loader2 className="h-6 w-6 animate-spin text-white" />
            </div>
          )}
        </div>
        <span
          className={`absolute bottom-1 right-1 h-4 w-4 rounded-full border-2 border-white dark:border-[#12151C] ${
            user?.isActive !== false ? 'bg-emerald-500' : 'bg-gray-400'
          }`}
        />
      </div>

      {/* Hidden File Input & Change Avatar Trigger */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        onChange={handleFileChange}
        className="hidden"
      />
      <button
        type="button"
        disabled={!user || isUploadingAvatar}
        onClick={() => fileInputRef.current?.click()}
        className="flex items-center gap-1.5 rounded-lg border border-gray-200 dark:border-white/[0.1] bg-white dark:bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-neutral-300 shadow-2xs transition-all hover:border-indigo-300 hover:text-indigo-600 dark:hover:text-indigo-400 disabled:opacity-50 cursor-pointer"
      >
        {isUploadingAvatar ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Camera className="h-3.5 w-3.5" />
        )}
        {isUploadingAvatar ? 'Đang tải ảnh...' : 'Thay đổi ảnh'}
      </button>

      {/* Name & Role */}
      <div className="text-center w-full">
        <p className="text-base font-bold font-heading text-gray-900 dark:text-neutral-100 truncate">
          {user?.name || 'Đang tải...'}
        </p>
        <p className="mt-0.5 text-xs text-gray-500 dark:text-neutral-400 truncate">
          {user?.email || '—'}
        </p>
        <span className="mt-2 inline-flex items-center rounded-full bg-violet-100 dark:bg-violet-500/15 px-2.5 py-0.5 text-xs font-medium font-heading text-violet-700 dark:text-violet-300">
          {roleLabel}
        </span>
      </div>

      {/* Quick Study Stats */}
      <div className="grid w-full grid-cols-2 gap-2 border-t border-gray-100 dark:border-white/[0.08] pt-4">
        <div className="rounded-xl bg-slate-50 dark:bg-white/[0.03] p-2.5">
          <div className="flex items-center gap-1.5 text-[11px] text-gray-400">
            <BookOpen className="h-3.5 w-3.5 text-indigo-500" />
            <span>Môn học</span>
          </div>
          <p className="mt-1 text-base font-bold font-heading text-gray-800 dark:text-neutral-100 tabular-nums">
            {user?.stats.subjectsCount ?? 0}
          </p>
        </div>
        <div className="rounded-xl bg-slate-50 dark:bg-white/[0.03] p-2.5">
          <div className="flex items-center gap-1.5 text-[11px] text-gray-400">
            <MessageSquare className="h-3.5 w-3.5 text-violet-500" />
            <span>Phiên học</span>
          </div>
          <p className="mt-1 text-base font-bold font-heading text-gray-800 dark:text-neutral-100 tabular-nums">
            {user?.stats.conversationsCount ?? 0}
          </p>
        </div>
        <div className="rounded-xl bg-slate-50 dark:bg-white/[0.03] p-2.5">
          <div className="flex items-center gap-1.5 text-[11px] text-gray-400">
            <FileText className="h-3.5 w-3.5 text-emerald-500" />
            <span>Tài liệu</span>
          </div>
          <p className="mt-1 text-base font-bold font-heading text-gray-800 dark:text-neutral-100 tabular-nums">
            {user?.stats.documentsCount ?? 0}
          </p>
        </div>
        <div className="rounded-xl bg-slate-50 dark:bg-white/[0.03] p-2.5">
          <div className="flex items-center gap-1.5 text-[11px] text-gray-400">
            <Layers className="h-3.5 w-3.5 text-amber-500" />
            <span>Bộ thẻ / Quiz</span>
          </div>
          <p className="mt-1 text-base font-bold font-heading text-gray-800 dark:text-neutral-100 tabular-nums">
            {studyItemsCount}
          </p>
        </div>
      </div>

      {/* Meta Info */}
      <div className="w-full space-y-3 border-t border-gray-100 dark:border-white/[0.08] pt-4">
        <div className="flex items-start gap-3">
          <Calendar className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
          <div>
            <p className="text-[11px] text-gray-400">Ngày tạo tài khoản</p>
            <p className="text-sm font-semibold text-gray-700 dark:text-neutral-200">
              {formatCreatedAt(user?.createdAt)}
            </p>
          </div>
        </div>

        {user?.id && (
          <div className="flex items-start gap-3">
            <div className="mt-1 h-3.5 w-3.5 shrink-0 rounded-sm border border-gray-300 dark:border-neutral-600 bg-gray-100 dark:bg-white/[0.05]" />
            <div className="min-w-0 flex-1">
              <p className="text-[11px] text-gray-400">Mã định danh (User ID)</p>
              <div className="flex items-center gap-1.5">
                <p className="truncate text-xs font-mono text-gray-600 dark:text-neutral-300">
                  {user.id}
                </p>
                <button
                  type="button"
                  onClick={handleCopyId}
                  aria-label="Sao chép User ID"
                  className="shrink-0 text-gray-400 hover:text-indigo-600 transition-colors cursor-pointer"
                >
                  {copiedId ? (
                    <Check className="h-3.5 w-3.5 text-emerald-500" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Logout */}
      <button
        type="button"
        disabled={isLoggingOut}
        onClick={() => {
          void onLogout?.();
        }}
        className="mt-1 flex w-full items-center justify-center gap-2 rounded-xl border border-red-100 dark:border-red-500/20 bg-red-50 dark:bg-red-500/10 px-4 py-2.5 text-sm font-medium text-red-600 dark:text-red-400 transition-all hover:bg-red-100 dark:hover:bg-red-500/20 hover:border-red-200 disabled:opacity-50 cursor-pointer"
      >
        {isLoggingOut ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <LogOut className="h-4 w-4" />
        )}
        {isLoggingOut ? 'Đang đăng xuất...' : 'Đăng xuất tài khoản'}
      </button>
    </div>
  );
}

export { ProfileSidebar };
