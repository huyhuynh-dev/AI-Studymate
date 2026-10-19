"use client";

import React from "react";
import { Sparkles, Brain } from "lucide-react";

export default function SummarySkeleton() {
  return (
    <div className="relative flex w-full flex-1 flex-col items-center justify-start rounded-3xl border border-indigo-100/70 bg-gradient-to-b from-indigo-50/20 via-white to-white p-6 sm:p-10 overflow-hidden">
      {/* Animated AI Processing Banner */}
      <div className="flex flex-col items-center justify-center text-center max-w-md mx-auto mb-8 sm:mb-12">
        <div className="relative mb-5 flex items-center justify-center">
          {/* Outer Pulsing Glow */}
          <div className="absolute -inset-1 rounded-3xl bg-gradient-to-r from-indigo-500 to-purple-600 opacity-30 blur-md animate-pulse" />
          
          {/* Squircle Badge */}
          <div className="relative flex h-16 w-16 sm:h-20 sm:w-20 items-center justify-center rounded-2xl sm:rounded-3xl bg-gradient-to-tr from-[#4F46E5] to-[#7C3AED] shadow-lg shadow-indigo-500/25">
            <Brain className="h-8 w-8 sm:h-9 sm:w-9 text-white animate-bounce" />
            <div className="absolute -top-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-white shadow-xs">
              <Sparkles className="h-3.5 w-3.5 text-indigo-600 fill-indigo-600 animate-spin" />
            </div>
          </div>
        </div>

        <h3 className="text-lg sm:text-xl font-bold tracking-tight text-gray-900">
          AI đang đọc tài liệu và xây dựng bản tóm tắt...
        </h3>
        <p className="mt-2 text-xs sm:text-sm text-gray-500 leading-relaxed">
          Đang phân tích cấu trúc, trích xuất luận điểm cốt lõi, công thức và thiết lập các khối ghi chú thông minh cho bạn.
        </p>

        {/* Progress indicator bar */}
        <div className="w-48 h-1.5 bg-gray-100 rounded-full mt-5 overflow-hidden">
          <div className="h-full bg-gradient-to-r from-indigo-500 to-purple-600 rounded-full animate-[progress_1.5s_ease-in-out_infinite]" />
        </div>
      </div>

      {/* Mock Document Shimmer Skeleton */}
      <div className="w-full max-w-3xl space-y-6 opacity-75">
        {/* Title Shimmer */}
        <div className="space-y-2">
          <div className="h-8 w-3/4 rounded-xl bg-gray-200/80 animate-pulse" />
          <div className="h-4 w-1/3 rounded-lg bg-gray-100 animate-pulse" />
        </div>

        {/* Divider */}
        <div className="h-px w-full bg-gray-100" />

        {/* Section 1 */}
        <div className="space-y-3">
          <div className="h-6 w-1/2 rounded-lg bg-gray-200/70 animate-pulse" />
          <div className="space-y-2">
            <div className="h-4 w-full rounded-md bg-gray-100 animate-pulse" />
            <div className="h-4 w-11/12 rounded-md bg-gray-100 animate-pulse" />
            <div className="h-4 w-4/5 rounded-md bg-gray-100 animate-pulse" />
          </div>
        </div>

        {/* Section 2 (Bullet items) */}
        <div className="space-y-3 pl-4 border-l-2 border-indigo-100">
          <div className="flex items-center gap-2">
            <div className="h-2.5 w-2.5 rounded-full bg-indigo-300 animate-pulse" />
            <div className="h-4 w-2/3 rounded-md bg-gray-100 animate-pulse" />
          </div>
          <div className="flex items-center gap-2">
            <div className="h-2.5 w-2.5 rounded-full bg-indigo-300 animate-pulse" />
            <div className="h-4 w-4/5 rounded-md bg-gray-100 animate-pulse" />
          </div>
          <div className="flex items-center gap-2">
            <div className="h-2.5 w-2.5 rounded-full bg-indigo-300 animate-pulse" />
            <div className="h-4 w-1/2 rounded-md bg-gray-100 animate-pulse" />
          </div>
        </div>

        {/* Section 3 */}
        <div className="space-y-3">
          <div className="h-6 w-2/5 rounded-lg bg-gray-200/70 animate-pulse" />
          <div className="space-y-2">
            <div className="h-4 w-full rounded-md bg-gray-100 animate-pulse" />
            <div className="h-4 w-5/6 rounded-md bg-gray-100 animate-pulse" />
          </div>
        </div>
      </div>
    </div>
  );
}
