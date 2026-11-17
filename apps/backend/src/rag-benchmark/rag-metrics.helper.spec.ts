import { describe, expect, it } from 'vitest';
import {
  aggregateModeMetrics,
  computeFirstRelevantRank,
  computeHitRateAtK,
  computeModeComparisonDelta,
  computeNdcgAtK,
  computePercentile,
  computePrecisionAtK,
  computeRecallAtK,
  computeReciprocalRankAtK,
  evaluateSingleQuery,
} from './helpers/rag-metrics.helper.js';
import type {
  GoldenBenchmarkQuery,
  RankedCandidateItem,
} from './rag-benchmark.types.js';

function makeCandidate(chunkId: string, score: number): RankedCandidateItem {
  return {
    chunkId,
    documentId: 'doc-1',
    fileName: 'Test.pdf',
    headings: ['Chương 1'],
    score,
    vectorRank: 1,
    keywordRank: 1,
    rrfScore: 0.032,
    rerankScore: score,
  };
}

function makeQuery(
  overrides?: Partial<GoldenBenchmarkQuery>,
): GoldenBenchmarkQuery {
  return {
    id: 'q-test-1',
    category: 'semantic_lookup',
    subjectName: 'Hệ điều hành',
    question: 'Câu hỏi kiểm thử?',
    semanticQuery: 'truy vấn kiểm thử',
    keywords: ['kiểm thử'],
    decomposedSubQueries: [
      { semanticQuery: 'truy vấn kiểm thử', keywords: ['kiểm thử'] },
    ],
    expectedChunkIds: ['c1', 'c2'],
    relevanceGrades: { c1: 3, c2: 2 },
    notes: 'test',
    ...overrides,
  };
}

