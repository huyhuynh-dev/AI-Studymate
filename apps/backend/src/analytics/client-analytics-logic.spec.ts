import { beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/axios.client', () => ({
  axiosClient: {
    get: vi.fn(),
  },
}));

type AnalyticsHelpersMod = {
  formatPercent: (value: number | null | undefined) => string;
  formatResponseSeconds: (ms: number | null | undefined) => string;
  formatPageRange: (startPage: number | null, endPage: number | null) => string;
  formatMinutes: (minutes: number | null | undefined) => string;
  formatDeltaPct: (delta: number | null | undefined) => string | null;
  buildPlainBloomSentence: (
    levels: Array<{ level: string; totalAnswered: number; accuracyRate: number | null }>,
  ) => string;
};

type AnalyticsApiMod = {
  normalizeDocumentMastery: (raw: unknown) => {
    documentId: string;
    fileName: string;
    pageCount: number | null;
    overallMasteryScore: number | null;
    overallStatus: string;
    totalSections: number;
    sections: Array<{
      text: string;
      startPage: number | null;
      endPage: number | null;
      masteryScore: number | null;
      status: string;
      chunkIds: string[];
    }>;
  };
  normalizeConversationAnalytics: (raw: unknown) => {
    conversationId: string;
    srsOverview: {
      totalCards: number;
      retentionRate: number | null;
      studiedToday: boolean;
      studyStreakDays: number;
    };
    bloomMastery: {
      levels: Array<{ level: string; accuracyRate: number | null }>;
      untaggedCount: number;
    };
    leechCards: Array<{
      id: string;
      easeFactor: number;
      sourceRefs: Array<{ documentId: string; pageNumbers: number[] }>;
    }>;
    recommendations: Array<{
      id: string;
      priority: string;
      actionType: string;
      payload: { conversationId: string; chunkIds?: string[]; bloomPreset?: string };
    }>;
    todayPlan: {
      tasks: Array<{ id: string; order: number; title: string }>;
      dailyGoalMinutes: number;
      overdueCount: number;
    };
    headline: {
      retention: { value: number | null; label: string; sampleSize: number };
      habit: { daysStudiedThisWeek: number; weekDaysMask: boolean[] };
    };
    attentionItems: Array<{ sectionKey: string; reasons: string[] }>;
    insights: Array<{ ruleId: string; tone: string; message: string }>;
    progress: {
      windowDays: number;
      buckets: Array<{ label: string; minutesStudied: number }>;
    };
    advanced: {
      deckComposition: { matureCount: number; youngCount: number };
    };
  };
  normalizeSubjectAnalytics: (raw: unknown) => {
    subjectId: string;
    color: string | null;
    conversationSummaries: Array<{
      conversationId: string;
      avgQuizScorePct: number | null;
    }>;
    topWeakTopics: Array<{ topic: string; startPage: number | null }>;
    todayPlan: { dailyGoalMinutes: number; tasks: unknown[] };
    headline: { habit: { weekDaysMask: boolean[] } };
  };
};

let helpers: AnalyticsHelpersMod;
let apiMod: AnalyticsApiMod;

beforeAll(async () => {
  helpers = await vi.importActual<AnalyticsHelpersMod>(
    '../../../client/src/components/analytics/analytics-helpers.ts',
  );
  apiMod = await vi.importActual<AnalyticsApiMod>(
    '../../../client/src/services/analytics.api.ts',
  );
});

