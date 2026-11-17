import type {
  BenchmarkQueryCategory,
  CategoryBreakdownMetrics,
  CategoryModeSummary,
  GoldenBenchmarkQuery,
  ModeAggregateMetrics,
  ModeComparisonDelta,
  RagBenchmarkMode,
  RankedCandidateItem,
  SingleQueryEvaluationResult,
} from '../rag-benchmark.types.js';
import { CATEGORY_LABELS } from '../datasets/golden-dataset.js';

export const MODE_DISPLAY_LABELS: Record<RagBenchmarkMode, string> = {
  vector_only: 'Vector-Only (pgvector)',
  keyword_only: 'Keyword-Only (PGroonga)',
  hybrid_rrf: 'Single-Query Hybrid RRF (k=60)',
  hybrid_rrf_rerank: 'Full 5-Step Pipeline (Decompose + Hybrid RRF + Rerank)',
};

export const BENCHMARK_MODES_ORDER: readonly RagBenchmarkMode[] = [
  'vector_only',
  'keyword_only',
  'hybrid_rrf',
  'hybrid_rrf_rerank',
];

function roundMetric(value: number, decimals = 4): number {
  if (!Number.isFinite(value)) return 0;
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function deduplicateIds(ids: readonly string[]): string[] {
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const id of ids) {
    if (!seen.has(id)) {
      seen.add(id);
      unique.push(id);
    }
  }
  return unique;
}

export function computeHitRateAtK(
  returnedIds: readonly string[],
  expectedIds: readonly string[],
  k: number,
): number {
  if (k <= 0 || expectedIds.length === 0 || returnedIds.length === 0) {
    return 0;
  }
  const expectedSet = new Set(expectedIds);
  const topK = deduplicateIds(returnedIds).slice(0, k);
  return topK.some((id) => expectedSet.has(id)) ? 1 : 0;
}

export function computeFirstRelevantRank(
  returnedIds: readonly string[],
  expectedIds: readonly string[],
): number | null {
  if (expectedIds.length === 0 || returnedIds.length === 0) {
    return null;
  }
  const expectedSet = new Set(expectedIds);
  const uniqueReturned = deduplicateIds(returnedIds);
  const idx = uniqueReturned.findIndex((id) => expectedSet.has(id));
  return idx >= 0 ? idx + 1 : null;
}

export function computeReciprocalRankAtK(
  returnedIds: readonly string[],
  expectedIds: readonly string[],
  k: number,
): number {
  if (k <= 0) return 0;
  const rank = computeFirstRelevantRank(returnedIds, expectedIds);
  if (rank === null || rank > k) return 0;
  return roundMetric(1 / rank);
}

export function computeRecallAtK(
  returnedIds: readonly string[],
  expectedIds: readonly string[],
  k: number,
): number {
  if (k <= 0 || expectedIds.length === 0 || returnedIds.length === 0) {
    return 0;
  }
  const expectedSet = new Set(expectedIds);
  const topK = deduplicateIds(returnedIds).slice(0, k);
  let matched = 0;
  for (const id of topK) {
    if (expectedSet.has(id)) {
      matched += 1;
    }
  }
  return roundMetric(matched / expectedSet.size);
}

export function computePrecisionAtK(
  returnedIds: readonly string[],
  expectedIds: readonly string[],
  k: number,
): number {
  if (k <= 0 || expectedIds.length === 0 || returnedIds.length === 0) {
    return 0;
  }
  const expectedSet = new Set(expectedIds);
  const topK = deduplicateIds(returnedIds).slice(0, k);
  if (topK.length === 0) return 0;

  let matched = 0;
  for (const id of topK) {
    if (expectedSet.has(id)) {
      matched += 1;
    }
  }
  return roundMetric(matched / topK.length);
}

export function computeNdcgAtK(
  returnedIds: readonly string[],
  relevanceGrades: Readonly<Record<string, 1 | 2 | 3>>,
  k: number,
): number {
  if (k <= 0 || returnedIds.length === 0) {
    return 0;
  }

  const idealGrades = Object.values(relevanceGrades)
    .filter((grade) => grade > 0)
    .sort((a, b) => b - a)
    .slice(0, k);

  if (idealGrades.length === 0) {
    return 0;
  }

  let idcg = 0;
  for (let i = 0; i < idealGrades.length; i++) {
    idcg += (2 ** idealGrades[i] - 1) / Math.log2(i + 2);
  }
  if (idcg <= 0) {
    return 0;
  }

  const topK = deduplicateIds(returnedIds).slice(0, k);
  let dcg = 0;
  for (let i = 0; i < topK.length; i++) {
    const rel = relevanceGrades[topK[i]] ?? 0;
    if (rel > 0) {
      dcg += (2 ** rel - 1) / Math.log2(i + 2);
    }
  }

  return roundMetric(Math.min(1, dcg / idcg));
}

