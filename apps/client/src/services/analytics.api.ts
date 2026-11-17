import { axiosClient } from '@/lib/axios.client';
import {
  parseClientSourceRefs,
  type AnalyticsBloomLevel,
  type BloomMasteryItem,
  type BloomMasterySummary,
  type ConversationAnalyticsResponse,
  type DocumentMasteryResponse,
  type DocumentMasterySummary,
  type LeechCardItem,
  type MasteryStatus,
  type MissingPointCluster,
  type QuizPerformanceSummary,
  type SrsOverviewStats,
  type StudyRecommendation,
  type StudyRecommendationActionType,
  type SubjectAnalyticsResponse,
  type SubjectConversationSummary,
  type TocMasterySection,
  type WeakTopicItem,
  type WorkloadForecastDay,
} from '@/types';

type UnknownRecord = Record<string, unknown>;

const VALID_BLOOM_LEVELS = new Set<AnalyticsBloomLevel>([
  'remember',
  'understand',
  'apply',
  'analyze',
]);

const VALID_MASTERY_STATUS = new Set<MasteryStatus>([
  'unstudied',
  'weak',
  'developing',
  'mastered',
]);

const VALID_ACTION_TYPES = new Set<StudyRecommendationActionType>([
  'review_due_cards',
  'targeted_quiz_weak_chunk',
  'remediate_leech_cards',
  'address_bloom_gap',
  'read_unstudied_section',
]);

function asRecord(raw: unknown): UnknownRecord {
  return raw && typeof raw === 'object' && !Array.isArray(raw)
    ? (raw as UnknownRecord)
    : {};
}

function asArray(raw: unknown): unknown[] {
  return Array.isArray(raw) ? raw : [];
}

function asString(raw: unknown, fallback = ''): string {
  return typeof raw === 'string' ? raw : fallback;
}

function asStringArray(raw: unknown): string[] {
  return asArray(raw).filter((item): item is string => typeof item === 'string');
}

function asNumber(raw: unknown, fallback = 0): number {
  return typeof raw === 'number' && Number.isFinite(raw) ? raw : fallback;
}

function asNullableNumber(raw: unknown): number | null {
  return typeof raw === 'number' && Number.isFinite(raw) ? raw : null;
}

function asBloomLevel(raw: unknown): AnalyticsBloomLevel {
  return typeof raw === 'string' && VALID_BLOOM_LEVELS.has(raw as AnalyticsBloomLevel)
    ? (raw as AnalyticsBloomLevel)
    : 'understand';
}

function asMasteryStatus(raw: unknown): MasteryStatus {
  return typeof raw === 'string' && VALID_MASTERY_STATUS.has(raw as MasteryStatus)
    ? (raw as MasteryStatus)
    : 'unstudied';
}

function normalizeSrsOverview(raw: unknown): SrsOverviewStats {
  const o = asRecord(raw);
  return {
    totalCards: asNumber(o.totalCards),
    dueNowCount: asNumber(o.dueNowCount),
    newCount: asNumber(o.newCount),
    learningCount: asNumber(o.learningCount),
    reviewCount: asNumber(o.reviewCount),
    relearningCount: asNumber(o.relearningCount),
    masteredCount: asNumber(o.masteredCount),
    retentionRate: asNullableNumber(o.retentionRate),
    matureRetentionRate: asNullableNumber(o.matureRetentionRate),
    totalReviewsInWindow: asNumber(o.totalReviewsInWindow),
    againCountInWindow: asNumber(o.againCountInWindow),
    avgResponseTimeMs: asNullableNumber(o.avgResponseTimeMs),
    studyStreakDays: asNumber(o.studyStreakDays),
    longestStreakDays: asNumber(o.longestStreakDays),
    studiedToday: Boolean(o.studiedToday),
    activeDaysLast30: asNumber(o.activeDaysLast30),
  };
}

function normalizeWorkloadForecast(raw: unknown): WorkloadForecastDay[] {
  return asArray(raw).map((entry) => {
    const d = asRecord(entry);
    return {
      date: asString(d.date),
      label: asString(d.label),
      isToday: Boolean(d.isToday),
      dueCount: asNumber(d.dueCount),
      newCount: asNumber(d.newCount),
      estimatedMinutes: asNumber(d.estimatedMinutes),
    };
  });
}

