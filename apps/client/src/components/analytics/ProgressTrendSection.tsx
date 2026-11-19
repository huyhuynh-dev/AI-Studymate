"use client";

import React, { useMemo, useState } from 'react';
import { TrendingUp } from 'lucide-react';
import type { ProgressTrends, QuizPerformanceSummary } from '@/types';
import { BentoCard } from '@/components/analytics/AnalyticsPrimitives';
import {
  formatMinutes,
  formatPercent,
} from '@/components/analytics/analytics-helpers';

const WINDOW_OPTIONS = [7, 30, 90] as const;

export interface ProgressTrendSectionProps {
  progress: ProgressTrends;
  quizPerformance: QuizPerformanceSummary;
  windowDays: number;
  onWindowDaysChange: (days: number) => void;
}

export default function ProgressTrendSection({
  progress,
  quizPerformance,
  windowDays,
  onWindowDaysChange,
}: ProgressTrendSectionProps) {
  const [selectedIdx, setSelectedIdx] = useState<number>(() =>
    Math.max(0, progress.buckets.length - 1)
  );

  const buckets = progress.buckets;
  const maxMinutes = useMemo(() => {
    const peak = Math.max(...buckets.map((b) => b.minutesStudied), 0);
    return Math.max(peak, 10);
  }, [buckets]);

  const safeIdx = Math.min(selectedIdx, Math.max(0, buckets.length - 1));
  const activeBucket = buckets[safeIdx] ?? null;

  const chartPoints = useMemo(() => {
    const withRetention = buckets
      .map((b, idx) => ({
        idx,
        retention: b.retentionRate,
      }))
      .filter((p): p is { idx: number; retention: number } => p.retention !== null);

    if (buckets.length === 0 || withRetention.length === 0) return [];
    return withRetention.map((p) => {
      const x = ((p.idx + 0.5) / buckets.length) * 100;
      const y = 100 - Math.max(8, Math.min(92, p.retention));
      return { x, y, retention: p.retention };
    });
  }, [buckets]);

  const retentionPolyline = chartPoints.map((p) => `${p.x},${p.y}`).join(' ');

  return (
    <BentoCard className="p-5 sm:p-6 space-y-5">
      {/* Header + Bộ lọc thời gian nhất quán cho cả khối */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg sm:text-[20px] font-bold font-heading tracking-tight text-neutral-900 dark:text-white leading-[1.2]">
            Tiến bộ của bạn
          </h2>
          <p className="mt-1 text-xs sm:text-[13px] text-neutral-500 dark:text-neutral-400">
            Thời gian học trong {windowDays} ngày qua và mức tăng điểm khi làm lại bài kiểm tra.
          </p>
        </div>

        <div
          role="group"
          aria-label="Khoảng thời gian theo dõi tiến bộ"
          className="inline-flex rounded-xl bg-neutral-100/90 dark:bg-white/[0.06] p-1 border border-black/[0.04] dark:border-white/[0.06] self-start sm:self-auto"
        >
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
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        {/* Trái: Phút học & Tỉ lệ nhớ trong khoảng thời gian đã chọn */}
        <div className="lg:col-span-7 flex flex-col justify-between gap-3 rounded-2xl border border-black/[0.05] dark:border-white/[0.08] bg-neutral-50/70 dark:bg-[#161A23] p-4">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="font-semibold text-neutral-800 dark:text-neutral-200">
              Tổng cộng: {formatMinutes(progress.totalMinutesInWindow)}
            </span>
            {activeBucket && (
              <span className="tabular-nums text-neutral-600 dark:text-neutral-300">
                Mốc {activeBucket.label}: <strong>{formatMinutes(activeBucket.minutesStudied)}</strong>
                {activeBucket.retentionRate !== null
                  ? ` · Nhớ đúng ${activeBucket.retentionRate}%`
                  : ''}
              </span>
            )}
          </div>

          {buckets.length === 0 ? (
            <div className="py-10 text-center text-xs text-neutral-500 dark:text-neutral-400">
              Chưa có hoạt động học trong {windowDays} ngày qua.
            </div>
          ) : (
            <div className="space-y-2">
              <div className="relative pt-3 h-40">
                {chartPoints.length > 0 && (
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-x-0 top-3 bottom-6"
                  >
                    {chartPoints.length > 1 && (
                      <svg
                        viewBox="0 0 100 100"
                        preserveAspectRatio="none"
                        className="h-full w-full overflow-visible"
                      >
                        <polyline
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.6"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          vectorEffect="non-scaling-stroke"
                          points={retentionPolyline}
                          className="text-emerald-500/80 dark:text-[#30D158]/80"
                        />
                      </svg>
                    )}
                    {chartPoints.map((pt, i) => (
                      <span
                        key={i}
                        style={{ left: `${pt.x}%`, top: `${pt.y}%` }}
                        className="absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-emerald-600 dark:border-[#30D158] bg-white dark:bg-[#161A23]"
                      />
                    ))}
                  </div>
                )}

                <div
                  className="relative z-10 grid gap-2 items-end h-full"
                  style={{
                    gridTemplateColumns: `repeat(${buckets.length}, minmax(0, 1fr))`,
                  }}
                >
                  {buckets.map((bucket, idx) => {
                    const heightPct =
                      bucket.minutesStudied > 0
                        ? Math.max(10, Math.round((bucket.minutesStudied / maxMinutes) * 100))
                        : 0;
                    const isSelected = idx === safeIdx;

                    return (
                      <button
                        key={bucket.bucketKey || idx}
                        type="button"
                        onClick={() => setSelectedIdx(idx)}
                        onMouseEnter={() => setSelectedIdx(idx)}
                        className="group flex h-full flex-col items-center justify-end gap-1.5 rounded-xl py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0066FF] cursor-pointer"
                      >
                        <span className="text-[10.5px] font-semibold tabular-nums text-neutral-500 dark:text-neutral-400">
                          {bucket.minutesStudied > 0 ? `${bucket.minutesStudied}p` : '0'}
                        </span>

                        <div className="flex w-full max-w-[36px] flex-1 items-end justify-center rounded-lg bg-neutral-200/60 dark:bg-white/[0.04] p-0.5 overflow-hidden">
                          <div
                            className={`w-full rounded-[6px] transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none ${
                              bucket.minutesStudied === 0
                                ? 'h-1 bg-neutral-300/70 dark:bg-white/[0.08]'
                                : isSelected
                                  ? 'bg-[#4F46E5] dark:bg-[#0A84FF]'
                                  : 'bg-indigo-400/80 dark:bg-[#0A84FF]/55 group-hover:bg-[#4F46E5] dark:group-hover:bg-[#0A84FF]'
                            }`}
                            style={
                              bucket.minutesStudied > 0
                                ? { height: `${heightPct}%` }
                                : undefined
                            }
                          />
                        </div>

                        <span
                          className={`w-full truncate text-center text-[10.5px] font-medium tabular-nums ${
                            isSelected
                              ? 'font-semibold text-neutral-900 dark:text-white'
                              : 'text-neutral-500 dark:text-neutral-400'
                          }`}
                        >
                          {bucket.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-4 text-[11px] text-neutral-500 dark:text-neutral-400">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-xs bg-[#4F46E5] dark:bg-[#0A84FF]" />
                  <span>Phút học (cột)</span>
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-0.5 w-3.5 rounded-full bg-emerald-500 dark:bg-[#30D158]" />
                  <span>Tỉ lệ nhớ đúng (đường)</span>
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Phải: Tiến bộ khi làm lại cùng một bài kiểm tra */}
        <div className="lg:col-span-5 flex flex-col justify-between gap-3 rounded-2xl border border-black/[0.05] dark:border-white/[0.08] bg-neutral-50/70 dark:bg-[#161A23] p-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold text-neutral-900 dark:text-white">
                Tiến bộ khi làm lại kiểm tra
              </h3>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                So sánh lần đầu và lần gần nhất trên cùng một đề.
              </p>
            </div>
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:bg-[#30D158]/15 dark:text-[#30D158]">
              <TrendingUp className="h-4 w-4" />
            </span>
          </div>

          {progress.quizRetakeGains.length > 0 ? (
            <div className="space-y-2">
              {progress.quizRetakeGains.slice(0, 4).map((item) => {
                const isUp = item.gainPct > 0;
                return (
                  <div
                    key={item.quizId}
                    className="flex items-center justify-between gap-3 rounded-xl bg-white dark:bg-[#1C212E] border border-black/[0.04] dark:border-white/[0.06] px-3 py-2.5 text-xs"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-neutral-800 dark:text-neutral-100">
                        {item.quizTitle}
                      </p>
                      <p className="text-[11px] text-neutral-500 dark:text-neutral-400 tabular-nums">
                        {item.attemptsCount} lượt · {item.firstScorePct}% → {item.latestScorePct}%
                      </p>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold tabular-nums ${
                        isUp
                          ? 'bg-emerald-500/12 text-emerald-700 dark:bg-[#30D158]/15 dark:text-[#30D158]'
                          : 'bg-neutral-100 text-neutral-600 dark:bg-white/[0.06] dark:text-neutral-300'
                      }`}
                    >
                      {isUp ? `▲ +${Math.round(item.gainPct)}%` : `${Math.round(item.gainPct)}%`}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : quizPerformance.recentScores.length > 0 ? (
            <div className="space-y-2">
              <p className="text-[11.5px] text-neutral-500 dark:text-neutral-400">
                Điểm gần đây (làm lại cùng một đề để đo mức tiến bộ thật):
              </p>
              {quizPerformance.recentScores
                .slice(-3)
                .reverse()
                .map((s) => (
                  <div
                    key={s.attemptId}
                    className="flex items-center justify-between gap-3 rounded-xl bg-white dark:bg-[#1C212E] border border-black/[0.04] dark:border-white/[0.06] px-3 py-2 text-xs"
                  >
                    <span className="truncate font-medium text-neutral-700 dark:text-neutral-300">
                      {s.quizTitle}
                    </span>
                    <span className="shrink-0 font-bold tabular-nums text-neutral-900 dark:text-white">
                      {formatPercent(s.scorePct)}
                    </span>
                  </div>
                ))}
            </div>
          ) : (
            <div className="flex flex-1 items-center justify-center py-6 text-center text-xs text-neutral-500 dark:text-neutral-400">
              Chưa có bài kiểm tra nào được nộp.
            </div>
          )}
        </div>
      </div>
    </BentoCard>
  );
}
