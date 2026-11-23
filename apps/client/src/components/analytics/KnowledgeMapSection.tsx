"use client";

import React from 'react';
import { ArrowUpRight, FileText, MessageSquare } from 'lucide-react';
import type {
  DocumentMasterySummary,
  SubjectConversationSummary,
} from '@/types';
import { BentoCard } from '@/components/analytics/AnalyticsPrimitives';
import {
  MASTERY_STATUS_META,
  formatPercent,
} from '@/components/analytics/analytics-helpers';

export interface KnowledgeMapSectionProps {
  documentMasterySummaries: DocumentMasterySummary[];
  conversationSummaries?: SubjectConversationSummary[];
  onOpenDocument?: (
    documentId: string,
    fileName: string,
    pageNo?: number,
    conversationId?: string
  ) => void;
  onOpenConversation?: (conversationId: string) => void;
}

export default function KnowledgeMapSection({
  documentMasterySummaries,
  conversationSummaries = [],
  onOpenDocument,
  onOpenConversation,
}: KnowledgeMapSectionProps) {
  if (
    documentMasterySummaries.length === 0 &&
    conversationSummaries.length === 0
  ) {
    return null;
  }

  return (
    <div className="space-y-6">
      {documentMasterySummaries.length > 0 && (
        <BentoCard className="p-5 sm:p-6 space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg sm:text-[20px] font-bold font-heading tracking-tight text-neutral-900 dark:text-[#EFF0F6] leading-[1.2]">
                Bản đồ kiến thức
              </h2>
              <p className="mt-1 text-xs sm:text-[13px] text-neutral-500 dark:text-[#9DA3AF]">
                Mỗi ô là một mục trong tài liệu. Bấm vào ô màu để mở đúng trang cần xem lại.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3 text-[11px] font-medium text-neutral-600 dark:text-[#9DA3AF]">
              {(['mastered', 'developing', 'weak', 'unstudied'] as const).map(
                (st) => (
                  <span key={st} className="inline-flex items-center gap-1.5">
                    <span
                      aria-hidden="true"
                      className={`h-2.5 w-2.5 rounded-sm ${MASTERY_STATUS_META[st].dotClass}`}
                    />
                    <span>{MASTERY_STATUS_META[st].shortLabel}</span>
                  </span>
                )
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
            {documentMasterySummaries.map((doc) => {
              const statusMeta = MASTERY_STATUS_META[doc.overallStatus];
              const tiles = doc.sectionTiles ?? [];

              return (
                <div
                  key={doc.documentId}
                  className="flex flex-col justify-between gap-3 rounded-2xl border border-black/[0.05] dark:border-white/[0.08] bg-neutral-50/80 dark:bg-white/[0.035] p-4"
                >
                  <button
                    type="button"
                    onClick={() =>
                      onOpenDocument?.(
                        doc.documentId,
                        doc.fileName,
                        1,
                        doc.conversationId
                      )
                    }
                    className="group flex items-start justify-between gap-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-lg cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-500/10 text-[#4F46E5] dark:bg-indigo-500/[0.14] dark:text-[#818CF8]">
                        <FileText className="h-4.5 w-4.5" />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-neutral-900 dark:text-[#EFF0F6] group-hover:text-[#4F46E5] dark:group-hover:text-[#818CF8] transition-colors">
                          {doc.fileName}
                        </p>
                        <p className="text-xs text-neutral-500 dark:text-[#9DA3AF] tabular-nums">
                          {doc.studiedSectionsCount}/{doc.totalSections} mục đã học
                          {doc.weakSectionsCount > 0
                            ? ` · ${doc.weakSectionsCount} mục cần ôn`
                            : ''}
                        </p>
                      </div>
                    </div>

                    <span
                      className={`shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-semibold tabular-nums ${statusMeta.badgeClass}`}
                    >
                      {formatPercent(doc.overallMasteryScore)}
                    </span>
                  </button>

                  {tiles.length > 0 ? (
                    <div
                      className="flex flex-wrap gap-1.5"
                      aria-label={`Các mục của ${doc.fileName}`}
                    >
                      {tiles.slice(0, 24).map((tile) => {
                        const tileMeta = MASTERY_STATUS_META[tile.status];
                        const scoreLabel =
                          tile.masteryScore !== null
                            ? `${Math.round(tile.masteryScore)}%`
                            : tileMeta.label;
                        return (
                          <button
                            key={`${doc.documentId}-${tile.index}`}
                            type="button"
                            title={`${tile.text} · ${scoreLabel}${
                              tile.startPage ? ` (Tr. ${tile.startPage})` : ''
                            }`}
                            aria-label={`${tile.text}: ${scoreLabel}`}
                            onClick={() =>
                              onOpenDocument?.(
                                doc.documentId,
                                doc.fileName,
                                tile.startPage ?? 1,
                                doc.conversationId
                              )
                            }
                            className={`h-4 min-w-[20px] flex-1 max-w-[36px] rounded-[5px] transition-transform duration-150 hover:scale-110 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary cursor-pointer ${tileMeta.tileClass}`}
                          />
                        );
                      })}
                    </div>
                  ) : (
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-200/80 dark:bg-white/[0.08]">
                      <div
                        className={`h-full rounded-full transition-all duration-300 motion-reduce:transition-none ${statusMeta.barClass}`}
                        style={{ width: `${doc.overallMasteryScore ?? 0}%` }}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </BentoCard>
      )}

      {/* Chế độ Môn học: Các phiên học xếp theo mức cần chú ý */}
      {conversationSummaries.length > 0 && (
        <BentoCard className="p-5 sm:p-6 space-y-4">
          <div>
            <h2 className="text-lg sm:text-[20px] font-bold font-heading tracking-tight text-neutral-900 dark:text-[#EFF0F6] leading-[1.2]">
              Các phiên học ({conversationSummaries.length})
            </h2>
            <p className="mt-1 text-xs sm:text-[13px] text-neutral-500 dark:text-[#9DA3AF]">
              Ưu tiên xếp các phiên học có mục cần ôn hoặc thẻ đến hạn lên đầu.
            </p>
          </div>

          <div className="space-y-2">
            {conversationSummaries.map((conv) => (
              <button
                key={conv.conversationId}
                type="button"
                onClick={() => onOpenConversation?.(conv.conversationId)}
                className="group flex w-full flex-col gap-2 rounded-2xl border border-black/[0.05] dark:border-white/[0.08] bg-neutral-50/80 dark:bg-white/[0.035] px-4 py-3.5 text-left hover:border-indigo-500/30 dark:hover:border-indigo-400/30 hover:bg-white dark:hover:bg-[#1D212B] active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary transition-all sm:flex-row sm:items-center sm:justify-between cursor-pointer"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-500/10 text-[#4F46E5] dark:bg-indigo-500/[0.14] dark:text-[#818CF8]">
                    <MessageSquare className="h-4 w-4" />
                  </span>
                  <span className="truncate text-sm font-semibold text-neutral-900 dark:text-[#EFF0F6]">
                    {conv.title}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-3 text-xs tabular-nums text-neutral-600 dark:text-[#9DA3AF]">
                  <span>Thẻ cần ôn: {conv.dueNowCount}/{conv.totalCards}</span>
                  <span>Kiểm tra: {formatPercent(conv.avgQuizScorePct)}</span>
                  {conv.weakSectionsCount > 0 && (
                    <span className="rounded-full bg-amber-500/12 dark:bg-amber-500/[0.14] px-2.5 py-0.5 font-semibold text-amber-800 dark:text-amber-300">
                      {conv.weakSectionsCount} mục cần ôn
                    </span>
                  )}
                  <ArrowUpRight className="h-4 w-4 text-neutral-400 group-hover:text-[#4F46E5] dark:group-hover:text-[#818CF8] transition-colors" />
                </div>
              </button>
            ))}
          </div>
        </BentoCard>
      )}
    </div>
  );
}
