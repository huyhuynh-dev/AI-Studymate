import { describe, expect, it } from 'vitest';
import { CardStateEnum } from '../../generated/prisma/client.js';
import type {
  AnalyticsFlashcardRow,
  AnalyticsReviewLogRow,
} from '../../repo/analytics-repo/analytics-repo.service.js';
import {
  computeDeckComposition,
  computeLocalDateKey,
  computeOverdueCount,
  computeProgressBuckets,
  computeRatingDistribution,
  computeRetentionAndTiming,
  computeSrsOverviewStats,
  computeStudyMinutesByDate,
  computeStudyStreak,
  computeTrueRetentionWithDelta,
  computeWorkloadForecast7Days,
  extractLeechCards,
} from './srs-analytics.helper.js';

describe('srs-analytics.helper', () => {
  describe('computeLocalDateKey', () => {
    it('shifts UTC timestamp using tzOffsetMinutes (UTC+7 crosses midnight properly)', () => {
      const utcNight = new Date('2026-11-16T18:30:00.000Z');
      expect(computeLocalDateKey(utcNight, 0)).toBe('2026-11-16');
      expect(computeLocalDateKey(utcNight, 420)).toBe('2026-11-17');
    });
  });

  describe('computeStudyStreak', () => {
    const now = new Date('2026-11-16T10:00:00.000Z'); // 17:00 UTC+7 on 2026-11-16

    it('returns zeros when no activities exist', () => {
      expect(computeStudyStreak([], now, 420)).toEqual({
        currentStreakDays: 0,
        longestStreakDays: 0,
        studiedToday: false,
        activeDaysLast30: 0,
      });
    });

    it('counts consecutive streak ending today across reviews and quiz dates', () => {
      const timestamps = [
        new Date('2026-11-14T02:00:00.000Z'),
        new Date('2026-11-15T05:00:00.000Z'),
        new Date('2026-11-16T08:00:00.000Z'),
        new Date('2026-11-16T09:00:00.000Z'), // same local day deduped
      ];
      const streak = computeStudyStreak(timestamps, now, 420);
      expect(streak).toEqual({
        currentStreakDays: 3,
        longestStreakDays: 3,
        studiedToday: true,
        activeDaysLast30: 3,
      });
    });

    it('preserves streak when yesterday was active even if today has no activity yet', () => {
      const timestamps = [
        new Date('2026-11-14T04:00:00.000Z'),
        new Date('2026-11-15T04:00:00.000Z'),
      ];
      const streak = computeStudyStreak(timestamps, now, 420);
      expect(streak.currentStreakDays).toBe(2);
      expect(streak.studiedToday).toBe(false);
    });

    it('resets currentStreakDays to 0 when broken while keeping longestStreakDays', () => {
      const timestamps = [
        new Date('2026-11-01T04:00:00.000Z'),
        new Date('2026-11-02T04:00:00.000Z'),
        new Date('2026-11-03T04:00:00.000Z'),
        new Date('2026-11-10T04:00:00.000Z'),
      ];
      const streak = computeStudyStreak(timestamps, now, 420);
      expect(streak.currentStreakDays).toBe(0);
      expect(streak.longestStreakDays).toBe(3);
      expect(streak.activeDaysLast30).toBe(4);
    });
  });

  describe('computeRetentionAndTiming', () => {
    const now = new Date('2026-11-16T10:00:00.000Z');

    it('returns null rates when window has zero reviews', () => {
      const res = computeRetentionAndTiming([], 30, now);
      expect(res).toEqual({
        overallRetentionRate: null,
        matureRetentionRate: null,
        totalReviewsInWindow: 0,
        againCountInWindow: 0,
        avgResponseTimeMs: null,
      });
    });

    it('computes overall & mature retention and ignores null/out-of-window entries', () => {
      const logs: AnalyticsReviewLogRow[] = [
        {
          flashcardId: 'c1',
          rating: 1,
          stateBefore: CardStateEnum.review,
          timeTakenMs: 5000,
          reviewedAt: new Date('2026-11-15T10:00:00.000Z'),
        },
        {
          flashcardId: 'c2',
          rating: 3,
          stateBefore: CardStateEnum.review,
          timeTakenMs: 7000,
          reviewedAt: new Date('2026-11-15T11:00:00.000Z'),
        },
        {
          flashcardId: 'c3',
          rating: 4,
          stateBefore: CardStateEnum.learning,
          timeTakenMs: null,
          reviewedAt: new Date('2026-11-16T05:00:00.000Z'),
        },
        {
          flashcardId: 'c4',
          rating: 1,
          stateBefore: CardStateEnum.review,
          timeTakenMs: 9000,
          reviewedAt: new Date('2026-09-01T00:00:00.000Z'), // outside 30d window
        },
      ];

      const res = computeRetentionAndTiming(logs, 30, now);
      expect(res.totalReviewsInWindow).toBe(3);
      expect(res.againCountInWindow).toBe(1);
      expect(res.overallRetentionRate).toBe(66.7);
      expect(res.matureRetentionRate).toBe(50);
      expect(res.avgResponseTimeMs).toBe(6000);
    });
  });

  describe('computeWorkloadForecast7Days & extractLeechCards', () => {
    const now = new Date('2026-11-16T10:00:00.000Z'); // local 2026-11-16

    const sampleCards: AnalyticsFlashcardRow[] = [
      {
        id: 'card-new',
        deckId: 'deck-1',
        deckName: 'Deck 1',
        conversationId: 'conv-1',
        frontText: '<p>New Card</p>',
        state: CardStateEnum.new,
        interval: 0,
        easeFactor: 2.5,
        dueDate: new Date('2026-11-25T00:00:00.000Z'),
        lastReviewedAt: null,
        sourceRefs: null,
        againCount: 0,
      },
      {
        id: 'card-overdue-leech',
        deckId: 'deck-1',
        deckName: 'Deck 1',
        conversationId: 'conv-1',
        frontText: '<p><strong>Deadlock</strong> là gì?</p>',
        state: CardStateEnum.relearning,
        interval: 1,
        easeFactor: 1.5,
        dueDate: new Date('2026-11-14T08:00:00.000Z'),
        lastReviewedAt: new Date('2026-11-15T08:00:00.000Z'),
        sourceRefs: [{ documentId: 'doc-1', fileName: 'OS.pdf', pageNumbers: [45] }],
        againCount: 3,
      },
      {
        id: 'card-day2',
        deckId: 'deck-1',
        deckName: 'Deck 1',
        conversationId: 'conv-1',
        frontText: '<p>Mastered Card</p>',
        state: CardStateEnum.review,
        interval: 25,
        easeFactor: 2.6,
        dueDate: new Date('2026-11-18T08:00:00.000Z'),
        lastReviewedAt: new Date('2026-11-10T08:00:00.000Z'),
        sourceRefs: null,
        againCount: 0,
      },
    ];

    it('buckets new and overdue cards into Today (index 0) and future cards up to day 6', () => {
      const forecast = computeWorkloadForecast7Days(sampleCards, 30_000, now, 420);
      expect(forecast).toHaveLength(7);
      expect(forecast[0].isToday).toBe(true);
      expect(forecast[0].date).toBe('2026-11-16');
      expect(forecast[0].dueCount).toBe(2); // card-new + card-overdue-leech
      expect(forecast[0].newCount).toBe(1);
      expect(forecast[0].estimatedMinutes).toBe(1);
      expect(forecast[2].date).toBe('2026-11-18');
      expect(forecast[2].dueCount).toBe(1);
    });

    it('extracts leech cards ranked by severity and strips HTML', () => {
      const leeches = extractLeechCards(sampleCards, 10);
      expect(leeches).toHaveLength(1);
      expect(leeches[0].id).toBe('card-overdue-leech');
      expect(leeches[0].frontText).toBe('Deadlock là gì?');
      expect(leeches[0].againCount).toBe(3);
      expect(leeches[0].sourceRefs).toHaveLength(1);
    });

    it('aggregates complete SrsOverviewStats consistently', () => {
      const stats = computeSrsOverviewStats({
        cards: sampleCards,
        reviews: [],
        quizSubmittedDates: [now],
        windowDays: 30,
        now,
        tzOffsetMinutes: 420,
      });
      expect(stats.totalCards).toBe(3);
      expect(stats.dueNowCount).toBe(2);
      expect(stats.newCount).toBe(1);
      expect(stats.relearningCount).toBe(1);
      expect(stats.masteredCount).toBe(1);
      expect(stats.studyStreakDays).toBe(1);
      expect(stats.retentionRate).toBeNull();
    });

    it('handles negative tzOffsetMinutes (UTC-5), zero/null response time fallback, and >6d future cards safely', () => {
      // 2026-11-17T03:00:00Z = 2026-11-16 22:00 at UTC-5 (-300 min)
      const boundaryNow = new Date('2026-11-17T03:00:00.000Z');
      expect(computeLocalDateKey(boundaryNow, -300)).toBe('2026-11-16');

      const timing = computeRetentionAndTiming(
        [
          {
            flashcardId: 'fc-0',
            rating: 3,
            stateBefore: CardStateEnum.review,
            timeTakenMs: 0,
            reviewedAt: boundaryNow,
          },
          {
            flashcardId: 'fc-null',
            rating: 4,
            stateBefore: CardStateEnum.learning,
            timeTakenMs: null,
            reviewedAt: boundaryNow,
          },
        ],
        30,
        boundaryNow,
      );
      expect(timing.overallRetentionRate).toBe(100);
      expect(timing.matureRetentionRate).toBe(100);
      expect(timing.avgResponseTimeMs).toBeNull();

      // 3 cards due today + 1 card beyond 7 days (ignored in 7-day buckets)
      const forecast = computeWorkloadForecast7Days(
        [
          ...sampleCards,
          {
            id: 'card-day10',
            deckId: 'deck-1',
            deckName: 'Deck 1',
            conversationId: 'conv-1',
            frontText: '<p>Far future card</p>',
            state: CardStateEnum.review,
            interval: 30,
            easeFactor: 2.5,
            dueDate: new Date('2026-11-28T10:00:00.000Z'),
            lastReviewedAt: boundaryNow,
            sourceRefs: null,
            againCount: 0,
          },
        ],
        null, // fallback 20s/card
        boundaryNow,
        -300,
      );
      expect(forecast[0].date).toBe('2026-11-16');
      expect(forecast[0].dueCount).toBe(2);
      expect(forecast[0].estimatedMinutes).toBe(1);
      expect(forecast.reduce((s, d) => s + d.dueCount, 0)).toBe(3);
    });
  });

  describe('Phase 2 enhanced SRS metrics (true retention, anti-gaming, deck composition, buckets)', () => {
    const now = new Date('2026-11-19T10:00:00.000Z');

    it('returns insufficient_data when review sample < 20 and computes deltaVsPrev when both windows >= 20', () => {
      const smallLogs: AnalyticsReviewLogRow[] = Array.from({ length: 5 }, (_, i) => ({
        flashcardId: `c-${i}`,
        rating: 3,
        stateBefore: CardStateEnum.review,
        timeTakenMs: 5000,
        reviewedAt: new Date(now.getTime() - i * 3600_000),
      }));
      const smallRes = computeTrueRetentionWithDelta(smallLogs, 30, now);
      expect(smallRes.label).toBe('insufficient_data');
      expect(smallRes.value).toBeNull();
      expect(smallRes.sampleSize).toBe(5);

      const curLogs: AnalyticsReviewLogRow[] = Array.from({ length: 20 }, (_, i) => ({
        flashcardId: `cur-${i}`,
        rating: i < 18 ? 3 : 1, // 90%
        stateBefore: CardStateEnum.review,
        timeTakenMs: 4000,
        reviewedAt: new Date(now.getTime() - (i + 1) * 3600_000),
      }));
      const prevLogs: AnalyticsReviewLogRow[] = Array.from({ length: 20 }, (_, i) => ({
        flashcardId: `prev-${i}`,
        rating: i < 16 ? 3 : 1, // 80%
        stateBefore: CardStateEnum.review,
        timeTakenMs: 4000,
        reviewedAt: new Date(now.getTime() - 35 * 86_400_000 - i * 3600_000),
      }));
      const fullRes = computeTrueRetentionWithDelta([...curLogs, ...prevLogs], 30, now);
      expect(fullRes.label).toBe('good');
      expect(fullRes.value).toBe(90);
      expect(fullRes.deltaVsPrev).toBe(10);
    });

    it('caps study time at 60s, ignores < 300ms gaming, and splits young vs mature cards (>= 21d)', () => {
      const reviews: AnalyticsReviewLogRow[] = [
        { flashcardId: '1', rating: 3, stateBefore: CardStateEnum.review, timeTakenMs: 150, reviewedAt: now },
        { flashcardId: '2', rating: 3, stateBefore: CardStateEnum.review, timeTakenMs: 180_000, reviewedAt: now },
      ];
      const minsMap = computeStudyMinutesByDate(reviews, [], 420);
      const todayKey = computeLocalDateKey(now, 420);
      expect(minsMap.get(todayKey)).toBe(1);

      const comp = computeDeckComposition([
        {
          id: '1', deckId: 'd', deckName: 'D', conversationId: 'c', frontText: 'a',
          state: CardStateEnum.new, interval: 0, easeFactor: 2.5, dueDate: now, lastReviewedAt: null, sourceRefs: null, againCount: 0,
        },
        {
          id: '2', deckId: 'd', deckName: 'D', conversationId: 'c', frontText: 'b',
          state: CardStateEnum.review, interval: 10, easeFactor: 2.5, dueDate: now, lastReviewedAt: now, sourceRefs: null, againCount: 0,
        },
        {
          id: '3', deckId: 'd', deckName: 'D', conversationId: 'c', frontText: 'c',
          state: CardStateEnum.review, interval: 25, easeFactor: 2.5, dueDate: new Date('2026-11-01T00:00:00Z'), lastReviewedAt: now, sourceRefs: null, againCount: 0,
        },
      ]);
      expect(comp).toEqual({ newCount: 1, learningCount: 0, youngCount: 1, matureCount: 1 });
      expect(computeOverdueCount([
        {
          id: '3', deckId: 'd', deckName: 'D', conversationId: 'c', frontText: 'c',
          state: CardStateEnum.review, interval: 25, easeFactor: 2.5, dueDate: new Date('2026-11-01T00:00:00Z'), lastReviewedAt: now, sourceRefs: null, againCount: 0,
        },
      ], now, 420)).toBe(1);

      const dist = computeRatingDistribution(reviews, 30, now);
      expect(dist).toEqual({ again: 0, hard: 0, good: 2, easy: 0, total: 2 });

      const buckets7 = computeProgressBuckets(reviews, [], 7, now, 420);
      const buckets90 = computeProgressBuckets(reviews, [], 90, now, 420);
      expect(buckets7.buckets).toHaveLength(7);
      expect(buckets90.buckets.length).toBeLessThanOrEqual(7);
    });
  });
});
