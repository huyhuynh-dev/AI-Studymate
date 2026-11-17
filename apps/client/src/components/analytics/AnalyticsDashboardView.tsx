"use client";

import React from 'react';
import { ArrowUpRight, MessageSquare, RefreshCw } from 'lucide-react';
import type {
  ConversationAnalyticsResponse,
  SourceReference,
  StudyRecommendation,
  SubjectAnalyticsResponse,
} from '@/types';
import {
  AnalyticsEmptyState,
  AnalyticsErrorState,
  AnalyticsSkeleton,
  BentoCard,
} from '@/components/analytics/AnalyticsPrimitives';
import BloomAndQuizPanel from '@/components/analytics/BloomAndQuizPanel';
import KnowledgeGapPanel from '@/components/analytics/KnowledgeGapPanel';
import NextBestActionsCard from '@/components/analytics/NextBestActionsCard';
import SrsOverviewBento from '@/components/analytics/SrsOverviewBento';
import WorkloadForecastChart from '@/components/analytics/WorkloadForecastChart';
import { formatPercent } from '@/components/analytics/analytics-helpers';

const WINDOW_OPTIONS = [7, 30, 90] as const;

export interface AnalyticsDashboardViewProps {
  mode: 'conversation' | 'subject';
  data: ConversationAnalyticsResponse | SubjectAnalyticsResponse | null;
  isLoading: boolean;
  isValidating?: boolean;
  errorMessage: string | null;
  windowDays: number;
  onWindowDaysChange: (days: number) => void;
  onRetry: () => void;
  onExecuteAction: (rec: StudyRecommendation) => void;
  onJumpToSource?: (ref: SourceReference, conversationId?: string) => void;
  onCreateTargetedQuiz?: (opts: {
    conversationId: string;
    chunkIds: string[];
    sectionTitle: string;
  }) => void;
  onOpenDeck?: (deckId: string, conversationId: string) => void;
  onOpenDocument?: (documentId: string, fileName: string) => void;
  onOpenConversation?: (conversationId: string) => void;
}

