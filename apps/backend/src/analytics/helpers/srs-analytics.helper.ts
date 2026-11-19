import { parseSourceRefs } from '../../common/types/source-ref.types.js';
import { stripHtml } from '../../common/utils/text.utils.js';
import { CardStateEnum } from '../../generated/prisma/client.js';
import type {
  AnalyticsFlashcardRow,
  AnalyticsQuizAttemptRow,
  AnalyticsReviewLogRow,
} from '../../repo/analytics-repo/analytics-repo.service.js';
import type {
  AdvancedAnalyticsBreakdown,
  LeechCardItem,
  MetricStatusLabel,
  MetricWithContext,
  ProgressBucketPoint,
  SrsOverviewStats,
  WorkloadForecastDay,
} from '../analytics.types.js';

export const DEFAULT_TZ_OFFSET_MINUTES = 420; // UTC+7 (Việt Nam)
export const MIN_VALID_REVIEW_MS = 300;
export const MAX_CAPPED_REVIEW_MS = 60_000;
export const MIN_RETENTION_SAMPLE = 20;
const MS_PER_MINUTE = 60_000;
const MS_PER_DAY = 86_400_000;
const DAY_LABELS_VI = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'] as const;

export function computeLocalDateKey(
  date: Date,
  tzOffsetMinutes = DEFAULT_TZ_OFFSET_MINUTES,
): string {
  const shifted = new Date(date.getTime() + tzOffsetMinutes * MS_PER_MINUTE);
  return shifted.toISOString().slice(0, 10);
}

export function shiftDateKey(dateKey: string, deltaDays: number): string {
  const baseMs = Date.parse(`${dateKey}T00:00:00.000Z`);
  return new Date(baseMs + deltaDays * MS_PER_DAY).toISOString().slice(0, 10);
}

export interface StudyStreakMetrics {
  currentStreakDays: number;
  longestStreakDays: number;
  studiedToday: boolean;
  activeDaysLast30: number;
}

export function computeStudyStreak(
  activityTimestamps: Date[],
  now = new Date(),
  tzOffsetMinutes = DEFAULT_TZ_OFFSET_MINUTES,
): StudyStreakMetrics {
  if (activityTimestamps.length === 0) {
    return {
      currentStreakDays: 0,
      longestStreakDays: 0,
      studiedToday: false,
      activeDaysLast30: 0,
    };
  }

  const activeDaySet = new Set<string>();
  for (const ts of activityTimestamps) {
    activeDaySet.add(computeLocalDateKey(ts, tzOffsetMinutes));
  }

  const todayKey = computeLocalDateKey(now, tzOffsetMinutes);
  const yesterdayKey = shiftDateKey(todayKey, -1);
  const studiedToday = activeDaySet.has(todayKey);

  let currentStreakDays = 0;
  let anchorKey: string | null = studiedToday
    ? todayKey
    : activeDaySet.has(yesterdayKey)
      ? yesterdayKey
      : null;

  while (anchorKey && activeDaySet.has(anchorKey)) {
    currentStreakDays += 1;
    anchorKey = shiftDateKey(anchorKey, -1);
  }

  const sortedDays = Array.from(activeDaySet).sort();
  let longestStreakDays = 0;
  let running = 0;
  for (let i = 0; i < sortedDays.length; i += 1) {
    if (i === 0 || shiftDateKey(sortedDays[i - 1], 1) === sortedDays[i]) {
      running += 1;
    } else {
      running = 1;
    }
    if (running > longestStreakDays) {
      longestStreakDays = running;
    }
  }

  const window30Start = shiftDateKey(todayKey, -29);
  let activeDaysLast30 = 0;
  for (const dayKey of activeDaySet) {
    if (dayKey >= window30Start && dayKey <= todayKey) {
      activeDaysLast30 += 1;
    }
  }

  return {
    currentStreakDays,
    longestStreakDays,
    studiedToday,
    activeDaysLast30,
  };
}