export function computePercentile(
  values: readonly number[],
  percentile: number,
): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const clampedP = Math.max(0, Math.min(100, percentile));
  const index = Math.max(
    0,
    Math.min(sorted.length - 1, Math.ceil((clampedP / 100) * sorted.length) - 1),
  );
  return roundMetric(sorted[index], 2);
}

export function evaluateSingleQuery(params: {
  query: GoldenBenchmarkQuery;
  returnedCandidates: readonly RankedCandidateItem[];
  outOfScopeRejectThreshold: number;
  latencyMs: number;
  subQueriesUsed: readonly string[];
}): SingleQueryEvaluationResult {
  const {
    query,
    returnedCandidates,
    outOfScopeRejectThreshold,
    latencyMs,
    subQueriesUsed,
  } = params;

  const returnedIds = returnedCandidates.map((c) => c.chunkId);
  const topCandidateScore = roundMetric(returnedCandidates[0]?.score ?? 0, 4);
  const isOutOfScope = query.expectedChunkIds.length === 0;

  if (isOutOfScope) {
    const rejectedOutOfScope =
      returnedCandidates.length === 0 ||
      topCandidateScore < outOfScopeRejectThreshold;

    return {
      queryId: query.id,
      category: query.category,
      question: query.question,
      isOutOfScope: true,
      expectedChunkIds: query.expectedChunkIds,
      returnedChunkIds: returnedIds,
      topCandidateScore,
      firstRelevantRank: null,
      hitAt1: 0,
      hitAt3: 0,
      hitAt5: 0,
      hitAt8: 0,
      reciprocalRankAt5: 0,
      reciprocalRankAt8: 0,
      recallAt5: 0,
      recallAt8: 0,
      precisionAt5: 0,
      ndcgAt5: 0,
      ndcgAt8: 0,
      rejectedOutOfScope,
      latencyMs: roundMetric(latencyMs, 2),
      subQueriesUsed,
    };
  }

  return {
    queryId: query.id,
    category: query.category,
    question: query.question,
    isOutOfScope: false,
    expectedChunkIds: query.expectedChunkIds,
    returnedChunkIds: returnedIds,
    topCandidateScore,
    firstRelevantRank: computeFirstRelevantRank(
      returnedIds,
      query.expectedChunkIds,
    ),
    hitAt1: computeHitRateAtK(returnedIds, query.expectedChunkIds, 1),
    hitAt3: computeHitRateAtK(returnedIds, query.expectedChunkIds, 3),
    hitAt5: computeHitRateAtK(returnedIds, query.expectedChunkIds, 5),
    hitAt8: computeHitRateAtK(returnedIds, query.expectedChunkIds, 8),
    reciprocalRankAt5: computeReciprocalRankAtK(
      returnedIds,
      query.expectedChunkIds,
      5,
    ),
    reciprocalRankAt8: computeReciprocalRankAtK(
      returnedIds,
      query.expectedChunkIds,
      8,
    ),
    recallAt5: computeRecallAtK(returnedIds, query.expectedChunkIds, 5),
    recallAt8: computeRecallAtK(returnedIds, query.expectedChunkIds, 8),
    precisionAt5: computePrecisionAtK(returnedIds, query.expectedChunkIds, 5),
    ndcgAt5: computeNdcgAtK(returnedIds, query.relevanceGrades, 5),
    ndcgAt8: computeNdcgAtK(returnedIds, query.relevanceGrades, 8),
    rejectedOutOfScope: null,
    latencyMs: roundMetric(latencyMs, 2),
    subQueriesUsed,
  };
}

function averageField(
  items: readonly SingleQueryEvaluationResult[],
  selector: (item: SingleQueryEvaluationResult) => number,
): number {
  if (items.length === 0) return 0;
  const total = items.reduce((acc, item) => acc + selector(item), 0);
  return roundMetric(total / items.length);
}

