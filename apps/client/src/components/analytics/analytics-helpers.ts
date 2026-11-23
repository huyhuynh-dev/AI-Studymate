import type {
  AnalyticsBloomLevel,
  BloomMasteryItem,
  MasteryStatus,
  MetricStatusLabel,
} from '@/types';

export const MIN_RETENTION_SAMPLE = 20;
export const MIN_BLOOM_SAMPLE = 5;
export const MIN_RATING_DIST_SAMPLE = 50;

export interface MasteryStatusVisual {
  label: string;
  shortLabel: string;
  dotClass: string;
  barClass: string;
  stripClass: string;
  badgeClass: string;
  tileClass: string;
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
    tileClass:
      'bg-neutral-200/80 hover:bg-neutral-300 dark:bg-white/[0.1] dark:hover:bg-white/[0.2]',
  },
  weak: {
    label: 'Nên ôn lại',
    shortLabel: 'Cần ôn',
    dotClass: 'bg-rose-500 dark:bg-rose-400',
    barClass: 'bg-rose-500 dark:bg-rose-400',
    stripClass: 'bg-rose-500 dark:bg-rose-400',
    badgeClass:
      'bg-rose-500/10 text-rose-700 border-rose-500/20 dark:bg-rose-500/[0.14] dark:text-rose-400 dark:border-rose-500/25',
    tileClass:
      'bg-rose-400/80 hover:bg-rose-500 dark:bg-rose-500/70 dark:hover:bg-rose-400',
  },
  developing: {
    label: 'Đang củng cố',
    shortLabel: 'Trung bình',
    dotClass: 'bg-amber-500 dark:bg-amber-400',
    barClass: 'bg-amber-500 dark:bg-amber-400',
    stripClass: 'bg-amber-500 dark:bg-amber-400',
    badgeClass:
      'bg-amber-500/10 text-amber-700 border-amber-500/20 dark:bg-amber-500/[0.14] dark:text-amber-300 dark:border-amber-400/25',
    tileClass:
      'bg-amber-400/85 hover:bg-amber-500 dark:bg-amber-400/70 dark:hover:bg-amber-400',
  },
  mastered: {
    label: 'Đã vững',
    shortLabel: 'Vững',
    dotClass: 'bg-emerald-500 dark:bg-emerald-400',
    barClass: 'bg-emerald-500 dark:bg-emerald-400',
    stripClass: 'bg-emerald-500 dark:bg-emerald-400',
    badgeClass:
      'bg-emerald-500/10 text-emerald-700 border-emerald-500/20 dark:bg-emerald-500/[0.14] dark:text-emerald-400 dark:border-emerald-500/25',
    tileClass:
      'bg-emerald-500/85 hover:bg-emerald-500 dark:bg-emerald-500/75 dark:hover:bg-emerald-400',
  },
};

export const METRIC_LABEL_META: Record<
  MetricStatusLabel,
  { label: string; badgeClass: string }
> = {
  good: {
    label: 'Tốt',
    badgeClass:
      'bg-emerald-500/10 text-emerald-700 border-emerald-500/20 dark:bg-emerald-500/[0.14] dark:text-emerald-400 dark:border-emerald-500/25',
  },
  ok: {
    label: 'Ổn',
    badgeClass:
      'bg-indigo-500/10 text-[#4F46E5] border-indigo-500/20 dark:bg-indigo-500/[0.14] dark:text-[#818CF8] dark:border-indigo-400/25',
  },
  needs_work: {
    label: 'Cần cải thiện',
    badgeClass:
      'bg-amber-500/10 text-amber-700 border-amber-500/20 dark:bg-amber-500/[0.14] dark:text-amber-300 dark:border-amber-400/25',
  },
  insufficient_data: {
    label: 'Chưa đủ dữ liệu',
    badgeClass:
      'bg-neutral-100 text-neutral-600 border-neutral-200/80 dark:bg-white/[0.06] dark:text-[#9DA3AF] dark:border-white/[0.08]',
  },
};

export const BLOOM_META_LABELS: Record<
  AnalyticsBloomLevel,
  { label: string; short: string; barClass: string }
> = {
  remember: {
    label: 'Ghi nhớ',
    short: 'Ghi nhớ',
    barClass: 'bg-slate-500 dark:bg-slate-400',
  },
  understand: {
    label: 'Hiểu',
    short: 'Hiểu',
    barClass: 'bg-[#4F46E5] dark:bg-[#6366F1]',
  },
  apply: {
    label: 'Vận dụng',
    short: 'Vận dụng',
    barClass: 'bg-amber-500 dark:bg-amber-400',
  },
  analyze: {
    label: 'Phân tích',
    short: 'Phân tích',
    barClass: 'bg-[#571AC0] dark:bg-[#8B5CF6]',
  },
};

export function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return '—';
  }
  return `${Math.round(value)}%`;
}

export function formatMinutes(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined || !Number.isFinite(minutes)) {
    return '0 phút';
  }
  const rounded = Math.max(0, Math.round(minutes));
  return `${rounded} phút`;
}

export function formatDeltaPct(delta: number | null | undefined): string | null {
  if (delta === null || delta === undefined || !Number.isFinite(delta)) {
    return null;
  }
  const rounded = Math.round(delta);
  if (rounded === 0) return null;
  return rounded > 0 ? `▲ +${rounded}%` : `▼ ${rounded}%`;
}

/**
 * @deprecated Dùng formatMinutes để hiển thị thời gian theo ngữ cảnh người học.
 */
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

export function formatDayShortLabel(dateStr: string): string {
  if (!dateStr) return '—';
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateStr);
  if (match) {
    return `${match[3]}/${match[2]}`;
  }
  const parsed = new Date(dateStr);
  if (Number.isNaN(parsed.getTime())) return dateStr;
  const dd = String(parsed.getUTCDate()).padStart(2, '0');
  const mm = String(parsed.getUTCMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}`;
}

export function buildPlainBloomSentence(levels: BloomMasteryItem[]): string {
  const reliable = levels.filter(
    (l) => l.totalAnswered >= MIN_BLOOM_SAMPLE && l.accuracyRate !== null
  );
  if (reliable.length === 0) {
    return 'Cần ít nhất 5 câu hỏi ở mỗi kiểu câu để đánh giá chính xác điểm mạnh và điểm cần luyện thêm.';
  }
  const sorted = [...reliable].sort(
    (a, b) => (b.accuracyRate ?? 0) - (a.accuracyRate ?? 0)
  );
  const strongest = sorted[0];
  const weakest = sorted[sorted.length - 1];
  if (
    sorted.length >= 2 &&
    (strongest.accuracyRate ?? 0) - (weakest.accuracyRate ?? 0) >= 15
  ) {
    return `Bạn làm tốt câu hỏi ${BLOOM_META_LABELS[strongest.level].label.toLowerCase()} (${Math.round(
      strongest.accuracyRate ?? 0
    )}%) nhưng nên luyện thêm câu ${BLOOM_META_LABELS[weakest.level].label.toLowerCase()} (${Math.round(
      weakest.accuracyRate ?? 0
    )}%).`;
  }
  return `Kết quả khá đồng đều — nổi bật nhất là dạng câu ${BLOOM_META_LABELS[strongest.level].label.toLowerCase()} (${Math.round(
    strongest.accuracyRate ?? 0
  )}%).`;
}