describe('Phase 4 Client Analytics Logic & DTO Mappers', () => {
  it('analytics-helpers formats percentages, zero vs null, response seconds, and page ranges safely', () => {
    expect(helpers.formatPercent(null)).toBe('—');
    expect(helpers.formatPercent(undefined)).toBe('—');
    expect(helpers.formatPercent(Number.NaN)).toBe('—');
    expect(helpers.formatPercent(0)).toBe('0%');
    expect(helpers.formatPercent(84.6)).toBe('85%');

    expect(helpers.formatResponseSeconds(null)).toBe('—');
    expect(helpers.formatResponseSeconds(0)).toBe('—');
    expect(helpers.formatResponseSeconds(6450)).toBe('6.5s/thẻ');

    expect(helpers.formatPageRange(null, null)).toBe('Chưa rõ trang');
    expect(helpers.formatPageRange(3, 3)).toBe('Tr. 3');
    expect(helpers.formatPageRange(3, 7)).toBe('Tr. 3–7');
  });

  it('normalizeDocumentMastery preserves zero scores while defaulting malformed fields safely', () => {
    const normalized = apiMod.normalizeDocumentMastery({
      documentId: 'doc-1',
      conversationId: 'conv-1',
      fileName: 'OS.pdf',
      pageCount: 20,
      overallMasteryScore: 0,
      overallStatus: 'weak',
      totalSections: 2,
      studiedSectionsCount: 1,
      weakSectionsCount: 1,
      developingSectionsCount: 0,
      masteredSectionsCount: 0,
      sections: [
        {
          index: 0,
          text: '1. Deadlock',
          level: 1,
          startPage: 5,
          endPage: 8,
          status: 'weak',
          masteryScore: 0,
          quizCorrect: 0,
          quizTotal: 2,
          chunkIds: ['chk-1', 123],
        },
        {
          index: 1,
          text: '2. Paging',
          status: 'unknown-status',
          masteryScore: null,
        },
      ],
    });

    expect(normalized.overallMasteryScore).toBe(0);
    expect(normalized.sections[0]).toMatchObject({
      text: '1. Deadlock',
      startPage: 5,
      endPage: 8,
      masteryScore: 0,
      status: 'weak',
      chunkIds: ['chk-1'],
    });
    expect(normalized.sections[1]).toMatchObject({
      text: '2. Paging',
      startPage: null,
      endPage: null,
      masteryScore: null,
      status: 'unstudied',
    });
  });

  it('normalizeConversationAnalytics and normalizeSubjectAnalytics parse sourceRefs and fall back safely on empty payloads', () => {
    const conv = apiMod.normalizeConversationAnalytics({
      conversationId: 'conv-1',
      srsOverview: {
        totalCards: 10,
        retentionRate: 88.5,
        studiedToday: true,
        studyStreakDays: 4,
      },
      bloomMastery: {
        levels: [
          { level: 'apply', accuracyRate: 0 },
          { level: 'invalid-level', accuracyRate: null },
        ],
        untaggedCount: 2,
      },
      leechCards: [
        {
          id: 'fc-1',
          easeFactor: 1.4,
          sourceRefs: [
            { documentId: 'doc-1', fileName: 'OS.pdf', pageNumbers: [12] },
            { invalid: true },
          ],
        },
      ],
      recommendations: [
        {
          id: 'rec-1',
          priority: 'high',
          actionType: 'address_bloom_gap',
          payload: {
            conversationId: 'conv-1',
            bloomPreset: 'exam_prep',
            chunkIds: ['chk-1'],
          },
        },
      ],
    });

    expect(conv.srsOverview.retentionRate).toBe(88.5);
    expect(conv.bloomMastery.levels[0]).toMatchObject({
      level: 'apply',
      accuracyRate: 0,
    });
    expect(conv.bloomMastery.levels[1].level).toBe('understand');
    expect(conv.leechCards[0].sourceRefs).toHaveLength(1);
    expect(conv.recommendations[0].payload.bloomPreset).toBe('exam_prep');

    const emptySubj = apiMod.normalizeSubjectAnalytics(null);
    expect(emptySubj.subjectId).toBe('');
    expect(emptySubj.color).toBeNull();
    expect(emptySubj.conversationSummaries).toEqual([]);
    expect(emptySubj.topWeakTopics).toEqual([]);
    expect(emptySubj.todayPlan.dailyGoalMinutes).toBe(15);
    expect(emptySubj.headline.habit.weekDaysMask).toHaveLength(7);

    expect(helpers.formatMinutes(12.4)).toBe('12 phút');
    expect(helpers.formatDeltaPct(4.2)).toBe('▲ +4%');
    expect(helpers.formatDeltaPct(0)).toBeNull();
    expect(
      helpers.buildPlainBloomSentence([
        { level: 'remember', totalAnswered: 6, accuracyRate: 90 },
        { level: 'analyze', totalAnswered: 6, accuracyRate: 40 },
      ]),
    ).toContain('ghi nhớ');
  });

  it('normalizeConversationAnalytics maps Phase 2 coaching blocks (todayPlan, headline, attentionItems, progress, advanced)', () => {
    const conv = apiMod.normalizeConversationAnalytics({
      conversationId: 'conv-2',
      dailyGoalMinutes: 25,
      todayPlan: {
        tasks: [{ id: 't1', order: 1, actionType: 'review_due_cards', title: 'Ôn 10 thẻ', estimatedMinutes: 4 }],
        dailyGoalMinutes: 25,
        overdueCount: 0,
      },
      headline: {
        retention: { value: 88, deltaVsPrev: 5, sampleSize: 25, minSampleSize: 20, label: 'good', explanation: 'Tốt' },
        habit: { daysStudiedThisWeek: 4, weekDaysMask: [true, true, false, true, true, false, false] },
      },
      attentionItems: [
        { sectionKey: 'doc-1:0', title: 'Chương 3', reasons: ['Đúng 2/5 câu'], primaryAction: { type: 'targeted_quiz_weak_chunk', label: 'Luyện mục này', payload: { conversationId: 'conv-2' } } },
      ],
      insights: [{ ruleId: 'streak_milestone', tone: 'positive', message: 'Học liên tục 4 ngày' }],
      progress: { windowDays: 7, buckets: [{ bucketKey: 'b1', label: 'T2', minutesStudied: 15, retentionRate: 90, reviewCount: 10 }] },
      advanced: { deckComposition: { newCount: 2, learningCount: 1, youngCount: 3, matureCount: 5 } },
    });

    expect(conv.todayPlan.tasks).toHaveLength(1);
    expect(conv.todayPlan.dailyGoalMinutes).toBe(25);
    expect(conv.headline.retention.label).toBe('good');
    expect(conv.attentionItems[0].reasons).toEqual(['Đúng 2/5 câu']);
    expect(conv.insights[0].tone).toBe('positive');
    expect(conv.progress.buckets[0].minutesStudied).toBe(15);
    expect(conv.advanced.deckComposition.matureCount).toBe(5);
  });
});
