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
      title: `${input.leechCards.length} thẻ khó nhớ (Leech) cần giải thích sâu`,
      reason: `Thẻ "${topLeech.frontText}" đã bấm quên ${topLeech.againCount} lần (ease=${topLeech.easeFactor}).`,
      actionLabel: 'Xem lại thẻ & nguồn PDF',
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
        title: 'Luyện thêm câu hỏi Vận dụng & Phân tích (Bloom)',
        reason: `Nhớ/Hiểu đạt ${Math.round(lowerAcc * 100)}%, nhưng Vận dụng/Phân tích mới đạt ${Math.round(higherAcc * 100)}%.`,
        actionLabel: 'Sinh đề Ôn thi chuyên sâu',
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
