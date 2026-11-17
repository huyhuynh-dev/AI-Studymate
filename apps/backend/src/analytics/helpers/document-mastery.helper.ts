import { parseSourceRefs } from '../../common/types/source-ref.types.js';
import {
  normalizeHeadingKey,
  parseGradingCriteria,
} from '../../common/utils/text.utils.js';
import {
  CardStateEnum,
  EvaluationStatusEnum,
} from '../../generated/prisma/client.js';
import type {
  AnalyticsChunkIndexRow,
  AnalyticsFlashcardRow,
  AnalyticsQuizAnswerRow,
} from '../../repo/analytics-repo/analytics-repo.service.js';
import type {
  DocumentMasteryResponse,
  DocumentMasterySummary,
  MasteryStatus,
  TocMasterySection,
} from '../analytics.types.js';

export interface NormalizedTocSeed {
  index: number;
  text: string;
  normalizedKey: string;
  level: number;
  startPage: number | null;
  endPage: number | null;
}

interface SectionAccumulator {
  seed: NormalizedTocSeed;
  chunkIds: Set<string>;
  quizCorrect: number;
  quizTotal: number;
  quizEarnedPoints: number;
  quizMaxPoints: number;
  cardIds: Set<string>;
  reviewedCardScores: number[];
  cardMastered: number;
  leechCount: number;
  missingPoints: Map<string, string>;
}

export function classifyMasteryStatus(score: number | null): MasteryStatus {
  if (score === null) return 'unstudied';
  if (score < 55) return 'weak';
  if (score < 80) return 'developing';
  return 'mastered';
}

function readRawTocArray(docMetadata: unknown): Array<{
  text: string;
  level: number;
  pageNo: number | null;
}> {
  if (!docMetadata || typeof docMetadata !== 'object' || Array.isArray(docMetadata)) {
    return [];
  }
  const rawToc = (docMetadata as Record<string, unknown>).toc;
  if (!Array.isArray(rawToc)) return [];

  const parsed: Array<{ text: string; level: number; pageNo: number | null }> = [];
  for (const entry of rawToc) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue;
    const item = entry as Record<string, unknown>;
    const text = typeof item.text === 'string' ? item.text.trim() : '';
    if (!text) continue;

    const level =
      typeof item.level === 'number' && Number.isFinite(item.level) && item.level >= 1
        ? Math.min(6, Math.floor(item.level))
        : 1;
    const rawPage = item.page_no ?? item.pageNo;
    const pageNo =
      typeof rawPage === 'number' && Number.isFinite(rawPage) && rawPage > 0
        ? Math.floor(rawPage)
        : null;

    parsed.push({ text, level, pageNo });
  }
  return parsed;
}

function buildFallbackTocFromChunks(
  chunks: AnalyticsChunkIndexRow[],
): Array<{ text: string; level: number; pageNo: number | null }> {
  const seen = new Map<string, { text: string; level: number; pageNo: number | null }>();

  for (const chunk of chunks) {
    const primaryHeading = chunk.headings[0]?.trim();
    if (!primaryHeading) continue;
    const key = normalizeHeadingKey(primaryHeading);
    if (!key) continue;

    const minPage =
      chunk.pageNumbers.length > 0 ? Math.min(...chunk.pageNumbers) : null;

    const existing = seen.get(key);
    if (!existing) {
      seen.set(key, { text: primaryHeading, level: 1, pageNo: minPage });
    } else if (
      minPage !== null &&
      (existing.pageNo === null || minPage < existing.pageNo)
    ) {
      existing.pageNo = minPage;
    }
  }

  return Array.from(seen.values());
}

export function extractTocItems(
  docMetadata: unknown,
  pageCount: number | null,
  chunkIndexRows: AnalyticsChunkIndexRow[],
): NormalizedTocSeed[] {
  const rawList = readRawTocArray(docMetadata);
  const items =
    rawList.length > 0 ? rawList : buildFallbackTocFromChunks(chunkIndexRows);

  return items.map((item, idx) => {
    let endPage: number | null = item.pageNo;

    if (item.pageNo !== null) {
      let resolvedEnd: number | null = null;
      for (let j = idx + 1; j < items.length; j += 1) {
        const next = items[j];
        if (next.level <= item.level && next.pageNo !== null) {
          resolvedEnd =
            next.pageNo > item.pageNo ? next.pageNo - 1 : item.pageNo;
          break;
        }
      }
      if (resolvedEnd === null) {
        resolvedEnd =
          pageCount && pageCount >= item.pageNo ? pageCount : item.pageNo;
      }
      endPage = Math.max(item.pageNo, resolvedEnd);
    }

    return {
      index: idx,
      text: item.text,
      normalizedKey: normalizeHeadingKey(item.text),
      level: item.level,
      startPage: item.pageNo,
      endPage,
    };
  });
}

