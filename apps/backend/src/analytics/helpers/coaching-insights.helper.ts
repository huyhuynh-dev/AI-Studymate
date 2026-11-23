import type { AnalyticsChunkIndexRow } from '../../repo/analytics-repo/analytics-repo.service.js';
import type {
  AttentionItem,
  BloomMasterySummary,
  CoachingInsight,
  DocumentMasteryResponse,
  ExamReadinessMetric,
  HeadlineMetrics,
  LeechCardItem,
  MasteryConfidence,
  MetricStatusLabel,
  QuizRetakeGainItem,
  SrsOverviewStats,
  TodayPlanTask,
  TodayStudyPlan,
} from '../analytics.types.js';
import {
  computeLocalDateKey,
  DEFAULT_TZ_OFFSET_MINUTES,
} from './srs-analytics.helper.js';

const MS_PER_DAY = 86_400_000;
const MIN_MASTERY_SECTIONS_SAMPLE = 1;

function resolveDaysUntilExam(
  examDate: Date | null,
  now: Date,
  tzOffsetMinutes: number,
): number | null {
  if (!examDate) return null;
  const todayKey = computeLocalDateKey(now, tzOffsetMinutes);
  const examKey = examDate.toISOString().slice(0, 10);
  const diffMs = Date.parse(`${examKey}T00:00:00.000Z`) - Date.parse(`${todayKey}T00:00:00.000Z`);
  return Math.round(diffMs / MS_PER_DAY);
}

function buildSectionTokenWeights(
  chunks: AnalyticsChunkIndexRow[],
): Map<string, number> {
  const tokensByChunk = new Map<string, number>();
  for (const ch of chunks) {
    tokensByChunk.set(
      ch.id,
      typeof ch.tokenCount === 'number' && ch.tokenCount > 0 ? ch.tokenCount : 200,
    );
  }
  return tokensByChunk;
}

function sumSectionTokens(
  chunkIds: string[],
  tokensByChunk: Map<string, number>,
): number {
  if (chunkIds.length === 0) return 200;
  let total = 0;
  for (const cid of chunkIds) {
    total += tokensByChunk.get(cid) ?? 200;
  }
  return Math.max(200, total);
}

function buildSectionReasons(params: {
  quizCorrect: number;
  quizTotal: number;
  leechCount: number;
  missingPoints: string[];
  askedAiCount: number;
  status: string;
}): string[] {
  const reasons: string[] = [];
  if (params.quizTotal > 0) {
    reasons.push(`Đúng ${params.quizCorrect}/${params.quizTotal} câu kiểm tra`);
  }
  if (params.leechCount > 0) {
    reasons.push(`${params.leechCount} thẻ hay quên`);
  }
  if (params.missingPoints.length > 0) {
    reasons.push(`Hay bỏ sót: ${params.missingPoints[0]}`);
  }
  if (params.askedAiCount >= 3) {
    reasons.push(`Hỏi AI ${params.askedAiCount} lần`);
  }
  if (reasons.length === 0 && params.status === 'unstudied') {
    reasons.push('Đã hỏi AI nhiều lần nhưng chưa có bài luyện tập');
  }
  return reasons.slice(0, 3);
}

function resolveConfidenceFactor(confidence: MasteryConfidence): number {
  if (confidence === 'high') return 1.0;
  if (confidence === 'medium') return 0.85;
  return 0.65;
}

