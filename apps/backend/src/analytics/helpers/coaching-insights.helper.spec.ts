import { describe, expect, it } from 'vitest';
import { EvaluationStatusEnum } from '../../generated/prisma/client.js';
import type { AnalyticsChunkIndexRow } from '../../repo/analytics-repo/analytics-repo.service.js';
import type {
  DocumentMasteryResponse,
  LeechCardItem,
  SrsOverviewStats,
} from '../analytics.types.js';
import {
  buildAttentionItems,
  buildCoachingInsights,
  buildHeadlineMetrics,
  buildTodayPlan,
  computeExamReadiness,
} from './coaching-insights.helper.js';

describe('coaching-insights.helper', () => {
  const docMasteries: DocumentMasteryResponse[] = [
    {
      documentId: 'doc-1',
      conversationId: 'conv-1',
      fileName: 'OS.pdf',
      pageCount: 60,
      overallMasteryScore: 45,
      overallStatus: 'weak',
      totalSections: 3,
      studiedSectionsCount: 2,
      weakSectionsCount: 1,
      developingSectionsCount: 0,
      masteredSectionsCount: 1,
      sections: [
        {
          index: 0,
          text: 'Chương 1: Tổng quan',
          level: 1,
          startPage: 1,
          endPage: 15,
          status: 'mastered',
          masteryScore: 90,
          confidence: 'high',
          sampleSize: 16,
          quizCorrect: 5,
          quizTotal: 5,
          cardTotal: 11,
          cardReviewed: 11,
          cardMastered: 11,
          leechCount: 0,
          missingPoints: [],
          chunkIds: ['chk-1'],
        },
        {
          index: 1,
          text: 'Chương 3: Deadlock',
          level: 1,
          startPage: 25,
          endPage: 40,
          status: 'weak',
          masteryScore: 35,
          confidence: 'medium',
          sampleSize: 8,
          quizCorrect: 2,
          quizTotal: 5,
          cardTotal: 5,
          cardReviewed: 3,
          cardMastered: 0,
          leechCount: 2,
          missingPoints: ['Thiếu điều kiện Circular Wait'],
          chunkIds: ['chk-3'],
        },
        {
          index: 2,
          text: 'Chương 4: Bộ nhớ ảo',
          level: 1,
          startPage: 41,
          endPage: 60,
          status: 'unstudied',
          masteryScore: null,
          confidence: 'low',
          sampleSize: 0,
          quizCorrect: 0,
          quizTotal: 0,
          cardTotal: 0,
          cardReviewed: 0,
          cardMastered: 0,
          leechCount: 0,
          missingPoints: [],
          chunkIds: ['chk-4'],
        },
      ],
    },
  ];

  const chunks: AnalyticsChunkIndexRow[] = [
    { id: 'chk-1', documentId: 'doc-1', chunkIndex: 0, headings: ['Chương 1'], pageNumbers: [1], tokenCount: 500 },
    { id: 'chk-3', documentId: 'doc-1', chunkIndex: 1, headings: ['Chương 3'], pageNumbers: [25], tokenCount: 800 },
    { id: 'chk-4', documentId: 'doc-1', chunkIndex: 2, headings: ['Chương 4'], pageNumbers: [41], tokenCount: 600 },
  ];

  it('merges weak sections, missing points, leeches, and frequently asked AI sections into AttentionItems without jargon', () => {
    const askedCounts = new Map<string, number>([['chk-4', 4]]);
    const items = buildAttentionItems({
      documentMasteries: docMasteries,
      conversationTitleMap: new Map([['conv-1', 'Buổi 1']]),
      askedChunkCounts: askedCounts,
      chunks,
      examDate: new Date('2026-11-25T00:00:00.000Z'),
      now: new Date('2026-11-19T10:00:00.000Z'),
      tzOffsetMinutes: 420,
    });

    expect(items).toHaveLength(2);
    expect(items[0].title).toBe('Chương 3: Deadlock');
    expect(items[0].reasons.join(' ')).not.toMatch(/Leech|ease|Bloom/i);
    expect(items[0].reasons).toContain('2 thẻ hay quên');
    expect(items[1].title).toBe('Chương 4: Bộ nhớ ảo');
    expect(items[1].reasons).toContain('Hỏi AI 4 lần');
  });

  it('caps TodayStudyPlan at 3 tasks and provides gentleCatchupSuggestion when overdueCount > 30', () => {
    const srsOverview: SrsOverviewStats = {
      totalCards: 80,
      dueNowCount: 45,
      newCount: 5,
      learningCount: 5,
      reviewCount: 65,
      relearningCount: 5,
      masteredCount: 20,
      retentionRate: 82,
      matureRetentionRate: 84,
      totalReviewsInWindow: 40,
      againCountInWindow: 6,
      avgResponseTimeMs: 12000,
      studyStreakDays: 4,
      longestStreakDays: 7,
      studiedToday: true,
      activeDaysLast30: 15,
    };

    const leechCards: LeechCardItem[] = [
      {
        id: 'fc-1',
        deckId: 'd-1',
        deckName: 'OS',
        conversationId: 'conv-1',
        frontText: 'Coffman conditions',
        easeFactor: 1.4,
        state: 'relearning',
        againCount: 4,
        sourceRefs: [{ documentId: 'doc-1', fileName: 'OS.pdf', pageNumbers: [26] }],
      },
    ];

    const attentionItems = buildAttentionItems({
      documentMasteries: docMasteries,
      conversationTitleMap: new Map(),
      askedChunkCounts: new Map(),
      chunks,
      examDate: null,
    });

    const plan = buildTodayPlan({
      defaultConversationId: 'conv-1',
      srsOverview,
      leechCards,
      attentionItems,
      documentMasteries: docMasteries,
      minutesDoneToday: 8,
      dailyGoalMinutes: 20,
      overdueCount: 42,
    });

    expect(plan.tasks).toHaveLength(3);
    expect(plan.tasks[0].order).toBe(1);
    expect(plan.gentleCatchupSuggestion).toContain('25 thẻ/ngày');
    expect(plan.dailyGoalMinutes).toBe(20);
    expect(plan.minutesDoneToday).toBe(8);
  });

  it('computes ExamReadiness and always prioritizes at least one positive insight when available', () => {
    const now = new Date('2026-11-19T08:00:00.000Z');
    const examDate = new Date('2026-11-29T00:00:00.000Z');
    const readiness = computeExamReadiness({
      examDate,
      targetScore: 85,
      documentMasteries: docMasteries,
      chunks,
      minutesPerDayAvg: 12,
      now,
      tzOffsetMinutes: 420,
    });

    expect(readiness).not.toBeNull();
    expect(readiness?.daysLeft).toBe(10);
    expect(readiness?.value).toBeGreaterThan(0);

    const headline = buildHeadlineMetrics({
      documentMasteries: docMasteries,
      trueRetention: {
        value: 86,
        deltaVsPrev: 4.5,
        sampleSize: 32,
        minSampleSize: 20,
        label: 'good',
        explanation: 'Tốt',
      },
      habit: {
        daysStudiedThisWeek: 5,
        weekDaysMask: [true, true, false, true, true, false, true],
        minutesThisWeek: 75,
        minutesLastWeek: 50,
        streakDays: 5,
        studiedToday: true,
      },
      readiness,
    });

    const insights = buildCoachingInsights({
      headline,
      attentionItems: [],
      quizRetakeGains: [
        {
          quizId: 'q1',
          quizTitle: 'Quiz 1',
          conversationId: 'conv-1',
          attemptsCount: 2,
          firstScorePct: 50,
          latestScorePct: 80,
          gainPct: 30,
        },
      ],
      bloomMastery: {
        levels: [
          {
            level: 'remember',
            totalAnswered: 6,
            correctCount: 6,
            partialCount: 0,
            incorrectCount: 0,
            accuracyRate: 100,
          },
          {
            level: 'understand',
            totalAnswered: 0,
            correctCount: 0,
            partialCount: 0,
            incorrectCount: 0,
            accuracyRate: null,
          },
          {
            level: 'apply',
            totalAnswered: 0,
            correctCount: 0,
            partialCount: 0,
            incorrectCount: 0,
            accuracyRate: null,
          },
          {
            level: 'analyze',
            totalAnswered: 6,
            correctCount: 2,
            partialCount: 0,
            incorrectCount: 4,
            accuracyRate: 33.3,
          },
        ],
        untaggedCount: 0,
      },
      matchedPointsStrengths: ['Nêu đủ 4 điều kiện'],
      questionTypeGap: { objectiveAvgPct: 85, essayAvgPct: 50 },
      dueNowCount: 0,
    });

    expect(insights.length).toBeLessThanOrEqual(3);
    expect(insights.some((i) => i.tone === 'positive')).toBe(true);
    expect(EvaluationStatusEnum.correct).toBe('correct');
  });
});