function normalizeLeechCards(raw: unknown): LeechCardItem[] {
  return asArray(raw).map((entry) => {
    const c = asRecord(entry);
    return {
      id: asString(c.id),
      deckId: asString(c.deckId),
      deckName: asString(c.deckName),
      conversationId: asString(c.conversationId),
      frontText: asString(c.frontText),
      easeFactor: asNumber(c.easeFactor, 2.5),
      state: asString(c.state, 'relearning'),
      againCount: asNumber(c.againCount),
      sourceRefs: parseClientSourceRefs(c.sourceRefs),
    };
  });
}

function normalizeBloomMastery(raw: unknown): BloomMasterySummary {
  const b = asRecord(raw);
  const levels: BloomMasteryItem[] = asArray(b.levels).map((entry) => {
    const item = asRecord(entry);
    return {
      level: asBloomLevel(item.level),
      totalAnswered: asNumber(item.totalAnswered),
      correctCount: asNumber(item.correctCount),
      partialCount: asNumber(item.partialCount),
      incorrectCount: asNumber(item.incorrectCount),
      accuracyRate: asNullableNumber(item.accuracyRate),
    };
  });
  return {
    levels,
    untaggedCount: asNumber(b.untaggedCount),
  };
}

function normalizeQuizPerformance(raw: unknown): QuizPerformanceSummary {
  const q = asRecord(raw);
  return {
    totalSubmittedAttempts: asNumber(q.totalSubmittedAttempts),
    avgScorePct: asNullableNumber(q.avgScorePct),
    recentScores: asArray(q.recentScores).map((entry) => {
      const item = asRecord(entry);
      return {
        attemptId: asString(item.attemptId),
        quizId: asString(item.quizId),
        quizTitle: asString(item.quizTitle),
        conversationId: asString(item.conversationId),
        scorePct: asNumber(item.scorePct),
        completedAt: asString(item.completedAt),
      };
    }),
  };
}

function normalizeMissingPointClusters(raw: unknown): MissingPointCluster[] {
  return asArray(raw).map((entry) => {
    const c = asRecord(entry);
    return {
      point: asString(c.point),
      frequency: asNumber(c.frequency, 1),
      bloomLevels: asArray(c.bloomLevels).map(asBloomLevel),
      sampleQuestionText: asString(c.sampleQuestionText),
      sourceRefs: parseClientSourceRefs(c.sourceRefs),
    };
  });
}

function normalizeTocSection(raw: unknown): TocMasterySection {
  const s = asRecord(raw);
  return {
    index: asNumber(s.index),
    text: asString(s.text),
    level: asNumber(s.level, 1),
    startPage: asNullableNumber(s.startPage),
    endPage: asNullableNumber(s.endPage),
    status: asMasteryStatus(s.status),
    masteryScore: asNullableNumber(s.masteryScore),
    quizCorrect: asNumber(s.quizCorrect),
    quizTotal: asNumber(s.quizTotal),
    cardTotal: asNumber(s.cardTotal),
    cardReviewed: asNumber(s.cardReviewed),
    cardMastered: asNumber(s.cardMastered),
    leechCount: asNumber(s.leechCount),
    missingPoints: asStringArray(s.missingPoints),
    chunkIds: asStringArray(s.chunkIds),
  };
}

function normalizeWeakTopics(raw: unknown): WeakTopicItem[] {
  return asArray(raw).map((entry) => {
    const t = asRecord(entry);
    const convTitle = asString(t.conversationTitle);
    return {
      topic: asString(t.topic),
      conversationId: asString(t.conversationId),
      ...(convTitle ? { conversationTitle: convTitle } : {}),
      documentId: asString(t.documentId),
      fileName: asString(t.fileName),
      startPage: asNullableNumber(t.startPage),
      endPage: asNullableNumber(t.endPage),
      masteryScore: asNullableNumber(t.masteryScore),
      status: asMasteryStatus(t.status),
      quizCorrect: asNumber(t.quizCorrect),
      quizTotal: asNumber(t.quizTotal),
      leechCount: asNumber(t.leechCount),
      missingPointCount: asNumber(t.missingPointCount),
      chunkIds: asStringArray(t.chunkIds),
    };
  });
}