export function buildAttentionItems(input: {
  documentMasteries: DocumentMasteryResponse[];
  conversationTitleMap: Map<string, string>;
  askedChunkCounts: Map<string, number>;
  chunks: AnalyticsChunkIndexRow[];
  examDate: Date | null;
  now?: Date;
  tzOffsetMinutes?: number;
  limit?: number;
}): AttentionItem[] {
  const now = input.now ?? new Date();
  const tz = input.tzOffsetMinutes ?? DEFAULT_TZ_OFFSET_MINUTES;
  const daysLeft = resolveDaysUntilExam(input.examDate, now, tz);
  const examPressure =
    daysLeft !== null && daysLeft >= 0 && daysLeft <= 14
      ? Math.min(1, (14 - daysLeft) / 14)
      : 0;

  const tokensByChunk = buildSectionTokenWeights(input.chunks);
  let maxSectionTokens = 1;
  for (const dm of input.documentMasteries) {
    for (const sec of dm.sections) {
      const w = sumSectionTokens(sec.chunkIds, tokensByChunk);
      if (w > maxSectionTokens) maxSectionTokens = w;
    }
  }

  const items: AttentionItem[] = [];

  for (const dm of input.documentMasteries) {
    const convTitle = input.conversationTitleMap.get(dm.conversationId);
    for (const sec of dm.sections) {
      let askedAiCount = 0;
      for (const cid of sec.chunkIds) {
        askedAiCount = Math.max(askedAiCount, input.askedChunkCounts.get(cid) ?? 0);
      }

      const isWeak = sec.status === 'weak';
      const isDevelopingWithGap =
        sec.status === 'developing' &&
        (sec.leechCount > 0 || sec.missingPoints.length > 0 || askedAiCount >= 3);
      const isUnstudiedAskedOften =
        sec.status === 'unstudied' && askedAiCount >= 3;

      if (!isWeak && !isDevelopingWithGap && !isUnstudiedAskedOften) {
        continue;
      }

      const confidence: MasteryConfidence = sec.confidence ?? 'low';
      const masteryGap =
        sec.masteryScore !== null
          ? Math.max(0.05, (100 - sec.masteryScore) / 100)
          : 0.45;
      const tokenWeight =
        0.5 + 0.5 * (sumSectionTokens(sec.chunkIds, tokensByChunk) / maxSectionTokens);
      const askedBoost = askedAiCount >= 3 ? 1.5 : 1;
      const studiedPriorityMultiplier = sec.masteryScore !== null ? 1.0 : 0.75;
      const priorityScore =
        Math.round(
          masteryGap *
            tokenWeight *
            askedBoost *
            studiedPriorityMultiplier *
            (1 + examPressure) *
            resolveConfidenceFactor(confidence) *
            1000,
        ) / 1000;

      const reasons = buildSectionReasons({
        quizCorrect: sec.quizCorrect,
        quizTotal: sec.quizTotal,
        leechCount: sec.leechCount,
        missingPoints: sec.missingPoints,
        askedAiCount,
        status: sec.status,
      });

      const canTargetQuiz = sec.chunkIds.length > 0;
      const pageNo = sec.startPage ?? 1;

      items.push({
        sectionKey: `${dm.documentId}:${sec.index}`,
        title: sec.text,
        conversationId: dm.conversationId,
        ...(convTitle ? { conversationTitle: convTitle } : {}),
        documentId: dm.documentId,
        fileName: dm.fileName,
        startPage: sec.startPage,
        endPage: sec.endPage,
        masteryScore: sec.masteryScore,
        status: sec.status,
        confidence,
        priorityScore,
        reasons,
        primaryAction: canTargetQuiz
          ? {
              type: 'targeted_quiz_weak_chunk',
              label: isUnstudiedAskedOften ? 'Tạo bài luyện' : 'Luyện mục này',
              payload: {
                conversationId: dm.conversationId,
                documentId: dm.documentId,
                pageNo,
                chunkIds: sec.chunkIds.slice(0, 10),
                sectionTitle: sec.text,
                bloomPreset: 'exam_prep',
              },
            }
          : {
              type: 'read_unstudied_section',
              label: 'Đọc lại mục này',
              payload: {
                conversationId: dm.conversationId,
                documentId: dm.documentId,
                pageNo,
                sectionTitle: sec.text,
              },
            },
        ...(sec.startPage !== null
          ? {
              secondaryAction: {
                type: 'open_pdf' as const,
                label: 'Xem trang',
                payload: {
                  documentId: dm.documentId,
                  fileName: dm.fileName,
                  pageNo,
                  conversationId: dm.conversationId,
                },
              },
            }
          : {}),
      });
    }
  }

  return items
    .sort((a, b) => b.priorityScore - a.priorityScore)
    .slice(0, Math.max(1, input.limit ?? 12));
}

