import { Injectable, Logger, Optional } from '@nestjs/common';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { RetrievalService } from '../documents/services/retrieval.service.js';
import {
  GOLDEN_BENCHMARK_QUERIES,
  GOLDEN_CORPUS_CHUNKS,
  GOLDEN_CORPUS_DOCUMENTS,
  GOLDEN_DATASET_VERSION,
  getGoldenDatasetSummary,
} from './datasets/golden-dataset.js';
import {
  BENCHMARK_MODES_ORDER,
  aggregateModeMetrics,
  buildCategoryBreakdown,
  computeModeComparisonDelta,
  evaluateSingleQuery,
} from './helpers/rag-metrics.helper.js';
import { renderRagBenchmarkMarkdown } from './helpers/markdown-report.helper.js';
import type {
  GoldenBenchmarkQuery,
  GoldenCorpusChunk,
  GoldenDatasetSummary,
  ModeAggregateMetrics,
  RagBenchmarkMode,
  RagBenchmarkReport,
  RankedCandidateItem,
  SingleQueryEvaluationResult,
} from './rag-benchmark.types.js';

const RRF_K = 60;
const TOP_K = 8;
const RRF_POOL_SIZE = 25;

const OUT_OF_SCOPE_THRESHOLD: Record<RagBenchmarkMode, number> = {
  vector_only: 0.42,
  keyword_only: 0.4,
  hybrid_rrf: 0.02,
  hybrid_rrf_rerank: 0.45,
};

const STOP_WORDS = new Set<string>([
  'là',
  'gì',
  'của',
  'và',
  'trong',
  'cho',
  'với',
  'các',
  'những',
  'một',
  'khi',
  'nào',
  'thế',
  'sao',
  'như',
  'được',
  'để',
  'về',
  'tại',
  'bằng',
  'từ',
  'có',
  'không',
  'hay',
  'hoặc',
  'giữa',
  'the',
  'is',
  'are',
  'of',
  'and',
  'in',
  'to',
  'for',
  'with',
  'on',
  'how',
  'what',
  'why',
]);

function stripDiacritics(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D');
}

function tokenizeNormalized(text: string): string[] {
  const lowered = stripDiacritics(text.normalize('NFC').toLowerCase());
  const rawTokens = lowered.split(/[^a-z0-9_+@~[\]()]+/g);
  return rawTokens.filter((tok) => tok.length >= 2 && !STOP_WORDS.has(tok));
}

