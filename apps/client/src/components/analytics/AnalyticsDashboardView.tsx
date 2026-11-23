"use client";

import React, { useState } from 'react';
import dynamic from 'next/dynamic';
import { ChevronDown, ChevronUp, RefreshCw } from 'lucide-react';
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
} from '@/components/analytics/AnalyticsPrimitives';
import TodayCoachHero from '@/components/analytics/TodayCoachHero';
import HeadlineMetricsRow from '@/components/analytics/HeadlineMetricsRow';
import AttentionSectionList from '@/components/analytics/AttentionSectionList';
import ProgressTrendSection from '@/components/analytics/ProgressTrendSection';
import KnowledgeMapSection from '@/components/analytics/KnowledgeMapSection';

const AdvancedAnalyticsSection = dynamic(
  () => import('@/components/analytics/AdvancedAnalyticsSection'),
  {
    ssr: false,
    loading: () => (
      <div className="h-44 w-full animate-pulse motion-reduce:animate-none rounded-[24px] border border-black/[0.06] dark:border-white/[0.08] bg-white dark:bg-[#161922]" />
    ),
  }
);

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
  onOpenDocument?: (
    documentId: string,
    fileName: string,
    pageNo?: number,
    conversationId?: string
  ) => void;
  onOpenConversation?: (conversationId: string) => void;
  userName?: string | null;
  onUpdateDailyGoal?: (minutes: number) => Promise<void>;
  onUpdateExamGoal?: (input: {
    examDate: string | null;
    targetScore?: number | null;
  }) => Promise<void>;
  onGoToFlashcards?: () => void;
  onGoToQuiz?: () => void;
  onGoToDocuments?: () => void;
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
  userName,
  onUpdateDailyGoal,
  onUpdateExamGoal,
  onGoToFlashcards,
  onGoToQuiz,
  onGoToDocuments,
}: AnalyticsDashboardViewProps) {
  const [advancedOpen, setAdvancedOpen] = useState(false);

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
        onGoToFlashcards={onGoToFlashcards}
        onGoToQuiz={onGoToQuiz}
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
    data.documentMasterySummaries.some((d) => d.studiedSectionsCount > 0) ||
    data.attentionItems.length > 0;

  const firstName = userName?.trim().split(/\s+/).slice(-1)[0] ?? '';

  return (
    <div className="mx-auto w-full max-w-[1200px] space-y-6">
      {/* Header tối giản, thân thiện */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[22px] sm:text-2xl font-bold font-heading tracking-tight text-neutral-900 dark:text-[#EFF0F6] leading-[1.2]">
            {isSubjectMode
              ? `Tổng quan môn: ${subjData?.subjectName ?? ''}`
              : firstName
                ? `Xin chào, ${firstName}`
                : 'Tiến độ học tập'}
          </h1>
          <p className="mt-1 text-xs sm:text-[13px] text-neutral-500 dark:text-[#9DA3AF]">
            Cập nhật theo hoạt động ôn thẻ và làm bài kiểm tra của bạn.
          </p>
        </div>

        <button
          type="button"
          onClick={onRetry}
          disabled={isValidating}
          title="Cập nhật số liệu mới nhất"
          aria-label="Cập nhật số liệu mới nhất"
          className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-black/[0.08] dark:border-white/[0.1] bg-white dark:bg-white/[0.06] px-3 text-xs font-semibold text-neutral-600 dark:text-[#EFF0F6] hover:bg-neutral-50 dark:hover:bg-white/[0.1] active:scale-[0.98] disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary transition-all cursor-pointer"
        >
          <RefreshCw
            className={`h-3.5 w-3.5 ${isValidating ? 'animate-spin motion-reduce:animate-none' : ''}`}
          />
          <span>Cập nhật</span>
        </button>
      </div>

      {!hasAnyStudySignal ? (
        <AnalyticsEmptyState
          scopeLabel={isSubjectMode ? 'môn học này' : 'phiên học này'}
          onGoToFlashcards={onGoToFlashcards}
          onGoToQuiz={onGoToQuiz}
        />
      ) : (
        <>
          {/* Tầng 1A: Kế hoạch hôm nay & Vòng mục tiêu */}
          <TodayCoachHero
            todayPlan={data.todayPlan}
            streakDays={data.headline.habit.streakDays}
            studiedToday={data.headline.habit.studiedToday}
            onExecuteTask={onExecuteAction}
            onUpdateDailyGoal={onUpdateDailyGoal}
            onGoToDocuments={onGoToDocuments}
          />

          {/* Tầng 1B: 3 Chỉ số cốt lõi & Nhận định nhanh */}
          <HeadlineMetricsRow
            headline={data.headline}
            insights={data.insights}
            examDate={data.examDate}
            targetScore={data.targetScore}
            onUpdateExamGoal={onUpdateExamGoal}
          />

          {/* Tầng 2A: Cần chú ý hợp nhất (Top 3 + Xem tất cả) */}
          <AttentionSectionList
            items={data.attentionItems}
            onExecuteAction={onExecuteAction}
            onJumpToSource={onJumpToSource}
            onCreateTargetedQuiz={onCreateTargetedQuiz}
          />

          {/* Tầng 2B: Tiến bộ của bạn (gắn bộ lọc 7/30/90 ngày nhất quán) */}
          <ProgressTrendSection
            progress={data.progress}
            quizPerformance={data.quizPerformance}
            windowDays={windowDays}
            onWindowDaysChange={onWindowDaysChange}
          />

          {/* Tầng 2C: Bản đồ kiến thức & Các phiên học */}
          <KnowledgeMapSection
            documentMasterySummaries={
              convData?.documentMasterySummaries ?? data.documentMasterySummaries
            }
            conversationSummaries={subjData?.conversationSummaries}
            onOpenDocument={onOpenDocument}
            onOpenConversation={onOpenConversation}
          />

          {/* Tầng 3: Chi tiết nâng cao (thu gọn mặc định, lazy-loaded) */}
          <div className="pt-1">
            <button
              type="button"
              aria-expanded={advancedOpen}
              onClick={() => setAdvancedOpen((prev) => !prev)}
              className="flex w-full items-center justify-between rounded-2xl border border-black/[0.06] dark:border-white/[0.08] bg-white/80 dark:bg-[#161922] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] px-5 py-3.5 text-left hover:bg-neutral-50 dark:hover:bg-[#1D212B] active:scale-[0.995] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary transition-all cursor-pointer"
            >
              <div>
                <span className="text-sm font-semibold text-neutral-800 dark:text-[#EFF0F6]">
                  Chi tiết nâng cao
                </span>
                <span className="ml-2 hidden sm:inline text-xs text-neutral-500 dark:text-[#9DA3AF]">
                  Kho thẻ · Phân bố đánh giá · Kiểu câu hỏi · Lịch ôn tuần tới · Thẻ hay quên
                </span>
              </div>
              {advancedOpen ? (
                <ChevronUp className="h-4 w-4 shrink-0 text-neutral-500 dark:text-[#9DA3AF]" />
              ) : (
                <ChevronDown className="h-4 w-4 shrink-0 text-neutral-500 dark:text-[#9DA3AF]" />
              )}
            </button>

            {advancedOpen && (
              <div className="mt-4">
                <AdvancedAnalyticsSection
                  advanced={data.advanced}
                  bloomMastery={data.bloomMastery}
                  forecast7d={data.workloadForecast7Days}
                  leechCards={data.leechCards}
                  missingPointsClusters={data.missingPointsClusters}
                  onJumpToSource={onJumpToSource}
                  onOpenDeck={onOpenDeck}
                />
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