export function buildTodayPlan(input: {
  defaultConversationId: string;
  subjectId?: string;
  srsOverview: SrsOverviewStats;
  leechCards: LeechCardItem[];
  attentionItems: AttentionItem[];
  documentMasteries: DocumentMasteryResponse[];
  minutesDoneToday: number;
  dailyGoalMinutes: number;
  overdueCount: number;
}): TodayStudyPlan {
  const tasks: TodayPlanTask[] = [];
  const secPerCard =
    input.srsOverview.avgResponseTimeMs && input.srsOverview.avgResponseTimeMs > 0
      ? Math.max(5, Math.min(60, input.srsOverview.avgResponseTimeMs / 1000))
      : 20;

  if (input.srsOverview.dueNowCount > 0) {
    const cardsBatch =
      input.overdueCount > 30
        ? Math.min(25, input.srsOverview.dueNowCount)
        : input.srsOverview.dueNowCount;
    const estMin = Math.max(1, Math.round((cardsBatch * secPerCard) / 60));
    const deckId = input.leechCards[0]?.deckId;
    tasks.push({
      id: `plan-due-${input.defaultConversationId}`,
      order: tasks.length + 1,
      actionType: 'review_due_cards',
      title:
        input.overdueCount > 30
          ? `Ôn trước ${cardsBatch} thẻ đến hạn hôm nay`
          : `Ôn ${input.srsOverview.dueNowCount} thẻ đến hạn hôm nay`,
      subtitle: 'Giữ nhịp ghi nhớ đều đặn trước khi kiến thức mờ đi',
      estimatedMinutes: estMin,
      actionLabel: 'Bắt đầu ôn thẻ',
      payload: {
        conversationId: input.defaultConversationId,
        ...(input.subjectId ? { subjectId: input.subjectId } : {}),
        ...(deckId ? { deckId } : {}),
      },
    });
  }

  const topAttention = input.attentionItems[0];
  if (topAttention && tasks.length < 3) {
    tasks.push({
      id: `plan-attention-${topAttention.sectionKey}`,
      order: tasks.length + 1,
      actionType: topAttention.primaryAction.type,
      title: `Củng cố "${topAttention.title}"`,
      subtitle: topAttention.reasons[0] ?? 'Mục cần ưu tiên ôn lại',
      estimatedMinutes: 8,
      actionLabel: topAttention.primaryAction.label,
      payload: topAttention.primaryAction.payload,
    });
  }

  if (input.leechCards.length > 0 && tasks.length < 3) {
    const firstLeech = input.leechCards[0];
    const firstRef = firstLeech.sourceRefs[0];
    tasks.push({
      id: `plan-leech-${firstLeech.conversationId}`,
      order: tasks.length + 1,
      actionType: 'remediate_leech_cards',
      title: `Xem lại ${input.leechCards.length} thẻ hay quên`,
      subtitle: `Thẻ "${firstLeech.frontText}" đã quên ${firstLeech.againCount} lần`,
      estimatedMinutes: 5,
      actionLabel: 'Mở bộ thẻ',
      payload: {
        conversationId: firstLeech.conversationId,
        ...(input.subjectId ? { subjectId: input.subjectId } : {}),
        deckId: firstLeech.deckId,
        flashcardIds: input.leechCards.slice(0, 5).map((c) => c.id),
        ...(firstRef
          ? { documentId: firstRef.documentId, pageNo: firstRef.pageNumbers[0] }
          : {}),
      },
    });
  }

  if (tasks.length < 3) {
    for (const dm of input.documentMasteries) {
      const unstudied = dm.sections.find(
        (s) => s.status === 'unstudied' && s.startPage !== null,
      );
      if (!unstudied) continue;
      tasks.push({
        id: `plan-read-${dm.documentId}-${unstudied.index}`,
        order: tasks.length + 1,
        actionType: 'read_unstudied_section',
        title: `Đọc mục mới: "${unstudied.text}"`,
        subtitle: `${dm.fileName} · Tr. ${unstudied.startPage}`,
        estimatedMinutes: 7,
        actionLabel: 'Mở trang PDF',
        payload: {
          conversationId: dm.conversationId,
          ...(input.subjectId ? { subjectId: input.subjectId } : {}),
          documentId: dm.documentId,
          pageNo: unstudied.startPage ?? 1,
          sectionTitle: unstudied.text,
        },
      });
      break;
    }
  }

  const totalEstimatedMinutes = tasks.reduce(
    (sum, t) => sum + t.estimatedMinutes,
    0,
  );

  const gentleCatchupSuggestion =
    input.overdueCount > 30
      ? `Hiện có ${input.overdueCount} thẻ tồn đọng — bạn chỉ cần ôn khoảng 25 thẻ/ngày trong ${Math.ceil(
          input.overdueCount / 25,
        )} ngày để bắt kịp nhẹ nhàng.`
      : null;

  return {
    tasks: tasks.slice(0, 3),
    totalEstimatedMinutes,
    minutesDoneToday: Math.round(input.minutesDoneToday),
    dailyGoalMinutes: input.dailyGoalMinutes,
    overdueCount: input.overdueCount,
    gentleCatchupSuggestion,
  };
}

