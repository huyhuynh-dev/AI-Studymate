"use client";

import React, { useState } from 'react';
import {
  CheckCircle2,
  ChevronRight,
  Flame,
  Play,
  SlidersHorizontal,
  Sparkles,
} from 'lucide-react';
import type {
  StudyRecommendation,
  TodayPlanTask,
  TodayStudyPlan,
} from '@/types';
import { BentoCard } from '@/components/analytics/AnalyticsPrimitives';
import { formatMinutes } from '@/components/analytics/analytics-helpers';

const GOAL_PRESETS = [10, 15, 20, 30, 45] as const;

export interface TodayCoachHeroProps {
  todayPlan: TodayStudyPlan;
  streakDays: number;
  studiedToday: boolean;
  onExecuteTask: (rec: StudyRecommendation) => void;
  onUpdateDailyGoal?: (minutes: number) => Promise<void>;
  onGoToDocuments?: () => void;
}

function toRecommendationFromTask(task: TodayPlanTask): StudyRecommendation {
  return {
    id: task.id,
    priority: task.order === 1 ? 'high' : 'medium',
    actionType: task.actionType,
    title: task.title,
    reason: task.subtitle,
    actionLabel: task.actionLabel,
    payload: task.payload,
  };
}

export default function TodayCoachHero({
  todayPlan,
  streakDays,
  studiedToday,
  onExecuteTask,
  onUpdateDailyGoal,
  onGoToDocuments,
}: TodayCoachHeroProps) {
  const [goalPickerOpen, setGoalPickerOpen] = useState(false);
  const [savingGoal, setSavingGoal] = useState(false);

  const primaryTask = todayPlan.tasks[0] ?? null;
  const secondaryTasks = todayPlan.tasks.slice(1);

  const goalMinutes = Math.max(5, todayPlan.dailyGoalMinutes || 15);
  const doneMinutes = Math.max(0, todayPlan.minutesDoneToday);
  const progressRatio = Math.min(1, doneMinutes / goalMinutes);
  const radius = 38;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - progressRatio);
  const isGoalCompleted = doneMinutes >= goalMinutes;

  const handleSelectGoal = async (minutes: number) => {
    if (!onUpdateDailyGoal) return;
    setSavingGoal(true);
    try {
      await onUpdateDailyGoal(minutes);
      setGoalPickerOpen(false);
    } finally {
      setSavingGoal(false);
    }
  };

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
      {/* Cột trái: Kế hoạch hôm nay + 1 nút Primary CTA */}
      <BentoCard className="p-5 sm:p-6 lg:col-span-8 flex flex-col justify-between gap-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[#4F46E5] dark:text-[#818CF8]">
              Hôm nay
            </span>
            <h2 className="mt-1 text-xl sm:text-[22px] font-bold font-heading tracking-tight text-neutral-900 dark:text-[#EFF0F6] leading-[1.2]">
              {primaryTask
                ? `Hôm nay bạn nên làm (khoảng ${formatMinutes(
                    todayPlan.totalEstimatedMinutes
                  )})`
                : 'Bạn đã hoàn thành các việc cần ôn hôm nay'}
            </h2>
          </div>

          {primaryTask && (
            <button
              type="button"
              onClick={() => onExecuteTask(toRecommendationFromTask(primaryTask))}
              className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-primary hover:bg-primary-hover px-5 text-sm font-semibold text-white shadow-xs dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.18)] transition-all duration-200 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-[#161922] cursor-pointer"
            >
              <Play className="h-4 w-4 fill-current" aria-hidden="true" />
              <span>Bắt đầu ngay</span>
            </button>
          )}
        </div>

        {!primaryTask ? (
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-2xl border border-emerald-500/20 dark:border-emerald-500/25 bg-emerald-50/70 dark:bg-emerald-500/[0.09] px-4 py-4">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-neutral-900 dark:text-[#EFF0F6]">
                  Tiến độ rất ổn định!
                </p>
                <p className="mt-0.5 text-xs text-neutral-600 dark:text-[#9DA3AF] leading-relaxed">
                  Không có thẻ đến hạn hay mục cấp bách nào lúc này. Bạn có thể đọc tiếp tài liệu mới hoặc làm thêm bài kiểm tra.
                </p>
              </div>
            </div>
            {onGoToDocuments && (
              <button
                type="button"
                onClick={onGoToDocuments}
                className="inline-flex h-9 shrink-0 items-center gap-1 rounded-xl border border-black/[0.08] dark:border-white/[0.12] bg-white dark:bg-white/[0.06] px-3.5 text-xs font-semibold text-neutral-800 dark:text-[#EFF0F6] hover:bg-neutral-50 dark:hover:bg-white/[0.1] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary transition-all cursor-pointer"
              >
                <span>Mở tài liệu</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-2.5">
            {/* Bước #1 nổi bật */}
            <div
              role="button"
              tabIndex={0}
              onClick={() => onExecuteTask(toRecommendationFromTask(primaryTask))}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onExecuteTask(toRecommendationFromTask(primaryTask));
                }
              }}
              className="flex items-center justify-between gap-3 rounded-2xl border border-indigo-500/20 dark:border-indigo-400/25 bg-indigo-50/60 dark:bg-indigo-500/[0.08] px-4 py-3.5 hover:border-indigo-500/40 dark:hover:border-indigo-400/45 dark:hover:bg-indigo-500/[0.12] active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary transition-all cursor-pointer"
            >
              <div className="flex items-start gap-3 min-w-0">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-white tabular-nums mt-0.5">
                  1
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-neutral-900 dark:text-[#EFF0F6] leading-snug">
                    {primaryTask.title}
                  </p>
                  <p className="mt-0.5 text-xs text-neutral-600 dark:text-[#9DA3AF] line-clamp-1">
                    {primaryTask.subtitle}
                  </p>
                </div>
              </div>
              <span className="shrink-0 text-xs font-semibold tabular-nums text-[#4F46E5] dark:text-[#A5B4FC]">
                ~{formatMinutes(primaryTask.estimatedMinutes)}
              </span>
            </div>

            {/* Bước #2 & #3 nhẹ nhàng */}
            {secondaryTasks.map((task) => (
              <div
                key={task.id}
                className="flex items-center justify-between gap-3 rounded-2xl border border-black/[0.05] dark:border-white/[0.08] bg-neutral-50/70 dark:bg-white/[0.035] px-4 py-2.5"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-neutral-200/80 dark:bg-white/[0.08] text-xs font-semibold text-neutral-700 dark:text-[#EFF0F6] tabular-nums">
                    {task.order}
                  </span>
                  <p className="truncate text-[13px] font-medium text-neutral-800 dark:text-[#EFF0F6]">
                    {task.title}
                  </p>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <span className="hidden sm:inline text-xs tabular-nums text-neutral-500 dark:text-[#9DA3AF]">
                    ~{formatMinutes(task.estimatedMinutes)}
                  </span>
                  <button
                    type="button"
                    onClick={() => onExecuteTask(toRecommendationFromTask(task))}
                    className="inline-flex h-8 items-center gap-0.5 rounded-lg px-2 text-xs font-semibold text-[#4F46E5] dark:text-[#818CF8] hover:bg-indigo-500/10 dark:hover:bg-indigo-500/[0.14] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary transition-colors cursor-pointer"
                  >
                    <span>{task.actionLabel}</span>
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {todayPlan.gentleCatchupSuggestion && (
          <div className="flex items-start gap-2.5 rounded-2xl border border-amber-500/20 dark:border-amber-400/25 bg-amber-50/70 dark:bg-amber-500/[0.09] px-3.5 py-2.5 text-xs text-amber-800 dark:text-amber-200 leading-relaxed">
            <Sparkles className="h-4 w-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
            <span>{todayPlan.gentleCatchupSuggestion}</span>
          </div>
        )}
      </BentoCard>

      {/* Cột phải: Vòng mục tiêu hôm nay + Chuỗi ngày nhẹ nhàng */}
      <BentoCard className="p-5 sm:p-6 lg:col-span-4 flex flex-col justify-between gap-4">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[13px] font-semibold text-neutral-700 dark:text-[#EFF0F6]">
            Mục tiêu hôm nay
          </span>
          {onUpdateDailyGoal && (
            <button
              type="button"
              onClick={() => setGoalPickerOpen((prev) => !prev)}
              disabled={savingGoal}
              className="inline-flex h-7 items-center gap-1 rounded-lg px-2 text-[11.5px] font-medium text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800 dark:text-[#9DA3AF] dark:hover:bg-white/[0.08] dark:hover:text-[#EFF0F6] disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary transition-colors cursor-pointer"
            >
              <SlidersHorizontal className="h-3 w-3" />
              <span>Đổi mục tiêu</span>
            </button>
          )}
        </div>

        {goalPickerOpen && onUpdateDailyGoal ? (
          <div className="rounded-2xl border border-black/[0.06] dark:border-white/[0.08] bg-neutral-50/90 dark:bg-[#1D212B]/80 p-3 space-y-2.5">
            <p className="text-xs font-medium text-neutral-600 dark:text-[#9DA3AF]">
              Chọn số phút mục tiêu mỗi ngày:
            </p>
            <div className="grid grid-cols-5 gap-1.5">
              {GOAL_PRESETS.map((preset) => {
                const selected = preset === goalMinutes;
                return (
                  <button
                    key={preset}
                    type="button"
                    disabled={savingGoal}
                    onClick={() => void handleSelectGoal(preset)}
                    className={`h-9 rounded-xl text-xs font-semibold tabular-nums transition-all active:scale-[0.97] disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary cursor-pointer ${
                      selected
                        ? 'bg-primary text-white shadow-xs dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.18)]'
                        : 'bg-white dark:bg-[#242938] text-neutral-700 dark:text-[#EFF0F6] border border-black/[0.06] dark:border-white/[0.08] hover:border-indigo-500/40 dark:hover:border-indigo-400/40'
                    }`}
                  >
                    {preset}p
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-4 py-1">
            <div className="relative flex h-24 w-24 shrink-0 items-center justify-center">
              <svg
                viewBox="0 0 96 96"
                className="h-24 w-24 -rotate-90"
                role="img"
                aria-label={`Đã học ${doneMinutes} trên mục tiêu ${goalMinutes} phút hôm nay`}
              >
                <circle
                  cx="48"
                  cy="48"
                  r={radius}
                  fill="none"
                  strokeWidth="9"
                  className="stroke-neutral-100 dark:stroke-white/[0.08]"
                />
                <circle
                  cx="48"
                  cy="48"
                  r={radius}
                  fill="none"
                  strokeWidth="9"
                  strokeLinecap="round"
                  strokeDasharray={circumference}
                  strokeDashoffset={dashOffset}
                  className={`transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none ${
                    isGoalCompleted
                      ? 'stroke-emerald-500 dark:stroke-[#10B981]'
                      : 'stroke-[#4F46E5] dark:stroke-[#6366F1]'
                  }`}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center tabular-nums">
                <span className="text-lg font-bold font-heading leading-none text-neutral-900 dark:text-[#EFF0F6]">
                  {doneMinutes}
                </span>
                <span className="mt-0.5 text-[10.5px] font-medium text-neutral-500 dark:text-[#9DA3AF]">
                  / {goalMinutes} phút
                </span>
              </div>
            </div>

            <div className="min-w-0 space-y-1">
              <p className="text-sm font-semibold text-neutral-900 dark:text-[#EFF0F6]">
                {isGoalCompleted
                  ? 'Đạt mục tiêu hôm nay!'
                  : `Còn ${Math.max(0, goalMinutes - doneMinutes)} phút nữa`}
              </p>
              <p className="text-xs text-neutral-500 dark:text-[#9DA3AF] leading-relaxed">
                {isGoalCompleted
                  ? 'Rất tốt — bạn đã hoàn thành nhịp học đặt ra cho hôm nay.'
                  : 'Tính từ thời gian ôn thẻ và làm bài kiểm tra trong ngày.'}
              </p>
            </div>
          </div>
        )}

        {/* Thanh chuỗi ngày nhẹ nhàng */}
        <div className="flex items-center justify-between gap-2 rounded-2xl border border-black/[0.05] dark:border-white/[0.08] bg-neutral-50/80 dark:bg-white/[0.035] px-3.5 py-2.5">
          <div className="flex items-center gap-2 min-w-0">
            <span
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
                studiedToday || streakDays > 0
                  ? 'bg-amber-500/12 text-amber-600 dark:bg-amber-500/[0.14] dark:text-amber-400'
                  : 'bg-neutral-200/70 text-neutral-500 dark:bg-white/[0.06] dark:text-[#9DA3AF]'
              }`}
            >
              <Flame className="h-4 w-4" />
            </span>
            <span className="truncate text-xs font-semibold text-neutral-800 dark:text-[#EFF0F6] tabular-nums">
              {streakDays > 0
                ? `${streakDays} ngày liên tục`
                : 'Bắt đầu nhịp học hôm nay'}
            </span>
          </div>
          <span className="shrink-0 text-[11px] font-medium text-neutral-500 dark:text-[#9DA3AF]">
            {studiedToday ? 'Đã học hôm nay' : '5 phút là đủ'}
          </span>
        </div>
      </BentoCard>
    </div>
  );
}