function findSectionIndexForLocation(
  seeds: NormalizedTocSeed[],
  headings: string[] | undefined,
  pageNumbers: number[] | undefined,
): number | null {
  if (seeds.length === 0) return null;

  const firstPage =
    pageNumbers && pageNumbers.length > 0 ? Math.min(...pageNumbers) : null;

  if (headings && headings.length > 0) {
    for (let h = headings.length - 1; h >= 0; h -= 1) {
      const hKey = normalizeHeadingKey(headings[h]);
      if (!hKey) continue;

      const exactMatches = seeds.filter((s) => s.normalizedKey === hKey);
      if (exactMatches.length === 1) {
        return exactMatches[0].index;
      }
      if (exactMatches.length > 1) {
        const pageMatched =
          firstPage !== null
            ? exactMatches.find(
                (s) =>
                  s.startPage !== null &&
                  s.endPage !== null &&
                  firstPage >= s.startPage &&
                  firstPage <= s.endPage,
              )
            : undefined;
        return (pageMatched ?? exactMatches[0]).index;
      }
    }
  }

  if (firstPage !== null) {
    let bestMatch: NormalizedTocSeed | null = null;
    for (const s of seeds) {
      if (
        s.startPage !== null &&
        s.endPage !== null &&
        firstPage >= s.startPage &&
        firstPage <= s.endPage
      ) {
        if (!bestMatch || s.level >= bestMatch.level) {
          bestMatch = s;
        }
      }
    }
    if (bestMatch) return bestMatch.index;
  }

  return null;
}

export function mapChunksToTocSections(
  seeds: NormalizedTocSeed[],
  chunks: AnalyticsChunkIndexRow[],
): {
  chunkToSectionIndex: Map<string, number>;
  sectionChunkIds: Map<number, Set<string>>;
} {
  const chunkToSectionIndex = new Map<string, number>();
  const sectionChunkIds = new Map<number, Set<string>>();

  for (const seed of seeds) {
    sectionChunkIds.set(seed.index, new Set());
  }

  for (const chunk of chunks) {
    const idx = findSectionIndexForLocation(
      seeds,
      chunk.headings,
      chunk.pageNumbers,
    );
    if (idx !== null) {
      chunkToSectionIndex.set(chunk.id, idx);
      sectionChunkIds.get(idx)?.add(chunk.id);
    }
  }

  return { chunkToSectionIndex, sectionChunkIds };
}

function computeSingleFlashcardScore(card: AnalyticsFlashcardRow): number | null {
  if (card.state === CardStateEnum.new && card.lastReviewedAt === null) {
    return null;
  }

  if (card.state === CardStateEnum.relearning) {
    return Math.max(10, 30 - card.againCount * 5);
  }
  if (card.state === CardStateEnum.learning) {
    return Math.max(20, 52 - card.againCount * 5);
  }

  const raw =
    62 +
    Math.min(card.interval, 30) * 1.0 +
    Math.max(0, card.easeFactor - 2.1) * 18 -
    Math.min(25, card.againCount * 6);
  return Math.max(25, Math.min(100, Math.round(raw)));
}

function finalizeSection(acc: SectionAccumulator): TocMasterySection {
  const quizScore =
    acc.quizTotal > 0 && acc.quizMaxPoints > 0
      ? (acc.quizEarnedPoints / acc.quizMaxPoints) * 100
      : null;

  const reviewedCount = acc.reviewedCardScores.length;
  const flashcardScore =
    reviewedCount > 0
      ? acc.reviewedCardScores.reduce((s, v) => s + v, 0) / reviewedCount
      : null;

  let masteryScore: number | null = null;
  if (quizScore !== null && flashcardScore !== null) {
    masteryScore = Math.round(quizScore * 0.55 + flashcardScore * 0.45);
  } else if (quizScore !== null) {
    masteryScore = Math.round(quizScore);
  } else if (flashcardScore !== null) {
    masteryScore = Math.round(flashcardScore);
  }

  return {
    index: acc.seed.index,
    text: acc.seed.text,
    level: acc.seed.level,
    startPage: acc.seed.startPage,
    endPage: acc.seed.endPage,
    status: classifyMasteryStatus(masteryScore),
    masteryScore,
    quizCorrect: acc.quizCorrect,
    quizTotal: acc.quizTotal,
    cardTotal: acc.cardIds.size,
    cardReviewed: reviewedCount,
    cardMastered: acc.cardMastered,
    leechCount: acc.leechCount,
    missingPoints: Array.from(acc.missingPoints.values()),
    chunkIds: Array.from(acc.chunkIds),
  };
}