export function computeExamReadiness(input: {
  examDate: Date | null;
  targetScore: number | null;
  documentMasteries: DocumentMasteryResponse[];
  chunks: AnalyticsChunkIndexRow[];
  minutesPerDayAvg: number;
  now?: Date;
  tzOffsetMinutes?: number;
}): ExamReadinessMetric | null {
  if (!input.examDate) return null;
  const now = input.now ?? new Date();
  const tz = input.tzOffsetMinutes ?? DEFAULT_TZ_OFFSET_MINUTES;
  const daysLeft = resolveDaysUntilExam(input.examDate, now, tz);
  if (daysLeft === null) return null;

  const targetScore = input.targetScore ?? 85;
  const examDateStr = input.examDate.toISOString().slice(0, 10);
  const tokensByChunk = buildSectionTokenWeights(input.chunks);

  let totalWeight = 0;
  let studiedWeight = 0;
  let weightedScoreSum = 0;
  let weakDeficitPoints = 0;

  for (const dm of input.documentMasteries) {
    for (const sec of dm.sections) {
      const w = sumSectionTokens(sec.chunkIds, tokensByChunk);
      totalWeight += w;
      if (sec.masteryScore !== null && sec.status !== 'unstudied') {
        studiedWeight += w;
        weightedScoreSum += sec.masteryScore * w;
        if (sec.masteryScore < targetScore) {
          weakDeficitPoints += targetScore - sec.masteryScore;
        }
      } else {
        weakDeficitPoints += targetScore * 0.6;
      }
    }
  }

  if (totalWeight === 0 || studiedWeight === 0) {
    return {
      value: null,
      deltaVsPrev: null,
      sampleSize: 0,
      minSampleSize: 1,
      label: 'insufficient_data',
      explanation:
        'Hãy ôn tập ít nhất một mục tài liệu để hệ thống ước lượng độ sẵn sàng cho kỳ thi.',
      examDate: examDateStr,
      targetScore,
      daysLeft,
      projectedScore: null,
      suggestedExtraMinutesPerDay: null,
      coverageRate: 0,
    };
  }

  const coverageRatio = studiedWeight / totalWeight;
  const avgMastery = weightedScoreSum / studiedWeight;
  const readiness = Math.round(avgMastery * (0.7 + 0.3 * coverageRatio));
  const coverageRate = Math.round(coverageRatio * 100);

  const minutesNeeded = Math.max(20, Math.round(weakDeficitPoints * 0.45));
  const safeDaysLeft = Math.max(1, daysLeft);
  const effectiveAvgMin = Math.max(5, input.minutesPerDayAvg);
  const projectedGainRatio = Math.min(
    1,
    (safeDaysLeft * effectiveAvgMin) / minutesNeeded,
  );
  const projectedScore = Math.min(
    100,
    Math.round(readiness + (targetScore - readiness) * projectedGainRatio),
  );

  const requiredMinPerDay = Math.ceil(minutesNeeded / safeDaysLeft);
  const suggestedExtraMinutesPerDay =
    projectedScore < targetScore && daysLeft > 0
      ? Math.max(5, Math.min(60, requiredMinPerDay - Math.round(input.minutesPerDayAvg)))
      : null;

  const label: MetricStatusLabel =
    readiness >= targetScore
      ? 'good'
      : readiness >= targetScore - 15
        ? 'ok'
        : 'needs_work';

  return {
    value: readiness,
    deltaVsPrev: null,
    sampleSize: studiedWeight,
    minSampleSize: 1,
    label,
    explanation: `Tính từ mức nắm vững các mục đã học (${Math.round(avgMastery)}%) và độ phủ nội dung tài liệu (${coverageRate}%).`,
    examDate: examDateStr,
    targetScore,
    daysLeft,
    projectedScore,
    suggestedExtraMinutesPerDay,
    coverageRate,
  };
}

