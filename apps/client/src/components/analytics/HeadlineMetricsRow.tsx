"use client";

import React, { useState } from 'react';
import {
  Award,
  Brain,
  CalendarClock,
  CheckCircle2,
  Flame,
  Info,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import type { CoachingInsight, HeadlineMetrics } from '@/types';
import {
  BentoCard,
  InfoPopoverTip,
} from '@/components/analytics/AnalyticsPrimitives';
import {
  METRIC_LABEL_META,
  formatDeltaPct,
  formatMinutes,
  formatPercent,
} from '@/components/analytics/analytics-helpers';

const WEEK_DAY_FALLBACK = ['T-6', 'T-5', 'T-4', 'T-3', 'T-2', 'H.qua', 'H.nay'];

export interface HeadlineMetricsRowProps {
  headline: HeadlineMetrics;
  insights: CoachingInsight[];
  examDate: string | null;
  targetScore: number | null;
  onUpdateExamGoal?: (input: {
    examDate: string | null;
    targetScore?: number | null;
  }) => Promise<void>;
}

export default function HeadlineMetricsRow({
  headline,
  insights,
  examDate,
  targetScore,
  onUpdateExamGoal,
}: HeadlineMetricsRowProps) {
  const [examEditorOpen, setExamEditorOpen] = useState(false);
  const [draftDate, setDraftDate] = useState(examDate ?? '');
  const [draftTarget, setDraftTarget] = useState(String(targetScore ?? 85));
  const [savingExam, setSavingExam] = useState(false);

  const readiness = headline.readiness;
  const retention = headline.retention;
  const habit = headline.habit;

  const isRetentionInsufficient =
    retention.label === 'insufficient_data' || retention.value === null;
  const retentionLabelMeta = METRIC_LABEL_META[retention.label];
  const retentionDelta = formatDeltaPct(retention.deltaVsPrev);

  const handleSaveExam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onUpdateExamGoal) return;
    setSavingExam(true);
    try {
      const parsedTarget = Number(draftTarget);
      await onUpdateExamGoal({
        examDate: draftDate.trim() ? draftDate.trim() : null,
        targetScore:
          Number.isFinite(parsedTarget) && parsedTarget >= 50 && parsedTarget <= 100
            ? Math.round(parsedTarget)
            : 85,
      });
      setExamEditorOpen(false);
    } finally {
      setSavingExam(false);
    }
  };

  const handleClearExam = async () => {
    if (!onUpdateExamGoal) return;
    setSavingExam(true);
    try {
      await onUpdateExamGoal({ examDate: null, targetScore: null });
      setDraftDate('');
      setExamEditorOpen(false);
    } finally {
      setSavingExam(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {/* Thẻ 1: Mức nắm vững hoặc Sẵn sàng thi */}
        <BentoCard className="p-5 flex flex-col justify-between gap-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-indigo-500/10 text-[#4F46E5] dark:bg-[#0A84FF]/15 dark:text-[#60A5FA]">
                {readiness ? (
                  <CalendarClock className="h-4 w-4" />
                ) : (
                  <Award className="h-4 w-4" />
                )}
              </span>
              <span className="truncate text-[13px] font-medium text-neutral-600 dark:text-neutral-300">
                {readiness ? 'Độ sẵn sàng thi' : 'Mức nắm vững'}
              </span>
            </div>

            <InfoPopoverTip
              label="Giải thích cách tính mức nắm vững"
              content={
                readiness
                  ? readiness.explanation
                  : headline.mastery.explanation
              }
            />
          </div>

          {examEditorOpen && onUpdateExamGoal ? (
            <form onSubmit={(e) => void handleSaveExam(e)} className="space-y-2.5">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-medium text-neutral-500 dark:text-neutral-400 mb-1">
                    Ngày thi
                  </label>
                  <input
                    type="date"
                    value={draftDate}
                    onChange={(e) => setDraftDate(e.target.value)}
                    className="h-9 w-full rounded-xl border border-black/[0.1] dark:border-white/[0.14] bg-neutral-50 dark:bg-[#181C26] px-2.5 text-xs text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0066FF]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-neutral-500 dark:text-neutral-400 mb-1">
                    Mục tiêu (%)
                  </label>
                  <input
                    type="number"
                    min={50}
                    max={100}
                    value={draftTarget}
                    onChange={(e) => setDraftTarget(e.target.value)}
                    className="h-9 w-full rounded-xl border border-black/[0.1] dark:border-white/[0.14] bg-neutral-50 dark:bg-[#181C26] px-2.5 text-xs tabular-nums text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0066FF]"
                  />
                </div>
              </div>
              <div className="flex items-center justify-between gap-2">
                {examDate ? (
                  <button
                    type="button"
                    disabled={savingExam}
                    onClick={() => void handleClearExam()}
                    className="text-xs font-medium text-neutral-500 hover:text-rose-600 dark:text-neutral-400 dark:hover:text-[#FF6961] cursor-pointer"
                  >
                    Xóa ngày thi
                  </button>
                ) : (
                  <span />
                )}
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={savingExam}
                    onClick={() => setExamEditorOpen(false)}
                    className="h-8 rounded-lg px-2.5 text-xs font-medium text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-white/[0.08] cursor-pointer"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    disabled={savingExam}
                    className="h-8 rounded-lg bg-[#4F46E5] dark:bg-[#0A84FF] px-3 text-xs font-semibold text-white disabled:opacity-40 cursor-pointer"
                  >
                    {savingExam ? 'Đang lưu...' : 'Lưu'}
                  </button>
                </div>
              </div>
            </form>
          ) : (
            <div className="space-y-1.5">
              <div className="flex items-baseline justify-between gap-2">
                <div className="flex items-baseline gap-2">
                  <span className="text-[30px] font-bold font-heading leading-[1.15] tabular-nums tracking-tight text-neutral-900 dark:text-white">
                    {readiness
                      ? formatPercent(readiness.value)
                      : formatPercent(headline.mastery.value)}
                  </span>
                  {readiness && (
                    <span className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 tabular-nums">
                      {readiness.daysLeft > 0
                        ? `· còn ${readiness.daysLeft} ngày`
                        : readiness.daysLeft === 0
                          ? '· Hôm nay thi'
                          : '· Đã qua ngày thi'}
                    </span>
                  )}
                </div>

                {readiness ? (
                  <span
                    className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
                      METRIC_LABEL_META[readiness.label].badgeClass
                    }`}
                  >
                    {METRIC_LABEL_META[readiness.label].label}
                  </span>
                ) : (
                  headline.mastery.value !== null && (
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
                        METRIC_LABEL_META[headline.mastery.label].badgeClass
                      }`}
                    >
                      {METRIC_LABEL_META[headline.mastery.label].label}
                    </span>
                  )
                )}
              </div>

              <div className="flex items-center justify-between gap-2 text-xs text-neutral-500 dark:text-neutral-400 tabular-nums">
                <span className="truncate">
                  {readiness
                    ? readiness.projectedScore !== null
                      ? `Dự phóng ~${readiness.projectedScore}% (mục tiêu ${readiness.targetScore}%)`
                      : `Độ phủ nội dung ${readiness.coverageRate}%`
                    : headline.mastery.sectionsTotal > 0
                      ? `${headline.mastery.sectionsMastered}/${headline.mastery.sectionsTotal} mục đã vững`
                      : 'Chưa có dữ liệu mục tài liệu'}
                </span>
                {onUpdateExamGoal && (
                  <button
                    type="button"
                    onClick={() => {
                      setDraftDate(examDate ?? '');
                      setDraftTarget(String(targetScore ?? 85));
                      setExamEditorOpen(true);
                    }}
                    className="shrink-0 font-semibold text-[#4F46E5] dark:text-[#60A5FA] hover:underline cursor-pointer"
                  >
                    {examDate ? 'Sửa ngày thi' : '+ Đặt ngày thi'}
                  </button>
                )}
              </div>
            </div>
          )}
        </BentoCard>

        {/* Thẻ 2: Tỉ lệ nhớ đúng */}
        <BentoCard className="p-5 flex flex-col justify-between gap-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-500/12 text-emerald-600 dark:bg-[#30D158]/15 dark:text-[#30D158]">
                <Brain className="h-4 w-4" />
              </span>
              <span className="truncate text-[13px] font-medium text-neutral-600 dark:text-neutral-300">
                Tỉ lệ nhớ đúng
              </span>
            </div>
            <InfoPopoverTip
              label="Giải thích cách tính tỉ lệ nhớ đúng"
              content={retention.explanation}
            />
          </div>

          {isRetentionInsufficient ? (
            <div className="space-y-1.5 opacity-80">
              <p className="text-lg font-bold font-heading leading-[1.2] text-neutral-500 dark:text-neutral-400">
                Chưa đủ dữ liệu
              </p>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 tabular-nums leading-relaxed">
                Đã ôn {retention.sampleSize}/{retention.minSampleSize} lượt thẻ đã học (cần thêm{' '}
                {Math.max(0, retention.minSampleSize - retention.sampleSize)} lượt).
              </p>
            </div>
          ) : (
            <div className="space-y-1.5">
              <div className="flex items-baseline justify-between gap-2">
                <div className="flex items-baseline gap-2 tabular-nums">
                  <span className="text-[30px] font-bold font-heading leading-[1.15] tracking-tight text-neutral-900 dark:text-white">
                    {formatPercent(retention.value)}
                  </span>
                  {retentionDelta && (
                    <span
                      className={`text-xs font-semibold ${
                        (retention.deltaVsPrev ?? 0) >= 0
                          ? 'text-emerald-600 dark:text-[#30D158]'
                          : 'text-amber-600 dark:text-[#FFD60A]'
                      }`}
                    >
                      {retentionDelta}
                    </span>
                  )}
                </div>

                <span
                  className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${retentionLabelMeta.badgeClass}`}
                >
                  <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                  <span>{retentionLabelMeta.label}</span>
                </span>
              </div>

              <p className="text-xs text-neutral-500 dark:text-neutral-400 tabular-nums">
                Bạn nhớ đúng {formatPercent(retention.value)} trên {retention.sampleSize} lượt ôn (mục tiêu ~85%)
              </p>
            </div>
          )}
        </BentoCard>

        {/* Thẻ 3: Thói quen tuần này */}
        <BentoCard className="p-5 flex flex-col justify-between gap-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-amber-500/12 text-amber-600 dark:bg-amber-400/15 dark:text-[#FFD60A]">
                <Flame className="h-4 w-4" />
              </span>
              <span className="truncate text-[13px] font-medium text-neutral-600 dark:text-neutral-300">
                Thói quen tuần này
              </span>
            </div>
            <span className="text-xs font-semibold tabular-nums text-neutral-700 dark:text-neutral-200">
              {formatMinutes(habit.minutesThisWeek)}
            </span>
          </div>

          <div className="space-y-2">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-[24px] font-bold font-heading leading-[1.2] tabular-nums tracking-tight text-neutral-900 dark:text-white">
                {habit.daysStudiedThisWeek}/7 ngày học
              </span>
            </div>

            {/* 7 thanh mini */}
            <div
              className="grid grid-cols-7 gap-1.5"
              aria-label={`Hoạt động ${habit.daysStudiedThisWeek} trên 7 ngày gần nhất`}
            >
              {habit.weekDaysMask.map((active, idx) => (
                <div key={WEEK_DAY_FALLBACK[idx]} className="space-y-1 text-center">
                  <div
                    className={`h-2 w-full rounded-full transition-colors ${
                      active
                        ? 'bg-[#4F46E5] dark:bg-[#0A84FF]'
                        : 'bg-neutral-200/80 dark:bg-white/[0.08]'
                    }`}
                  />
                  <span className="block text-[10px] font-medium text-neutral-400 dark:text-neutral-500">
                    {WEEK_DAY_FALLBACK[idx]}
                  </span>
                </div>
              ))}
            </div>

            <p className="text-xs text-neutral-500 dark:text-neutral-400 tabular-nums">
              {habit.minutesLastWeek > 0
                ? `Tuần này: ${formatMinutes(habit.minutesThisWeek)} · Tuần trước: ${formatMinutes(
                    habit.minutesLastWeek
                  )}`
                : 'Duy trì đều đặn mỗi ngày vài phút giúp nhớ lâu hơn.'}
            </p>
          </div>
        </BentoCard>
      </div>

      {/* Dải nhận định nhanh (tối đa 3 câu, luôn có tích cực nếu có) */}
      {insights.length > 0 && (
        <div className="grid grid-cols-1 gap-2.5 md:grid-cols-3">
          {insights.map((ins) => {
            const isPositive = ins.tone === 'positive';
            const isFocus = ins.tone === 'focus';
            return (
              <div
                key={ins.ruleId}
                className={`flex items-start gap-2.5 rounded-2xl border px-3.5 py-2.5 text-xs leading-relaxed ${
                  isPositive
                    ? 'border-emerald-500/20 bg-emerald-50/70 text-emerald-900 dark:border-[#30D158]/25 dark:bg-[#30D158]/10 dark:text-emerald-200'
                    : isFocus
                      ? 'border-indigo-500/20 bg-indigo-50/60 text-indigo-950 dark:border-[#0A84FF]/25 dark:bg-[#0A84FF]/10 dark:text-blue-100'
                      : 'border-black/[0.05] bg-white text-neutral-700 dark:border-white/[0.08] dark:bg-[#12151C] dark:text-neutral-300'
                }`}
              >
                {isPositive ? (
                  <TrendingUp className="h-4 w-4 shrink-0 mt-0.5 text-emerald-600 dark:text-[#30D158]" />
                ) : isFocus ? (
                  <Sparkles className="h-4 w-4 shrink-0 mt-0.5 text-[#4F46E5] dark:text-[#60A5FA]" />
                ) : (
                  <Info className="h-4 w-4 shrink-0 mt-0.5 text-neutral-500 dark:text-neutral-400" />
                )}
                <span>{ins.message}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
