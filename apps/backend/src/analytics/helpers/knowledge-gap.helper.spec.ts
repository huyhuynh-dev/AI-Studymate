import { describe, expect, it } from 'vitest';
import { EvaluationStatusEnum } from '../../generated/prisma/client.js';
import type { AnalyticsQuizAttemptRow } from '../../repo/analytics-repo/analytics-repo.service.js';
import {
  clusterMissingPoints,
  computeBloomMasteryBreakdown,
  computeQuizPerformanceSummary,
  deduplicateLatestQuizAnswers,
  generateStudyRecommendations,
} from './knowledge-gap.helper.js';

describe('knowledge-gap.helper', () => {
  const attempts: AnalyticsQuizAttemptRow[] = [
    {
      id: 'att-newest',
      quizId: 'quiz-2',
      quizTitle: 'Quiz 2',
      conversationId: 'conv-1',
      score: 7,
      maxScore: 10,
      completedAt: new Date('2026-11-16T09:00:00.000Z'),
      answers: [
        {
          questionId: 'q-1',
          evaluationStatus: EvaluationStatusEnum.correct,
          pointsEarned: 1,
          missingPoints: [],
          answeredAt: new Date('2026-11-16T09:00:00.000Z'),
          question: {
            id: 'q-1',
            questionText: '<p>Định nghĩa Semaphore</p>',
            points: 1,
            bloomLevel: 'remember',
            sourceRefs: [],
          },
        },
        {
          questionId: 'q-2',
          evaluationStatus: EvaluationStatusEnum.partial,
          pointsEarned: 1,
          missingPoints: ['Chưa nêu điều kiện Hold and Wait.'],
          answeredAt: new Date('2026-11-16T09:00:00.000Z'),
          question: {
            id: 'q-2',
            questionText: '<p>Phân tích kịch bản Deadlock</p>',
            points: 2,
            bloomLevel: 'analyze',
            sourceRefs: [
              { documentId: 'doc-1', fileName: 'OS.pdf', chunkId: 'chk-3', pageNumbers: [26] },
            ],
          },
        },
        {
          questionId: 'q-legacy',
          evaluationStatus: EvaluationStatusEnum.correct,
          pointsEarned: 1,
          missingPoints: [],
          answeredAt: new Date('2026-11-16T09:00:00.000Z'),
          question: {
            id: 'q-legacy',
            questionText: '<p>Câu hỏi cũ chưa gắn Bloom</p>',
            points: 1,
            bloomLevel: null,
            sourceRefs: [],
          },
        },
      ],
    },
    {
      id: 'att-older',
      quizId: 'quiz-1',
      quizTitle: 'Quiz 1',
      conversationId: 'conv-1',
      score: 5,
      maxScore: 10,
      completedAt: new Date('2026-11-15T09:00:00.000Z'),
      answers: [
        {
          questionId: 'q-1', // Same question answered earlier -> superseded in latest
          evaluationStatus: EvaluationStatusEnum.incorrect,
          pointsEarned: 0,
          missingPoints: [],
          answeredAt: new Date('2026-11-15T09:00:00.000Z'),
          question: {
            id: 'q-1',
            questionText: '<p>Định nghĩa Semaphore</p>',
            points: 1,
            bloomLevel: 'remember',
            sourceRefs: [],
          },
        },
        {
          questionId: 'q-3',
          evaluationStatus: EvaluationStatusEnum.incorrect,
          pointsEarned: 0,
          missingPoints: ['chưa nêu điều kiện Hold and Wait'],
          answeredAt: new Date('2026-11-15T09:00:00.000Z'),
          question: {
            id: 'q-3',
            questionText: '<p>Áp dụng thuật toán Banker</p>',
            points: 2,
            bloomLevel: 'apply',
            sourceRefs: [
              { documentId: 'doc-1', fileName: 'OS.pdf', chunkId: 'chk-3', pageNumbers: [28] },
            ],
          },
        },
      ],
    },
  ];

  it('computes Bloom breakdown while isolating legacy null bloom_level questions', () => {
    const latest = deduplicateLatestQuizAnswers(attempts);
    expect(latest.map((a) => a.questionId)).toEqual(['q-1', 'q-2', 'q-legacy', 'q-3']);

    const bloom = computeBloomMasteryBreakdown(latest);
    expect(bloom.untaggedCount).toBe(1);
    const rem = bloom.levels.find((l) => l.level === 'remember')!;
    expect(rem.correctCount).toBe(1);
    expect(rem.accuracyRate).toBe(100);

    const apply = bloom.levels.find((l) => l.level === 'apply')!;
    expect(apply.incorrectCount).toBe(1);
    expect(apply.accuracyRate).toBe(0);

    const analyze = bloom.levels.find((l) => l.level === 'analyze')!;
    expect(analyze.partialCount).toBe(1);
    expect(analyze.accuracyRate).toBe(50);
  });

  it('computes chronological score trend and clusters normalized missing_points', () => {
    const perf = computeQuizPerformanceSummary(attempts);
    expect(perf.totalSubmittedAttempts).toBe(2);
    expect(perf.avgScorePct).toBe(60);
    expect(perf.recentScores.map((s) => s.attemptId)).toEqual(['att-older', 'att-newest']);

    const clusters = clusterMissingPoints(attempts, 5);
    expect(clusters).toHaveLength(1);
    expect(clusters[0].frequency).toBe(2);
    expect(clusters[0].bloomLevels).toEqual(['analyze', 'apply']);
    expect(clusters[0].sourceRefs).toHaveLength(1);
  });

  it('generates prioritized Next Best Study Actions up to 5 items', () => {
    const recs = generateStudyRecommendations({
      defaultConversationId: 'conv-1',
      subjectId: 'subj-1',
      srsOverview: {
        totalCards: 20,
        dueNowCount: 12,
        newCount: 4,
        learningCount: 2,
        reviewCount: 12,
        relearningCount: 2,
        masteredCount: 8,
        retentionRate: 78,
        matureRetentionRate: 85,
        totalReviewsInWindow: 30,
        againCountInWindow: 6,
        avgResponseTimeMs: 15000,
        studyStreakDays: 4,
        longestStreakDays: 4,
        studiedToday: true,
        activeDaysLast30: 10,
      },
      leechCards: [
        {
          id: 'c-1',
          deckId: 'd-1',
          deckName: 'OS Deck',
          conversationId: 'conv-1',
          frontText: 'Deadlock conditions',
          easeFactor: 1.4,
          state: 'relearning',
          againCount: 4,
          sourceRefs: [{ documentId: 'doc-1', fileName: 'OS.pdf', pageNumbers: [26] }],
        },
      ],
      weakTopics: [
        {
          topic: '3.1 Điều kiện Deadlock',
          conversationId: 'conv-1',
          documentId: 'doc-1',
          fileName: 'OS.pdf',
          startPage: 26,
          endPage: 30,
          masteryScore: 32,
          status: 'weak',
          quizCorrect: 0,
          quizTotal: 2,
          leechCount: 1,
          missingPointCount: 2,
          chunkIds: ['chk-3'],
        },
      ],
      bloomMastery: {
        levels: [
          { level: 'remember', totalAnswered: 3, correctCount: 3, partialCount: 0, incorrectCount: 0, accuracyRate: 100 },
          { level: 'understand', totalAnswered: 2, correctCount: 1, partialCount: 1, incorrectCount: 0, accuracyRate: 75 },
          { level: 'apply', totalAnswered: 2, correctCount: 0, partialCount: 1, incorrectCount: 1, accuracyRate: 25 },
          { level: 'analyze', totalAnswered: 1, correctCount: 0, partialCount: 0, incorrectCount: 1, accuracyRate: 0 },
        ],
        untaggedCount: 0,
      },
      documentMasteries: [
        {
          documentId: 'doc-1',
          conversationId: 'conv-1',
          fileName: 'OS.pdf',
          pageCount: 55,
          overallMasteryScore: 45,
          overallStatus: 'weak',
          totalSections: 2,
          studiedSectionsCount: 1,
          weakSectionsCount: 1,
          developingSectionsCount: 0,
          masteredSectionsCount: 0,
          sections: [
            {
              index: 0,
              text: '3.1 Điều kiện Deadlock',
              level: 2,
              startPage: 26,
              endPage: 30,
              status: 'weak',
              masteryScore: 32,
              quizCorrect: 0,
              quizTotal: 2,
              cardTotal: 1,
              cardReviewed: 1,
              cardMastered: 0,
              leechCount: 1,
              missingPoints: ['Circular Wait'],
              chunkIds: ['chk-3'],
            },
            {
              index: 1,
              text: 'Chương 4: Bộ nhớ ảo',
              level: 1,
              startPage: 40,
              endPage: 55,
              status: 'unstudied',
              masteryScore: null,
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
      ],
    });

    expect(recs).toHaveLength(5);
    expect(recs.map((r) => r.actionType)).toEqual([
      'review_due_cards',
      'targeted_quiz_weak_chunk',
      'remediate_leech_cards',
      'address_bloom_gap',
      'read_unstudied_section',
    ]);
    expect(recs[1].payload.chunkIds).toEqual(['chk-3']);
  });
});
