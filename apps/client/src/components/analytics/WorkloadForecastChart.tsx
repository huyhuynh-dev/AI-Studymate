"use client";

import React, { useMemo, useState } from 'react';
import { CalendarDays } from 'lucide-react';
import type { WorkloadForecastDay } from '@/types';
import { BentoCard } from '@/components/analytics/AnalyticsPrimitives';

export interface WorkloadForecastChartProps {
  forecast: WorkloadForecastDay[];
}

export default function WorkloadForecastChart({
  forecast,
}: WorkloadForecastChartProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);

  const maxDue = useMemo(() => {
    const peak = Math.max(...forecast.map((d) => d.dueCount), 0);
    return Math.max(peak, 1);
  }, [forecast]);

  const total7Days = useMemo(
    () => forecast.reduce((sum, d) => sum + d.dueCount, 0),
    [forecast]
  );

  const selectedDay = forecast[selectedIndex] ?? forecast[0];

  return (
    <BentoCard className="p-5 sm:p-6 flex flex-col justify-between gap-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-[20px] font-bold font-heading tracking-tight text-neutral-900 dark:text-white leading-tight">
            Dự báo 7 ngày tới
          </h2>
          <p className="mt-1 text-xs sm:text-[13px] text-neutral-500 dark:text-neutral-400 leading-relaxed">
            Khối lượng thẻ Flashcard đến hạn theo lịch SM-2.
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-black/[0.06] dark:border-white/[0.08] bg-neutral-100/80 dark:bg-white/[0.06] px-2.5 py-1 text-[11px] font-semibold tabular-nums text-neutral-700 dark:text-neutral-300">
          <CalendarDays className="h-3.5 w-3.5 text-[#4F46E5] dark:text-[#60A5FA]" />
          <span>{total7Days} thẻ</span>
        </span>
      </div>

      {/* Selected Day Readout */}
      {selectedDay && (
        <div className="flex items-center justify-between rounded-2xl border border-black/[0.05] dark:border-white/[0.08] bg-neutral-50/90 dark:bg-[#181C26] px-4 py-3">
          <div>
            <p className="text-xs font-semibold text-neutral-900 dark:text-white">
              {selectedDay.label}
            </p>
            <p className="text-[11px] text-neutral-500 dark:text-neutral-400 tabular-nums">
              {selectedDay.date}
            </p>
          </div>
          <div className="text-right tabular-nums">
            <p className="text-base font-bold font-heading text-neutral-900 dark:text-white">
              {selectedDay.dueCount} thẻ
              {selectedDay.newCount > 0 && (
                <span className="ml-1.5 text-xs font-medium text-[#4F46E5] dark:text-[#60A5FA]">
                  ({selectedDay.newCount} mới)
                </span>
              )}
            </p>
            <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
              {selectedDay.estimatedMinutes > 0
                ? `Ước tính ~${selectedDay.estimatedMinutes} phút`
                : 'Không có thẻ đến hạn'}
            </p>
          </div>
        </div>
      )}

      {/* 7-Day Column Chart (Pure CSS + SVG aesthetic) */}
      <div className="grid grid-cols-7 gap-2 pt-2 items-end h-44">
        {forecast.map((day, idx) => {
          const heightPct =
            day.dueCount > 0
              ? Math.max(12, Math.round((day.dueCount / maxDue) * 100))
              : 4;
          const isSelected = idx === selectedIndex;

          return (
            <button
              key={day.date || idx}
              type="button"
              onClick={() => setSelectedIndex(idx)}
              onMouseEnter={() => setSelectedIndex(idx)}
              className="group flex h-full flex-col items-center justify-end gap-1.5 rounded-xl py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0066FF] cursor-pointer"
            >
              <span
                className={`text-[11px] font-semibold tabular-nums transition-colors ${
                  day.dueCount > 0
                    ? isSelected
                      ? 'text-neutral-900 dark:text-white'
                      : 'text-neutral-500 dark:text-neutral-400'
                    : 'text-neutral-300 dark:text-neutral-600'
                }`}
              >
                {day.dueCount}
              </span>

              <div className="flex w-full max-w-[34px] flex-1 items-end justify-center rounded-lg bg-neutral-100/80 dark:bg-white/[0.04] p-0.5 overflow-hidden">
                <div
                  className={`w-full rounded-[6px] transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                    day.dueCount === 0
                      ? 'bg-neutral-200/70 dark:bg-white/[0.08]'
                      : day.isToday
                        ? 'bg-[#4F46E5] dark:bg-[#0A84FF]'
                        : isSelected
                          ? 'bg-indigo-400 dark:bg-[#60A5FA]'
                          : 'bg-indigo-300/80 dark:bg-[#0A84FF]/45 group-hover:bg-indigo-400 dark:group-hover:bg-[#0A84FF]/70'
                  }`}
                  style={{ height: `${heightPct}%` }}
                />
              </div>

              <span
                className={`w-full truncate text-center text-[10.5px] font-medium tabular-nums ${
                  day.isToday
                    ? 'font-semibold text-[#4F46E5] dark:text-[#60A5FA]'
                    : isSelected
                      ? 'text-neutral-900 dark:text-white'
                      : 'text-neutral-500 dark:text-neutral-400'
                }`}
              >
                {day.isToday ? 'H.nay' : day.date.slice(8, 10) + '/' + day.date.slice(5, 7)}
              </span>
            </button>
          );
        })}
      </div>
    </BentoCard>
  );
}
