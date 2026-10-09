"use client";

import React from "react";
import { Sparkles, BookOpen, FileUp, PenLine, Lightbulb } from "lucide-react";

export interface SummaryTabProps {
  /** Callback khi bấm nút "Tải tài liệu để AI tóm tắt" */
  onUploadDocument?: () => void;
  /** Callback khi bấm nút "Nhập ghi chú hoặc dán văn bản" */
  onInputText?: () => void;
  /** Class tùy chọn cho container ngoài cùng */
  className?: string;
}

export default function SummaryTab({
  onUploadDocument,
  onInputText,
  className = "",
}: SummaryTabProps) {
  return (
    <div
      className={`relative flex w-full flex-col items-center justify-center rounded-3xl border border-blue-100/80 bg-[#F4F7FF] px-6 py-12 sm:px-12 sm:py-16 text-center select-none ${className}`}
    >
      {/* Central Illustration */}
      <div className="relative mb-6 sm:mb-8 flex items-center justify-center">
        {/* Soft squircle wrapper */}
        <div className="relative flex h-24 w-24 sm:h-28 sm:w-28 items-center justify-center rounded-3xl bg-white p-2 shadow-sm border border-indigo-50">
          {/* Inner purple squircle */}
          <div className="flex h-full w-full items-center justify-center rounded-2xl bg-gradient-to-tr from-[#4F46E5] to-[#6366F1] shadow-md shadow-indigo-500/20">
            <Sparkles className="h-8 w-8 text-white fill-white" />
          </div>

          {/* Book Badge (Bottom-Right) */}
          <div className="absolute -bottom-2 -right-2 flex h-9 w-9 items-center justify-center rounded-xl border border-gray-100 bg-white shadow-md shadow-indigo-500/10">
            <BookOpen className="h-4.5 w-4.5 text-[#4F46E5]" />
          </div>
        </div>
      </div>

      {/* Title */}
      <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-gray-900">
        Chưa có bản Tóm tắt nào được tạo
      </h2>

      {/* Description */}
      <p className="mt-2.5 max-w-xl text-center text-sm sm:text-[15px] leading-relaxed text-gray-600">
        AI StudyMate cần tài liệu học tập để tự động trích xuất các luận điểm
        quan trọng, công thức và sơ đồ kiến thức cốt lõi cho bạn.
      </p>

      {/* Action Buttons */}
      <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
        {/* Primary Button */}
        <button
          type="button"
          onClick={onUploadDocument}
          className="inline-flex items-center gap-2 rounded-xl bg-[#4F46E5] px-5 py-2.5 sm:px-6 sm:py-3 text-sm sm:text-base font-semibold text-white shadow-md shadow-indigo-500/25 transition-all hover:bg-[#4338CA] hover:shadow-lg hover:shadow-indigo-500/30 active:scale-[0.98] cursor-pointer"
        >
          <FileUp className="h-5 w-5" />
          <span>Tải tài liệu để AI tóm tắt</span>
        </button>

        {/* Secondary Button */}
        <button
          type="button"
          onClick={onInputText}
          className="inline-flex items-center gap-2 rounded-xl border border-gray-100 bg-white px-5 py-2.5 sm:px-6 sm:py-3 text-sm sm:text-base font-semibold text-gray-800 shadow-xs transition-all hover:bg-gray-50 active:scale-[0.98] cursor-pointer"
        >
          <PenLine className="h-4.5 w-4.5 text-gray-700" />
          <span>Nhập ghi chú hoặc dán văn bản</span>
        </button>
      </div>

      {/* Notice Banner */}
      <div className="mt-8 inline-flex items-center gap-2 rounded-full border border-indigo-100/70 bg-[#EAF0FE]/90 px-4 py-2 text-xs sm:text-sm text-indigo-700 shadow-xs">
        <Lightbulb className="h-4 w-4 shrink-0 text-[#4F46E5]" />
        <span>
          Cần có tài liệu ở Tab Tài liệu (PDF) để kích hoạt tính năng tóm tắt tự động.
        </span>
      </div>
    </div>
  );
}