describe('rag-metrics.helper', () => {
  describe('computeHitRateAtK & computeFirstRelevantRank & computeReciprocalRankAtK', () => {
    it('nên tính đúng Hit@K, hạng đầu tiên và MRR khi kết quả khớp ở các vị trí khác nhau', () => {
      const returned = ['x1', 'x2', 'c2', 'c1', 'x3'];
      const expected = ['c1', 'c2'];

      expect(computeHitRateAtK(returned, expected, 1)).toBe(0);
      expect(computeHitRateAtK(returned, expected, 2)).toBe(0);
      expect(computeHitRateAtK(returned, expected, 3)).toBe(1);
      expect(computeHitRateAtK(returned, expected, 5)).toBe(1);

      expect(computeFirstRelevantRank(returned, expected)).toBe(3);
      expect(computeReciprocalRankAtK(returned, expected, 2)).toBe(0);
      expect(computeReciprocalRankAtK(returned, expected, 3)).toBeCloseTo(
        0.3333,
        4,
      );
    });

    it('nên xử lý an toàn khi mảng rỗng hoặc trùng lặp chunkId trong danh sách trả về', () => {
      expect(computeHitRateAtK([], ['c1'], 5)).toBe(0);
      expect(computeHitRateAtK(['c1'], [], 5)).toBe(0);
      expect(computeFirstRelevantRank(['x1', 'x1', 'c1'], ['c1'])).toBe(2);
      expect(computeReciprocalRankAtK(['x1', 'x1', 'c1'], ['c1'], 5)).toBe(0.5);
    });
  });

  describe('computeRecallAtK & computePrecisionAtK', () => {
    it('nên tính đúng Recall@K và Precision@K mà không bị nhân đôi khi trùng lặp ID', () => {
      const returned = ['c1', 'x1', 'c1', 'c2', 'x2'];
      const expected = ['c1', 'c2', 'c3'];

      // Top-5 unique = ['c1', 'x1', 'c2', 'x2'] (4 phần tử, trúng 2/3 expected)
      expect(computeRecallAtK(returned, expected, 5)).toBeCloseTo(0.6667, 4);
      expect(computePrecisionAtK(returned, expected, 5)).toBe(0.5);
      // Top-2 unique = ['c1', 'x1'] (trúng 1/3 expected)
      expect(computeRecallAtK(returned, expected, 2)).toBeCloseTo(0.3333, 4);
      expect(computePrecisionAtK(returned, expected, 2)).toBe(0.5);
    });
  });

  describe('computeNdcgAtK', () => {
    it('nên trả về 1.0 khi thứ tự xếp hạng đạt lý tưởng theo relevanceGrades', () => {
      const returned = ['c1', 'c2', 'x1', 'x2'];
      const grades = { c1: 3 as const, c2: 2 as const };
      expect(computeNdcgAtK(returned, grades, 5)).toBe(1);
    });

    it('nên giảm NDCG khi đoạn liên quan cao hơn (grade 3) đứng sau đoạn grade 2', () => {
      const ideal = computeNdcgAtK(
        ['c1', 'c2'],
        { c1: 3, c2: 1 },
        5,
      );
      const swapped = computeNdcgAtK(
        ['c2', 'c1'],
        { c1: 3, c2: 1 },
        5,
      );

      expect(ideal).toBe(1);
      expect(swapped).toBeGreaterThan(0);
      expect(swapped).toBeLessThan(1);
    });

    it('nên trả về 0 khi không có đoạn chuẩn nào được trả về hoặc bảng điểm rỗng', () => {
      expect(computeNdcgAtK(['x1', 'x2'], { c1: 3 }, 5)).toBe(0);
      expect(computeNdcgAtK(['c1'], {}, 5)).toBe(0);
    });
  });

  describe('computePercentile', () => {
    it('nên tính đúng P50 và P95', () => {
      const latencies = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
      expect(computePercentile(latencies, 50)).toBe(50);
      expect(computePercentile(latencies, 95)).toBe(100);
      expect(computePercentile([], 95)).toBe(0);
    });
  });

  describe('evaluateSingleQuery & aggregateModeMetrics & computeModeComparisonDelta', () => {
    it('nên đánh giá chính xác cả câu hỏi trong phạm vi lẫn câu bẫy ngoài phạm vi (Anti-Hallucination)', () => {
      const inScope1 = evaluateSingleQuery({
        query: makeQuery({ id: 'q1' }),
        returnedCandidates: [makeCandidate('c1', 0.9), makeCandidate('c2', 0.8)],
        outOfScopeRejectThreshold: 0.45,
        latencyMs: 12.5,
        subQueriesUsed: ['q1'],
      });
      const inScope2 = evaluateSingleQuery({
        query: makeQuery({ id: 'q2', expectedChunkIds: ['c1'] }),
        returnedCandidates: [makeCandidate('x1', 0.6), makeCandidate('c1', 0.55)],
        outOfScopeRejectThreshold: 0.45,
        latencyMs: 25.0,
        subQueriesUsed: ['q2'],
      });
      const outOfScopeRejected = evaluateSingleQuery({
        query: makeQuery({
          id: 'q-trap-1',
          category: 'out_of_scope_trap',
          expectedChunkIds: [],
          relevanceGrades: {},
        }),
        returnedCandidates: [makeCandidate('x1', 0.25)],
        outOfScopeRejectThreshold: 0.45,
        latencyMs: 8.0,
        subQueriesUsed: ['trap'],
      });
      const outOfScopeLeaked = evaluateSingleQuery({
        query: makeQuery({
          id: 'q-trap-2',
          category: 'out_of_scope_trap',
          expectedChunkIds: [],
          relevanceGrades: {},
        }),
        returnedCandidates: [makeCandidate('x1', 0.6)],
        outOfScopeRejectThreshold: 0.45,
        latencyMs: 10.0,
        subQueriesUsed: ['trap'],
      });

      expect(inScope1.hitAt1).toBe(1);
      expect(inScope1.recallAt5).toBe(1);
      expect(inScope2.hitAt1).toBe(0);
      expect(inScope2.hitAt3).toBe(1);
      expect(inScope2.reciprocalRankAt5).toBe(0.5);
      expect(outOfScopeRejected.rejectedOutOfScope).toBe(true);
      expect(outOfScopeLeaked.rejectedOutOfScope).toBe(false);

      const agg = aggregateModeMetrics('hybrid_rrf_rerank', [
        inScope1,
        inScope2,
        outOfScopeRejected,
        outOfScopeLeaked,
      ]);

      expect(agg.totalQueries).toBe(4);
      expect(agg.inScopeQueries).toBe(2);
      expect(agg.outOfScopeQueries).toBe(2);
      expect(agg.hitRateAt1).toBe(0.5);
      expect(agg.hitRateAt3).toBe(1);
      expect(agg.mrrAt5).toBe(0.75);
      expect(agg.antiHallucinationRate).toBe(0.5);
    });

    it('nên tính chênh lệch điểm phần trăm chính xác giữa baseline và proposed', () => {
      const base = aggregateModeMetrics('vector_only', [
        evaluateSingleQuery({
          query: makeQuery({ id: 'q1', expectedChunkIds: ['c1'] }),
          returnedCandidates: [makeCandidate('x1', 0.8), makeCandidate('c1', 0.7)],
          outOfScopeRejectThreshold: 0.4,
          latencyMs: 10,
          subQueriesUsed: ['q1'],
        }),
      ]);
      const prop = aggregateModeMetrics('hybrid_rrf_rerank', [
        evaluateSingleQuery({
          query: makeQuery({ id: 'q1', expectedChunkIds: ['c1'] }),
          returnedCandidates: [makeCandidate('c1', 0.9)],
          outOfScopeRejectThreshold: 0.45,
          latencyMs: 15,
          subQueriesUsed: ['q1'],
        }),
      ]);

      const delta = computeModeComparisonDelta(base, prop);
      expect(delta.hitRateAt1DeltaPct).toBe(100);
      expect(delta.mrrAt5DeltaPct).toBe(50);
    });
  });
});
