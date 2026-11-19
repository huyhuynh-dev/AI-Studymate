import { Injectable, Logger } from '@nestjs/common';
import {
  AnalyticsRepoService,
  type AnalyticsChunkIndexRow,
  type AnalyticsFlashcardRow,
  type AnalyticsQuizAttemptRow,
} from '../repo/analytics-repo/analytics-repo.service.js';
import type {
  ConversationAnalyticsResponse,
  DocumentMasteryResponse,
  SubjectAnalyticsResponse,
  SubjectConversationSummary,
} from './analytics.types.js';
import type { AnalyticsQueryDto } from './dto/analytics.dto.js';
import {
  buildAttentionItems,
  buildCoachingInsights,
  buildHeadlineMetrics,
  buildTodayPlan,
  computeExamReadiness,
} from './helpers/coaching-insights.helper.js';
import {
  computeDocumentMastery,
  toDocumentMasterySummary,
} from './helpers/document-mastery.helper.js';
import {
  clusterMissingPoints,
  computeAdvancedQuizSignals,
  computeBloomMasteryBreakdown,
  computeLatestQuizAvgPct,
  computeQuizPerformanceSummary,
  computeQuizRetakeGains,
  deduplicateLatestQuizAnswers,
  extractWeakTopicsFromDocuments,
  generateStudyRecommendations,
} from './helpers/knowledge-gap.helper.js';
import {
  computeDeckComposition,
  computeLocalDateKey,
  computeOverdueCount,
  computeProgressBuckets,
  computeRatingDistribution,
  computeSrsOverviewStats,
  computeStudyMinutesByDate,
  computeTrueRetentionWithDelta,
  computeWeeklyHabit,
  computeWorkloadForecast7Days,
  DEFAULT_TZ_OFFSET_MINUTES,
  extractLeechCards,
} from './helpers/srs-analytics.helper.js';