export interface RetentionMetrics {
  overallRetentionRate: number | null;
  matureRetentionRate: number | null;
  totalReviewsInWindow: number;
  againCountInWindow: number;
  avgResponseTimeMs: number | null;
}

export function computeRetentionAndTiming(
  reviews: AnalyticsReviewLogRow[],
  windowDays = 30,
  now = new Date(),
): RetentionMetrics {
  const cutoffMs = now.getTime() - Math.max(1, windowDays) * MS_PER_DAY;
  const inWindow = reviews.filter((r) => r.reviewedAt.getTime() >= cutoffMs);

  if (inWindow.length === 0) {
    return {
      overallRetentionRate: null,
      matureRetentionRate: null,
      totalReviewsInWindow: 0,
      againCountInWindow: 0,
      avgResponseTimeMs: null,
    };
  }

  let retained = 0;
  let againCount = 0;
  let matureTotal = 0;
  let matureRetained = 0;
  let timeSum = 0;
  let timeCount = 0;

  for (const log of inWindow) {
    const isPassed = log.rating >= 2;
    if (isPassed) retained += 1;
    else againCount += 1;

    if (log.stateBefore === CardStateEnum.review) {
      matureTotal += 1;
      if (isPassed) matureRetained += 1;
    }

    if (
      typeof log.timeTakenMs === 'number' &&
      Number.isFinite(log.timeTakenMs) &&
      log.timeTakenMs > 0
    ) {
      timeSum += log.timeTakenMs;
      timeCount += 1;
    }
  }

  return {
    overallRetentionRate: Math.round((retained / inWindow.length) * 1000) / 10,
    matureRetentionRate:
      matureTotal > 0
        ? Math.round((matureRetained / matureTotal) * 1000) / 10
        : null,
    totalReviewsInWindow: inWindow.length,
    againCountInWindow: againCount,
    avgResponseTimeMs: timeCount > 0 ? Math.round(timeSum / timeCount) : null,
  };
}

function formatDayLabel(dateKey: string, dayOffset: number): string {
  if (dayOffset === 0) return 'Hôm nay';
  if (dayOffset === 1) return 'Ngày mai';
  const weekday = new Date(`${dateKey}T00:00:00.000Z`).getUTCDay();
  const ddMm = `${dateKey.slice(8, 10)}/${dateKey.slice(5, 7)}`;
  return `${DAY_LABELS_VI[weekday]} (${ddMm})`;
}

export function computeWorkloadForecast7Days(
  cards: AnalyticsFlashcardRow[],
  avgResponseTimeMs: number | null,
  now = new Date(),
  tzOffsetMinutes = DEFAULT_TZ_OFFSET_MINUTES,
): WorkloadForecastDay[] {
  const todayKey = computeLocalDateKey(now, tzOffsetMinutes);
  const dayKeys = Array.from({ length: 7 }, (_, idx) =>
    shiftDateKey(todayKey, idx),
  );
  const bucketIndexByKey = new Map(dayKeys.map((k, idx) => [k, idx]));

  const secPerCard =
    avgResponseTimeMs && avgResponseTimeMs > 0
      ? Math.max(5, Math.min(120, avgResponseTimeMs / 1000))
      : 20;

  const dueCounts = Array.from<number>({ length: 7 }).fill(0);
  const newCounts = Array.from<number>({ length: 7 }).fill(0);

  for (const card of cards) {
    if (card.state === CardStateEnum.new) {
      dueCounts[0] += 1;
      newCounts[0] += 1;
      continue;
    }

    const dueKey = computeLocalDateKey(card.dueDate, tzOffsetMinutes);
    if (dueKey <= todayKey) {
      dueCounts[0] += 1;
      continue;
    }

    const idx = bucketIndexByKey.get(dueKey);
    if (idx !== undefined) {
      dueCounts[idx] += 1;
    }
  }

  return dayKeys.map((dateKey, idx) => {
    const dueCount = dueCounts[idx];
    return {
      date: dateKey,
      label: formatDayLabel(dateKey, idx),
      isToday: idx === 0,
      dueCount,
      newCount: newCounts[idx],
      estimatedMinutes:
        dueCount > 0 ? Math.max(1, Math.round((dueCount * secPerCard) / 60)) : 0,
    };
  });
}

