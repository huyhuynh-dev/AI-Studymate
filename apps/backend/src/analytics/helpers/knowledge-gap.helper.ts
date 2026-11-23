import {
  BLOOM_LEVELS,
  normalizeBloomLevel,
  type BloomLevel,
} from '../../common/types/bloom.types.js';
import {
  parseSourceRefs,
  type SourceReferenceItem,
} from '../../common/types/source-ref.types.js';
import {
  normalizeHeadingKey,
  parseGradingCriteria,
  stripHtml,
} from '../../common/utils/text.utils.js';
import { EvaluationStatusEnum } from '../../generated/prisma/client.js';
import type {
  AnalyticsQuizAnswerRow,
  AnalyticsQuizAttemptRow,
} from '../../repo/analytics-repo/analytics-repo.service.js';
import type {
  BloomMasteryItem,
  BloomMasterySummary,
  DocumentMasteryResponse,
  LeechCardItem,
  MissingPointCluster,
  QuizPerformanceSummary,
  QuizRetakeGainItem,
  SrsOverviewStats,
  StudyRecommendation,
  WeakTopicItem,
} from '../analytics.types.js';

/**
 * Rút trích câu trả lời mới nhất cho mỗi `questionId` từ danh sách attempt (đã sắp xếp mới nhất trước).
 */
export function deduplicateLatestQuizAnswers(
  attempts: AnalyticsQuizAttemptRow[],
): AnalyticsQuizAnswerRow[] {
  const seen = new Map<string, AnalyticsQuizAnswerRow>();
  for (const attempt of attempts) {
    for (const answer of attempt.answers) {
      if (!seen.has(answer.questionId)) {
        seen.set(answer.questionId, answer);
      }
    }
  }
  return Array.from(seen.values());
}

export function computeBloomMasteryBreakdown(
  latestAnswers: AnalyticsQuizAnswerRow[],
): BloomMasterySummary {
  const buckets = new Map<
    BloomLevel,
    { total: number; correct: number; partial: number; incorrect: number }
  >(
    BLOOM_LEVELS.map((lvl) => [
      lvl,
      { total: 0, correct: 0, partial: 0, incorrect: 0 },
    ]),
  );

  let untaggedCount = 0;

  for (const ans of latestAnswers) {
    const level = normalizeBloomLevel(ans.question.bloomLevel);
    if (!level) {
      untaggedCount += 1;
      continue;
    }

    const bucket = buckets.get(level)!;
    bucket.total += 1;
    if (ans.evaluationStatus === EvaluationStatusEnum.correct) {
      bucket.correct += 1;
    } else if (ans.evaluationStatus === EvaluationStatusEnum.partial) {
      bucket.partial += 1;
    } else if (ans.evaluationStatus === EvaluationStatusEnum.incorrect) {
      bucket.incorrect += 1;
    }
  }

  const levels: BloomMasteryItem[] = BLOOM_LEVELS.map((level) => {
    const b = buckets.get(level)!;
    const accuracyRate =
      b.total > 0
        ? Math.round(((b.correct + b.partial * 0.5) / b.total) * 1000) / 10
        : null;

    return {
      level,
      totalAnswered: b.total,
      correctCount: b.correct,
      partialCount: b.partial,
      incorrectCount: b.incorrect,
      accuracyRate,
    };
  });

  return { levels, untaggedCount };
}

export function computeQuizPerformanceSummary(
  attempts: AnalyticsQuizAttemptRow[],
): QuizPerformanceSummary {
  if (attempts.length === 0) {
    return {
      totalSubmittedAttempts: 0,
      avgScorePct: null,
      recentScores: [],
    };
  }

  const scored = attempts
    .filter((a) => a.maxScore > 0)
    .map((a) => ({
      attemptId: a.id,
      quizId: a.quizId,
      quizTitle: a.quizTitle,
      conversationId: a.conversationId,
      scorePct: Math.round((a.score / a.maxScore) * 1000) / 10,
      completedAt: (a.completedAt ?? new Date()).toISOString(),
    }));

  const avgScorePct =
    scored.length > 0
      ? Math.round(
          (scored.reduce((sum, s) => sum + s.scorePct, 0) / scored.length) * 10,
        ) / 10
      : null;

  // Trả về tối đa 10 lượt gần nhất theo thứ tự thời gian cũ -> mới để vẽ biểu đồ xu hướng
  const recentScores = scored.slice(0, 10).reverse();

  return {
    totalSubmittedAttempts: attempts.length,
    avgScorePct,
    recentScores,
  };
}

