"use client";

import React from "react";
import {
  Sparkles,
  ClipboardCheck,
  Check,
  FileUp,
  ArrowRight,
  PenLine,
  Zap,
  FileText,
  SlidersHorizontal,
  AlertTriangle,
} from "lucide-react";

export interface QuizTabProps {
  /** Callback khi bấm nút "Tải tài liệu để AI tạo đề" */
  onUploadDocument?: () => void;
  /** Callback khi bấm nút "Tự soạn câu hỏi" */
  onCreateManual?: () => void;
  /** Callback khi chọn một gợi ý tạo nhanh */
  onSelectPreset?: (preset: "quick" | "standard" | "custom") => void;
  /** Class tùy chọn cho container ngoài cùng */
  className?: string;
}

export default function QuizTab({
  onUploadDocument,
  onCreateManual,
  onSelectPreset,
  className = "",
}: QuizTabProps) {
  return (
    <div
      className={`relative flex w-full flex-col items-center justify-center rounded-3xl border border-blue-100/80 bg-[#F4F7FF] px-6 py-12 sm:px-12 sm:py-16 text-center select-none ${className}`}
    >
      {/* Central Illustration */}
      <div className="relative mb-6 sm:mb-8 flex items-center justify-center">
        {/* Soft squircle wrapper */}
        <div className="relative flex h-24 w-24 sm:h-28 sm:w-28 items-center justify-center rounded-3xl bg-white p-2 shadow-sm border border-indigo-50">
          {/* Inner lavender container */}
          <div className="flex h-full w-full items-center justify-center rounded-2xl bg-[#EEEDFE]">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#4F46E5] shadow-md shadow-indigo-500/20">
              <ClipboardCheck className="h-6 w-6 text-white" />
            </div>
          </div>

          {/* Sparkles Badge (Top-Right) */}
          <div className="absolute -top-2.5 -right-2.5 flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-tr from-[#6366F1] to-[#7C3AED] shadow-md shadow-indigo-500/25">
            <Sparkles className="h-4 w-4 text-white fill-white" />
          </div>

          {/* 100% Score Badge (Bottom-Center / Left) */}
          <div className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 flex items-center gap-1 rounded-full bg-[#047857] px-2.5 py-0.5 text-[11px] font-bold text-white shadow-md shadow-emerald-700/20">
            <Check className="h-3 w-3 stroke-[3]" />
            <span>100%</span>
          </div>
        </div>
      </div>

      {/* Title */}
      <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-gray-900">
        Chưa có bộ câu hỏi trắc nghiệm nào
      </h2>

      {/* Description */}
      <p className="mt-2.5 max-w-xl text-center text-sm sm:text-[15px] leading-relaxed text-gray-600">
        Kiểm tra ngay mức độ hiểu bài của bạn. AI có thể tự động bóc tách kiến
        thức, tạo đề thi mô phỏng bám sát đề cương tài liệu đã tải lên.
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
          <span>Tải tài liệu để AI tạo đề</span>
          <ArrowRight className="h-4 w-4" />
        </button>

        {/* Secondary Button */}
        <button
          type="button"
          onClick={onCreateManual}
          className="inline-flex items-center gap-2 rounded-xl border border-gray-100 bg-white px-5 py-2.5 sm:px-6 sm:py-3 text-sm sm:text-base font-semibold text-gray-800 shadow-xs transition-all hover:bg-gray-50 active:scale-[0.98] cursor-pointer"
        >
          <PenLine className="h-4.5 w-4.5 text-gray-700" />
          <span>Tự soạn câu hỏi</span>
        </button>
      </div>

      {/* Quick presets section */}
      <div className="mt-8 flex flex-col items-center">
        <span className="text-[11px] font-bold tracking-wider text-gray-500 uppercase">
          GỢI Ý TẠO NHANH CHO CHỦ ĐỀ NÀY:
        </span>
        <div className="mt-3 flex flex-wrap items-center justify-center gap-2.5 sm:gap-3">
          {/* Preset 1 */}
          <button
            type="button"
            onClick={() => onSelectPreset?.("quick")}
            className="inline-flex items-center gap-1.5 rounded-full border border-gray-100 bg-white px-3.5 py-1.5 text-xs font-medium text-gray-700 shadow-xs transition-colors hover:bg-gray-50 cursor-pointer"
          >
            <Zap className="h-3.5 w-3.5 text-emerald-500 fill-emerald-500" />
            <span>5 câu nhanh (10 phút)</span>
          </button>

          {/* Preset 2 */}
          <button
            type="button"
            onClick={() => onSelectPreset?.("standard")}
            className="inline-flex items-center gap-1.5 rounded-full border border-gray-100 bg-white px-3.5 py-1.5 text-xs font-medium text-gray-700 shadow-xs transition-colors hover:bg-gray-50 cursor-pointer"
          >
            <FileText className="h-3.5 w-3.5 text-[#6366F1]" />
            <span>15 câu chuẩn thi (25 phút)</span>
          </button>

          {/* Preset 3 */}
          <button
            type="button"
            onClick={() => onSelectPreset?.("custom")}
            className="inline-flex items-center gap-1.5 rounded-full border border-gray-100 bg-white px-3.5 py-1.5 text-xs font-medium text-gray-700 shadow-xs transition-colors hover:bg-gray-50 cursor-pointer"
          >
            <SlidersHorizontal className="h-3.5 w-3.5 text-blue-600" />
            <span>Tùy chỉnh độ khó & dạng bài</span>
          </button>
        </div>
      </div>

      {/* Bottom Alert Notice */}
      <div className="mt-7 flex items-center justify-center gap-2 text-xs sm:text-sm text-gray-500">
        <AlertTriangle className="h-4 w-4 shrink-0 text-red-500" />
        <span>
          Chưa có tài liệu nguồn. Chuyển sang{" "}
          <strong className="font-semibold text-gray-800">Tab Tài liệu</strong>{" "}
          để tải file giáo trình giúp AI tạo đề trắc nghiệm sát với bài học.
        </span>
      </div>
    </div>
  );
}