export function extractLeechCards(
  cards: AnalyticsFlashcardRow[],
  limit = 20,
): LeechCardItem[] {
  const candidates = cards
    .filter(
      (c) =>
        c.againCount >= 2 ||
        c.easeFactor < 2.0 ||
        c.state === CardStateEnum.relearning,
    )
    .map((c) => {
      const score =
        c.againCount * 2 +
        Math.max(0, 2.5 - c.easeFactor) * 3 +
        (c.state === CardStateEnum.relearning ? 1.5 : 0);
      return { card: c, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.max(1, limit));

  return candidates.map(({ card }) => {
    const plain = stripHtml(card.frontText);
    const snippet =
      plain.length > 160 ? `${plain.slice(0, 157)}...` : plain || 'Thẻ ghi nhớ';

    return {
      id: card.id,
      deckId: card.deckId,
      deckName: card.deckName,
      conversationId: card.conversationId,
      frontText: snippet,
      easeFactor: Math.round(card.easeFactor * 100) / 100,
      state: card.state,
      againCount: card.againCount,
      sourceRefs: parseSourceRefs(card.sourceRefs),
    };
  });
}

export function computeSrsOverviewStats(input: {
  cards: AnalyticsFlashcardRow[];
  reviews: AnalyticsReviewLogRow[];
  quizSubmittedDates: Date[];
  windowDays: number;
  now?: Date;
  tzOffsetMinutes?: number;
}): SrsOverviewStats {
  const now = input.now ?? new Date();
  const tz = input.tzOffsetMinutes ?? DEFAULT_TZ_OFFSET_MINUTES;
  const todayKey = computeLocalDateKey(now, tz);

  let dueNowCount = 0;
  let newCount = 0;
  let learningCount = 0;
  let reviewCount = 0;
  let relearningCount = 0;
  let masteredCount = 0;

  for (const card of input.cards) {
    if (card.state === CardStateEnum.new) {
      newCount += 1;
      dueNowCount += 1;
      continue;
    }

    if (card.state === CardStateEnum.learning) learningCount += 1;
    else if (card.state === CardStateEnum.review) reviewCount += 1;
    else if (card.state === CardStateEnum.relearning) relearningCount += 1;

    if (
      card.state === CardStateEnum.review &&
      (card.interval >= 21 || card.easeFactor >= 2.2)
    ) {
      masteredCount += 1;
    }

    if (computeLocalDateKey(card.dueDate, tz) <= todayKey) {
      dueNowCount += 1;
    }
  }

  const retention = computeRetentionAndTiming(
    input.reviews,
    input.windowDays,
    now,
  );
  const streak = computeStudyStreak(
    [...input.reviews.map((r) => r.reviewedAt), ...input.quizSubmittedDates],
    now,
    tz,
  );

  return {
    totalCards: input.cards.length,
    dueNowCount,
    newCount,
    learningCount,
    reviewCount,
    relearningCount,
    masteredCount,
    retentionRate: retention.overallRetentionRate,
    matureRetentionRate: retention.matureRetentionRate,
    totalReviewsInWindow: retention.totalReviewsInWindow,
    againCountInWindow: retention.againCountInWindow,
    avgResponseTimeMs: retention.avgResponseTimeMs,
    studyStreakDays: streak.currentStreakDays,
    longestStreakDays: streak.longestStreakDays,
    studiedToday: streak.studiedToday,
    activeDaysLast30: streak.activeDaysLast30,
  };
}

export function computeStudyMinutesByDate(
  reviews: AnalyticsReviewLogRow[],
  quizAttempts: AnalyticsQuizAttemptRow[],
  tzOffsetMinutes = DEFAULT_TZ_OFFSET_MINUTES,
): Map<string, number> {
  const minutesByDay = new Map<string, number>();

  for (const log of reviews) {
    // Bỏ qua lượt lướt quá nhanh (< 300ms) để tránh gaming thời gian học; chỉ fallback nếu null
    const addMinutes =
      log.timeTakenMs === null
        ? 0.25
        : log.timeTakenMs >= MIN_VALID_REVIEW_MS
          ? Math.min(log.timeTakenMs, MAX_CAPPED_REVIEW_MS) / MS_PER_MINUTE
          : 0;
    if (addMinutes <= 0) continue;
    const key = computeLocalDateKey(log.reviewedAt, tzOffsetMinutes);
    minutesByDay.set(key, (minutesByDay.get(key) ?? 0) + addMinutes);
  }

  for (const att of quizAttempts) {
    const sec =
      typeof att.timeSpentSec === 'number' &&
      Number.isFinite(att.timeSpentSec) &&
      att.timeSpentSec > 0
        ? Math.min(att.timeSpentSec, 7_200)
        : 0;
    if (sec <= 0 || !att.completedAt) continue;
    const key = computeLocalDateKey(att.completedAt, tzOffsetMinutes);
    minutesByDay.set(key, (minutesByDay.get(key) ?? 0) + sec / 60);
  }

  return minutesByDay;
}

function classifyRetentionLabel(
  value: number | null,
  sampleSize: number,
): MetricStatusLabel {
  if (value === null || sampleSize < MIN_RETENTION_SAMPLE) {
    return 'insufficient_data';
  }
  if (value >= 85) return 'good';
  if (value >= 70) return 'ok';
  return 'needs_work';
}

export function computeTrueRetentionWithDelta(
  reviews: AnalyticsReviewLogRow[],
  windowDays = 30,
  now = new Date(),
): MetricWithContext {
  const safeWindow = Math.max(1, windowDays);
  const currentStartMs = now.getTime() - safeWindow * MS_PER_DAY;
  const prevStartMs = currentStartMs - safeWindow * MS_PER_DAY;

  let curTotal = 0;
  let curPassed = 0;
  let prevTotal = 0;
  let prevPassed = 0;

  for (const log of reviews) {
    if (log.stateBefore !== CardStateEnum.review) continue;
    const ts = log.reviewedAt.getTime();
    if (ts > now.getTime()) continue;
    const passed = log.rating >= 2;
    if (ts >= currentStartMs) {
      curTotal += 1;
      if (passed) curPassed += 1;
    } else if (ts >= prevStartMs) {
      prevTotal += 1;
      if (passed) prevPassed += 1;
    }
  }

  const curRate =
    curTotal > 0 ? Math.round((curPassed / curTotal) * 1000) / 10 : null;
  const prevRate =
    prevTotal >= MIN_RETENTION_SAMPLE
      ? Math.round((prevPassed / prevTotal) * 1000) / 10
      : null;

  const label = classifyRetentionLabel(curRate, curTotal);
  const value = curTotal >= MIN_RETENTION_SAMPLE ? curRate : null;
  const deltaVsPrev =
    value !== null && prevRate !== null
      ? Math.round((value - prevRate) * 10) / 10
      : null;

  const explanation =
    value === null
      ? `Cần tối thiểu ${MIN_RETENTION_SAMPLE} lượt ôn thẻ đã học để đánh giá chính xác (hiện có ${curTotal} lượt).`
      : `Tính trên ${curTotal} lượt ôn các thẻ đã học trong ${safeWindow} ngày qua (mục tiêu khuyến nghị từ 85% trở lên).`;

  return {
    value,
    deltaVsPrev,
    sampleSize: curTotal,
    minSampleSize: MIN_RETENTION_SAMPLE,
    label,
    explanation,
  };
}

export function computeDeckComposition(
  cards: AnalyticsFlashcardRow[],
): AdvancedAnalyticsBreakdown['deckComposition'] {
  let newCount = 0;
  let learningCount = 0;
  let youngCount = 0;
  let matureCount = 0;

  for (const card of cards) {
    if (card.state === CardStateEnum.new) {
      newCount += 1;
    } else if (
      card.state === CardStateEnum.learning ||
      card.state === CardStateEnum.relearning
    ) {
      learningCount += 1;
    } else if (card.state === CardStateEnum.review) {
      if (card.interval >= 21) matureCount += 1;
      else youngCount += 1;
    }
  }

  return { newCount, learningCount, youngCount, matureCount };
}

export function computeOverdueCount(
  cards: AnalyticsFlashcardRow[],
  now = new Date(),
  tzOffsetMinutes = DEFAULT_TZ_OFFSET_MINUTES,
): number {
  const todayKey = computeLocalDateKey(now, tzOffsetMinutes);
  const overdueCutoffKey = shiftDateKey(todayKey, -3);
  let overdueCount = 0;
  for (const card of cards) {
    if (card.state === CardStateEnum.new) continue;
    const dueKey = computeLocalDateKey(card.dueDate, tzOffsetMinutes);
    if (dueKey < overdueCutoffKey) {
      overdueCount += 1;
    }
  }
  return overdueCount;
}

export function computeRatingDistribution(
  reviews: AnalyticsReviewLogRow[],
  windowDays = 30,
  now = new Date(),
): AdvancedAnalyticsBreakdown['ratingDistribution'] {
  const cutoffMs = now.getTime() - Math.max(1, windowDays) * MS_PER_DAY;
  let again = 0;
  let hard = 0;
  let good = 0;
  let easy = 0;

  for (const log of reviews) {
    if (log.reviewedAt.getTime() < cutoffMs) continue;
    if (log.rating === 1) again += 1;
    else if (log.rating === 2) hard += 1;
    else if (log.rating === 3) good += 1;
    else if (log.rating >= 4) easy += 1;
  }

  return {
    again,
    hard,
    good,
    easy,
    total: again + hard + good + easy,
  };
}

function formatShortDayOfWeek(dateKey: string, isToday: boolean): string {
  if (isToday) return 'H.nay';
  const weekday = new Date(`${dateKey}T00:00:00.000Z`).getUTCDay();
  return DAY_LABELS_VI[weekday];
}

function formatShortDateDdMm(dateKey: string): string {
  return `${dateKey.slice(8, 10)}/${dateKey.slice(5, 7)}`;
}

export function computeProgressBuckets(
  reviews: AnalyticsReviewLogRow[],
  quizAttempts: AnalyticsQuizAttemptRow[],
  windowDays = 30,
  now = new Date(),
  tzOffsetMinutes = DEFAULT_TZ_OFFSET_MINUTES,
): {
  buckets: ProgressBucketPoint[];
  totalMinutesInWindow: number;
  avgRetentionInWindow: number | null;
  retentionSampleInWindow: number;
} {
  const safeWindow = Math.max(7, Math.min(90, windowDays));
  const todayKey = computeLocalDateKey(now, tzOffsetMinutes);
  const minutesByDay = computeStudyMinutesByDate(
    reviews,
    quizAttempts,
    tzOffsetMinutes,
  );

  const reviewStatsByDay = new Map<string, { total: number; passed: number }>();
  for (const log of reviews) {
    if (log.stateBefore !== CardStateEnum.review) continue;
    const key = computeLocalDateKey(log.reviewedAt, tzOffsetMinutes);
    const cur = reviewStatsByDay.get(key) ?? { total: 0, passed: 0 };
    cur.total += 1;
    if (log.rating >= 2) cur.passed += 1;
    reviewStatsByDay.set(key, cur);
  }

  const bucketCount = safeWindow <= 7 ? 7 : safeWindow <= 30 ? 5 : 6;
  const spanDays = safeWindow <= 7 ? 1 : Math.ceil(safeWindow / bucketCount);
  const startOffset = -(bucketCount * spanDays - 1);

  const buckets: ProgressBucketPoint[] = [];
  let totalMinutesInWindow = 0;
  let totalReviewsWindow = 0;
  let totalPassedWindow = 0;

  for (let b = 0; b < bucketCount; b += 1) {
    const bStartOffset = startOffset + b * spanDays;
    const bEndOffset = Math.min(0, bStartOffset + spanDays - 1);
    const startKey = shiftDateKey(todayKey, bStartOffset);
    const endKey = shiftDateKey(todayKey, bEndOffset);

    let mins = 0;
    let revTotal = 0;
    let revPassed = 0;

    for (let d = bStartOffset; d <= bEndOffset; d += 1) {
      const dayKey = shiftDateKey(todayKey, d);
      mins += minutesByDay.get(dayKey) ?? 0;
      const r = reviewStatsByDay.get(dayKey);
      if (r) {
        revTotal += r.total;
        revPassed += r.passed;
      }
    }

    const roundedMins = Math.round(mins);
    totalMinutesInWindow += roundedMins;
    totalReviewsWindow += revTotal;
    totalPassedWindow += revPassed;

    const label =
      spanDays === 1
        ? formatShortDayOfWeek(startKey, bEndOffset === 0)
        : formatShortDateDdMm(endKey);

    buckets.push({
      bucketKey: `${startKey}_${endKey}`,
      label,
      minutesStudied: roundedMins,
      retentionRate:
        revTotal >= 3 ? Math.round((revPassed / revTotal) * 100) : null,
      reviewCount: revTotal,
    });
  }

  const avgRetentionInWindow =
    totalReviewsWindow >= MIN_RETENTION_SAMPLE
      ? Math.round((totalPassedWindow / totalReviewsWindow) * 1000) / 10
      : null;

  return {
    buckets,
    totalMinutesInWindow,
    avgRetentionInWindow,
    retentionSampleInWindow: totalReviewsWindow,
  };
}

export function computeWeeklyHabit(
  minutesByDate: Map<string, number>,
  activityDates: Date[],
  streak: StudyStreakMetrics,
  now = new Date(),
  tzOffsetMinutes = DEFAULT_TZ_OFFSET_MINUTES,
): {
  daysStudiedThisWeek: number;
  weekDaysMask: boolean[];
  minutesThisWeek: number;
  minutesLastWeek: number;
  streakDays: number;
  studiedToday: boolean;
} {
  const todayKey = computeLocalDateKey(now, tzOffsetMinutes);
  const activeDaySet = new Set<string>();
  for (const ts of activityDates) {
    activeDaySet.add(computeLocalDateKey(ts, tzOffsetMinutes));
  }

  const weekDaysMask: boolean[] = [];
  let daysStudiedThisWeek = 0;
  let minutesThisWeek = 0;
  let minutesLastWeek = 0;

  for (let offset = -6; offset <= 0; offset += 1) {
    const key = shiftDateKey(todayKey, offset);
    const active = activeDaySet.has(key) || (minutesByDate.get(key) ?? 0) > 0;
    weekDaysMask.push(active);
    if (active) daysStudiedThisWeek += 1;
    minutesThisWeek += minutesByDate.get(key) ?? 0;
  }

  for (let offset = -13; offset <= -7; offset += 1) {
    const key = shiftDateKey(todayKey, offset);
    minutesLastWeek += minutesByDate.get(key) ?? 0;
  }

  return {
    daysStudiedThisWeek,
    weekDaysMask,
    minutesThisWeek: Math.round(minutesThisWeek),
    minutesLastWeek: Math.round(minutesLastWeek),
    streakDays: streak.currentStreakDays,
    studiedToday: streak.studiedToday,
  };
}
