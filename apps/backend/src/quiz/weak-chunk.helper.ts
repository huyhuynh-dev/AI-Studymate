import { parseSourceRefs } from '../common/types/source-ref.types.js';
import { parseGradingCriteria, stripHtml } from './quiz.helper.js';

export interface WeakQuestionSignalInput {
  question_id: string;
  evaluation_status: string;
  missing_points: unknown;
  question: {
    id: string;
    question_text: string;
    source_refs: unknown;
  } | null;
}

export interface WeakFlashcardSignalInput {
  id: string;
  front_text: string;
  ease_factor: number;
  state: string;
  source_refs: unknown;
  reviews?: Array<{ id: string }>;
}

export interface AggregatedWeakSignals {
  hasWeakAreas: boolean;
  weakChunkIds: string[];
  weakChunkCount: number;
  incorrectQuizCount: number;
  leechCardCount: number;
  topWeakTopics: string[];
  topMissingPoints: string[];
  priorFailedQuestions: string[];
}

/**
 * Tổng hợp và xếp hạng các vùng kiến thức (`chunkId`) người học hay làm sai / thiếu ý hoặc quên nhiều lần.
 * Hàm thuần túy 0% LLM để tính toán tức thì và dễ dàng kiểm thử đơn vị.
 */
export function aggregateWeakChunkSignals(
  questionSignals: WeakQuestionSignalInput[],
  flashcardSignals: WeakFlashcardSignalInput[],
  maxChunks = 10,
): AggregatedWeakSignals {
  const chunkScores = new Map<string, number>();
  const topicScores = new Map<string, number>();
  const missingPointCounts = new Map<string, number>();
  const priorFailedSet = new Set<string>();
  const incorrectQuestionIds = new Set<string>();
  const leechCardIds = new Set<string>();

  for (const sig of questionSignals) {
    incorrectQuestionIds.add(sig.question_id);

    const plainQuestion = stripHtml(sig.question?.question_text).trim();
    if (plainQuestion && priorFailedSet.size < 10) {
      priorFailedSet.add(plainQuestion);
    }

    const missingPoints = parseGradingCriteria(
      sig.missing_points as Parameters<typeof parseGradingCriteria>[0],
    );
    for (const point of missingPoints) {
      missingPointCounts.set(point, (missingPointCounts.get(point) ?? 0) + 1);
    }

    const baseWeight = sig.evaluation_status === 'incorrect' ? 3.0 : 1.5;
    const totalWeight = baseWeight + missingPoints.length * 1.0;

    const refs = parseSourceRefs(sig.question?.source_refs);
    for (const ref of refs) {
      const topic = ref.headings?.[ref.headings.length - 1]?.trim();
      if (topic) {
        topicScores.set(topic, (topicScores.get(topic) ?? 0) + totalWeight);
      }
      if (ref.chunkId) {
        chunkScores.set(
          ref.chunkId,
          (chunkScores.get(ref.chunkId) ?? 0) + totalWeight,
        );
      }
    }
  }

  for (const card of flashcardSignals) {
    leechCardIds.add(card.id);
    const againCount = Array.isArray(card.reviews) ? card.reviews.length : 0;
    const lowEaseOrRelearning =
      card.ease_factor < 1.8 || card.state === 'relearning' ? 2.0 : 1.2;
    const totalWeight = lowEaseOrRelearning + againCount * 1.8;

    const refs = parseSourceRefs(card.source_refs);
    for (const ref of refs) {
      const topic = ref.headings?.[ref.headings.length - 1]?.trim();
      if (topic) {
        topicScores.set(topic, (topicScores.get(topic) ?? 0) + totalWeight);
      }
      if (ref.chunkId) {
        chunkScores.set(
          ref.chunkId,
          (chunkScores.get(ref.chunkId) ?? 0) + totalWeight,
        );
      }
    }
  }

  const weakChunkIds = Array.from(chunkScores.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, Math.max(1, maxChunks))
    .map(([chunkId]) => chunkId);

  const topWeakTopics = Array.from(topicScores.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([topic]) => topic);

  const topMissingPoints = Array.from(missingPointCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([point]) => point);

  return {
    hasWeakAreas: weakChunkIds.length > 0,
    weakChunkIds,
    weakChunkCount: chunkScores.size,
    incorrectQuizCount: incorrectQuestionIds.size,
    leechCardCount: leechCardIds.size,
    topWeakTopics,
    topMissingPoints,
    priorFailedQuestions: Array.from(priorFailedSet),
  };
}