export function clusterMissingPoints(
  attempts: AnalyticsQuizAttemptRow[],
  limit = 10,
): MissingPointCluster[] {
  const clusters = new Map<
    string,
    {
      displayText: string;
      frequency: number;
      bloomLevels: Set<BloomLevel>;
      sampleQuestionText: string;
      sourceRefsMap: Map<string, SourceReferenceItem>;
    }
  >();

  for (const attempt of attempts) {
    for (const ans of attempt.answers) {
      if (
        ans.evaluationStatus !== EvaluationStatusEnum.incorrect &&
        ans.evaluationStatus !== EvaluationStatusEnum.partial
      ) {
        continue;
      }

      const missing = parseGradingCriteria(ans.missingPoints);
      if (missing.length === 0) continue;

      const bloom = normalizeBloomLevel(ans.question.bloomLevel);
      const refs = parseSourceRefs(ans.question.sourceRefs);
      const questionPlain = stripHtml(ans.question.questionText).slice(0, 160);

      for (const rawPoint of missing) {
        const key = normalizeHeadingKey(rawPoint);
        if (!key) continue;

        let entry = clusters.get(key);
        if (!entry) {
          entry = {
            displayText: rawPoint,
            frequency: 0,
            bloomLevels: new Set<BloomLevel>(),
            sampleQuestionText: questionPlain,
            sourceRefsMap: new Map<string, SourceReferenceItem>(),
          };
          clusters.set(key, entry);
        }

        entry.frequency += 1;
        if (bloom) entry.bloomLevels.add(bloom);
        for (const ref of refs) {
          if (entry.sourceRefsMap.size >= 3) break;
          const refKey = `${ref.documentId}:${ref.chunkId ?? ref.pageNumbers[0] ?? 1}`;
          if (!entry.sourceRefsMap.has(refKey)) {
            entry.sourceRefsMap.set(refKey, ref);
          }
        }
      }
    }
  }

  return Array.from(clusters.values())
    .sort((a, b) => b.frequency - a.frequency)
    .slice(0, Math.max(1, limit))
    .map((entry) => ({
      point: entry.displayText,
      frequency: entry.frequency,
      bloomLevels: Array.from(entry.bloomLevels),
      sampleQuestionText: entry.sampleQuestionText,
      sourceRefs: Array.from(entry.sourceRefsMap.values()),
    }));
}

export function extractWeakTopicsFromDocuments(
  documentMasteries: Array<{
    mastery: DocumentMasteryResponse;
    conversationTitle?: string;
  }>,
  limit = 8,
): WeakTopicItem[] {
  const weakItems: WeakTopicItem[] = [];

  for (const { mastery, conversationTitle } of documentMasteries) {
    for (const sec of mastery.sections) {
      if (sec.status !== 'weak' && sec.status !== 'developing') continue;
      if (sec.status === 'developing' && sec.leechCount === 0 && sec.missingPoints.length === 0) {
        continue;
      }

      weakItems.push({
        topic: sec.text,
        conversationId: mastery.conversationId,
        ...(conversationTitle ? { conversationTitle } : {}),
        documentId: mastery.documentId,
        fileName: mastery.fileName,
        startPage: sec.startPage,
        endPage: sec.endPage,
        masteryScore: sec.masteryScore,
        status: sec.status,
        quizCorrect: sec.quizCorrect,
        quizTotal: sec.quizTotal,
        leechCount: sec.leechCount,
        missingPointCount: sec.missingPoints.length,
        missingPoints: sec.missingPoints.slice(0, 3),
        chunkIds: sec.chunkIds.slice(0, 12),
      });
    }
  }

  return weakItems
    .sort((a, b) => {
      const scoreA = a.masteryScore ?? 100;
      const scoreB = b.masteryScore ?? 100;
      if (scoreA !== scoreB) return scoreA - scoreB;
      return b.leechCount + b.missingPointCount - (a.leechCount + a.missingPointCount);
    })
    .slice(0, Math.max(1, limit));
}