export function aggregateModeMetrics(
  mode: RagBenchmarkMode,
  results: readonly SingleQueryEvaluationResult[],
): ModeAggregateMetrics {
  const inScope = results.filter((r) => !r.isOutOfScope);
  const outOfScope = results.filter((r) => r.isOutOfScope);
  const latencies = results.map((r) => r.latencyMs);

  const rejectedCount = outOfScope.filter(
    (r) => r.rejectedOutOfScope === true,
  ).length;
  const antiHallucinationRate =
    outOfScope.length > 0 ? roundMetric(rejectedCount / outOfScope.length) : 1;

  return {
    mode,
    modeLabel: MODE_DISPLAY_LABELS[mode],
    totalQueries: results.length,
    inScopeQueries: inScope.length,
    outOfScopeQueries: outOfScope.length,
    hitRateAt1: averageField(inScope, (r) => r.hitAt1),
    hitRateAt3: averageField(inScope, (r) => r.hitAt3),
    hitRateAt5: averageField(inScope, (r) => r.hitAt5),
    hitRateAt8: averageField(inScope, (r) => r.hitAt8),
    mrrAt5: averageField(inScope, (r) => r.reciprocalRankAt5),
    mrrAt8: averageField(inScope, (r) => r.reciprocalRankAt8),
    recallAt5: averageField(inScope, (r) => r.recallAt5),
    recallAt8: averageField(inScope, (r) => r.recallAt8),
    precisionAt5: averageField(inScope, (r) => r.precisionAt5),
    ndcgAt5: averageField(inScope, (r) => r.ndcgAt5),
    ndcgAt8: averageField(inScope, (r) => r.ndcgAt8),
    antiHallucinationRate,
    avgLatencyMs: roundMetric(
      latencies.length > 0
        ? latencies.reduce((acc, v) => acc + v, 0) / latencies.length
        : 0,
      2,
    ),
    p50LatencyMs: computePercentile(latencies, 50),
    p95LatencyMs: computePercentile(latencies, 95),
  };
}

function summarizeCategoryForMode(
  results: readonly SingleQueryEvaluationResult[],
): CategoryModeSummary {
  const isOutOfScopeCategory = results.every((r) => r.isOutOfScope);
  if (isOutOfScopeCategory && results.length > 0) {
    const rejected = results.filter((r) => r.rejectedOutOfScope === true).length;
    return {
      hitRateAt5: 0,
      mrrAt5: 0,
      recallAt5: 0,
      ndcgAt5: 0,
      antiHallucinationRate: roundMetric(rejected / results.length),
    };
  }

  return {
    hitRateAt5: averageField(results, (r) => r.hitAt5),
    mrrAt5: averageField(results, (r) => r.reciprocalRankAt5),
    recallAt5: averageField(results, (r) => r.recallAt5),
    ndcgAt5: averageField(results, (r) => r.ndcgAt5),
    antiHallucinationRate: null,
  };
}

export function buildCategoryBreakdown(
  queryResultsByMode: Record<
    RagBenchmarkMode,
    readonly SingleQueryEvaluationResult[]
  >,
): CategoryBreakdownMetrics[] {
  const categories: readonly BenchmarkQueryCategory[] = [
    'semantic_lookup',
    'exact_technical',
    'bilingual_acronym',
    'multi_hop_comparison',
    'out_of_scope_trap',
  ];

  return categories.map((category) => {
    const sampleModeResults = queryResultsByMode.hybrid_rrf_rerank.filter(
      (r) => r.category === category,
    );

    const byMode: Record<RagBenchmarkMode, CategoryModeSummary> = {
      vector_only: summarizeCategoryForMode(
        queryResultsByMode.vector_only.filter((r) => r.category === category),
      ),
      keyword_only: summarizeCategoryForMode(
        queryResultsByMode.keyword_only.filter((r) => r.category === category),
      ),
      hybrid_rrf: summarizeCategoryForMode(
        queryResultsByMode.hybrid_rrf.filter((r) => r.category === category),
      ),
      hybrid_rrf_rerank: summarizeCategoryForMode(sampleModeResults),
    };

    return {
      category,
      categoryLabel: CATEGORY_LABELS[category],
      queryCount: sampleModeResults.length,
      byMode,
    };
  });
}

/**
 * Tính mức cải thiện theo điểm phần trăm (percentage-point delta: (proposed - baseline) * 100)
 */
export function computeModeComparisonDelta(
  baseline: ModeAggregateMetrics,
  proposed: ModeAggregateMetrics,
): ModeComparisonDelta {
  const deltaPct = (a: number, b: number) => roundMetric((b - a) * 100, 2);
  return {
    baselineMode: baseline.mode,
    proposedMode: proposed.mode,
    hitRateAt1DeltaPct: deltaPct(baseline.hitRateAt1, proposed.hitRateAt1),
    hitRateAt5DeltaPct: deltaPct(baseline.hitRateAt5, proposed.hitRateAt5),
    mrrAt5DeltaPct: deltaPct(baseline.mrrAt5, proposed.mrrAt5),
    recallAt5DeltaPct: deltaPct(baseline.recallAt5, proposed.recallAt5),
    ndcgAt5DeltaPct: deltaPct(baseline.ndcgAt5, proposed.ndcgAt5),
    antiHallucinationDeltaPct: deltaPct(
      baseline.antiHallucinationRate,
      proposed.antiHallucinationRate,
    ),
  };
}