function normalizeDocumentMasterySummaries(raw: unknown): DocumentMasterySummary[] {
  return asArray(raw).map((entry) => {
    const d = asRecord(entry);
    return {
      documentId: asString(d.documentId),
      fileName: asString(d.fileName),
      pageCount: asNullableNumber(d.pageCount),
      overallMasteryScore: asNullableNumber(d.overallMasteryScore),
      overallStatus: asMasteryStatus(d.overallStatus),
      totalSections: asNumber(d.totalSections),
      studiedSectionsCount: asNumber(d.studiedSectionsCount),
      weakSectionsCount: asNumber(d.weakSectionsCount),
      masteredSectionsCount: asNumber(d.masteredSectionsCount),
    };
  });
}

function normalizeRecommendations(raw: unknown): StudyRecommendation[] {
  return asArray(raw).map((entry) => {
    const r = asRecord(entry);
    const p = asRecord(r.payload);
    const priorityRaw = asString(r.priority, 'medium');
    const priority: 'high' | 'medium' | 'low' =
      priorityRaw === 'high' || priorityRaw === 'low' ? priorityRaw : 'medium';

    const actionRaw = asString(r.actionType);
    const actionType: StudyRecommendationActionType = VALID_ACTION_TYPES.has(
      actionRaw as StudyRecommendationActionType
    )
      ? (actionRaw as StudyRecommendationActionType)
      : 'review_due_cards';

    const bloomPresetRaw = asString(p.bloomPreset);
    const bloomPreset =
      bloomPresetRaw === 'familiarize' ||
      bloomPresetRaw === 'balanced' ||
      bloomPresetRaw === 'exam_prep'
        ? bloomPresetRaw
        : undefined;

    return {
      id: asString(r.id),
      priority,
      actionType,
      title: asString(r.title),
      reason: asString(r.reason),
      actionLabel: asString(r.actionLabel),
      payload: {
        conversationId: asString(p.conversationId),
        ...(typeof p.subjectId === 'string' ? { subjectId: p.subjectId } : {}),
        ...(typeof p.deckId === 'string' ? { deckId: p.deckId } : {}),
        ...(typeof p.documentId === 'string' ? { documentId: p.documentId } : {}),
        ...(typeof p.pageNo === 'number' ? { pageNo: p.pageNo } : {}),
        ...(Array.isArray(p.chunkIds) ? { chunkIds: asStringArray(p.chunkIds) } : {}),
        ...(Array.isArray(p.flashcardIds)
          ? { flashcardIds: asStringArray(p.flashcardIds) }
          : {}),
        ...(bloomPreset ? { bloomPreset } : {}),
        ...(typeof p.sectionTitle === 'string'
          ? { sectionTitle: p.sectionTitle }
          : {}),
      },
    };
  });
}

export function normalizeDocumentMastery(raw: unknown): DocumentMasteryResponse {
  const d = asRecord(raw);
  return {
    documentId: asString(d.documentId),
    conversationId: asString(d.conversationId),
    fileName: asString(d.fileName),
    pageCount: asNullableNumber(d.pageCount),
    overallMasteryScore: asNullableNumber(d.overallMasteryScore),
    overallStatus: asMasteryStatus(d.overallStatus),
    totalSections: asNumber(d.totalSections),
    studiedSectionsCount: asNumber(d.studiedSectionsCount),
    weakSectionsCount: asNumber(d.weakSectionsCount),
    developingSectionsCount: asNumber(d.developingSectionsCount),
    masteredSectionsCount: asNumber(d.masteredSectionsCount),
    sections: asArray(d.sections).map(normalizeTocSection),
  };
}

export function normalizeConversationAnalytics(
  raw: unknown
): ConversationAnalyticsResponse {
  const r = asRecord(raw);
  return {
    conversationId: asString(r.conversationId),
    conversationTitle: asString(r.conversationTitle),
    subjectId: asString(r.subjectId),
    subjectName: asString(r.subjectName),
    generatedAt: asString(r.generatedAt),
    windowDays: asNumber(r.windowDays, 30),
    srsOverview: normalizeSrsOverview(r.srsOverview),
    workloadForecast7Days: normalizeWorkloadForecast(r.workloadForecast7Days),
    leechCards: normalizeLeechCards(r.leechCards),
    quizPerformance: normalizeQuizPerformance(r.quizPerformance),
    bloomMastery: normalizeBloomMastery(r.bloomMastery),
    missingPointsClusters: normalizeMissingPointClusters(r.missingPointsClusters),
    weakTopics: normalizeWeakTopics(r.weakTopics),
    documentMasterySummaries: normalizeDocumentMasterySummaries(
      r.documentMasterySummaries
    ),
    recommendations: normalizeRecommendations(r.recommendations),
  };
}

