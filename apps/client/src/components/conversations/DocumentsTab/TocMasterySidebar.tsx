"use client";

import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  BookOpen,
  ListTree,
  RefreshCw,
  Target,
  X,
} from 'lucide-react';
import { useDocumentMastery } from '@/hooks/useLearningAnalytics';
import type { TocMasterySection } from '@/types';
import {
  MASTERY_STATUS_META,
  formatPageRange,
  formatPercent,
} from '@/components/analytics/analytics-helpers';

export interface TocMasterySidebarProps {
  documentId: string;
  onJumpToPage: (pageNumber: number) => void;
  onCreateTargetedQuiz?: (opts: {
    chunkIds: string[];
    sectionTitle: string;
  }) => void;
  onClose: () => void;
}

export default function TocMasterySidebar({
  documentId,
  onJumpToPage,
  onCreateTargetedQuiz,
  onClose,
}: TocMasterySidebarProps) {
  const { mastery, isLoading, errorMessage, refresh } = useDocumentMastery(
    documentId,
    true
  );
  const [filterMode, setFilterMode] = useState<'all' | 'weak'>('all');

  const visibleSections = useMemo<TocMasterySection[]>(() => {
    const sections = mastery?.sections ?? [];
    if (filterMode === 'weak') {
      return sections.filter(
        (s) => s.status === 'weak' || s.status === 'developing'
      );
    }
    return sections;
  }, [mastery?.sections, filterMode]);

  const indentClass = (level: number) => {
    if (level <= 1) return 'pl-2';
    if (level === 2) return 'pl-4';
    return 'pl-6';
  };

  return (
    <aside
      aria-label="Mục lục và Bản đồ nhiệt độ thuộc bài"
      className="flex h-full w-full sm:w-80 shrink-0 flex-col border-r border-black/[0.06] dark:border-white/[0.08] bg-white/95 dark:bg-[#12151C]/95 backdrop-blur-xl select-none"
    >
      {/* Header Sidebar */}
      <div className="flex items-center justify-between gap-2 border-b border-black/[0.06] dark:border-white/[0.08] px-4 py-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-indigo-500/10 text-[#4F46E5] dark:text-[#818CF8]">
            <ListTree className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <h2 className="truncate text-[13.5px] font-semibold font-heading text-neutral-900 dark:text-white tracking-tight">
              Mục lục & Độ thuộc
            </h2>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => void refresh()}
            title="Làm mới dữ liệu độ thuộc"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-neutral-500 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-white/[0.08] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0066FF] cursor-pointer"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng mục lục"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-neutral-500 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-white/[0.08] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0066FF] cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Body */}
      {isLoading ? (
        <div className="flex-1 space-y-3 p-4 animate-pulse">
          <div className="h-20 rounded-2xl bg-neutral-100 dark:bg-white/[0.05]" />
          <div className="h-9 rounded-xl bg-neutral-100 dark:bg-white/[0.05]" />
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-14 rounded-xl bg-neutral-100/80 dark:bg-white/[0.04]"
            />
          ))}
        </div>
      ) : errorMessage ? (
        <div className="flex flex-1 flex-col items-center justify-center p-6 text-center">
          <AlertTriangle className="h-6 w-6 text-rose-500 mb-2" />
          <p className="text-xs text-neutral-600 dark:text-neutral-300 leading-relaxed">
            {errorMessage}
          </p>
          <button
            type="button"
            onClick={() => void refresh()}
            className="mt-3 rounded-xl bg-neutral-100 dark:bg-white/[0.08] px-3.5 py-2 text-xs font-semibold text-neutral-800 dark:text-white hover:bg-neutral-200 dark:hover:bg-white/[0.12] active:scale-[0.98] cursor-pointer"
          >
            Thử lại
          </button>
        </div>
      ) : !mastery || mastery.totalSections === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center p-6 text-center">
          <BookOpen className="h-7 w-7 text-neutral-400 dark:text-neutral-500 mb-2" />
          <p className="text-[13px] font-semibold text-neutral-800 dark:text-neutral-200">
            Chưa có mục lục chi tiết
          </p>
          <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
            Tài liệu này chưa có cấu trúc chương/mục hoặc đang chờ hoàn tất trích xuất.
          </p>
        </div>
      ) : (
        <>
          {/* Summary Card */}
          <div className="border-b border-black/[0.06] dark:border-white/[0.08] p-3 space-y-2.5">
            <div className="rounded-2xl border border-black/[0.05] dark:border-white/[0.08] bg-neutral-50/90 dark:bg-[#181C26] p-3">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
                  Mức độ nắm vững tổng thể
                </span>
                <span className="text-lg font-bold font-heading tabular-nums tracking-tight text-neutral-900 dark:text-white">
                  {formatPercent(mastery.overallMasteryScore)}
                </span>
              </div>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-neutral-200/80 dark:bg-white/[0.08]">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    MASTERY_STATUS_META[mastery.overallStatus].barClass
                  }`}
                  style={{
                    width: `${mastery.overallMasteryScore ?? 0}%`,
                  }}
                />
              </div>
              <div className="mt-2.5 grid grid-cols-3 gap-1.5 text-center text-[11px] font-medium tabular-nums">
                <div className="rounded-lg bg-rose-500/10 dark:bg-[#FF453A]/15 py-1 text-rose-700 dark:text-[#FF6961]">
                  Yếu: {mastery.weakSectionsCount}
                </div>
                <div className="rounded-lg bg-amber-500/10 dark:bg-amber-400/15 py-1 text-amber-700 dark:text-amber-300">
                  Củng cố: {mastery.developingSectionsCount}
                </div>
                <div className="rounded-lg bg-emerald-500/10 dark:bg-[#30D158]/15 py-1 text-emerald-700 dark:text-[#30D158]">
                  Vững: {mastery.masteredSectionsCount}
                </div>
              </div>
            </div>

            {/* Segmented Filter */}
            <div className="grid grid-cols-2 gap-1 rounded-xl bg-neutral-100/90 dark:bg-white/[0.05] p-1">
              <button
                type="button"
                onClick={() => setFilterMode('all')}
                className={`rounded-lg py-1.5 text-xs font-semibold transition-all cursor-pointer tabular-nums ${
                  filterMode === 'all'
                    ? 'bg-white dark:bg-[#232836] text-neutral-900 dark:text-white shadow-2xs'
                    : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200'
                }`}
              >
                Tất cả ({mastery.totalSections})
              </button>
              <button
                type="button"
                onClick={() => setFilterMode('weak')}
                className={`rounded-lg py-1.5 text-xs font-semibold transition-all cursor-pointer tabular-nums ${
                  filterMode === 'weak'
                    ? 'bg-white dark:bg-[#232836] text-neutral-900 dark:text-white shadow-2xs'
                    : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200'
                }`}
              >
                Cần ôn ({mastery.weakSectionsCount + mastery.developingSectionsCount})
              </button>
            </div>
          </div>

          {/* Sections Tree */}
          <div className="flex-1 overflow-y-auto p-2.5 space-y-1.5">
            {visibleSections.length === 0 ? (
              <p className="py-10 text-center text-xs text-neutral-500 dark:text-neutral-400">
                Chưa có mục lục nào nằm trong nhóm cần củng cố.
              </p>
            ) : (
              visibleSections.map((section) => {
                const meta = MASTERY_STATUS_META[section.status];
                const canJump = section.startPage !== null;
                return (
                  <div
                    key={`${section.index}-${section.text}`}
                    className={`${indentClass(section.level)}`}
                  >
                    <div
                      role={canJump ? 'button' : undefined}
                      tabIndex={canJump ? 0 : undefined}
                      onClick={() => {
                        if (canJump && section.startPage) {
                          onJumpToPage(section.startPage);
                        }
                      }}
                      onKeyDown={(e) => {
                        if (
                          canJump &&
                          section.startPage &&
                          (e.key === 'Enter' || e.key === ' ')
                        ) {
                          e.preventDefault();
                          onJumpToPage(section.startPage);
                        }
                      }}
                      className={`group relative flex flex-col gap-1.5 rounded-xl border border-black/[0.05] dark:border-white/[0.08] bg-white dark:bg-[#181C26] p-2.5 pl-3.5 transition-all duration-200 ${
                        canJump
                          ? 'hover:border-indigo-500/35 hover:bg-neutral-50 dark:hover:bg-[#1E2330] active:scale-[0.99] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0066FF]'
                          : ''
                      }`}
                    >
                      {/* Semantic Left Heat Strip */}
                      <span
                        aria-hidden="true"
                        className={`absolute left-1.5 top-2.5 bottom-2.5 w-1 rounded-full ${meta.stripClass}`}
                      />

                      <div className="flex items-start justify-between gap-2">
                        <p className="text-[12.5px] font-semibold leading-snug text-neutral-800 dark:text-neutral-100 line-clamp-2">
                          {section.text}
                        </p>
                        <span
                          className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-semibold tabular-nums ${meta.badgeClass}`}
                        >
                          {section.masteryScore !== null
                            ? `${section.masteryScore}%`
                            : meta.shortLabel}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] text-neutral-500 dark:text-neutral-400 tabular-nums">
                        <span>{formatPageRange(section.startPage, section.endPage)}</span>
                        {section.quizTotal > 0 && (
                          <span>
                            Quiz {section.quizCorrect}/{section.quizTotal}
                          </span>
                        )}
                        {section.cardTotal > 0 && (
                          <span>
                            Thẻ {section.cardReviewed}/{section.cardTotal}
                          </span>
                        )}
                        {section.leechCount > 0 && (
                          <span className="font-semibold text-rose-600 dark:text-[#FF6961]">
                            {section.leechCount} khó nhớ
                          </span>
                        )}
                      </div>

                      {section.missingPoints.length > 0 && (
                        <p className="text-[11px] leading-4 text-rose-700/90 dark:text-rose-300/90 line-clamp-2">
                          Hay thiếu: {section.missingPoints[0]}
                        </p>
                      )}

                      {onCreateTargetedQuiz &&
                        section.chunkIds.length > 0 &&
                        (section.status === 'weak' ||
                          section.status === 'developing') && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onCreateTargetedQuiz({
                                chunkIds: section.chunkIds.slice(0, 10),
                                sectionTitle: section.text,
                              });
                            }}
                            className="mt-0.5 inline-flex h-7 w-fit items-center gap-1 rounded-lg bg-indigo-500/10 dark:bg-[#0A84FF]/15 px-2.5 text-[11px] font-semibold text-[#4F46E5] dark:text-[#60A5FA] hover:bg-indigo-500/20 dark:hover:bg-[#0A84FF]/25 active:scale-[0.98] transition-all cursor-pointer"
                          >
                            <Target className="h-3 w-3" />
                            <span>Luyện mục này</span>
                          </button>
                        )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </>
      )}
    </aside>
  );
}
