"use client";

import React from "react";
import { ChevronLeft, Share2, MoreHorizontal, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export interface ConversationHeaderProps {
  /** Callback khi bấm nút "Quay lại" */
  onBack?: () => void;
  /** Đường dẫn quay lại mặc định nếu không truyền onBack */
  backHref?: string;
  /** Tên môn học / Không gian học tập (Tầng 1 - Eyebrow) */
  subjectName?: string;
  /** Đường dẫn tới trang môn học */
  subjectHref?: string;
  /** Tiêu đề phiên học hiện tại (Tầng 2 - Heading) */
  sessionTitle?: string;
  /** Nhãn trạng thái (ví dụ: "Phiên mới") */
  badgeText?: string;
  /** Trạng thái đóng/mở của thanh Trợ lý AI */
  isRightSidebarCollapsed?: boolean;
  /** Callback bật/tắt thanh Trợ lý AI */
  onToggleRightSidebar?: () => void;
  /** Callback khi bấm nút Chia sẻ */
  onShare?: () => void;
  /** Callback khi bấm nút Tùy chọn khác */
  onMoreOptions?: () => void;
  /** Class tùy chọn */
  className?: string;
}

export default function ConversationHeader({
  onBack,
  backHref,
  subjectName = "Cấu Trúc Dữ Liệu",
  subjectHref,
  sessionTitle = "Phiên học mới",
  badgeText = "Phiên mới",
  isRightSidebarCollapsed = true,
  onToggleRightSidebar,
  onShare,
  onMoreOptions,
  className = "",
}: ConversationHeaderProps) {
  const router = useRouter();

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else if (backHref) {
      router.push(backHref);
    } else {
      router.back();
    }
  };

  return (
    <header
      className={`flex items-center justify-between gap-3 select-none w-full min-w-0 ${className}`}
      aria-label="Conversation Toolbar"
    >
      {/* Vùng bên trái: Nút Back + Tiêu đề phân cấp 2 tầng (Hierarchical Title) */}
      <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
        {/* Nút Quay lại chuẩn Apple Pill/Circle Button */}
        <button
          type="button"
          onClick={handleBack}
          aria-label="Quay lại"
          title="Quay lại"
          className="group flex h-8.5 w-8.5 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-full border border-black/[0.06] dark:border-white/[0.08] bg-white/80 dark:bg-[#12151C]/80 backdrop-blur-md text-neutral-600 dark:text-neutral-300 shadow-2xs transition-all duration-200 hover:bg-neutral-100/80 dark:hover:bg-white/[0.08] hover:text-neutral-900 dark:hover:text-white active:scale-95 cursor-pointer"
        >
          <ChevronLeft className="h-4.5 w-4.5 text-neutral-500 dark:text-neutral-400 group-hover:text-neutral-800 dark:group-hover:text-neutral-200 transition-colors" />
        </button>

        {/* Cụm Tiêu đề 2 tầng macOS / iPadOS */}
        <div className="flex flex-col min-w-0 justify-center leading-tight">
          {/* Tầng 1 (Eyebrow Breadcrumb) */}
          <div className="flex items-center gap-1.5 text-xs text-neutral-400 dark:text-neutral-400 font-medium">
            {subjectHref ? (
              <Link
                href={subjectHref}
                className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors truncate max-w-[160px] sm:max-w-[240px]"
                title={subjectName}
              >
                {subjectName}
              </Link>
            ) : (
              <span className="truncate max-w-[160px] sm:max-w-[240px]" title={subjectName}>
                {subjectName}
              </span>
            )}
          </div>

          {/* Tầng 2 (Heading + Status Indicator) */}
          <div className="flex items-center gap-2 mt-0.5 min-w-0">
            <h1
              className="text-sm sm:text-base font-semibold text-neutral-900 dark:text-neutral-100 tracking-tight truncate max-w-[180px] sm:max-w-[320px] md:max-w-[420px]"
              title={sessionTitle}
            >
              {sessionTitle}
            </h1>

            {/* Apple Status Dot & Mini Pill */}
            {badgeText && (
              <div className="hidden xs:inline-flex items-center gap-1 rounded-full bg-emerald-500/10 dark:bg-emerald-500/15 border border-emerald-500/20 px-2 py-0.5 text-[10.5px] font-medium text-emerald-700 dark:text-emerald-400 shrink-0">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" aria-hidden="true" />
                <span>{badgeText}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Vùng bên phải: Nhóm nút hành động Apple Toolbar (Luôn cố định, chống tràn) */}
      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
        <button
          type="button"
          onClick={onShare}
          title="Chia sẻ phiên học"
          aria-label="Chia sẻ phiên học"
          className="flex h-8.5 w-8.5 sm:h-9 sm:w-9 items-center justify-center rounded-full border border-black/[0.06] dark:border-white/[0.08] bg-white/80 dark:bg-[#12151C]/80 backdrop-blur-md text-neutral-600 dark:text-neutral-300 shadow-2xs transition-all duration-200 hover:bg-neutral-100/80 dark:hover:bg-white/[0.08] hover:text-neutral-900 dark:hover:text-white active:scale-95 cursor-pointer"
        >
          <Share2 className="h-4 w-4" />
        </button>

        <button
          type="button"
          onClick={onMoreOptions}
          title="Tùy chọn khác"
          aria-label="Tùy chọn khác"
          className="flex h-8.5 w-8.5 sm:h-9 sm:w-9 items-center justify-center rounded-full border border-black/[0.06] dark:border-white/[0.08] bg-white/80 dark:bg-[#12151C]/80 backdrop-blur-md text-neutral-600 dark:text-neutral-300 shadow-2xs transition-all duration-200 hover:bg-neutral-100/80 dark:hover:bg-white/[0.08] hover:text-neutral-900 dark:hover:text-white active:scale-95 cursor-pointer"
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>

        {/* Nút bật/tắt Trợ lý AI StudyMate */}
        <div className="relative group">
          <button
            type="button"
            onClick={onToggleRightSidebar}
            aria-label="Trợ lý StudyMate AI"
            className={`flex h-8.5 w-8.5 sm:h-9 sm:w-9 items-center justify-center rounded-full border transition-all duration-200 active:scale-95 cursor-pointer ${
              !isRightSidebarCollapsed
                ? "border-indigo-300 dark:border-indigo-500/40 bg-indigo-50 dark:bg-indigo-950/40 text-[#4F46E5] dark:text-[#818CF8] shadow-xs"
                : "border-black/[0.06] dark:border-white/[0.08] bg-white/80 dark:bg-[#12151C]/80 backdrop-blur-md text-neutral-600 dark:text-neutral-400 hover:border-indigo-200 dark:hover:border-indigo-800/40 hover:bg-indigo-50/50 hover:text-[#4F46E5]"
            }`}
          >
            <Sparkles className="h-4 w-4 text-[#4F46E5] dark:text-[#818CF8] transition-transform duration-200 group-hover:scale-110" />
          </button>

          {/* Tooltip Apple Floating Capsule */}
          <div className="pointer-events-none absolute right-0 top-full mt-2 hidden group-hover:flex items-center z-50 animate-in fade-in-50 zoom-in-95 duration-150">
            <div className="rounded-full bg-[#0B1C30]/90 dark:bg-white/95 backdrop-blur-md px-3 py-1 text-xs font-medium text-white dark:text-[#0B1C30] shadow-xl whitespace-nowrap">
              {isRightSidebarCollapsed ? "Mở Trợ lý StudyMate AI" : "Thu gọn Trợ lý StudyMate AI"}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