export function buildHeadlineMetrics(input: {
  documentMasteries: DocumentMasteryResponse[];
  trueRetention: HeadlineMetrics['retention'];
  habit: HeadlineMetrics['habit'];
  readiness: ExamReadinessMetric | null;
}): HeadlineMetrics {
  let sectionsTotal = 0;
  let sectionsStudied = 0;
  let sectionsMastered = 0;
  let weightedSum = 0;
  let weightTotal = 0;

  for (const dm of input.documentMasteries) {
    sectionsTotal += dm.totalSections;
    sectionsStudied += dm.studiedSectionsCount;
    sectionsMastered += dm.masteredSectionsCount;
    for (const sec of dm.sections) {
      if (sec.masteryScore === null || sec.status === 'unstudied') continue;
      const w = Math.max(1, sec.quizTotal + sec.cardReviewed);
      weightedSum += sec.masteryScore * w;
      weightTotal += w;
    }
  }

  const masteryValue =
    weightTotal > 0 ? Math.round(weightedSum / weightTotal) : null;
  const masteryLabel: MetricStatusLabel =
    masteryValue === null || sectionsStudied < MIN_MASTERY_SECTIONS_SAMPLE
      ? 'insufficient_data'
      : masteryValue >= 80
        ? 'good'
        : masteryValue >= 55
          ? 'ok'
          : 'needs_work';

  return {
    mastery: {
      value: masteryValue,
      deltaVsPrev: null,
      sampleSize: sectionsStudied,
      minSampleSize: MIN_MASTERY_SECTIONS_SAMPLE,
      label: masteryLabel,
      explanation:
        'Tính từ điểm kiểm tra gần đây (55%) kết hợp độ nhớ thẻ ghi nhớ (45%) trên các mục đã học.',
      sectionsMastered,
      sectionsStudied,
      sectionsTotal,
    },
    retention: input.trueRetention,
    habit: input.habit,
    readiness: input.readiness,
  };
}

function buildPositiveInsight(input: {
  retention: HeadlineMetrics['retention'];
  habit: HeadlineMetrics['habit'];
  quizRetakeGains: QuizRetakeGainItem[];
  masterySectionsCount: number;
  matchedPointsStrengths: string[];
  dueNowCount: number;
}): CoachingInsight | null {
  if (
    input.retention.deltaVsPrev !== null &&
    input.retention.deltaVsPrev >= 3
  ) {
    return {
      ruleId: 'retention_improved',
      tone: 'positive',
      message: `Tỉ lệ nhớ đúng tăng +${Math.round(input.retention.deltaVsPrev)}% so với kỳ trước.`,
    };
  }

  const bestRetake = input.quizRetakeGains.find((g) => g.gainPct >= 5);
  if (bestRetake) {
    return {
      ruleId: 'quiz_retake_gain',
      tone: 'positive',
      message: `Làm lại "${bestRetake.quizTitle}" tăng từ ${bestRetake.firstScorePct}% lên ${bestRetake.latestScorePct}%.`,
    };
  }

  if (input.habit.streakDays >= 3) {
    return {
      ruleId: 'streak_milestone',
      tone: 'positive',
      message: `Bạn đã duy trì học liên tục ${input.habit.streakDays} ngày.`,
    };
  }

  if (input.masterySectionsCount > 0) {
    return {
      ruleId: 'sections_mastered',
      tone: 'positive',
      message: `Bạn đã nắm vững ${input.masterySectionsCount} mục kiến thức trong tài liệu.`,
    };
  }

  if (input.matchedPointsStrengths.length > 0) {
    return {
      ruleId: 'essay_strength',
      tone: 'positive',
      message: `Bạn trả lời rất chắc ý: "${input.matchedPointsStrengths[0]}".`,
    };
  }

  if (input.dueNowCount === 0 && input.habit.studiedToday) {
    return {
      ruleId: 'caught_up_today',
      tone: 'positive',
      message: 'Bạn đã hoàn thành toàn bộ thẻ cần ôn hôm nay.',
    };
  }

  return null;
}