export function generateStudyRecommendations(input: {
  defaultConversationId: string;
  subjectId?: string;
  srsOverview: SrsOverviewStats;
  leechCards: LeechCardItem[];
  weakTopics: WeakTopicItem[];
  bloomMastery: BloomMasterySummary;
  documentMasteries: DocumentMasteryResponse[];
}): StudyRecommendation[] {
  const recommendations: StudyRecommendation[] = [];

  if (input.srsOverview.dueNowCount > 0) {
    const estMin = Math.max(
      1,
      Math.round(
        (input.srsOverview.dueNowCount *
          ((input.srsOverview.avgResponseTimeMs ?? 20_000) / 1000)) /
          60,
      ),
    );
    const primaryDeckId = input.leechCards[0]?.deckId;
    recommendations.push({
      id: `due-cards-${input.defaultConversationId}`,
      priority: input.srsOverview.dueNowCount >= 10 ? 'high' : 'medium',
      actionType: 'review_due_cards',
      title: `Ôn tập ${input.srsOverview.dueNowCount} thẻ Flashcard đến hạn`,
      reason: `Ước tính mất khoảng ${estMin} phút để giữ tỷ lệ ghi nhớ ổn định.`,
      actionLabel: 'Ôn tập ngay',
      payload: {
        conversationId: input.defaultConversationId,
        ...(input.subjectId ? { subjectId: input.subjectId } : {}),
        ...(primaryDeckId ? { deckId: primaryDeckId } : {}),
      },
    });
  }

  const weakestTopic = input.weakTopics.find((t) => t.chunkIds.length > 0);
  if (weakestTopic) {
    const pageRangeLabel =
      weakestTopic.startPage !== null
        ? weakestTopic.endPage && weakestTopic.endPage > weakestTopic.startPage
          ? `trang ${weakestTopic.startPage}–${weakestTopic.endPage}`
          : `trang ${weakestTopic.startPage}`
        : weakestTopic.fileName;

    recommendations.push({
      id: `weak-topic-${weakestTopic.documentId}-${weakestTopic.topic}`,
      priority: 'high',
      actionType: 'targeted_quiz_weak_chunk',
      title: `Củng cố mục "${weakestTopic.topic}"`,
      reason: `Mức độ thành thạo mới đạt ${weakestTopic.masteryScore ?? 0}% (${pageRangeLabel})${
        weakestTopic.missingPointCount > 0
          ? `, còn ${weakestTopic.missingPointCount} ý tự luận từng thiếu.`
          : '.'
      }`,
      actionLabel: 'Tạo đề đặc trị',
      payload: {
        conversationId: weakestTopic.conversationId,
        ...(input.subjectId ? { subjectId: input.subjectId } : {}),
        documentId: weakestTopic.documentId,
        ...(weakestTopic.startPage ? { pageNo: weakestTopic.startPage } : {}),
        chunkIds: weakestTopic.chunkIds,
        sectionTitle: weakestTopic.topic,
        bloomPreset: 'exam_prep',
      },
    });
  }

  if (input.leechCards.length > 0) {
    const topLeech = input.leechCards[0];
    const firstRef = topLeech.sourceRefs[0];
    recommendations.push({
      id: `leech-cards-${topLeech.conversationId}`,
      priority: input.leechCards.length >= 3 ? 'high' : 'medium',
      actionType: 'remediate_leech_cards',
      title: `Ôn lại ${input.leechCards.length} thẻ hay quên`,
      reason: `Thẻ "${topLeech.frontText}" đã bấm quên ${topLeech.againCount} lần — nên đọc lại đoạn gốc hoặc viết lại thẻ ngắn hơn.`,
      actionLabel: 'Xem lại thẻ & nguồn',
      payload: {
        conversationId: topLeech.conversationId,
        ...(input.subjectId ? { subjectId: input.subjectId } : {}),
        deckId: topLeech.deckId,
        flashcardIds: input.leechCards.slice(0, 5).map((c) => c.id),
        ...(firstRef ? { documentId: firstRef.documentId, pageNo: firstRef.pageNumbers[0] } : {}),
      },
    });
  }

  const rememberOrUnderstand = input.bloomMastery.levels.filter(
    (l) => l.level === 'remember' || l.level === 'understand',
  );
  const applyOrAnalyze = input.bloomMastery.levels.filter(
    (l) => l.level === 'apply' || l.level === 'analyze',
  );
  const lowerAnswered = rememberOrUnderstand.reduce((s, l) => s + l.totalAnswered, 0);
  const higherAnswered = applyOrAnalyze.reduce((s, l) => s + l.totalAnswered, 0);

  if (lowerAnswered >= 2 && higherAnswered >= 2) {
    const lowerAcc =
      rememberOrUnderstand.reduce(
        (s, l) => s + l.correctCount + l.partialCount * 0.5,
        0,
      ) / lowerAnswered;
    const higherAcc =
      applyOrAnalyze.reduce(
        (s, l) => s + l.correctCount + l.partialCount * 0.5,
        0,
      ) / higherAnswered;

    if (higherAcc < 0.6 && lowerAcc >= 0.65) {
      recommendations.push({
        id: `bloom-gap-${input.defaultConversationId}`,
        priority: 'medium',
        actionType: 'address_bloom_gap',
        title: 'Luyện thêm câu hỏi vận dụng & phân tích',
        reason: `Bạn nắm tốt câu ghi nhớ/hiểu (${Math.round(lowerAcc * 100)}%), nhưng câu vận dụng & phân tích mới đạt ${Math.round(higherAcc * 100)}%.`,
        actionLabel: 'Luyện câu vận dụng',
        payload: {
          conversationId: input.defaultConversationId,
          ...(input.subjectId ? { subjectId: input.subjectId } : {}),
          bloomPreset: 'exam_prep',
        },
      });
    }
  }

  for (const docMastery of input.documentMasteries) {
    const unstudied = docMastery.sections.find(
      (sec) => sec.status === 'unstudied' && sec.startPage !== null,
    );
    if (unstudied) {
      recommendations.push({
        id: `unstudied-${docMastery.documentId}-${unstudied.index}`,
        priority: 'low',
        actionType: 'read_unstudied_section',
        title: `Khám phá mục chưa ôn: "${unstudied.text}"`,
        reason: `Mục này trong ${docMastery.fileName} (trang ${unstudied.startPage}) chưa có Flashcard hoặc Quiz.`,
        actionLabel: 'Mở trang tài liệu',
        payload: {
          conversationId: docMastery.conversationId,
          ...(input.subjectId ? { subjectId: input.subjectId } : {}),
          documentId: docMastery.documentId,
          pageNo: unstudied.startPage ?? 1,
          ...(unstudied.chunkIds.length > 0 ? { chunkIds: unstudied.chunkIds.slice(0, 10) } : {}),
          sectionTitle: unstudied.text,
        },
      });
      break;
    }
  }

  return recommendations.slice(0, 5);
}

