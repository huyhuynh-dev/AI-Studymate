import type { AnalyticsBloomLevel, MasteryStatus } from '@/types';

export interface MasteryStatusVisual {
  label: string;
  shortLabel: string;
  dotClass: string;
  barClass: string;
  stripClass: string;
  badgeClass: string;
}

export const MASTERY_STATUS_META: Record<MasteryStatus, MasteryStatusVisual> = {
  unstudied: {
    label: 'Chưa học',
    shortLabel: 'Chưa ôn',
    dotClass: 'bg-neutral-400 dark:bg-neutral-500',
    barClass: 'bg-neutral-300 dark:bg-neutral-600',
    stripClass: 'bg-neutral-300 dark:bg-neutral-700',
    badgeClass:
      'bg-neutral-100 text-neutral-600 border-neutral-200/80 dark:bg-white/[0.06] dark:text-neutral-300 dark:border-white/[0.08]',
  },
  weak: {
    label: 'Cần học lại',
    shortLabel: 'Yếu',
    dotClass: 'bg-[#FF453A]',
    barClass: 'bg-[#FF453A]',
    stripClass: 'bg-[#FF453A]',
    badgeClass:
      'bg-rose-500/10 text-rose-700 border-rose-500/20 dark:bg-[#FF453A]/15 dark:text-[#FF6961] dark:border-[#FF453A]/25',
  },
  developing: {
    label: 'Đang củng cố',
    shortLabel: 'Trung bình',
    dotClass: 'bg-amber-500',
    barClass: 'bg-amber-500',
    stripClass: 'bg-amber-500',
    badgeClass:
      'bg-amber-500/10 text-amber-700 border-amber-500/20 dark:bg-amber-400/15 dark:text-amber-300 dark:border-amber-400/25',
  },
  mastered: {
    label: 'Đã vững',
    shortLabel: 'Vững',
    dotClass: 'bg-[#30D158]',
    barClass: 'bg-[#30D158]',
    stripClass: 'bg-[#30D158]',
    badgeClass:
      'bg-emerald-500/10 text-emerald-700 border-emerald-500/20 dark:bg-[#30D158]/15 dark:text-[#30D158] dark:border-[#30D158]/25',
  },
};

export const BLOOM_META_LABELS: Record<
  AnalyticsBloomLevel,
  { label: string; short: string; barClass: string }
> = {
  remember: {
    label: 'Ghi nhớ (Remember)',
    short: 'Nhớ',
    barClass: 'bg-slate-500 dark:bg-slate-400',
  },
  understand: {
    label: 'Thông hiểu (Understand)',
    short: 'Hiểu',
    barClass: 'bg-[#0066FF] dark:bg-[#0A84FF]',
  },
  apply: {
    label: 'Vận dụng (Apply)',
    short: 'Vận dụng',
    barClass: 'bg-amber-500 dark:bg-[#FFD60A]',
  },
  analyze: {
    label: 'Phân tích (Analyze)',
    short: 'Phân tích',
    barClass: 'bg-indigo-600 dark:bg-[#818CF8]',
  },
};

export function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return '—';
  }
  return `${Math.round(value)}%`;
}

export function formatResponseSeconds(ms: number | null | undefined): string {
  if (!ms || !Number.isFinite(ms) || ms <= 0) return '—';
  return `${(ms / 1000).toFixed(1)}s/thẻ`;
}

export function formatPageRange(
  startPage: number | null,
  endPage: number | null
): string {
  if (startPage === null) return 'Chưa rõ trang';
  if (endPage && endPage > startPage) return `Tr. ${startPage}–${endPage}`;
  return `Tr. ${startPage}`;
}
