export type RagBenchmarkMode =
  | 'vector_only'
  | 'keyword_only'
  | 'hybrid_rrf'
  | 'hybrid_rrf_rerank';

export type BenchmarkQueryCategory =
  | 'semantic_lookup'
  | 'exact_technical'
  | 'bilingual_acronym'
  | 'multi_hop_comparison'
  | 'out_of_scope_trap';

export type GoldenChunkType = 'text' | 'table' | 'formula' | 'code';

export interface GoldenCorpusDocument {
  readonly id: string;
  readonly subjectName: string;
  readonly fileName: string;
  readonly pageCount: number;
}

export interface GoldenCorpusChunk {
  readonly id: string;
  readonly documentId: string;
  readonly fileName: string;
  readonly subjectName: string;
  readonly chunkIndex: number;
  readonly pageNumbers: readonly number[];
  readonly headings: readonly string[];
  readonly chunkType: GoldenChunkType;
  readonly content: string;
  readonly semanticConcepts: readonly string[];
  readonly exactTerms: readonly string[];
}

export interface DecomposedSubQuery {
  readonly semanticQuery: string;
  readonly keywords: readonly string[];
}

export interface GoldenBenchmarkQuery {
  readonly id: string;
  readonly category: BenchmarkQueryCategory;
  readonly subjectName: string;
  readonly question: string;
  readonly semanticQuery: string;
  readonly keywords: readonly string[];
  readonly decomposedSubQueries: readonly DecomposedSubQuery[];
  readonly expectedChunkIds: readonly string[];
  readonly relevanceGrades: Readonly<Record<string, 1 | 2 | 3>>;
  readonly notes: string;
}

export interface RankedCandidateItem {
  readonly chunkId: string;
  readonly documentId: string;
  readonly fileName: string;
  readonly headings: readonly string[];
  readonly score: number;
  readonly vectorRank: number | null;
  readonly keywordRank: number | null;
  readonly rrfScore: number;
  readonly rerankScore: number | null;
}

export interface SingleQueryEvaluationResult {
  readonly queryId: string;
  readonly category: BenchmarkQueryCategory;
  readonly question: string;
  readonly isOutOfScope: boolean;
  readonly expectedChunkIds: readonly string[];
  readonly returnedChunkIds: readonly string[];
  readonly topCandidateScore: number;
  readonly firstRelevantRank: number | null;
  readonly hitAt1: number;
  readonly hitAt3: number;
  readonly hitAt5: number;
  readonly hitAt8: number;
  readonly reciprocalRankAt5: number;
  readonly reciprocalRankAt8: number;
  readonly recallAt5: number;
  readonly recallAt8: number;
  readonly precisionAt5: number;
  readonly ndcgAt5: number;
  readonly ndcgAt8: number;
  readonly rejectedOutOfScope: boolean | null;
  readonly latencyMs: number;
  readonly subQueriesUsed: readonly string[];
}

export interface ModeAggregateMetrics {
  readonly mode: RagBenchmarkMode;
  readonly modeLabel: string;
  readonly totalQueries: number;
  readonly inScopeQueries: number;
  readonly outOfScopeQueries: number;
  readonly hitRateAt1: number;
  readonly hitRateAt3: number;
  readonly hitRateAt5: number;
  readonly hitRateAt8: number;
  readonly mrrAt5: number;
  readonly mrrAt8: number;
  readonly recallAt5: number;
  readonly recallAt8: number;
  readonly precisionAt5: number;
  readonly ndcgAt5: number;
  readonly ndcgAt8: number;
  readonly antiHallucinationRate: number;
  readonly avgLatencyMs: number;
  readonly p50LatencyMs: number;
  readonly p95LatencyMs: number;
}

export interface CategoryModeSummary {
  readonly hitRateAt5: number;
  readonly mrrAt5: number;
  readonly recallAt5: number;
  readonly ndcgAt5: number;
  readonly antiHallucinationRate: number | null;
}

export interface CategoryBreakdownMetrics {
  readonly category: BenchmarkQueryCategory;
  readonly categoryLabel: string;
  readonly queryCount: number;
  readonly byMode: Record<RagBenchmarkMode, CategoryModeSummary>;
}

export interface ModeComparisonDelta {
  readonly baselineMode: RagBenchmarkMode;
  readonly proposedMode: RagBenchmarkMode;
  readonly hitRateAt1DeltaPct: number;
  readonly hitRateAt5DeltaPct: number;
  readonly mrrAt5DeltaPct: number;
  readonly recallAt5DeltaPct: number;
  readonly ndcgAt5DeltaPct: number;
  readonly antiHallucinationDeltaPct: number;
}

export interface GoldenDatasetSummary {
  readonly version: string;
  readonly corpusDocumentCount: number;
  readonly corpusChunkCount: number;
  readonly totalQueries: number;
  readonly categoryCounts: Record<BenchmarkQueryCategory, number>;
  readonly documents: readonly GoldenCorpusDocument[];
  readonly chunks: readonly GoldenCorpusChunk[];
  readonly queries: readonly GoldenBenchmarkQuery[];
}

export interface RagBenchmarkReport {
  readonly generatedAt: string;
  readonly datasetVersion: string;
  readonly runnerType: 'golden_ablation' | 'live_database';
  readonly corpusStats: {
    readonly documentCount: number;
    readonly chunkCount: number;
    readonly totalQueries: number;
    readonly inScopeQueries: number;
    readonly outOfScopeQueries: number;
  };
  readonly modeMetrics: readonly ModeAggregateMetrics[];
  readonly deltasVsVectorOnly: ModeComparisonDelta;
  readonly deltasVsHybridRrf: ModeComparisonDelta;
  readonly categoryBreakdown: readonly CategoryBreakdownMetrics[];
  readonly queryResultsByMode: Record<
    RagBenchmarkMode,
    readonly SingleQueryEvaluationResult[]
  >;
}