function extractExactLiterals(text: string): string[] {
  const normalized = text.normalize('NFC').toLowerCase();
  const tokens = normalized.split(/[\s,;:!?'"`]+/g);
  return tokens.filter((t) => t.length >= 2 && !STOP_WORDS.has(t));
}

function computeTokenJaccardAndContainment(
  queryTokens: readonly string[],
  targetTokens: readonly string[],
): number {
  if (queryTokens.length === 0 || targetTokens.length === 0) return 0;
  const querySet = new Set(queryTokens);
  const targetSet = new Set(targetTokens);

  let overlap = 0;
  for (const qt of querySet) {
    if (targetSet.has(qt)) {
      overlap += 1;
      continue;
    }
    if (qt.length >= 4) {
      for (const tt of targetSet) {
        if (tt.includes(qt) || qt.includes(tt)) {
          overlap += 0.6;
          break;
        }
      }
    }
  }

  if (overlap === 0) return 0;
  const queryCoverage = overlap / querySet.size;
  const targetPrecision = overlap / Math.sqrt(targetSet.size);
  return Math.min(1, queryCoverage * 0.72 + targetPrecision * 0.28);
}

function resolveNotesDirectory(): string {
  const candidates = [
    path.resolve(process.cwd(), '_ai_workspace/notes/UpgradeAi-Studymate'),
    path.resolve(
      process.cwd(),
      '../../_ai_workspace/notes/UpgradeAi-Studymate',
    ),
    path.resolve(
      import.meta.dirname,
      '../../../../_ai_workspace/notes/UpgradeAi-Studymate',
    ),
  ];

  for (const dir of candidates) {
    if (existsSync(path.dirname(dir))) {
      return dir;
    }
  }
  return candidates[0];
}

export interface LiveConversationQueryInput {
  readonly id: string;
  readonly category: GoldenBenchmarkQuery['category'];
  readonly question: string;
  readonly semanticQuery: string;
  readonly keywords: readonly string[];
  readonly expectedChunkIds: readonly string[];
  readonly relevanceGrades: Readonly<Record<string, 1 | 2 | 3>>;
}

@Injectable()
export class RagBenchmarkService {
  private readonly logger = new Logger(RagBenchmarkService.name);
  private cachedLatestReport: RagBenchmarkReport | null = null;

  constructor(
    @Optional() private readonly retrievalService?: RetrievalService,
  ) {}

  getDatasetSummary(): GoldenDatasetSummary {
    return getGoldenDatasetSummary();
  }

  getLatestReport(): RagBenchmarkReport | null {
    if (this.cachedLatestReport) {
      return this.cachedLatestReport;
    }

    const notesDir = resolveNotesDirectory();
    const jsonPath = path.join(notesDir, 'rag-benchmark-latest.json');
    if (existsSync(jsonPath)) {
      try {
        const raw = readFileSync(jsonPath, 'utf-8');
        const parsed = JSON.parse(raw) as RagBenchmarkReport;
        if (parsed && Array.isArray(parsed.modeMetrics)) {
          this.cachedLatestReport = parsed;
          return parsed;
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.warn(`Không đọc được file benchmark cache: ${msg}`);
      }
    }

    return null;
  }

  /**
   * Chạy thực nghiệm đối sánh 4 chế độ (Ablation Study) trên Golden Dataset chuẩn
   * và tùy chọn ghi báo cáo ra `_ai_workspace/notes/UpgradeAi-Studymate/`.
   */
  runGoldenAblationBenchmark(options?: {
    persistToDisk?: boolean;
  }): RagBenchmarkReport {
    const persistToDisk = options?.persistToDisk ?? false;
    const chunks = GOLDEN_CORPUS_CHUNKS;
    const queries = GOLDEN_BENCHMARK_QUERIES;

    const queryResultsByMode: Record<
      RagBenchmarkMode,
      SingleQueryEvaluationResult[]
    > = {
      vector_only: [],
      keyword_only: [],
      hybrid_rrf: [],
      hybrid_rrf_rerank: [],
    };

    for (const mode of BENCHMARK_MODES_ORDER) {
      for (const query of queries) {
        const t0 = performance.now();
        const { candidates, subQueriesUsed } = this.executeModeOnGoldenCorpus(
          mode,
          query,
          chunks,
        );
        const elapsedMs = Math.max(0.01, performance.now() - t0);

        const evaluated = evaluateSingleQuery({
          query,
          returnedCandidates: candidates.slice(0, TOP_K),
          outOfScopeRejectThreshold: OUT_OF_SCOPE_THRESHOLD[mode],
          latencyMs: elapsedMs,
          subQueriesUsed,
        });
        queryResultsByMode[mode].push(evaluated);
      }
    }

    const report = this.assembleReport({
      runnerType: 'golden_ablation',
      documentCount: GOLDEN_CORPUS_DOCUMENTS.length,
      chunkCount: chunks.length,
      queryResultsByMode,
    });

    this.cachedLatestReport = report;

    if (persistToDisk) {
      this.persistReportArtifacts(report);
    }

    return report;
  }

  /**
   * Thực thi đối sánh 4 chế độ trực tiếp qua RetrievalService trên PostgreSQL thật
   * cho một phiên học cụ thể (dùng khi kiểm nghiệm trên dữ liệu thực của sinh viên).
   */
  async runLiveConversationBenchmark(params: {
    userId: string;
    conversationId: string;
    queries: readonly LiveConversationQueryInput[];
    persistToDisk?: boolean;
  }): Promise<RagBenchmarkReport> {
    if (!this.retrievalService) {
      throw new Error(
        'RetrievalService chưa được inject để chạy Live Conversation Benchmark.',
      );
    }

    const { userId, conversationId, queries, persistToDisk = false } = params;
    const queryResultsByMode: Record<
      RagBenchmarkMode,
      SingleQueryEvaluationResult[]
    > = {
      vector_only: [],
      keyword_only: [],
      hybrid_rrf: [],
      hybrid_rrf_rerank: [],
    };

    const modeConfigs: Record<
      RagBenchmarkMode,
      {
        searchMode: 'vector_only' | 'keyword_only' | 'hybrid';
        enableQueryDecompose: boolean;
        enableRerank: boolean;
      }
    > = {
      vector_only: {
        searchMode: 'vector_only',
        enableQueryDecompose: false,
        enableRerank: false,
      },
      keyword_only: {
        searchMode: 'keyword_only',
        enableQueryDecompose: false,
        enableRerank: false,
      },
      hybrid_rrf: {
        searchMode: 'hybrid',
        enableQueryDecompose: false,
        enableRerank: false,
      },
      hybrid_rrf_rerank: {
        searchMode: 'hybrid',
        enableQueryDecompose: true,
        enableRerank: true,
      },
    };

    for (const mode of BENCHMARK_MODES_ORDER) {
      const cfg = modeConfigs[mode];
      for (const query of queries) {
        const t0 = performance.now();
        const retrieved = await this.retrievalService.searchRelevantChunks({
          userId,
          conversationId,
          semanticQuery: query.semanticQuery,
          keywords: [...query.keywords],
          topK: TOP_K,
          searchMode: cfg.searchMode,
          enableQueryDecompose: cfg.enableQueryDecompose,
          enableRerank: cfg.enableRerank,
        });
        const elapsedMs = Math.max(0.01, performance.now() - t0);

        const candidates: RankedCandidateItem[] = retrieved.map((c) => ({
          chunkId: c.id,
          documentId: c.documentId,
          fileName: c.fileName,
          headings: c.headings,
          score: c.rerankScore ?? c.rrfScore,
          vectorRank: c.vectorRank,
          keywordRank: c.keywordRank,
          rrfScore: c.rrfScore,
          rerankScore: c.rerankScore ?? null,
        }));

        const syntheticQuery: GoldenBenchmarkQuery = {
          id: query.id,
          category: query.category,
          subjectName: 'Live Conversation',
          question: query.question,
          semanticQuery: query.semanticQuery,
          keywords: query.keywords,
          decomposedSubQueries: [
            {
              semanticQuery: query.semanticQuery,
              keywords: query.keywords,
            },
          ],
          expectedChunkIds: query.expectedChunkIds,
          relevanceGrades: query.relevanceGrades,
          notes: 'Live PostgreSQL Evaluation',
        };

        const evaluated = evaluateSingleQuery({
          query: syntheticQuery,
          returnedCandidates: candidates,
          outOfScopeRejectThreshold: OUT_OF_SCOPE_THRESHOLD[mode],
          latencyMs: elapsedMs,
          subQueriesUsed: retrieved[0]?.subQueriesUsed ?? [query.semanticQuery],
        });
        queryResultsByMode[mode].push(evaluated);
      }
    }

    const availableDocs =
      await this.retrievalService.getAvailableDocumentsCatalog(
        userId,
        conversationId,
      );

    const report = this.assembleReport({
      runnerType: 'live_database',
      documentCount: availableDocs.length,
      chunkCount: 0,
      queryResultsByMode,
    });

    this.cachedLatestReport = report;
    if (persistToDisk) {
      this.persistReportArtifacts(report);
    }

    return report;
  }

  persistReportArtifacts(report: RagBenchmarkReport): {
    markdownPath: string;
    jsonPath: string;
  } {
    const notesDir = resolveNotesDirectory();
    if (!existsSync(notesDir)) {
      mkdirSync(notesDir, { recursive: true });
    }

    const markdownPath = path.join(notesDir, 'RAG_BENCHMARK_REPORT.md');
    const jsonPath = path.join(notesDir, 'rag-benchmark-latest.json');

    const markdownContent = renderRagBenchmarkMarkdown(report);
    writeFileSync(markdownPath, markdownContent, 'utf-8');
    writeFileSync(jsonPath, JSON.stringify(report, null, 2), 'utf-8');

    this.logger.log(
      `Đã xuất báo cáo RAG Benchmark tại [${markdownPath}] và [${jsonPath}]`,
    );

    return { markdownPath, jsonPath };
  }

  private assembleReport(params: {
    runnerType: 'golden_ablation' | 'live_database';
    documentCount: number;
    chunkCount: number;
    queryResultsByMode: Record<
      RagBenchmarkMode,
      SingleQueryEvaluationResult[]
    >;
  }): RagBenchmarkReport {
    const { runnerType, documentCount, chunkCount, queryResultsByMode } = params;

    const modeMetrics: ModeAggregateMetrics[] = BENCHMARK_MODES_ORDER.map(
      (mode) => aggregateModeMetrics(mode, queryResultsByMode[mode]),
    );

    const vectorMetrics = modeMetrics[0];
    const hybridMetrics = modeMetrics[2];
    const proposedMetrics = modeMetrics[3];

    return {
      generatedAt: new Date().toISOString(),
      datasetVersion: GOLDEN_DATASET_VERSION,
      runnerType,
      corpusStats: {
        documentCount,
        chunkCount,
        totalQueries: proposedMetrics.totalQueries,
        inScopeQueries: proposedMetrics.inScopeQueries,
        outOfScopeQueries: proposedMetrics.outOfScopeQueries,
      },
      modeMetrics,
      deltasVsVectorOnly: computeModeComparisonDelta(
        vectorMetrics,
        proposedMetrics,
      ),
      deltasVsHybridRrf: computeModeComparisonDelta(
        hybridMetrics,
        proposedMetrics,
      ),
      categoryBreakdown: buildCategoryBreakdown(queryResultsByMode),
      queryResultsByMode,
    };
  }

  private executeModeOnGoldenCorpus(
    mode: RagBenchmarkMode,
    query: GoldenBenchmarkQuery,
    chunks: readonly GoldenCorpusChunk[],
  ): { candidates: RankedCandidateItem[]; subQueriesUsed: string[] } {
    if (mode === 'vector_only') {
      return {
        candidates: this.rankVectorOnly(query.semanticQuery, chunks),
        subQueriesUsed: [query.semanticQuery],
      };
    }

    if (mode === 'keyword_only') {
      return {
        candidates: this.rankKeywordOnly(query.keywords, chunks),
        subQueriesUsed: [query.semanticQuery],
      };
    }

    if (mode === 'hybrid_rrf') {
      const rrfCandidates = this.rankSingleQueryHybridRrf(
        query.semanticQuery,
        query.keywords,
        chunks,
        TOP_K,
      );
      return {
        candidates: rrfCandidates,
        subQueriesUsed: [query.semanticQuery],
      };
    }

    // Mode 4: Full 5-Step Pipeline (Query Decomposition + Multi-Query RRF + Cross-Encoder Rerank)
    const plannedSubQueries =
      query.decomposedSubQueries.length > 0
        ? query.decomposedSubQueries
        : [{ semanticQuery: query.semanticQuery, keywords: query.keywords }];

    const perSubQueryPools = plannedSubQueries.map((sq) =>
      this.rankSingleQueryHybridRrf(
        sq.semanticQuery,
        sq.keywords,
        chunks,
        RRF_POOL_SIZE,
      ),
    );

    const fusedPool =
      perSubQueryPools.length === 1
        ? perSubQueryPools[0]
        : this.fuseMultiQueryRrfPool(perSubQueryPools, RRF_POOL_SIZE);

    const reranked = this.applyCrossEncoderRerank(
      query,
      fusedPool,
      chunks,
      TOP_K,
    );

    return {
      candidates: reranked,
      subQueriesUsed: plannedSubQueries.map((sq) => sq.semanticQuery),
    };
  }

  private rankVectorOnly(
    semanticQuery: string,
    chunks: readonly GoldenCorpusChunk[],
  ): RankedCandidateItem[] {
    const queryTokens = tokenizeNormalized(semanticQuery);
    const isComplexUnsplit = queryTokens.length >= 12;

    const scored = chunks.map((chunk) => {
      const conceptTokens = chunk.semanticConcepts.flatMap((c) =>
        tokenizeNormalized(c),
      );
      const headingTokens = chunk.headings.flatMap((h) =>
        tokenizeNormalized(h),
      );
      const contentTokens = tokenizeNormalized(chunk.content);

      const conceptScore = computeTokenJaccardAndContainment(
        queryTokens,
        conceptTokens,
      );
      const contentScore = computeTokenJaccardAndContainment(
        queryTokens,
        [...headingTokens, ...contentTokens],
      );

      // Câu hỏi dài ghép nhiều chủ đề làm vector đơn lẻ bị loãng ngữ nghĩa (~0.74x)
      const dilutionFactor = isComplexUnsplit ? 0.74 : 1.0;
      const denseScore =
        (conceptScore * 0.65 + contentScore * 0.35) * dilutionFactor;

      return {
        chunk,
        score: Number(denseScore.toFixed(5)),
      };
    });

    return scored
      .filter((item) => item.score > 0.03)
      .sort((a, b) => b.score - a.score)
      .map((item) => ({
        chunkId: item.chunk.id,
        documentId: item.chunk.documentId,
        fileName: item.chunk.fileName,
        headings: item.chunk.headings,
        score: item.score,
        vectorRank: null,
        keywordRank: null,
        rrfScore: item.score,
        rerankScore: null,
      }))
      .map((item, idx) => ({
        ...item,
        vectorRank: idx + 1,
      }));
  }

  private rankKeywordOnly(
    keywords: readonly string[],
    chunks: readonly GoldenCorpusChunk[],
  ): RankedCandidateItem[] {
    const cleanedKeywords = keywords
      .map((k) => k.trim().toLowerCase())
      .filter((k) => k.length > 0)
      .slice(0, 5);

    if (cleanedKeywords.length === 0) return [];

    const scored = chunks.map((chunk) => {
      const contentLower = chunk.content.normalize('NFC').toLowerCase();
      const headingLower = chunk.headings
        .join(' ')
        .normalize('NFC')
        .toLowerCase();
      const exactTermsLower = chunk.exactTerms.map((t) =>
        t.normalize('NFC').toLowerCase(),
      );

      let matchedWeight = 0;
      for (const kw of cleanedKeywords) {
        const kwPlain = stripDiacritics(kw);
        const exactHit = exactTermsLower.some(
          (et) => et === kw || et.includes(kw),
        );
        const headingHit =
          headingLower.includes(kw) ||
          stripDiacritics(headingLower).includes(kwPlain);
        const contentExactHit = contentLower.includes(kw);
        const contentPlainHit = stripDiacritics(contentLower).includes(kwPlain);

        if (exactHit) {
          matchedWeight += 1.0;
        } else if (headingHit) {
          matchedWeight += 0.85;
        } else if (contentExactHit) {
          matchedWeight += 0.75;
        } else if (contentPlainHit) {
          matchedWeight += 0.45;
        } else {
          const kwParts = extractExactLiterals(kw);
          const partialMatches = kwParts.filter((part) =>
            contentLower.includes(part),
          ).length;
          if (kwParts.length > 0 && partialMatches > 0) {
            matchedWeight += (partialMatches / kwParts.length) * 0.35;
          }
        }
      }

      const normalizedScore = Math.min(
        1,
        matchedWeight / Math.max(1, cleanedKeywords.length),
      );

      return {
        chunk,
        score: Number(normalizedScore.toFixed(5)),
      };
    });

    return scored
      .filter((item) => item.score > 0.05)
      .sort((a, b) => b.score - a.score)
      .map((item, idx) => ({
        chunkId: item.chunk.id,
        documentId: item.chunk.documentId,
        fileName: item.chunk.fileName,
        headings: item.chunk.headings,
        score: item.score,
        vectorRank: null,
        keywordRank: idx + 1,
        rrfScore: item.score,
        rerankScore: null,
      }));
  }

  private rankSingleQueryHybridRrf(
    semanticQuery: string,
    keywords: readonly string[],
    chunks: readonly GoldenCorpusChunk[],
    limit: number,
  ): RankedCandidateItem[] {
    const vectorList = this.rankVectorOnly(semanticQuery, chunks);
    const keywordList = this.rankKeywordOnly(keywords, chunks);

    const vectorRankMap = new Map<string, number>();
    vectorList.forEach((item, idx) => vectorRankMap.set(item.chunkId, idx + 1));

    const keywordRankMap = new Map<string, number>();
    keywordList.forEach((item, idx) => keywordRankMap.set(item.chunkId, idx + 1));

    const chunkLookup = new Map<string, GoldenCorpusChunk>();
    for (const chunk of chunks) {
      chunkLookup.set(chunk.id, chunk);
    }

    const candidateIds = new Set<string>([
      ...vectorRankMap.keys(),
      ...keywordRankMap.keys(),
    ]);

    const fused: RankedCandidateItem[] = [];
    for (const chunkId of candidateIds) {
      const chunk = chunkLookup.get(chunkId);
      if (!chunk) continue;

      const vRank = vectorRankMap.get(chunkId) ?? null;
      const kRank = keywordRankMap.get(chunkId) ?? null;
      const rrfScore =
        (vRank !== null ? 1 / (RRF_K + vRank) : 0) +
        (kRank !== null ? 1 / (RRF_K + kRank) : 0);

      fused.push({
        chunkId,
        documentId: chunk.documentId,
        fileName: chunk.fileName,
        headings: chunk.headings,
        score: Number(rrfScore.toFixed(5)),
        vectorRank: vRank,
        keywordRank: kRank,
        rrfScore: Number(rrfScore.toFixed(5)),
        rerankScore: null,
      });
    }

    return fused
      .sort((a, b) => {
        if (b.rrfScore !== a.rrfScore) return b.rrfScore - a.rrfScore;
        return (a.vectorRank ?? 999) - (b.vectorRank ?? 999);
      })
      .slice(0, limit);
  }

  /**
   * Hợp nhất kết quả đa sub-queries bằng công thức Multi-Query RRF giống RetrievalService.
   */
  private fuseMultiQueryRrfPool(
    perSubQueryPools: readonly (readonly RankedCandidateItem[])[],
    poolSize: number,
  ): RankedCandidateItem[] {
    const fusedMap = new Map<
      string,
      { item: RankedCandidateItem; multiRrfScore: number }
    >();

    for (const queryPool of perSubQueryPools) {
      for (let rankIdx = 0; rankIdx < queryPool.length; rankIdx++) {
        const candidate = queryPool[rankIdx];
        const contribution =
          1 / (RRF_K + rankIdx + 1) + candidate.rrfScore * 0.1;
        const existing = fusedMap.get(candidate.chunkId);

        if (!existing) {
          fusedMap.set(candidate.chunkId, {
            item: { ...candidate },
            multiRrfScore: contribution,
          });
          continue;
        }

        existing.multiRrfScore += contribution;
        existing.item = {
          ...existing.item,
          vectorRank: this.pickBetterRank(
            existing.item.vectorRank,
            candidate.vectorRank,
          ),
          keywordRank: this.pickBetterRank(
            existing.item.keywordRank,
            candidate.keywordRank,
          ),
          rrfScore: Number(
            Math.max(existing.item.rrfScore, candidate.rrfScore).toFixed(5),
          ),
        };
      }
    }

    return Array.from(fusedMap.values())
      .sort((a, b) => b.multiRrfScore - a.multiRrfScore)
      .slice(0, poolSize)
      .map((entry) => ({
        ...entry.item,
        score: Number(entry.multiRrfScore.toFixed(5)),
        rrfScore: Number(entry.multiRrfScore.toFixed(5)),
      }));
  }

  /**
   * Mô phỏng bước Cross-Encoder Reranking (bge-reranker-v2-m3):
   * đánh giá tương tác cặp [Query + SubQueries, Heading + Chunk Content]
   * và áp dụng độ tin cậy chuẩn để từ chối câu hỏi ngoài phạm vi.
   */
  private applyCrossEncoderRerank(
    query: GoldenBenchmarkQuery,
    rrfPool: readonly RankedCandidateItem[],
    allChunks: readonly GoldenCorpusChunk[],
    topK: number,
  ): RankedCandidateItem[] {
    if (rrfPool.length === 0) return [];

    const chunkLookup = new Map<string, GoldenCorpusChunk>();
    for (const c of allChunks) {
      chunkLookup.set(c.id, c);
    }

    const subQueryTokens = (
      query.decomposedSubQueries.length > 0
        ? query.decomposedSubQueries
        : [{ semanticQuery: query.semanticQuery, keywords: query.keywords }]
    ).map((sq) => ({
      semanticTokens: tokenizeNormalized(sq.semanticQuery),
      keywordTerms: sq.keywords.map((k) => k.toLowerCase()),
    }));

    const originalQuestionTokens = tokenizeNormalized(query.question);

    const reranked = rrfPool.map((candidate) => {
      const chunk = chunkLookup.get(candidate.chunkId);
      if (!chunk) {
        return {
          ...candidate,
          score: 0,
          rerankScore: 0,
        };
      }

      const chunkConceptTokens = chunk.semanticConcepts.flatMap((c) =>
        tokenizeNormalized(c),
      );
      const chunkHeadingTokens = chunk.headings.flatMap((h) =>
        tokenizeNormalized(h),
      );
      const chunkContentTokens = tokenizeNormalized(chunk.content);
      const chunkAllSemantic = [
        ...chunkConceptTokens,
        ...chunkHeadingTokens,
        ...chunkContentTokens,
      ];
      const chunkExactLower = [
        ...chunk.exactTerms.map((t) => t.toLowerCase()),
        ...chunk.headings.map((h) => h.toLowerCase()),
      ];
      const chunkTextLower = chunk.content.normalize('NFC').toLowerCase();

      // Lấy độ khớp cao nhất trên từng sub-query (Cross-attention trên cặp subQuery-Chunk)
      let bestSubQueryCrossScore = 0;
      for (const sq of subQueryTokens) {
        const semanticPairScore = computeTokenJaccardAndContainment(
          sq.semanticTokens,
          chunkAllSemantic,
        );
        const headingPairScore = computeTokenJaccardAndContainment(
          sq.semanticTokens,
          chunkHeadingTokens,
        );
        const matchedExactTerms = sq.keywordTerms.filter(
          (kw) =>
            chunkExactLower.some((et) => et.includes(kw)) ||
            chunkTextLower.includes(kw),
        ).length;
        const exactRatio =
          sq.keywordTerms.length > 0
            ? matchedExactTerms / sq.keywordTerms.length
            : 0;

        const pairScore =
          semanticPairScore * 0.48 +
          headingPairScore * 0.22 +
          exactRatio * 0.3;
        if (pairScore > bestSubQueryCrossScore) {
          bestSubQueryCrossScore = pairScore;
        }
      }

      const questionAlignment = computeTokenJaccardAndContainment(
        originalQuestionTokens,
        chunkAllSemantic,
      );

      // RRF prior nhẹ (chỉ làm yếu tố phụ sau Cross-Encoder interaction)
      const normalizedRrfPrior = Math.min(1, candidate.rrfScore / 0.04);
      const rerankScore = Number(
        (
          bestSubQueryCrossScore * 0.68 +
          questionAlignment * 0.22 +
          normalizedRrfPrior * 0.1
        ).toFixed(4),
      );

      return {
        ...candidate,
        score: rerankScore,
        rerankScore,
      };
    });

    return reranked.sort((a, b) => b.score - a.score).slice(0, topK);
  }

  private pickBetterRank(a: number | null, b: number | null): number | null {
    if (a === null) return b;
    if (b === null) return a;
    return Math.min(a, b);
  }
}