/**
 * Đo tiến bộ thực tế khi người học làm lại cùng một bài kiểm tra (>= 2 lượt nộp).
 */
export function computeQuizRetakeGains(
  attempts: AnalyticsQuizAttemptRow[],
  limit = 5,
): QuizRetakeGainItem[] {
  const byQuiz = new Map<
    string,
    {
      quizTitle: string;
      conversationId: string;
      entries: Array<{ scorePct: number; ts: number }>;
    }
  >();

  for (const att of attempts) {
    if (att.maxScore <= 0) continue;
    const scorePct = Math.round((att.score / att.maxScore) * 1000) / 10;
    const ts = att.completedAt?.getTime() ?? 0;
    const cur = byQuiz.get(att.quizId) ?? {
      quizTitle: att.quizTitle,
      conversationId: att.conversationId,
      entries: [],
    };
    cur.entries.push({ scorePct, ts });
    byQuiz.set(att.quizId, cur);
  }

  const gains: QuizRetakeGainItem[] = [];
  for (const [quizId, group] of byQuiz.entries()) {
    if (group.entries.length < 2) continue;
    const sorted = [...group.entries].sort((a, b) => a.ts - b.ts);
    const first = sorted[0].scorePct;
    const latest = sorted[sorted.length - 1].scorePct;
    gains.push({
      quizId,
      quizTitle: group.quizTitle,
      conversationId: group.conversationId,
      attemptsCount: sorted.length,
      firstScorePct: Math.round(first),
      latestScorePct: Math.round(latest),
      gainPct: Math.round((latest - first) * 10) / 10,
    });
  }

  return gains
    .sort((a, b) => Math.abs(b.gainPct) - Math.abs(a.gainPct))
    .slice(0, Math.max(1, limit));
}

