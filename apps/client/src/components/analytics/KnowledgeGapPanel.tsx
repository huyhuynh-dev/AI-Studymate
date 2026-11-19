"use client";

import React, { useState } from 'react';
import {
  AlertCircle,
  ArrowUpRight,
  BookOpen,
  FileText,
  Layers,
  Target,
} from 'lucide-react';
import type {
  DocumentMasterySummary,
  LeechCardItem,
  MissingPointCluster,
  SourceReference,
  WeakTopicItem,
} from '@/types';
import {
  BLOOM_META_LABELS,
  MASTERY_STATUS_META,
  formatPageRange,
  formatPercent,
} from '@/components/analytics/analytics-helpers';
import { BentoCard } from '@/components/analytics/AnalyticsPrimitives';

type GapTab = 'topics' | 'missing' | 'leech';

export interface KnowledgeGapPanelProps {
  weakTopics: WeakTopicItem[];
  missingPointsClusters: MissingPointCluster[];
  leechCards: LeechCardItem[];
  documentMasterySummaries?: DocumentMasterySummary[];
  onJumpToSource?: (ref: SourceReference, conversationId?: string) => void;
  onCreateTargetedQuiz?: (opts: {
    conversationId: string;
    chunkIds: string[];
    sectionTitle: string;
  }) => void;
  onOpenDeck?: (deckId: string, conversationId: string) => void;
  onOpenDocument?: (documentId: string, fileName: string) => void;
}

