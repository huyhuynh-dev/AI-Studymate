"use client";

import React from 'react';
import { AlertTriangle, BarChart3, RefreshCw } from 'lucide-react';

export function BentoCard({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-[24px] border border-black/[0.06] dark:border-white/[0.08] bg-white dark:bg-[#12151C] shadow-2xs dark:shadow-none transition-colors duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${className}`}
    >
      {children}
    </section>
  );
}

export function AnalyticsSkeleton() {
  return (
    <div
      className="space-y-6 animate-pulse"
      aria-busy="true"
      aria-label="Đang tải phân tích học tập"
    >
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-2">
          <div className="h-7 w-52 rounded-xl bg-neutral-200/80 dark:bg-white/[0.07]" />
          <div className="h-4 w-72 rounded-lg bg-neutral-200/60 dark:bg-white/[0.04]" />
        </div>
        <div className="h-10 w-52 rounded-xl bg-neutral-200/70 dark:bg-white/[0.06]" />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-32 rounded-[24px] bg-neutral-200/70 dark:bg-[#12151C] border border-black/[0.04] dark:border-white/[0.06]"
          />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="h-72 rounded-[24px] bg-neutral-200/70 dark:bg-[#12151C] lg:col-span-7" />
        <div className="h-72 rounded-[24px] bg-neutral-200/70 dark:bg-[#12151C] lg:col-span-5" />
      </div>

      <div className="h-64 rounded-[24px] bg-neutral-200/70 dark:bg-[#12151C]" />
    </div>
  );
}

export function AnalyticsErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div
      role="alert"
      className="mx-auto my-12 flex max-w-md flex-col items-center rounded-[24px] border border-rose-500/20 bg-white dark:bg-[#12151C] p-8 text-center"
    >
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-500/10 text-[#FF453A] mb-4">
        <AlertTriangle className="h-6 w-6" />
      </span>
      <h3 className="text-lg font-semibold font-heading tracking-tight text-neutral-900 dark:text-white">
        Không thể tải dữ liệu phân tích
      </h3>
      <p className="mt-1.5 text-sm text-neutral-600 dark:text-neutral-400 leading-relaxed">
        {message}
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-5 inline-flex h-11 items-center gap-2 rounded-xl bg-[#4F46E5] hover:bg-[#3525CD] px-5 text-sm font-semibold text-white transition-all active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0066FF] cursor-pointer"
      >
        <RefreshCw className="h-4 w-4" />
        <span>Thử tải lại</span>
      </button>
    </div>
  );
}

export function AnalyticsEmptyState({
  scopeLabel,
}: {
  scopeLabel: string;
}) {
  return (
    <BentoCard className="mx-auto my-8 max-w-xl p-8 text-center">
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-500/10 dark:bg-[#0A84FF]/15 text-[#4F46E5] dark:text-[#60A5FA]">
        <BarChart3 className="h-7 w-7" />
      </div>
      <h3 className="text-xl font-semibold font-heading tracking-tight text-neutral-900 dark:text-white">
        Chưa có dữ liệu học tập cho {scopeLabel}
      </h3>
      <p className="mx-auto mt-2 max-w-md text-sm text-neutral-600 dark:text-neutral-400 leading-relaxed">
        Hãy tạo bộ thẻ Flashcard để ôn tập ngắt quãng hoặc hoàn thành bài kiểm tra đầu tiên. Hệ thống sẽ tự động phân tích tỷ lệ ghi nhớ, bản đồ nhiệt tài liệu và lỗ hổng kiến thức tại đây.
      </p>
    </BentoCard>
  );
}