function normalizeSubjectConversationSummaries(
  raw: unknown
): SubjectConversationSummary[] {
  return asArray(raw).map((entry) => {
    const c = asRecord(entry);
    return {
      conversationId: asString(c.conversationId),
      title: asString(c.title),
      updatedAt: asString(c.updatedAt),
      totalCards: asNumber(c.totalCards),
      dueNowCount: asNumber(c.dueNowCount),
      leechCount: asNumber(c.leechCount),
      quizAttemptCount: asNumber(c.quizAttemptCount),
      avgQuizScorePct: asNullableNumber(c.avgQuizScorePct),
      weakSectionsCount: asNumber(c.weakSectionsCount),
    };
  });
}

export function normalizeSubjectAnalytics(raw: unknown): SubjectAnalyticsResponse {
  const r = asRecord(raw);
  return {
    subjectId: asString(r.subjectId),
    subjectName: asString(r.subjectName),
    color: typeof r.color === 'string' ? r.color : null,
    generatedAt: asString(r.generatedAt),
    windowDays: asNumber(r.windowDays, 30),
    srsOverview: normalizeSrsOverview(r.srsOverview),
    workloadForecast7Days: normalizeWorkloadForecast(r.workloadForecast7Days),
    leechCards: normalizeLeechCards(r.leechCards),
    quizPerformance: normalizeQuizPerformance(r.quizPerformance),
    bloomMastery: normalizeBloomMastery(r.bloomMastery),
    missingPointsClusters: normalizeMissingPointClusters(r.missingPointsClusters),
    topWeakTopics: normalizeWeakTopics(r.topWeakTopics),
    conversationSummaries: normalizeSubjectConversationSummaries(
      r.conversationSummaries
    ),
    recommendations: normalizeRecommendations(r.recommendations),
  };
}

function resolveClientTzOffsetMinutes(explicit?: number): number {
  if (typeof explicit === 'number' && Number.isFinite(explicit)) {
    return Math.max(-720, Math.min(840, Math.round(explicit)));
  }
  if (typeof window !== 'undefined') {
    const offset = -new Date().getTimezoneOffset();
    if (Number.isFinite(offset)) {
      return Math.max(-720, Math.min(840, Math.round(offset)));
    }
  }
  return 420;
}

export interface AnalyticsQueryParams {
  windowDays?: number;
  tzOffsetMinutes?: number;
}

export const analyticsApi = {
  getConversationAnalytics: async (
    conversationId: string,
    params?: AnalyticsQueryParams
  ): Promise<ConversationAnalyticsResponse> => {
    const res = await axiosClient.get(
      `/analytics/conversations/${conversationId}`,
      {
        params: {
          tzOffsetMinutes: resolveClientTzOffsetMinutes(params?.tzOffsetMinutes),
          ...(params?.windowDays ? { windowDays: params.windowDays } : {}),
        },
      }
    );
    return normalizeConversationAnalytics(res.data);
  },

  getDocumentMastery: async (
    documentId: string
  ): Promise<DocumentMasteryResponse> => {
    const res = await axiosClient.get(
      `/analytics/documents/${documentId}/mastery`
    );
    return normalizeDocumentMastery(res.data);
  },

  getSubjectAnalytics: async (
    subjectId: string,
    params?: AnalyticsQueryParams
  ): Promise<SubjectAnalyticsResponse> => {
    const res = await axiosClient.get(`/analytics/subjects/${subjectId}`, {
      params: {
        tzOffsetMinutes: resolveClientTzOffsetMinutes(params?.tzOffsetMinutes),
        ...(params?.windowDays ? { windowDays: params.windowDays } : {}),
      },
    });
    return normalizeSubjectAnalytics(res.data);
  },
};
