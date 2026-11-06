"use client";

import React from "react";
import { Sparkles, Brain } from "lucide-react";

export default function SummarySkeleton() {
  return (
    <div className="relative flex w-full flex-1 flex-col items-center justify-start rounded-[24px] border border-black/[0.06] dark:border-white/[0.08] bg-white/50 dark:bg-[#12151C]/50 backdrop-blur-xs p-6 sm:p-10 overflow-hidden select-none">
      {/* Animated AI Processing Banner */}
      <div className="flex flex-col items-center justify-center text-center max-w-md mx-auto mb-8 sm:mb-12">
        <div className="relative mb-5 flex items-center justify-center">
          {/* Outer Pulsing Glow */}
          <div className="absolute -inset-2 rounded-3xl bg-gradient-to-r from-indigo-500/30 to-purple-600/30 blur-lg animate-pulse" />

          {/* Squircle Badge */}
          <div className="relative flex h-16 w-16 sm:h-20 sm:w-20 items-center justify-center rounded-[22px] bg-gradient-to-tr from-[#4F46E5] to-[#7C3AED] shadow-lg shadow-indigo-500/25 border border-white/20">
            <Brain className="h-8 w-8 sm:h-9 sm:w-9 text-white animate-bounce" />
            <div className="absolute -top-1.5 -right-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-white dark:bg-[#161922] shadow-xs border border-black/[0.06] dark:border-white/[0.1]">
              <Sparkles className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400 fill-indigo-600 dark:fill-indigo-400 animate-spin" />
            </div>
          </div>
        </div>

        <h3 className="text-base sm:text-lg font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
          AI đang đọc tài liệu và xây dựng bản tóm tắt...
        </h3>
        <p className="mt-2 text-xs sm:text-sm text-neutral-500 dark:text-neutral-400 leading-relaxed max-w-sm">
          Đang phân tích cấu trúc, trích xuất luận điểm cốt lõi, công thức và thiết lập các khối ghi chú thông minh cho bạn.
        </p>

        {/* Progress indicator bar Apple Pill */}
        <div className="w-48 h-1.5 bg-black/[0.04] dark:bg-white/[0.08] rounded-full mt-5 overflow-hidden">
          <div className="h-full bg-gradient-to-r from-indigo-500 to-purple-600 rounded-full animate-[progress_1.5s_ease-in-out_infinite]" />
        </div>
      </div>

      {/* Mock Document Shimmer Skeleton */}
      <div className="w-full max-w-3xl space-y-6 opacity-75">
        {/* Title Shimmer */}
        <div className="space-y-2">
          <div className="h-7 w-3/4 rounded-xl bg-black/[0.06] dark:bg-white/[0.08] animate-pulse" />
          <div className="h-3.5 w-1/3 rounded-lg bg-black/[0.04] dark:bg-white/[0.05] animate-pulse" />
        </div>

        {/* Hairline Divider */}
        <div className="h-px w-full bg-black/[0.05] dark:border-white/[0.08]" />

        {/* Section 1 */}
        <div className="space-y-3">
          <div className="h-5 w-1/2 rounded-lg bg-black/[0.06] dark:bg-white/[0.08] animate-pulse" />
          <div className="space-y-2">
            <div className="h-3.5 w-full rounded-md bg-black/[0.04] dark:bg-white/[0.05] animate-pulse" />
            <div className="h-3.5 w-11/12 rounded-md bg-black/[0.04] dark:bg-white/[0.05] animate-pulse" />
            <div className="h-3.5 w-4/5 rounded-md bg-black/[0.04] dark:bg-white/[0.05] animate-pulse" />
          </div>
        </div>

        {/* Section 2 (Bullet items) */}
        <div className="space-y-3 pl-4 border-l-2 border-indigo-400/40 dark:border-indigo-500/30">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-indigo-500/60 animate-pulse" />
            <div className="h-3.5 w-2/3 rounded-md bg-black/[0.04] dark:bg-white/[0.05] animate-pulse" />
          </div>
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-indigo-500/60 animate-pulse" />
            <div className="h-3.5 w-4/5 rounded-md bg-black/[0.04] dark:bg-white/[0.05] animate-pulse" />
          </div>
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-indigo-500/60 animate-pulse" />
            <div className="h-3.5 w-1/2 rounded-md bg-black/[0.04] dark:bg-white/[0.05] animate-pulse" />
          </div>
        </div>

        {/* Section 3 */}
        <div className="space-y-3">
          <div className="h-5 w-2/5 rounded-lg bg-black/[0.06] dark:bg-white/[0.08] animate-pulse" />
          <div className="space-y-2">
            <div className="h-3.5 w-full rounded-md bg-black/[0.04] dark:bg-white/[0.05] animate-pulse" />
            <div className="h-3.5 w-5/6 rounded-md bg-black/[0.04] dark:bg-white/[0.05] animate-pulse" />
          </div>
        </div>
      </div>
    </div>
  );
}
