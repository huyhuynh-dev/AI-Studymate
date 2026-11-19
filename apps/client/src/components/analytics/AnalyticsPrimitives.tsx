"use client";

import React, { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  BarChart3,
  FileQuestion,
  Info,
  Layers,
  RefreshCw,
} from 'lucide-react';

export function BentoCard({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-[24px] border border-black/[0.06] dark:border-white/[0.08] bg-white dark:bg-[#12151C] shadow-2xs dark:shadow-none transition-colors duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none ${className}`}
    >
      {children}
    </section>
  );
}

export function InfoPopoverTip({
  label,
  content,
}: {
  label: string;
  content: string;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative inline-flex items-center">
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
        className="inline-flex h-6 w-6 items-center justify-center rounded-full text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 dark:text-neutral-500 dark:hover:bg-white/[0.08] dark:hover:text-neutral-200 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0066FF] transition-colors cursor-pointer"
      >
        <Info className="h-3.5 w-3.5" aria-hidden="true" />
      </button>

      {open && (
        <div
          role="tooltip"
          className="absolute right-0 top-7 z-30 w-64 rounded-2xl border border-black/[0.08] dark:border-white/[0.12] bg-white dark:bg-[#232836] p-3 text-xs leading-relaxed text-neutral-700 dark:text-neutral-200 shadow-lg dark:shadow-none"
        >
          {content}
        </div>
      )}
    </div>
  );
}

export function AnalyticsSkeleton() {
  return (
    <div
      className="mx-auto w-full max-w-[1200px] space-y-6 animate-pulse motion-reduce:animate-none"
      aria-busy="true"
      aria-label="Đang tải phân tích học tập"
    >
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-2">
          <div className="h-7 w-56 rounded-xl bg-neutral-200/80 dark:bg-white/[0.07]" />
          <div className="h-4 w-72 rounded-lg bg-neutral-200/60 dark:bg-white/[0.04]" />
        </div>
        <div className="h-9 w-9 rounded-xl bg-neutral-200/70 dark:bg-white/[0.06]" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className="h-56 rounded-[24px] bg-neutral-200/70 dark:bg-[#12151C] border border-black/[0.04] dark:border-white/[0.06] lg:col-span-8" />
        <div className="h-56 rounded-[24px] bg-neutral-200/70 dark:bg-[#12151C] border border-black/[0.04] dark:border-white/[0.06] lg:col-span-4" />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-32 rounded-[24px] bg-neutral-200/70 dark:bg-[#12151C] border border-black/[0.04] dark:border-white/[0.06]"
          />
        ))}
      </div>

      <div className="h-60 rounded-[24px] bg-neutral-200/70 dark:bg-[#12151C]" />
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
        className="mt-5 inline-flex h-11 items-center gap-2 rounded-xl bg-[#4F46E5] hover:bg-[#3525CD] dark:bg-[#0A84FF] dark:hover:bg-[#0070E0] px-5 text-sm font-semibold text-white transition-all active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0066FF] cursor-pointer"
      >
        <RefreshCw className="h-4 w-4" />
        <span>Thử tải lại</span>
      </button>
    </div>
  );
}

export function AnalyticsEmptyState({
  scopeLabel,
  onGoToFlashcards,
  onGoToQuiz,
}: {
  scopeLabel: string;
  onGoToFlashcards?: () => void;
  onGoToQuiz?: () => void;
}) {
  return (
    <BentoCard className="mx-auto my-8 max-w-xl p-8 text-center">
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-500/10 dark:bg-[#0A84FF]/15 text-[#4F46E5] dark:text-[#60A5FA]">
        <BarChart3 className="h-7 w-7" />
      </div>
      <h3 className="text-xl font-semibold font-heading tracking-tight text-neutral-900 dark:text-white leading-snug">
        Chưa có dữ liệu học tập cho {scopeLabel}
      </h3>
      <p className="mx-auto mt-2 max-w-md text-sm text-neutral-600 dark:text-neutral-400 leading-relaxed">
        Hãy tạo bộ thẻ ghi nhớ hoặc hoàn thành bài kiểm tra đầu tiên. Hệ thống sẽ lập kế hoạch học mỗi ngày và chỉ ra các mục bạn cần ôn tập tại đây.
      </p>

      {(onGoToFlashcards || onGoToQuiz) && (
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          {onGoToFlashcards && (
            <button
              type="button"
              onClick={onGoToFlashcards}
              className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#4F46E5] hover:bg-[#3525CD] dark:bg-[#0A84FF] dark:hover:bg-[#0070E0] px-5 text-sm font-semibold text-white shadow-xs transition-all active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0066FF] cursor-pointer"
            >
              <Layers className="h-4 w-4" />
              <span>Tạo bộ thẻ đầu tiên</span>
            </button>
          )}
          {onGoToQuiz && (
            <button
              type="button"
              onClick={onGoToQuiz}
              className="inline-flex h-11 items-center gap-2 rounded-xl border border-black/[0.08] dark:border-white/[0.12] bg-white dark:bg-white/[0.06] px-5 text-sm font-semibold text-neutral-800 dark:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-white/[0.1] transition-all active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0066FF] cursor-pointer"
            >
              <FileQuestion className="h-4 w-4" />
              <span>Làm bài kiểm tra đầu tiên</span>
            </button>
          )}
        </div>
      )}
    </BentoCard>
  );
}
