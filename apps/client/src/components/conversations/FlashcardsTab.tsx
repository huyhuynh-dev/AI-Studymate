"use client";

import React from "react";
import { Sparkles, Zap, RotateCcw, Plus, FileUp, Lightbulb, CheckCircle2 } from "lucide-react";

export interface FlashcardsTabProps {
  /** Callback khi bấm nút "Tải tài liệu để kích hoạt AI" */
  onUploadDocument?: () => void;
  /** Callback khi bấm nút "Tạo thẻ thủ công" */
  onCreateManual?: () => void;
  /** Class tùy chọn cho container ngoài cùng */
  className?: string;
}

export default function FlashcardsTab({
  onUploadDocument,
  onCreateManual,
  className = "",
}: FlashcardsTabProps) {
  return (
    <div
      className={`relative flex w-full flex-col items-center justify-center rounded-3xl border border-blue-100/80 bg-[#F4F7FF] px-6 py-12 sm:px-12 sm:py-16 text-center select-none ${className}`}
    >
      {/* Central Illustration */}
      <div className="relative mb-6 sm:mb-8 flex items-center justify-center">
        {/* Back card (offset) */}
        <div className="absolute -left-3 top-2 h-32 w-28 -rotate-6 rounded-2xl border border-indigo-100 bg-white/70 shadow-xs" />

        {/* Front Flashcard */}
        <div className="relative z-10 flex h-34 w-30 flex-col justify-between rounded-2xl border border-gray-100 bg-white p-3 shadow-md shadow-indigo-500/10">
          {/* Card header */}
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-[#4F46E5] tracking-tight">
              CÂY AVL
            </span>
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
          </div>

          {/* Card center content */}
          <div className="my-auto flex flex-col items-center gap-1.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#EEEDFE]">
              <RotateCcw className="h-4 w-4 text-[#6366F1]" />
            </div>
            {/* Skeleton lines */}
            <div className="h-1.5 w-16 rounded-full bg-[#DBEAFE]" />
            <div className="h-1.5 w-10 rounded-full bg-[#E0E7FF]" />
          </div>

          {/* Card footer */}
          <div className="flex items-center justify-between border-t border-gray-50 pt-1 text-[9px] text-gray-500">
            <span>Độ khó: Vừa</span>
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          </div>
        </div>

        {/* SRS Badge (Top-Right) */}
        <div className="absolute -top-2.5 -right-6 z-20 flex items-center gap-1 rounded-full bg-[#6366F1] px-2.5 py-0.5 text-[10px] font-bold text-white shadow-md shadow-indigo-500/25">
          <Zap className="h-3 w-3 fill-white" />
          <span>SRS x3</span>
        </div>

        {/* Sparkles Badge (Bottom-Left) */}
        <div className="absolute -bottom-2 -left-4 z-20 flex h-7 w-7 items-center justify-center rounded-full bg-[#34D399] shadow-md shadow-emerald-500/20">
          <Sparkles className="h-3.5 w-3.5 text-[#064E3B] fill-[#064E3B]" />
        </div>
      </div>

      {/* Title */}
      <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-gray-900">
        Bạn chưa có thẻ ghi nhớ nào
      </h2>

      {/* Description */}
      <p className="mt-2.5 max-w-xl text-center text-sm sm:text-[15px] leading-relaxed text-gray-600">
        Hệ thống ôn tập ngắt quãng <strong className="font-semibold text-gray-800">(Spaced Repetition)</strong> giúp bạn ghi nhớ kiến thức
        lâu hơn x3 lần. Hãy bắt đầu tạo bộ thẻ đầu tiên cho phiên học này.
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
          <span>Tải tài liệu để kích hoạt AI</span>
        </button>

        {/* Secondary Button */}
        <button
          type="button"
          onClick={onCreateManual}
          className="inline-flex items-center gap-2 rounded-xl border border-gray-100 bg-white px-5 py-2.5 sm:px-6 sm:py-3 text-sm sm:text-base font-semibold text-gray-800 shadow-xs transition-all hover:bg-gray-50 active:scale-[0.98] cursor-pointer"
        >
          <Plus className="h-4.5 w-4.5 stroke-[2.5]" />
          <span>Tạo thẻ thủ công</span>
        </button>
      </div>

      {/* Notice Card */}
      <div className="mt-8 flex w-full max-w-xl items-center gap-3 rounded-2xl border border-gray-100 bg-white/90 p-3.5 sm:p-4 text-left shadow-xs">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-[#6366F1]">
          <Lightbulb className="h-4.5 w-4.5" />
        </div>
        <p className="text-xs sm:text-sm text-gray-600 leading-normal">
          <strong className="font-semibold text-gray-900">Chưa có tài liệu nguồn:</strong> Vui lòng tải lên tài liệu ở Tab Tài liệu (PDF) để AI có thể tự động sinh bộ Flashcard cho bạn.
        </p>
      </div>
    </div>
  );
}