export function buildCoachingInsights(input: {
  headline: HeadlineMetrics;
  attentionItems: AttentionItem[];
  quizRetakeGains: QuizRetakeGainItem[];
  bloomMastery: BloomMasterySummary;
  matchedPointsStrengths: string[];
  questionTypeGap: { objectiveAvgPct: number | null; essayAvgPct: number | null };
  dueNowCount: number;
}): CoachingInsight[] {
  const insights: CoachingInsight[] = [];

  const positive = buildPositiveInsight({
    retention: input.headline.retention,
    habit: input.headline.habit,
    quizRetakeGains: input.quizRetakeGains,
    masterySectionsCount: input.headline.mastery.sectionsMastered,
    matchedPointsStrengths: input.matchedPointsStrengths,
    dueNowCount: input.dueNowCount,
  });
  if (positive) {
    insights.push(positive);
  }

  const readiness = input.headline.readiness;
  if (
    readiness &&
    readiness.suggestedExtraMinutesPerDay &&
    readiness.projectedScore !== null
  ) {
    insights.push({
      ruleId: 'exam_pace_gap',
      tone: 'focus',
      message: `Với nhịp hiện tại bạn dự kiến đạt ~${readiness.projectedScore}% vào ngày thi. Tăng thêm ${readiness.suggestedExtraMinutesPerDay} phút/ngày để chạm mục tiêu ${readiness.targetScore}%.`,
    });
  } else if (input.attentionItems[0]) {
    const top = input.attentionItems[0];
    insights.push({
      ruleId: 'top_attention',
      tone: 'focus',
      message: `"${top.title}" đang là mục cần ưu tiên nhất${
        top.reasons[0] ? ` (${top.reasons[0].toLowerCase()})` : ''
      }.`,
    });
  }

  const objPct = input.questionTypeGap.objectiveAvgPct;
  const essayPct = input.questionTypeGap.essayAvgPct;
  if (
    insights.length < 3 &&
    objPct !== null &&
    essayPct !== null &&
    objPct - essayPct >= 25
  ) {
    insights.push({
      ruleId: 'essay_vs_objective_gap',
      tone: 'info',
      message: `Bạn làm trắc nghiệm tốt (${Math.round(objPct)}%) hơn tự luận (${Math.round(essayPct)}%) — hãy thử tự diễn đạt lại bằng lời của mình.`,
    });
  }

  const rememberLvl = input.bloomMastery.levels.find((l) => l.level === 'remember');
  const analyzeLvl = input.bloomMastery.levels.find((l) => l.level === 'analyze');
  if (
    insights.length < 3 &&
    rememberLvl &&
    analyzeLvl &&
    rememberLvl.totalAnswered >= 5 &&
    analyzeLvl.totalAnswered >= 5 &&
    rememberLvl.accuracyRate !== null &&
    analyzeLvl.accuracyRate !== null &&
    rememberLvl.accuracyRate - analyzeLvl.accuracyRate >= 25
  ) {
    insights.push({
      ruleId: 'bloom_analyze_gap',
      tone: 'info',
      message: `Bạn nhớ khái niệm tốt (${Math.round(rememberLvl.accuracyRate)}%) nhưng còn cần luyện thêm câu hỏi phân tích (${Math.round(analyzeLvl.accuracyRate)}%).`,
    });
  }

  return insights.slice(0, 3);
}