export function computeDocumentMastery(input: {
  documentId: string;
  conversationId: string;
  fileName: string;
  pageCount: number | null;
  docMetadata: unknown;
  chunks: AnalyticsChunkIndexRow[];
  latestQuizAnswers: AnalyticsQuizAnswerRow[];
  flashcards: AnalyticsFlashcardRow[];
}): DocumentMasteryResponse {
  const seeds = extractTocItems(
    input.docMetadata,
    input.pageCount,
    input.chunks,
  );
  const { chunkToSectionIndex, sectionChunkIds } = mapChunksToTocSections(
    seeds,
    input.chunks,
  );

  const accumulators: SectionAccumulator[] = seeds.map((seed) => ({
    seed,
    chunkIds: sectionChunkIds.get(seed.index) ?? new Set<string>(),
    quizCorrect: 0,
    quizTotal: 0,
    quizEarnedPoints: 0,
    quizMaxPoints: 0,
    cardIds: new Set<string>(),
    reviewedCardScores: [],
    cardMastered: 0,
    leechCount: 0,
    missingPoints: new Map<string, string>(),
  }));

  const resolveSectionIndices = (rawRefs: unknown): number[] => {
    const refs = parseSourceRefs(rawRefs).filter(
      (r) => r.documentId === input.documentId,
    );
    const matched = new Set<number>();

    for (const ref of refs) {
      if (ref.chunkId && chunkToSectionIndex.has(ref.chunkId)) {
        matched.add(chunkToSectionIndex.get(ref.chunkId)!);
        continue;
      }
      const fallbackIdx = findSectionIndexForLocation(
        seeds,
        ref.headings,
        ref.pageNumbers,
      );
      if (fallbackIdx !== null) {
        matched.add(fallbackIdx);
      }
    }

    return Array.from(matched);
  };

  for (const ans of input.latestQuizAnswers) {
    const sectionIndices = resolveSectionIndices(ans.question.sourceRefs);
    if (sectionIndices.length === 0) continue;

    const maxPoints = Math.max(0, Number(ans.question.points) || 1);
    const earned = Math.max(0, Math.min(maxPoints, Number(ans.pointsEarned) || 0));
    const isCorrect = ans.evaluationStatus === EvaluationStatusEnum.correct;
    const missed = parseGradingCriteria(ans.missingPoints);

    for (const idx of sectionIndices) {
      const acc = accumulators[idx];
      acc.quizTotal += 1;
      if (isCorrect) acc.quizCorrect += 1;
      acc.quizEarnedPoints += earned;
      acc.quizMaxPoints += maxPoints;
      if (!isCorrect) {
        for (const pt of missed) {
          const key = normalizeHeadingKey(pt);
          if (key && !acc.missingPoints.has(key)) {
            acc.missingPoints.set(key, pt);
          }
        }
      }
    }
  }

  for (const card of input.flashcards) {
    const sectionIndices = resolveSectionIndices(card.sourceRefs);
    if (sectionIndices.length === 0) continue;

    const cardScore = computeSingleFlashcardScore(card);
    const isMastered =
      card.state === CardStateEnum.review &&
      (card.interval >= 21 || card.easeFactor >= 2.2);
    const isLeech =
      card.againCount >= 2 ||
      card.easeFactor < 2.0 ||
      card.state === CardStateEnum.relearning;

    for (const idx of sectionIndices) {
      const acc = accumulators[idx];
      if (acc.cardIds.has(card.id)) continue;
      acc.cardIds.add(card.id);
      if (cardScore !== null) acc.reviewedCardScores.push(cardScore);
      if (isMastered) acc.cardMastered += 1;
      if (isLeech) acc.leechCount += 1;
    }
  }

  const sections = accumulators.map(finalizeSection);

  let studiedWeightSum = 0;
  let weightedScoreSum = 0;
  let studiedSectionsCount = 0;
  let weakSectionsCount = 0;
  let developingSectionsCount = 0;
  let masteredSectionsCount = 0;

  for (const sec of sections) {
    if (sec.status === 'unstudied' || sec.masteryScore === null) continue;
    studiedSectionsCount += 1;
    if (sec.status === 'weak') weakSectionsCount += 1;
    else if (sec.status === 'developing') developingSectionsCount += 1;
    else if (sec.status === 'mastered') masteredSectionsCount += 1;

    const weight = Math.max(1, sec.quizTotal + sec.cardReviewed);
    weightedScoreSum += sec.masteryScore * weight;
    studiedWeightSum += weight;
  }

  const overallMasteryScore =
    studiedWeightSum > 0
      ? Math.round(weightedScoreSum / studiedWeightSum)
      : null;

  return {
    documentId: input.documentId,
    conversationId: input.conversationId,
    fileName: input.fileName,
    pageCount: input.pageCount,
    overallMasteryScore,
    overallStatus: classifyMasteryStatus(overallMasteryScore),
    totalSections: sections.length,
    studiedSectionsCount,
    weakSectionsCount,
    developingSectionsCount,
    masteredSectionsCount,
    sections,
  };
}

export function toDocumentMasterySummary(
  mastery: DocumentMasteryResponse,
): DocumentMasterySummary {
  return {
    documentId: mastery.documentId,
    fileName: mastery.fileName,
    pageCount: mastery.pageCount,
    overallMasteryScore: mastery.overallMasteryScore,
    overallStatus: mastery.overallStatus,
    totalSections: mastery.totalSections,
    studiedSectionsCount: mastery.studiedSectionsCount,
    weakSectionsCount: mastery.weakSectionsCount,
    masteredSectionsCount: mastery.masteredSectionsCount,
  };
}