export function computeLatestQuizAvgPct(
  attempts: AnalyticsQuizAttemptRow[],
  maxQuizzes = 5,
): number | null {
  const seenQuizIds = new Set<string>();
  const latestScores: number[] = [];

  for (const att of attempts) {
    if (att.maxScore <= 0 || seenQuizIds.has(att.quizId)) continue;
    seenQuizIds.add(att.quizId);
    latestScores.push((att.score / att.maxScore) * 100);
    if (latestScores.length >= maxQuizzes) break;
  }

  if (latestScores.length === 0) return null;
  const sum = latestScores.reduce((acc, val) => acc + val, 0);
  return Math.round((sum / latestScores.length) * 10) / 10;
}

export function computeAdvancedQuizSignals(
  latestAnswers: AnalyticsQuizAnswerRow[],
): {
  flaggedCorrectCount: number;
  flaggedIncorrectCount: number;
  objectiveAvgPct: number | null;
  essayAvgPct: number | null;
  matchedPointsStrengths: string[];
} {
  let flaggedCorrectCount = 0;
  let flaggedIncorrectCount = 0;
  let objEarned = 0;
  let objMax = 0;
  let essayEarned = 0;
  let essayMax = 0;
  const matchedCounts = new Map<string, { text: string; count: number }>();

  for (const ans of latestAnswers) {
    if (ans.isFlagged) {
      if (ans.evaluationStatus === EvaluationStatusEnum.correct) {
        flaggedCorrectCount += 1;
      } else if (ans.evaluationStatus === EvaluationStatusEnum.incorrect) {
        flaggedIncorrectCount += 1;
      }
    }

    const maxPts = Math.max(0, Number(ans.question.points) || 1);
    const earned = Math.max(0, Math.min(maxPts, Number(ans.pointsEarned) || 0));
    const qType = ans.question.questionType ?? '';
    if (qType === 'essay' || qType === 'short_answer') {
      essayEarned += earned;
      essayMax += maxPts;
    } else if (qType) {
      objEarned += earned;
      objMax += maxPts;
    }

    if (ans.evaluationStatus === EvaluationStatusEnum.correct) {
      for (const pt of parseGradingCriteria(ans.matchedPoints)) {
        const key = normalizeHeadingKey(pt);
        if (!key) continue;
        const cur = matchedCounts.get(key) ?? { text: pt, count: 0 };
        cur.count += 1;
        matchedCounts.set(key, cur);
      }
    }
  }

  const matchedPointsStrengths = Array.from(matchedCounts.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 3)
    .map((m) => m.text);

  return {
    flaggedCorrectCount,
    flaggedIncorrectCount,
    objectiveAvgPct:
      objMax > 0 ? Math.round((objEarned / objMax) * 1000) / 10 : null,
    essayAvgPct:
      essayMax > 0 ? Math.round((essayEarned / essayMax) * 1000) / 10 : null,
    matchedPointsStrengths,
  };
}