export default function KnowledgeGapPanel({
  weakTopics,
  missingPointsClusters,
  leechCards,
  documentMasterySummaries = [],
  onJumpToSource,
  onCreateTargetedQuiz,
  onOpenDeck,
  onOpenDocument,
}: KnowledgeGapPanelProps) {
  const [activeTab, setActiveTab] = useState<GapTab>(() =>
    weakTopics.length > 0
      ? 'topics'
      : missingPointsClusters.length > 0
        ? 'missing'
        : 'leech'
  );

  const tabs: { key: GapTab; label: string; count: number }[] = [
    { key: 'topics', label: 'Chủ đề yếu', count: weakTopics.length },
    {
      key: 'missing',
      label: 'Ý tự luận thiếu',
      count: missingPointsClusters.length,
    },
    { key: 'leech', label: 'Thẻ khó nhớ', count: leechCards.length },
  ];

  return (
    <div className="space-y-6">
      <BentoCard className="p-5 sm:p-6 space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-[20px] font-bold font-heading tracking-tight text-neutral-900 dark:text-white leading-tight">
              Chẩn đoán lỗ hổng kiến thức
            </h2>
            <p className="mt-1 text-xs sm:text-[13px] text-neutral-500 dark:text-neutral-400">
              Tổng hợp các vùng tài liệu yếu, ý tự luận hay bỏ sót và thẻ Flashcard khó nhớ.
            </p>
          </div>

          {/* Apple Segmented Control */}
          <div className="inline-flex rounded-xl bg-neutral-100/90 dark:bg-white/[0.06] p-1 self-start sm:self-auto">
            {tabs.map((t) => {
              const selected = activeTab === t.key;
              return (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setActiveTab(t.key)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold tabular-nums transition-all cursor-pointer ${
                    selected
                      ? 'bg-white dark:bg-[#232836] text-neutral-900 dark:text-white shadow-2xs'
                      : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200'
                  }`}
                >
                  {t.label} ({t.count})
                </button>
              );
            })}
          </div>
        </div>

        {/* Tab 1: Weak Topics */}
        {activeTab === 'topics' && (
          weakTopics.length === 0 ? (
            <EmptyDiagnosticLine text="Chưa ghi nhận chương/mục lục nào có điểm thành thạo thấp." />
          ) : (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {weakTopics.map((topic) => {
                const statusMeta = MASTERY_STATUS_META[topic.status];
                return (
                  <div
                    key={`${topic.documentId}-${topic.topic}-${topic.startPage ?? 0}`}
                    className="flex flex-col justify-between gap-3 rounded-2xl border border-black/[0.05] dark:border-white/[0.08] bg-neutral-50/80 dark:bg-[#161A23] p-4"
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h3 className="text-sm font-semibold text-neutral-900 dark:text-white leading-snug">
                            {topic.topic}
                          </h3>
                          <p className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400 truncate tabular-nums">
                            {topic.conversationTitle
                              ? `${topic.conversationTitle} · `
                              : ''}
                            {topic.fileName} ·{' '}
                            {formatPageRange(topic.startPage, topic.endPage)}
                          </p>
                        </div>
                        <span
                          className={`shrink-0 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold tabular-nums ${statusMeta.badgeClass}`}
                        >
                          {formatPercent(topic.masteryScore)}
                        </span>
                      </div>

                      <div className="flex flex-wrap gap-2 text-[11.5px] text-neutral-600 dark:text-neutral-400 tabular-nums">
                        {topic.quizTotal > 0 && (
                          <span>
                            Quiz: {topic.quizCorrect}/{topic.quizTotal} đúng
                          </span>
                        )}
                        {topic.leechCount > 0 && (
                          <span className="text-rose-600 dark:text-[#FF6961] font-medium">
                            {topic.leechCount} thẻ khó nhớ
                          </span>
                        )}
                        {topic.missingPointCount > 0 && (
                          <span>{topic.missingPointCount} ý tự luận thiếu</span>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      {onJumpToSource && topic.startPage && (
                        <button
                          type="button"
                          onClick={() =>
                            onJumpToSource(
                              {
                                documentId: topic.documentId,
                                fileName: topic.fileName,
                                pageNumbers: [topic.startPage ?? 1],
                              },
                              topic.conversationId
                            )
                          }
                          className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-black/[0.08] dark:border-white/[0.1] bg-white dark:bg-white/[0.06] px-3 text-xs font-semibold text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-white/[0.1] active:scale-[0.98] transition-all cursor-pointer"
                        >
                          <BookOpen className="h-3.5 w-3.5" />
                          <span>Mở trang PDF</span>
                        </button>
                      )}
                      {onCreateTargetedQuiz && topic.chunkIds.length > 0 && (
                        <button
                          type="button"
                          onClick={() =>
                            onCreateTargetedQuiz({
                              conversationId: topic.conversationId,
                              chunkIds: topic.chunkIds,
                              sectionTitle: topic.topic,
                            })
                          }
                          className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-indigo-500/10 dark:bg-[#0A84FF]/15 px-3 text-xs font-semibold text-[#4F46E5] dark:text-[#60A5FA] hover:bg-indigo-500/20 dark:hover:bg-[#0A84FF]/25 active:scale-[0.98] transition-all cursor-pointer"
                        >
                          <Target className="h-3.5 w-3.5" />
                          <span>Luyện đặc trị</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )
        )}

        {/* Tab 2: Missing Points Clusters */}
        {activeTab === 'missing' && (
          missingPointsClusters.length === 0 ? (
            <EmptyDiagnosticLine text="Chưa ghi nhận cụm ý tự luận nào bị bỏ sót trong các lần chấm bài." />
          ) : (
            <div className="space-y-2.5">
              {missingPointsClusters.map((cluster) => {
                const firstRef = cluster.sourceRefs[0];
                return (
                  <div
                    key={cluster.point}
                    className="flex flex-col gap-3 rounded-2xl border border-black/[0.05] dark:border-white/[0.08] bg-neutral-50/80 dark:bg-[#161A23] p-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/10 dark:bg-[#FF453A]/15 px-2.5 py-0.5 text-[11px] font-semibold tabular-nums text-rose-700 dark:text-[#FF6961]">
                          <AlertCircle className="h-3 w-3" />
                          Thiếu {cluster.frequency} lần
                        </span>
                        {cluster.bloomLevels.map((lvl) => (
                          <span
                            key={lvl}
                            className="rounded-full bg-neutral-200/70 dark:bg-white/[0.08] px-2 py-0.5 text-[11px] font-medium text-neutral-700 dark:text-neutral-300"
                          >
                            {BLOOM_META_LABELS[lvl].short}
                          </span>
                        ))}
                      </div>
                      <p className="text-sm font-semibold text-neutral-900 dark:text-white leading-snug">
                        {cluster.point}
                      </p>
                      {cluster.sampleQuestionText && (
                        <p className="text-xs text-neutral-500 dark:text-neutral-400 line-clamp-1">
                          Trong câu hỏi: “{cluster.sampleQuestionText}”
                        </p>
                      )}
                    </div>

                    {firstRef && onJumpToSource && (
                      <button
                        type="button"
                        onClick={() => onJumpToSource(firstRef)}
                        title={`Xem nguồn: ${firstRef.fileName} (Trang ${firstRef.pageNumbers[0] ?? 1})`}
                        className="group inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-indigo-500/25 bg-white dark:bg-white/[0.06] px-3.5 text-xs font-semibold text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-500/20 active:scale-[0.98] transition-colors cursor-pointer"
                      >
                        <span>Xem nguồn</span>
                        <ArrowUpRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" aria-hidden="true" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )
        )}

        {/* Tab 3: Leech Cards */}
        {activeTab === 'leech' && (
          leechCards.length === 0 ? (
            <EmptyDiagnosticLine text="Chưa có thẻ Flashcard nào rơi vào nhóm khó nhớ (Leech)." />
          ) : (
            <div className="space-y-2.5">
              {leechCards.map((card) => {
                const firstRef = card.sourceRefs[0];
                return (
                  <div
                    key={card.id}
                    className="flex flex-col gap-3 rounded-2xl border border-black/[0.05] dark:border-white/[0.08] bg-neutral-50/80 dark:bg-[#161A23] p-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0 space-y-1">
                      <p className="text-sm font-semibold text-neutral-900 dark:text-white leading-snug line-clamp-2">
                        {card.frontText}
                      </p>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400 tabular-nums">
                        <span>Bộ thẻ: {card.deckName}</span>
                        <span>·</span>
                        <span className="font-semibold text-rose-600 dark:text-[#FF6961]">
                          Quên {card.againCount} lần
                        </span>
                        <span>·</span>
                        <span>Ease {card.easeFactor.toFixed(2)}</span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      {firstRef && onJumpToSource && (
                        <button
                          type="button"
                          onClick={() =>
                            onJumpToSource(firstRef, card.conversationId)
                          }
                          title={`Xem nguồn: ${firstRef.fileName} (Trang ${firstRef.pageNumbers[0] ?? 1})`}
                          className="group inline-flex h-9 items-center gap-1.5 rounded-full border border-indigo-500/25 bg-white dark:bg-white/[0.06] px-3.5 text-xs font-semibold text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-500/20 active:scale-[0.98] transition-colors cursor-pointer"
                        >
                          <span>Xem nguồn</span>
                          <ArrowUpRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" aria-hidden="true" />
                        </button>
                      )}
                      {onOpenDeck && (
                        <button
                          type="button"
                          onClick={() =>
                            onOpenDeck(card.deckId, card.conversationId)
                          }
                          className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-indigo-500/10 dark:bg-[#0A84FF]/15 px-3 text-xs font-semibold text-[#4F46E5] dark:text-[#60A5FA] hover:bg-indigo-500/20 dark:hover:bg-[#0A84FF]/25 active:scale-[0.98] transition-all cursor-pointer"
                        >
                          <Layers className="h-3.5 w-3.5" />
                          <span>Mở bộ thẻ</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )
        )}
      </BentoCard>

      {/* Tóm tắt độ thuộc tài liệu PDF trong Phiên học */}
      {documentMasterySummaries.length > 0 && (
        <BentoCard className="p-5 sm:p-6 space-y-4">
          <div>
            <h2 className="text-[20px] font-bold font-heading tracking-tight text-neutral-900 dark:text-white leading-tight">
              Bản đồ nhiệt theo Tài liệu PDF
            </h2>
            <p className="mt-1 text-xs sm:text-[13px] text-neutral-500 dark:text-neutral-400">
              Bấm vào tài liệu để mở trình xem PDF kèm ngăn Mục lục Heatmap chi tiết từng chương.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {documentMasterySummaries.map((doc) => {
              const statusMeta = MASTERY_STATUS_META[doc.overallStatus];
              return (
                <button
                  key={doc.documentId}
                  type="button"
                  onClick={() => onOpenDocument?.(doc.documentId, doc.fileName)}
                  className="flex flex-col gap-2.5 rounded-2xl border border-black/[0.05] dark:border-white/[0.08] bg-neutral-50/80 dark:bg-[#161A23] p-4 text-left hover:border-indigo-500/30 hover:bg-white dark:hover:bg-[#1C212E] active:scale-[0.99] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0066FF] cursor-pointer"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400">
                        <FileText className="h-4.5 w-4.5" />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-neutral-900 dark:text-white">
                          {doc.fileName}
                        </p>
                        <p className="text-xs text-neutral-500 dark:text-neutral-400 tabular-nums">
                          {doc.studiedSectionsCount}/{doc.totalSections} mục đã học ·{' '}
                          {doc.weakSectionsCount} mục yếu
                        </p>
                      </div>
                    </div>
                    <span
                      className={`shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-semibold tabular-nums ${statusMeta.badgeClass}`}
                    >
                      {formatPercent(doc.overallMasteryScore)}
                    </span>
                  </div>

                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-200/80 dark:bg-white/[0.08]">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${statusMeta.barClass}`}
                      style={{ width: `${doc.overallMasteryScore ?? 0}%` }}
                    />
                  </div>
                </button>
              );
            })}
          </div>
        </BentoCard>
      )}
    </div>
  );
}

function EmptyDiagnosticLine({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-black/[0.08] dark:border-white/[0.1] bg-neutral-50/70 dark:bg-[#161A23] px-5 py-8 text-center text-xs text-neutral-500 dark:text-neutral-400">
      {text}
    </div>
  );
}