const REVIEW_HISTORY_DAYS = 365;
const DEFAULT_RETENTION_WINDOW_DAYS = 30;
const MS_PER_DAY = 86_400_000;

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(private readonly analyticsRepo: AnalyticsRepoService) {}

  async getConversationAnalytics(
    userId: string,
    conversationId: string,
    query: AnalyticsQueryDto = {},
  ): Promise<ConversationAnalyticsResponse> {
    const startTime = Date.now();
    const conv = await this.analyticsRepo.assertConversationAccess(
      conversationId,
      userId,
    );

    const diagnostics = await this.computeScopeDiagnostics(
      [conversationId],
      userId,
      query,
      new Map([[conversationId, conv.title]]),
      {
        dailyGoalMinutes: conv.dailyGoalMinutes,
        examDate: conv.examDate,
        targetScore: conv.targetScore,
        defaultConversationId: conversationId,
        subjectId: conv.subjectId,
      },
    );

    const recommendations = generateStudyRecommendations({
      defaultConversationId: conversationId,
      subjectId: conv.subjectId,
      srsOverview: diagnostics.srsOverview,
      leechCards: diagnostics.leechCards,
      weakTopics: diagnostics.weakTopics,
      bloomMastery: diagnostics.bloomMastery,
      documentMasteries: diagnostics.documentMasteries,
    });

    this.logger.log(
      `[getConversationAnalytics] Conv=${conversationId} | Cards=${diagnostics.srsOverview.totalCards}, Due=${diagnostics.srsOverview.dueNowCount}, Streak=${diagnostics.srsOverview.studyStreakDays}d, Leech=${diagnostics.leechCards.length}, Recs=${recommendations.length} (${Date.now() - startTime}ms)`,
    );

    return {
      conversationId: conv.id,
      conversationTitle: conv.title,
      subjectId: conv.subjectId,
      subjectName: conv.subjectName,
      generatedAt: diagnostics.now.toISOString(),
      windowDays: diagnostics.windowDays,
      dailyGoalMinutes: conv.dailyGoalMinutes,
      examDate: conv.examDate ? conv.examDate.toISOString().slice(0, 10) : null,
      targetScore: conv.targetScore,
      srsOverview: diagnostics.srsOverview,
      workloadForecast7Days: diagnostics.workloadForecast7Days,
      leechCards: diagnostics.leechCards,
      quizPerformance: diagnostics.quizPerformance,
      bloomMastery: diagnostics.bloomMastery,
      missingPointsClusters: diagnostics.missingPointsClusters,
      weakTopics: diagnostics.weakTopics,
      documentMasterySummaries: diagnostics.documentMasteries.map(
        toDocumentMasterySummary,
      ),
      recommendations,
      todayPlan: diagnostics.todayPlan,
      headline: diagnostics.headline,
      attentionItems: diagnostics.attentionItems,
      insights: diagnostics.insights,
      progress: diagnostics.progress,
      advanced: diagnostics.advanced,
    };
  }

  async getDocumentMastery(
    userId: string,
    documentId: string,
  ): Promise<DocumentMasteryResponse> {
    const startTime = Date.now();
    const doc = await this.analyticsRepo.assertDocumentAccess(
      documentId,
      userId,
    );

    const [chunks, flashcards, quizAttempts] = await Promise.all([
      this.analyticsRepo.getChunkIndexByDocumentId(documentId),
      this.analyticsRepo.getSrsFlashcardsByConversations(
        [doc.conversationId],
        userId,
      ),
      this.analyticsRepo.getSubmittedQuizAnalyticsByConversations(
        [doc.conversationId],
        userId,
      ),
    ]);

    const latestQuizAnswers = deduplicateLatestQuizAnswers(quizAttempts);
    const mastery = computeDocumentMastery({
      documentId: doc.id,
      conversationId: doc.conversationId,
      fileName: doc.fileName,
      pageCount: doc.pageCount,
      docMetadata: doc.docMetadata,
      chunks,
      latestQuizAnswers,
      flashcards,
    });

    this.logger.log(
      `[getDocumentMastery] Doc=${documentId} | Sections=${mastery.totalSections}, Studied=${mastery.studiedSectionsCount}, Weak=${mastery.weakSectionsCount}, Score=${mastery.overallMasteryScore ?? 'N/A'} (${Date.now() - startTime}ms)`,
    );

    return mastery;
  }

  async getSubjectAnalytics(
    userId: string,
    subjectId: string,
    query: AnalyticsQueryDto = {},
  ): Promise<SubjectAnalyticsResponse> {
    const startTime = Date.now();
    const subject =
      await this.analyticsRepo.assertSubjectAccessWithConversations(
        subjectId,
        userId,
      );

    const conversationIds = subject.conversations.map((c) => c.id);
    const titleMap = new Map(
      subject.conversations.map((c) => [c.id, c.title] as const),
    );

    const diagnostics = await this.computeScopeDiagnostics(
      conversationIds,
      userId,
      query,
      titleMap,
      {
        dailyGoalMinutes: subject.dailyGoalMinutes,
        examDate: subject.examDate,
        targetScore: subject.targetScore,
        defaultConversationId: conversationIds[0] ?? subject.id,
        subjectId: subject.id,
      },
    );

    const conversationSummaries = this.buildSubjectConversationSummaries(
      subject.conversations,
      diagnostics.flashcards,
      diagnostics.quizAttempts,
      diagnostics.documentMasteries,
      diagnostics.now,
      diagnostics.tzOffsetMinutes,
    );

    const primaryConvId =
      diagnostics.attentionItems[0]?.conversationId ??
      diagnostics.weakTopics[0]?.conversationId ??
      conversationSummaries.find((c) => c.dueNowCount > 0)?.conversationId ??
      conversationIds[0] ??
      subject.id;

    const recommendations =
      conversationIds.length > 0
        ? generateStudyRecommendations({
            defaultConversationId: primaryConvId,
            subjectId: subject.id,
            srsOverview: diagnostics.srsOverview,
            leechCards: diagnostics.leechCards,
            weakTopics: diagnostics.weakTopics,
            bloomMastery: diagnostics.bloomMastery,
            documentMasteries: diagnostics.documentMasteries,
          })
        : [];

    this.logger.log(
      `[getSubjectAnalytics] Subject=${subjectId} | Convs=${conversationIds.length}, Cards=${diagnostics.srsOverview.totalCards}, Streak=${diagnostics.srsOverview.studyStreakDays}d (${Date.now() - startTime}ms)`,
    );

    return {
      subjectId: subject.id,
      subjectName: subject.name,
      color: subject.color,
      generatedAt: diagnostics.now.toISOString(),
      windowDays: diagnostics.windowDays,
      dailyGoalMinutes: subject.dailyGoalMinutes,
      examDate: subject.examDate ? subject.examDate.toISOString().slice(0, 10) : null,
      targetScore: subject.targetScore,
      srsOverview: diagnostics.srsOverview,
      workloadForecast7Days: diagnostics.workloadForecast7Days,
      leechCards: diagnostics.leechCards,
      quizPerformance: diagnostics.quizPerformance,
      bloomMastery: diagnostics.bloomMastery,
      missingPointsClusters: diagnostics.missingPointsClusters,
      topWeakTopics: diagnostics.weakTopics,
      documentMasterySummaries: diagnostics.documentMasteries.map(
        toDocumentMasterySummary,
      ),
      conversationSummaries,
      recommendations,
      todayPlan: diagnostics.todayPlan,
      headline: diagnostics.headline,
      attentionItems: diagnostics.attentionItems,
      insights: diagnostics.insights,
      progress: diagnostics.progress,
      advanced: diagnostics.advanced,
    };
  }

  private async computeScopeDiagnostics(
    conversationIds: string[],
    userId: string,
    query: AnalyticsQueryDto,
    conversationTitleMap: Map<string, string>,
    goalConfig: {
      dailyGoalMinutes: number;
      examDate: Date | null;
      targetScore: number | null;
      defaultConversationId: string;
      subjectId?: string;
    },
  ) {
    const now = new Date();
    const tzOffsetMinutes =
      query.tzOffsetMinutes ?? DEFAULT_TZ_OFFSET_MINUTES;
    const windowDays = query.windowDays ?? DEFAULT_RETENTION_WINDOW_DAYS;
    const sinceDate = new Date(
      now.getTime() - REVIEW_HISTORY_DAYS * MS_PER_DAY,
    );
    const since14d = new Date(now.getTime() - 14 * MS_PER_DAY);

    const [flashcards, reviews, quizAttempts, docsData, askedChunkCounts] =
      await Promise.all([
        this.analyticsRepo.getSrsFlashcardsByConversations(
          conversationIds,
          userId,
        ),
        this.analyticsRepo.getReviewLogsByConversations(
          conversationIds,
          userId,
          sinceDate,
        ),
        this.analyticsRepo.getSubmittedQuizAnalyticsByConversations(
          conversationIds,
          userId,
        ),
        this.analyticsRepo.getDocumentsSummaryAndChunkIndex(
          conversationIds,
          userId,
        ),
        this.analyticsRepo.getFrequentlyAskedChunkCounts(
          conversationIds,
          userId,
          since14d,
        ),
      ]);

    const quizSubmittedDates = quizAttempts
      .map((a) => a.completedAt)
      .filter((d): d is Date => d instanceof Date);

    const srsOverview = computeSrsOverviewStats({
      cards: flashcards,
      reviews,
      quizSubmittedDates,
      windowDays,
      now,
      tzOffsetMinutes,
    });

    const workloadForecast7Days = computeWorkloadForecast7Days(
      flashcards,
      srsOverview.avgResponseTimeMs,
      now,
      tzOffsetMinutes,
    );

    const leechCards = extractLeechCards(flashcards, 20);
    const latestQuizAnswers = deduplicateLatestQuizAnswers(quizAttempts);
    const quizPerformance = computeQuizPerformanceSummary(quizAttempts);
    const bloomMastery = computeBloomMasteryBreakdown(latestQuizAnswers);
    const missingPointsClusters = clusterMissingPoints(quizAttempts, 10);

    const chunksByDoc = new Map<string, AnalyticsChunkIndexRow[]>();
    for (const chunk of docsData.chunks) {
      const list = chunksByDoc.get(chunk.documentId) ?? [];
      list.push(chunk);
      chunksByDoc.set(chunk.documentId, list);
    }

    const answersByConv = new Map<string, typeof latestQuizAnswers>();
    for (const attempt of quizAttempts) {
      const list = answersByConv.get(attempt.conversationId) ?? [];
      for (const ans of attempt.answers) list.push(ans);
      answersByConv.set(attempt.conversationId, list);
    }

    const cardsByConv = new Map<string, AnalyticsFlashcardRow[]>();
    for (const card of flashcards) {
      const list = cardsByConv.get(card.conversationId) ?? [];
      list.push(card);
      cardsByConv.set(card.conversationId, list);
    }

    const documentMasteries = docsData.documents.map((doc) => {
      const convAnswers = answersByConv.get(doc.conversationId) ?? [];
      const uniqueConvAnswers = new Map<string, (typeof convAnswers)[number]>();
      for (const a of convAnswers) {
        if (!uniqueConvAnswers.has(a.questionId)) {
          uniqueConvAnswers.set(a.questionId, a);
        }
      }

      return computeDocumentMastery({
        documentId: doc.id,
        conversationId: doc.conversationId,
        fileName: doc.fileName,
        pageCount: doc.pageCount,
        docMetadata: doc.docMetadata,
        chunks: chunksByDoc.get(doc.id) ?? [],
        latestQuizAnswers: Array.from(uniqueConvAnswers.values()),
        flashcards: cardsByConv.get(doc.conversationId) ?? [],
        now,
      });
    });

    const weakTopics = extractWeakTopicsFromDocuments(
      documentMasteries.map((mastery) => ({
        mastery,
        conversationTitle: conversationTitleMap.get(mastery.conversationId),
      })),
      8,
    );

    const minutesByDate = computeStudyMinutesByDate(
      reviews,
      quizAttempts,
      tzOffsetMinutes,
    );
    const todayKey = computeLocalDateKey(now, tzOffsetMinutes);
    const minutesDoneToday = minutesByDate.get(todayKey) ?? 0;

    const activityDates = [
      ...reviews.map((r) => r.reviewedAt),
      ...quizSubmittedDates,
    ];
    const habit = computeWeeklyHabit(
      minutesByDate,
      activityDates,
      {
        currentStreakDays: srsOverview.studyStreakDays,
        longestStreakDays: srsOverview.longestStreakDays,
        studiedToday: srsOverview.studiedToday,
        activeDaysLast30: srsOverview.activeDaysLast30,
      },
      now,
      tzOffsetMinutes,
    );

    const trueRetention = computeTrueRetentionWithDelta(reviews, 30, now);
    const progressBuckets = computeProgressBuckets(
      reviews,
      quizAttempts,
      windowDays,
      now,
      tzOffsetMinutes,
    );
    const quizRetakeGains = computeQuizRetakeGains(quizAttempts, 5);
    const latestQuizAvgPct = computeLatestQuizAvgPct(quizAttempts, 5);
    const advancedQuizSignals = computeAdvancedQuizSignals(latestQuizAnswers);

    const minutesPerDayAvg14 =
      (habit.minutesThisWeek + habit.minutesLastWeek) / 14;

    const readiness = computeExamReadiness({
      examDate: goalConfig.examDate,
      targetScore: goalConfig.targetScore,
      documentMasteries,
      chunks: docsData.chunks,
      minutesPerDayAvg: minutesPerDayAvg14,
      now,
      tzOffsetMinutes,
    });

    const headline = buildHeadlineMetrics({
      documentMasteries,
      trueRetention,
      habit,
      readiness,
    });

    const attentionItems = buildAttentionItems({
      documentMasteries,
      conversationTitleMap,
      askedChunkCounts,
      chunks: docsData.chunks,
      examDate: goalConfig.examDate,
      now,
      tzOffsetMinutes,
      limit: 12,
    });

    const overdueCount = computeOverdueCount(flashcards, now, tzOffsetMinutes);
    const effectiveConvId =
      attentionItems[0]?.conversationId ??
      weakTopics[0]?.conversationId ??
      goalConfig.defaultConversationId;

    const todayPlan = buildTodayPlan({
      defaultConversationId: effectiveConvId,
      subjectId: goalConfig.subjectId,
      srsOverview,
      leechCards,
      attentionItems,
      documentMasteries,
      minutesDoneToday,
      dailyGoalMinutes: goalConfig.dailyGoalMinutes,
      overdueCount,
    });

    const insights = buildCoachingInsights({
      headline,
      attentionItems,
      quizRetakeGains,
      bloomMastery,
      matchedPointsStrengths: advancedQuizSignals.matchedPointsStrengths,
      questionTypeGap: {
        objectiveAvgPct: advancedQuizSignals.objectiveAvgPct,
        essayAvgPct: advancedQuizSignals.essayAvgPct,
      },
      dueNowCount: srsOverview.dueNowCount,
    });

    const progress = {
      windowDays,
      buckets: progressBuckets.buckets,
      totalMinutesInWindow: progressBuckets.totalMinutesInWindow,
      avgRetentionInWindow: progressBuckets.avgRetentionInWindow,
      retentionSampleInWindow: progressBuckets.retentionSampleInWindow,
      quizRetakeGains,
      latestQuizAvgPct,
    };

    const advanced = {
      deckComposition: computeDeckComposition(flashcards),
      ratingDistribution: computeRatingDistribution(reviews, windowDays, now),
      flaggedCorrectCount: advancedQuizSignals.flaggedCorrectCount,
      flaggedIncorrectCount: advancedQuizSignals.flaggedIncorrectCount,
      questionTypeGap: {
        objectiveAvgPct: advancedQuizSignals.objectiveAvgPct,
        essayAvgPct: advancedQuizSignals.essayAvgPct,
      },
    };

    return {
      now,
      tzOffsetMinutes,
      windowDays,
      flashcards,
      quizAttempts,
      srsOverview,
      workloadForecast7Days,
      leechCards,
      quizPerformance,
      bloomMastery,
      missingPointsClusters,
      documentMasteries,
      weakTopics,
      todayPlan,
      headline,
      attentionItems,
      insights,
      progress,
      advanced,
    };
  }

  private buildSubjectConversationSummaries(
    conversations: Array<{ id: string; title: string; updatedAt: Date }>,
    flashcards: AnalyticsFlashcardRow[],
    quizAttempts: AnalyticsQuizAttemptRow[],
    documentMasteries: DocumentMasteryResponse[],
    now: Date,
    tzOffsetMinutes: number,
  ): SubjectConversationSummary[] {
    const cardsByConv = new Map<string, AnalyticsFlashcardRow[]>();
    for (const card of flashcards) {
      const arr = cardsByConv.get(card.conversationId) ?? [];
      arr.push(card);
      cardsByConv.set(card.conversationId, arr);
    }

    const attemptsByConv = new Map<string, AnalyticsQuizAttemptRow[]>();
    for (const att of quizAttempts) {
      const arr = attemptsByConv.get(att.conversationId) ?? [];
      arr.push(att);
      attemptsByConv.set(att.conversationId, arr);
    }

    const weakCountByConv = new Map<string, number>();
    for (const dm of documentMasteries) {
      weakCountByConv.set(
        dm.conversationId,
        (weakCountByConv.get(dm.conversationId) ?? 0) + dm.weakSectionsCount,
      );
    }

    return conversations
      .map((conv) => {
        const convCards = cardsByConv.get(conv.id) ?? [];
        const convAttempts = attemptsByConv.get(conv.id) ?? [];
        const convSrs = computeSrsOverviewStats({
          cards: convCards,
          reviews: [],
          quizSubmittedDates: [],
          windowDays: DEFAULT_RETENTION_WINDOW_DAYS,
          now,
          tzOffsetMinutes,
        });
        const convQuizPerf = computeQuizPerformanceSummary(convAttempts);
        const convLeeches = extractLeechCards(convCards, convCards.length || 1);

        return {
          conversationId: conv.id,
          title: conv.title,
          updatedAt: conv.updatedAt.toISOString(),
          totalCards: convCards.length,
          dueNowCount: convSrs.dueNowCount,
          leechCount: convLeeches.length,
          quizAttemptCount: convQuizPerf.totalSubmittedAttempts,
          avgQuizScorePct: convQuizPerf.avgScorePct,
          weakSectionsCount: weakCountByConv.get(conv.id) ?? 0,
        };
      })
      .sort((a, b) => {
        const urgencyA = a.weakSectionsCount * 3 + a.leechCount * 2 + a.dueNowCount;
        const urgencyB = b.weakSectionsCount * 3 + b.leechCount * 2 + b.dueNowCount;
        if (urgencyA !== urgencyB) return urgencyB - urgencyA;
        return b.updatedAt.localeCompare(a.updatedAt);
      });
  }
}
