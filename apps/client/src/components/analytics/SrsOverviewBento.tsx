"use client";

import React from 'react';
import { Award, Brain, Clock, Flame } from 'lucide-react';
import type { QuizPerformanceSummary, SrsOverviewStats } from '@/types';
import {
  formatPercent,
  formatResponseSeconds,
} from '@/components/analytics/analytics-helpers';
import { BentoCard } from '@/components/analytics/AnalyticsPrimitives';

export interface SrsOverviewBentoProps {
  srsOverview: SrsOverviewStats;
  quizPerformance: QuizPerformanceSummary;
  windowDays: number;
}

export default function SrsOverviewBento({
  srsOverview,
  quizPerformance,
  windowDays,
}: SrsOverviewBentoProps) {
  const cards = [
    {
      key: 'streak',
      label: 'Chuỗi ngày học',
      value: `${srsOverview.studyStreakDays}`,
      unit: 'ngày',
      sub: srsOverview.studiedToday
        ? `Đã học hôm nay · Kỷ lục ${srsOverview.longestStreakDays} ngày`
        : `Hôm nay chưa ôn · ${srsOverview.activeDaysLast30}/30 ngày hoạt động`,
      icon: Flame,
      accentClass: srsOverview.studiedToday
        ? 'bg-amber-500/12 text-amber-600 dark:bg-amber-400/15 dark:text-[#FFD60A]'
        : 'bg-neutral-100 text-neutral-500 dark:bg-white/[0.06] dark:text-neutral-400',
    },
    {
      key: 'retention',
      label: `Ghi nhớ thực tế (${windowDays} ngày)`,
      value: formatPercent(srsOverview.retentionRate),
      unit: '',
      sub:
        srsOverview.totalReviewsInWindow > 0
          ? `Trên ${srsOverview.totalReviewsInWindow} lượt ôn${
              srsOverview.matureRetentionRate !== null
                ? ` · Thẻ vững: ${formatPercent(srsOverview.matureRetentionRate)}`
                : ''
            }`
          : 'Chưa có lượt ôn Flashcard trong kỳ',
      icon: Brain,
      accentClass:
        srsOverview.retentionRate !== null && srsOverview.retentionRate < 70
          ? 'bg-rose-500/10 text-rose-600 dark:bg-[#FF453A]/15 dark:text-[#FF6961]'
          : 'bg-emerald-500/12 text-emerald-600 dark:bg-[#30D158]/15 dark:text-[#30D158]',
    },
    {
      key: 'due',
      label: 'Thẻ đến hạn hôm nay',
      value: `${srsOverview.dueNowCount}`,
      unit: `/ ${srsOverview.totalCards} thẻ`,
      sub:
        srsOverview.totalCards > 0
          ? `${srsOverview.newCount} thẻ mới · Phản xạ ${formatResponseSeconds(srsOverview.avgResponseTimeMs)}`
          : 'Chưa có bộ thẻ Flashcard',
      icon: Clock,
      accentClass:
        srsOverview.dueNowCount > 0
          ? 'bg-indigo-500/12 text-[#4F46E5] dark:bg-[#0A84FF]/15 dark:text-[#60A5FA]'
          : 'bg-neutral-100 text-neutral-500 dark:bg-white/[0.06] dark:text-neutral-400',
    },
    {
      key: 'quiz',
      label: 'Điểm Quiz trung bình',
      value: formatPercent(quizPerformance.avgScorePct),
      unit: '',
      sub:
        quizPerformance.totalSubmittedAttempts > 0
          ? `Tổng cộng ${quizPerformance.totalSubmittedAttempts} lượt đã nộp bài`
          : 'Chưa nộp bài kiểm tra nào',
      icon: Award,
      accentClass:
        quizPerformance.avgScorePct !== null && quizPerformance.avgScorePct < 60
          ? 'bg-amber-500/12 text-amber-600 dark:bg-amber-400/15 dark:text-[#FFD60A]'
          : 'bg-indigo-500/12 text-[#4F46E5] dark:bg-[#818CF8]/15 dark:text-[#818CF8]',
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((item) => {
        const Icon = item.icon;
        return (
          <BentoCard key={item.key} className="p-5 flex flex-col justify-between gap-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[13px] font-medium text-neutral-500 dark:text-neutral-400">
                {item.label}
              </span>
              <span
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${item.accentClass}`}
              >
                <Icon className="h-4.5 w-4.5" />
              </span>
            </div>

            <div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-[28px] font-bold font-heading leading-none tabular-nums tracking-tight text-neutral-900 dark:text-white">
                  {item.value}
                </span>
                {item.unit && (
                  <span className="text-sm font-medium tabular-nums text-neutral-500 dark:text-neutral-400">
                    {item.unit}
                  </span>
                )}
              </div>
              <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed tabular-nums">
                {item.sub}
              </p>
            </div>
          </BentoCard>
        );
      })}
    </div>
  );
}
