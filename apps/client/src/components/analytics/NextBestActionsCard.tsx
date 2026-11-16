"use client";

import React from 'react';
import {
  ArrowRight,
  BookOpen,
  BrainCircuit,
  Layers,
  Sparkles,
  Target,
} from 'lucide-react';
import type {
  StudyRecommendation,
  StudyRecommendationActionType,
} from '@/types';
import { BentoCard } from '@/components/analytics/AnalyticsPrimitives';

const ACTION_ICONS: Record<
  StudyRecommendationActionType,
  React.ComponentType<{ className?: string }>
> = {
  review_due_cards: Layers,
  targeted_quiz_weak_chunk: Target,
  remediate_leech_cards: BrainCircuit,
  address_bloom_gap: Sparkles,
  read_unstudied_section: BookOpen,
};

const PRIORITY_BADGE: Record<
  StudyRecommendation['priority'],
  { label: string; className: string }
> = {
  high: {
    label: 'Ưu tiên cao',
    className:
      'bg-rose-500/10 text-rose-700 border-rose-500/20 dark:bg-[#FF453A]/15 dark:text-[#FF6961] dark:border-[#FF453A]/25',
  },
  medium: {
    label: 'Đề xuất',
    className:
      'bg-amber-500/10 text-amber-700 border-amber-500/20 dark:bg-amber-400/15 dark:text-amber-300 dark:border-amber-400/25',
  },
  low: {
    label: 'Mở rộng',
    className:
      'bg-neutral-100 text-neutral-600 border-neutral-200 dark:bg-white/[0.06] dark:text-neutral-300 dark:border-white/[0.08]',
  },
};

export interface NextBestActionsCardProps {
  recommendations: StudyRecommendation[];
  onExecuteAction: (rec: StudyRecommendation) => void;
}

export default function NextBestActionsCard({
  recommendations,
  onExecuteAction,
}: NextBestActionsCardProps) {
  return (
    <BentoCard className="p-5 sm:p-6 flex flex-col justify-between gap-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-[20px] font-bold font-heading tracking-tight text-neutral-900 dark:text-white leading-tight">
            Hành động kế tiếp đề xuất
          </h2>
          <p className="mt-1 text-xs sm:text-[13px] text-neutral-500 dark:text-neutral-400 leading-relaxed">
            Chẩn đoán tức thì từ lịch sử ôn thẻ và kết quả bài kiểm tra.
          </p>
        </div>
        <span className="shrink-0 rounded-full border border-black/[0.06] dark:border-white/[0.08] bg-neutral-100/80 dark:bg-white/[0.06] px-2.5 py-1 text-[11px] font-semibold tabular-nums text-neutral-600 dark:text-neutral-300">
          {recommendations.length} gợi ý
        </span>
      </div>

      {recommendations.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center rounded-2xl border border-dashed border-black/[0.08] dark:border-white/[0.1] bg-neutral-50/70 dark:bg-[#181C26]/60 px-6 py-10 text-center">
          <Sparkles className="h-6 w-6 text-emerald-500 mb-2" />
          <p className="text-sm font-semibold text-neutral-800 dark:text-neutral-200">
            Tiến độ đang rất ổn định
          </p>
          <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400 max-w-sm leading-relaxed">
            Không có thẻ quá hạn hay lỗ hổng cấp bách nào lúc này. Bạn có thể đọc tiếp tài liệu mới hoặc ôn nâng cao.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {recommendations.map((rec, idx) => {
            const Icon = ACTION_ICONS[rec.actionType];
            const priorityMeta = PRIORITY_BADGE[rec.priority];
            const isFocalPrimary = idx === 0;

            return (
              <div
                key={rec.id}
                className={`rounded-2xl border p-4 transition-colors duration-200 ${
                  isFocalPrimary
                    ? 'border-[#4F46E5]/25 dark:border-[#0A84FF]/30 bg-indigo-50/50 dark:bg-[#181C26]'
                    : 'border-black/[0.05] dark:border-white/[0.08] bg-neutral-50/70 dark:bg-[#161A23]'
                }`}
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-start gap-3 min-w-0">
                    <span
                      className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                        isFocalPrimary
                          ? 'bg-[#4F46E5]/12 text-[#4F46E5] dark:bg-[#0A84FF]/20 dark:text-[#60A5FA]'
                          : 'bg-white dark:bg-white/[0.06] text-neutral-600 dark:text-neutral-300 border border-black/[0.05] dark:border-white/[0.08]'
                      }`}
                    >
                      <Icon className="h-5 w-5" />
                    </span>
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`rounded-full border px-2 py-0.5 text-[10.5px] font-semibold ${priorityMeta.className}`}
                        >
                          {priorityMeta.label}
                        </span>
                        <h3 className="text-sm font-semibold text-neutral-900 dark:text-white leading-snug">
                          {rec.title}
                        </h3>
                      </div>
                      <p className="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed">
                        {rec.reason}
                      </p>
                    </div>
                  </div>

                  {/* Quy tắc Apple HIG: Chỉ duy nhất 1 Primary CTA nổi bật nhất */}
                  <button
                    type="button"
                    onClick={() => onExecuteAction(rec)}
                    className={`inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl px-4 text-xs font-semibold transition-all duration-200 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0066FF] cursor-pointer whitespace-nowrap ${
                      isFocalPrimary
                        ? 'h-11 bg-[#4F46E5] hover:bg-[#3525CD] dark:bg-[#0A84FF] dark:hover:bg-[#0070E0] text-white shadow-xs'
                        : 'h-10 border border-black/[0.08] dark:border-white/[0.1] bg-white dark:bg-white/[0.06] text-neutral-800 dark:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-white/[0.12]'
                    }`}
                  >
                    <span>{rec.actionLabel}</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </BentoCard>
  );
}
