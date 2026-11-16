"use client";

import React from 'react';
import { LineChart } from 'lucide-react';
import type { BloomMasterySummary, QuizPerformanceSummary } from '@/types';
import {
  BLOOM_META_LABELS,
  formatPercent,
} from '@/components/analytics/analytics-helpers';
import { BentoCard } from '@/components/analytics/AnalyticsPrimitives';

export interface BloomAndQuizPanelProps {
  bloomMastery: BloomMasterySummary;
  quizPerformance: QuizPerformanceSummary;
}

export default function BloomAndQuizPanel({
  bloomMastery,
  quizPerformance,
}: BloomAndQuizPanelProps) {
  const hasBloomData = bloomMastery.levels.some((l) => l.totalAnswered > 0);
  const scores = quizPerformance.recentScores;

  // Xây dựng tọa độ biểu đồ SVG Sparkline (width=320, height=96)
  const svgPoints =
    scores.length > 0
      ? scores
          .map((item, idx) => {
            const x =
              scores.length === 1
                ? 160
                : 12 + (idx / (scores.length - 1)) * 296;
            const y = 84 - (Math.max(0, Math.min(100, item.scorePct)) / 100) * 68;
            return { x, y, item };
          })
      : [];

  const polylineStr = svgPoints.map((p) => `${p.x},${p.y}`).join(' ');

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
      {/* Thang đo nhận thức Bloom */}
      <BentoCard className="p-5 sm:p-6 lg:col-span-7 flex flex-col justify-between gap-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-[20px] font-bold font-heading tracking-tight text-neutral-900 dark:text-white leading-tight">
              Năng lực theo Thang đo Bloom
            </h2>
            <p className="mt-1 text-xs sm:text-[13px] text-neutral-500 dark:text-neutral-400 leading-relaxed">
              Độ chính xác trên câu hỏi mới nhất thuộc từng cấp độ tư duy.
            </p>
          </div>
          {bloomMastery.untaggedCount > 0 && (
            <span className="shrink-0 rounded-full border border-black/[0.06] dark:border-white/[0.08] bg-neutral-100/80 dark:bg-white/[0.06] px-2.5 py-1 text-[11px] font-medium tabular-nums text-neutral-500 dark:text-neutral-400">
              {bloomMastery.untaggedCount} câu cũ chưa gắn nhãn
            </span>
          )}
        </div>

        {!hasBloomData ? (
          <div className="rounded-2xl border border-dashed border-black/[0.08] dark:border-white/[0.1] bg-neutral-50/70 dark:bg-[#161A23] px-5 py-8 text-center text-xs text-neutral-500 dark:text-neutral-400">
            Hãy hoàn thành một bài kiểm tra AI có Thang đo Bloom để mở khóa biểu đồ 4 bậc tư duy.
          </div>
        ) : (
          <div className="space-y-3.5">
            {bloomMastery.levels.map((item) => {
              const meta = BLOOM_META_LABELS[item.level];
              const pct = item.accuracyRate ?? 0;

              return (
                <div key={item.level} className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-semibold text-neutral-800 dark:text-neutral-200">
                      {meta.label}
                    </span>
                    <div className="flex items-center gap-2 tabular-nums">
                      <span className="text-neutral-500 dark:text-neutral-400">
                        {item.totalAnswered > 0
                          ? `${item.correctCount} đúng / ${item.totalAnswered} câu`
                          : 'Chưa có câu hỏi'}
                      </span>
                      <span className="min-w-[40px] text-right font-bold text-neutral-900 dark:text-white">
                        {formatPercent(item.accuracyRate)}
                      </span>
                    </div>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-neutral-100 dark:bg-white/[0.06]">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${meta.barClass}`}
                      style={{
                        width: item.totalAnswered > 0 ? `${Math.max(4, pct)}%` : '0%',
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </BentoCard>

      {/* Xu hướng điểm Quiz gần đây */}
      <BentoCard className="p-5 sm:p-6 lg:col-span-5 flex flex-col justify-between gap-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-[20px] font-bold font-heading tracking-tight text-neutral-900 dark:text-white leading-tight">
              Xu hướng điểm kiểm tra
            </h2>
            <p className="mt-1 text-xs sm:text-[13px] text-neutral-500 dark:text-neutral-400 leading-relaxed">
              Tối đa 10 lần nộp bài gần nhất (%).
            </p>
          </div>
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-500/10 dark:bg-[#0A84FF]/15 text-[#4F46E5] dark:text-[#60A5FA]">
            <LineChart className="h-4.5 w-4.5" />
          </span>
        </div>

        {scores.length === 0 ? (
          <div className="flex flex-1 items-center justify-center rounded-2xl border border-dashed border-black/[0.08] dark:border-white/[0.1] bg-neutral-50/70 dark:bg-[#161A23] px-5 py-8 text-center text-xs text-neutral-500 dark:text-neutral-400">
            Chưa có lượt nộp bài kiểm tra nào để dựng biểu đồ xu hướng.
          </div>
        ) : (
          <div className="space-y-3">
            {/* SVG Trend Line */}
            <div className="rounded-2xl border border-black/[0.05] dark:border-white/[0.08] bg-neutral-50/80 dark:bg-[#181C26] p-3">
              <svg
                viewBox="0 0 320 96"
                className="w-full h-24 overflow-visible"
                role="img"
                aria-label="Biểu đồ xu hướng điểm Quiz"
              >
                <line
                  x1="8"
                  y1="50"
                  x2="312"
                  y2="50"
                  stroke="currentColor"
                  strokeDasharray="3 4"
                  className="text-neutral-300 dark:text-white/[0.1]"
                />
                {svgPoints.length > 1 && (
                  <polyline
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    points={polylineStr}
                    className="text-[#4F46E5] dark:text-[#0A84FF]"
                  />
                )}
                {svgPoints.map(({ x, y, item }) => (
                  <g key={item.attemptId}>
                    <circle
                      cx={x}
                      cy={y}
                      r={4}
                      className="fill-white dark:fill-[#12151C] stroke-[#4F46E5] dark:stroke-[#0A84FF]"
                      strokeWidth="2.2"
                    />
                    <text
                      x={x}
                      y={y - 9}
                      textAnchor="middle"
                      className="fill-neutral-700 dark:fill-neutral-200 text-[10px] font-semibold"
                    >
                      {Math.round(item.scorePct)}%
                    </text>
                  </g>
                ))}
              </svg>
            </div>

            {/* Latest 3 Attempts Quick List */}
            <div className="space-y-1.5">
              {scores
                .slice(-3)
                .reverse()
                .map((s) => (
                  <div
                    key={s.attemptId}
                    className="flex items-center justify-between gap-3 rounded-xl bg-neutral-50/90 dark:bg-[#161A23] px-3 py-2 text-xs"
                  >
                    <span className="truncate font-medium text-neutral-700 dark:text-neutral-300">
                      {s.quizTitle}
                    </span>
                    <span className="shrink-0 font-bold tabular-nums text-neutral-900 dark:text-white">
                      {Math.round(s.scorePct)}%
                    </span>
                  </div>
                ))}
            </div>
          </div>
        )}
      </BentoCard>
    </div>
  );
}