export default function AnalyticsDashboardView({
  mode,
  data,
  isLoading,
  isValidating = false,
  errorMessage,
  windowDays,
  onWindowDaysChange,
  onRetry,
  onExecuteAction,
  onJumpToSource,
  onCreateTargetedQuiz,
  onOpenDeck,
  onOpenDocument,
  onOpenConversation,
}: AnalyticsDashboardViewProps) {
  if (isLoading && !data) {
    return <AnalyticsSkeleton />;
  }

  if (errorMessage && !data) {
    return <AnalyticsErrorState message={errorMessage} onRetry={onRetry} />;
  }

  if (!data) {
    return (
      <AnalyticsEmptyState
        scopeLabel={mode === 'subject' ? 'môn học này' : 'phiên học này'}
      />
    );
  }

  const isSubjectMode = mode === 'subject';
  const convData = !isSubjectMode
    ? (data as ConversationAnalyticsResponse)
    : null;
  const subjData = isSubjectMode ? (data as SubjectAnalyticsResponse) : null;

  const hasAnyStudySignal =
    data.srsOverview.totalCards > 0 ||
    data.srsOverview.totalReviewsInWindow > 0 ||
    data.quizPerformance.totalSubmittedAttempts > 0 ||
    (convData?.documentMasterySummaries.some((d) => d.studiedSectionsCount > 0) ??
      false);

  const weakTopics = convData?.weakTopics ?? subjData?.topWeakTopics ?? [];

  return (
    <div className="mx-auto w-full max-w-[1200px] space-y-6">
      {/* Header Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-[22px] sm:text-2xl font-bold font-heading tracking-tight text-neutral-900 dark:text-white leading-tight">
            {isSubjectMode
              ? `Phân tích môn: ${subjData?.subjectName}`
              : 'Phân tích tiến độ & Lỗ hổng học tập'}
          </h1>
          <p className="mt-1 text-xs sm:text-[13px] text-neutral-500 dark:text-neutral-400">
            Tính toán trực tiếp từ nhật ký SM-2, kết quả Quiz và Mục lục tài liệu (0% LLM).
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <div className="inline-flex rounded-xl bg-neutral-100/90 dark:bg-white/[0.06] p-1 border border-black/[0.04] dark:border-white/[0.06]">
            {WINDOW_OPTIONS.map((days) => {
              const active = windowDays === days;
              return (
                <button
                  key={days}
                  type="button"
                  onClick={() => onWindowDaysChange(days)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold tabular-nums transition-all cursor-pointer ${
                    active
                      ? 'bg-white dark:bg-[#232836] text-neutral-900 dark:text-white shadow-2xs'
                      : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200'
                  }`}
                >
                  {days} ngày
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={onRetry}
            disabled={isValidating}
            title="Cập nhật số liệu mới nhất"
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-black/[0.08] dark:border-white/[0.1] bg-white dark:bg-white/[0.06] text-neutral-600 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-white/[0.1] active:scale-[0.98] disabled:opacity-50 transition-all cursor-pointer"
          >
            <RefreshCw
              className={`h-4 w-4 ${isValidating ? 'animate-spin' : ''}`}
            />
          </button>
        </div>
      </div>

      {/* KPIs */}
      <SrsOverviewBento
        srsOverview={data.srsOverview}
        quizPerformance={data.quizPerformance}
        windowDays={data.windowDays}
      />

      {!hasAnyStudySignal ? (
        <AnalyticsEmptyState
          scopeLabel={isSubjectMode ? 'môn học này' : 'phiên học này'}
        />
      ) : (
        <>
          {/* Focal Next Best Study Actions + 7-Day Forecast */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            <div className="lg:col-span-7">
              <NextBestActionsCard
                recommendations={data.recommendations}
                onExecuteAction={onExecuteAction}
              />
            </div>
            <div className="lg:col-span-5">
              <WorkloadForecastChart forecast={data.workloadForecast7Days} />
            </div>
          </div>

          {/* Bloom Taxonomy & Quiz Score Trend */}
          <BloomAndQuizPanel
            bloomMastery={data.bloomMastery}
            quizPerformance={data.quizPerformance}
          />

          {/* Knowledge Gap Diagnostics & Document Mastery Summaries */}
          <KnowledgeGapPanel
            weakTopics={weakTopics}
            missingPointsClusters={data.missingPointsClusters}
            leechCards={data.leechCards}
            documentMasterySummaries={convData?.documentMasterySummaries ?? []}
            onJumpToSource={onJumpToSource}
            onCreateTargetedQuiz={onCreateTargetedQuiz}
            onOpenDeck={onOpenDeck}
            onOpenDocument={onOpenDocument}
          />

          {/* Subject Mode: Per-Conversation Progress Table */}
          {subjData && subjData.conversationSummaries.length > 0 && (
            <BentoCard className="p-5 sm:p-6 space-y-4">
              <div>
                <h2 className="text-[20px] font-bold font-heading tracking-tight text-neutral-900 dark:text-white leading-tight">
                  Tiến độ từng phiên học ({subjData.conversationSummaries.length})
                </h2>
                <p className="mt-1 text-xs sm:text-[13px] text-neutral-500 dark:text-neutral-400">
                  Nhấn vào một phiên học để đi tới tài liệu, ôn thẻ đến hạn hoặc luyện bù lỗ hổng.
                </p>
              </div>

              <div className="space-y-2">
                {subjData.conversationSummaries.map((conv) => (
                  <button
                    key={conv.conversationId}
                    type="button"
                    onClick={() => onOpenConversation?.(conv.conversationId)}
                    className="group flex w-full flex-col gap-2 rounded-2xl border border-black/[0.05] dark:border-white/[0.08] bg-neutral-50/80 dark:bg-[#161A23] px-4 py-3.5 text-left hover:border-indigo-500/30 hover:bg-white dark:hover:bg-[#1C212E] active:scale-[0.99] transition-all sm:flex-row sm:items-center sm:justify-between cursor-pointer"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-500/10 text-[#4F46E5] dark:text-[#60A5FA]">
                        <MessageSquare className="h-4 w-4" />
                      </span>
                      <span className="truncate text-sm font-semibold text-neutral-900 dark:text-white">
                        {conv.title}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-xs tabular-nums text-neutral-600 dark:text-neutral-300">
                      <span>Thẻ đến hạn: {conv.dueNowCount}/{conv.totalCards}</span>
                      <span>Điểm Quiz TB: {formatPercent(conv.avgQuizScorePct)}</span>
                      {conv.weakSectionsCount > 0 && (
                        <span className="rounded-full bg-rose-500/10 dark:bg-[#FF453A]/15 px-2 py-0.5 font-semibold text-rose-700 dark:text-[#FF6961]">
                          {conv.weakSectionsCount} mục yếu
                        </span>
                      )}
                      <ArrowUpRight className="h-4 w-4 text-neutral-400 group-hover:text-[#4F46E5] dark:group-hover:text-[#60A5FA] transition-colors" />
                    </div>
                  </button>
                ))}
              </div>
            </BentoCard>
          )}
        </>
      )}
    </div>
  );
}
