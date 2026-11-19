"use client";

import React, { useState } from 'react';
import { BookOpen, CheckCircle2, Target } from 'lucide-react';
import type { AttentionItem, SourceReference, StudyRecommendation } from '@/types';
import { BentoCard } from '@/components/analytics/AnalyticsPrimitives';
import {
  MASTERY_STATUS_META,
  formatPageRange,
  formatPercent,
} from '@/components/analytics/analytics-helpers';

export interface AttentionSectionListProps {
  items: AttentionItem[];
  onExecuteAction: (rec: StudyRecommendation) => void;
  onJumpToSource?: (ref: SourceReference, conversationId?: string) => void;
  onCreateTargetedQuiz?: (opts: {
    conversationId: string;
    chunkIds: string[];
    sectionTitle: string;
  }) => void;
}

export default function AttentionSectionList({
  items,
  onExecuteAction,
  onJumpToSource,
  onCreateTargetedQuiz,
}: AttentionSectionListProps) {
  const [expanded, setExpanded] = useState(false);

  const visibleItems = expanded ? items : items.slice(0, 3);
  const hasMore = items.length > 3;

  return (
    <BentoCard className="p-5 sm:p-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg sm:text-[20px] font-bold font-heading tracking-tight text-neutral-900 dark:text-white leading-[1.2]">
            Cần chú ý{items.length > 0 ? ` (${items.length})` : ''}
          </h2>
          <p className="mt-1 text-xs sm:text-[13px] text-neutral-500 dark:text-neutral-400">
            Các mục có điểm còn thấp, thẻ hay quên hoặc bạn hỏi AI nhiều lần gần đây.
          </p>
        </div>

        {hasMore && (
          <button
            type="button"
            onClick={() => setExpanded((prev) => !prev)}
            className="inline-flex h-8 items-center rounded-lg px-2.5 text-xs font-semibold text-[#4F46E5] dark:text-[#60A5FA] hover:bg-indigo-500/10 dark:hover:bg-[#0A84FF]/15 active:scale-[0.98] transition-colors cursor-pointer"
          >
            {expanded ? 'Thu gọn' : `Xem tất cả (${items.length})`}
          </button>
        )}
      </div>

      {items.length === 0 ? (
        <div className="flex items-center gap-3 rounded-2xl border border-dashed border-black/[0.08] dark:border-white/[0.1] bg-neutral-50/70 dark:bg-[#181C26]/70 px-5 py-6">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600 dark:text-[#30D158]" />
          <p className="text-xs sm:text-[13px] text-neutral-600 dark:text-neutral-300 leading-relaxed">
            Các mục bạn đã học hiện đều đang ổn định. Chưa có phần kiến thức nào cần ôn gấp.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {visibleItems.map((item, idx) => {
            const statusMeta = MASTERY_STATUS_META[item.status];
            const isLowConfidence = item.confidence === 'low';

            const handlePrimary = () => {
              const p = item.primaryAction.payload;
              if (
                item.primaryAction.type === 'targeted_quiz_weak_chunk' &&
                onCreateTargetedQuiz &&
                p.chunkIds &&
                p.chunkIds.length > 0
              ) {
                onCreateTargetedQuiz({
                  conversationId: item.conversationId,
                  chunkIds: p.chunkIds,
                  sectionTitle: item.title,
                });
                return;
              }
              onExecuteAction({
                id: `att-${item.sectionKey}`,
                priority: 'high',
                actionType: item.primaryAction.type,
                title: item.title,
                reason: item.reasons[0] ?? '',
                actionLabel: item.primaryAction.label,
                payload: p,
              });
            };

            return (
              <div
                key={item.sectionKey}
                className="flex flex-col gap-3 rounded-2xl border border-black/[0.05] dark:border-white/[0.08] bg-neutral-50/80 dark:bg-[#161A23] p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0 space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white dark:bg-white/[0.08] border border-black/[0.06] dark:border-white/[0.08] text-xs font-bold text-neutral-700 dark:text-neutral-200 tabular-nums">
                      {idx + 1}
                    </span>
                    <h3 className="text-sm font-semibold text-neutral-900 dark:text-white leading-snug">
                      {item.title}
                    </h3>
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold tabular-nums ${
                        isLowConfidence
                          ? 'bg-neutral-100 text-neutral-500 border-neutral-200 dark:bg-white/[0.05] dark:text-neutral-400 dark:border-white/[0.08]'
                          : statusMeta.badgeClass
                      }`}
                    >
                      {item.masteryScore !== null
                        ? `${formatPercent(item.masteryScore)}${isLowConfidence ? ' (ít mẫu)' : ''}`
                        : statusMeta.shortLabel}
                    </span>
                  </div>

                  <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate tabular-nums">
                    {item.conversationTitle ? `${item.conversationTitle} · ` : ''}
                    {item.fileName} · {formatPageRange(item.startPage, item.endPage)}
                  </p>

                  {item.reasons.length > 0 && (
                    <p className="text-xs text-neutral-700 dark:text-neutral-300 leading-relaxed">
                      {item.reasons.join(' · ')}
                    </p>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  {item.secondaryAction && onJumpToSource && (
                    <button
                      type="button"
                      onClick={() =>
                        onJumpToSource(
                          {
                            documentId: item.secondaryAction!.payload.documentId,
                            fileName: item.secondaryAction!.payload.fileName,
                            pageNumbers: [item.secondaryAction!.payload.pageNo],
                          },
                          item.secondaryAction!.payload.conversationId
                        )
                      }
                      className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-black/[0.08] dark:border-white/[0.1] bg-white dark:bg-white/[0.06] px-3 text-xs font-semibold text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-white/[0.1] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0066FF] transition-all cursor-pointer"
                    >
                      <BookOpen className="h-3.5 w-3.5" />
                      <span>{item.secondaryAction.label}</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={handlePrimary}
                    className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-indigo-500/10 dark:bg-[#0A84FF]/15 px-3.5 text-xs font-semibold text-[#4F46E5] dark:text-[#60A5FA] hover:bg-indigo-500/20 dark:hover:bg-[#0A84FF]/25 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0066FF] transition-all cursor-pointer"
                  >
                    <Target className="h-3.5 w-3.5" />
                    <span>{item.primaryAction.label}</span>
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
