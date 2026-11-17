import { describe, expect, it, vi } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import {
  GOLDEN_BENCHMARK_QUERIES,
  GOLDEN_CORPUS_CHUNKS,
  GOLDEN_CORPUS_DOCUMENTS,
} from './datasets/golden-dataset.js';
import { renderRagBenchmarkMarkdown } from './helpers/markdown-report.helper.js';
import { RagBenchmarkService } from './rag-benchmark.service.js';
import type { RetrievalService } from '../documents/services/retrieval.service.js';

describe('RagBenchmarkService & Golden Dataset', () => {
  it('Golden Dataset phải đảm bảo tính toàn vẹn tham chiếu giữa documents, chunks và ground truth', () => {
    expect(GOLDEN_CORPUS_DOCUMENTS.length).toBeGreaterThanOrEqual(5);
    expect(GOLDEN_CORPUS_CHUNKS.length).toBeGreaterThanOrEqual(30);
    expect(GOLDEN_BENCHMARK_QUERIES.length).toBeGreaterThanOrEqual(40);

    const docIds = new Set(GOLDEN_CORPUS_DOCUMENTS.map((d) => d.id));
    const chunkIds = new Set(GOLDEN_CORPUS_CHUNKS.map((c) => c.id));

    for (const chunk of GOLDEN_CORPUS_CHUNKS) {
      expect(docIds.has(chunk.documentId)).toBe(true);
    }

    for (const query of GOLDEN_BENCHMARK_QUERIES) {
      for (const expectedId of query.expectedChunkIds) {
        expect(chunkIds.has(expectedId)).toBe(true);
      }
      if (query.category === 'out_of_scope_trap') {
        expect(query.expectedChunkIds).toHaveLength(0);
      } else {
        expect(query.expectedChunkIds.length).toBeGreaterThan(0);
      }
    }
  });

  it('nên chạy Ablation 4 chế độ với Full 5-Step Pipeline vượt trội so với các Baseline và render báo cáo Markdown đầy đủ', () => {
    const service = new RagBenchmarkService();
    const report = service.runGoldenAblationBenchmark({ persistToDisk: false });

    expect(report.modeMetrics).toHaveLength(4);
    expect(report.categoryBreakdown).toHaveLength(5);

    const vectorOnly = report.modeMetrics.find((m) => m.mode === 'vector_only');
    const keywordOnly = report.modeMetrics.find(
      (m) => m.mode === 'keyword_only',
    );
    const hybridRrf = report.modeMetrics.find((m) => m.mode === 'hybrid_rrf');
    const fullPipeline = report.modeMetrics.find(
      (m) => m.mode === 'hybrid_rrf_rerank',
    );

    expect(vectorOnly).toBeDefined();
    expect(keywordOnly).toBeDefined();
    expect(hybridRrf).toBeDefined();
    expect(fullPipeline).toBeDefined();

    // Proposed Full 5-Step Pipeline phải vượt trội các baseline ở cả Recall@5, MRR@5, NDCG@5 và Anti-Hallucination
    expect(fullPipeline!.hitRateAt5).toBeGreaterThan(vectorOnly!.hitRateAt5);
    expect(fullPipeline!.hitRateAt5).toBeGreaterThan(keywordOnly!.hitRateAt5);
    expect(fullPipeline!.recallAt5).toBeGreaterThan(hybridRrf!.recallAt5);
    expect(fullPipeline!.mrrAt5).toBeGreaterThan(vectorOnly!.mrrAt5);
    expect(fullPipeline!.ndcgAt5).toBeGreaterThan(vectorOnly!.ndcgAt5);
    expect(fullPipeline!.antiHallucinationRate).toBeGreaterThanOrEqual(
      vectorOnly!.antiHallucinationRate,
    );

    // Kiểm tra khả năng phân rã Multi-Hop nâng Recall@5 vượt bậc so với Single-Query
    const multiHop = report.categoryBreakdown.find(
      (c) => c.category === 'multi_hop_comparison',
    );
    expect(multiHop).toBeDefined();
    expect(multiHop!.byMode.hybrid_rrf_rerank.recallAt5).toBeGreaterThan(
      multiHop!.byMode.vector_only.recallAt5,
    );

    const md = renderRagBenchmarkMarkdown(report);
    expect(md).toContain('BÁO CÁO THỰC NGHIỆM ĐỊNH LƯỢNG HỆ THỐNG RAG');
    expect(md).toContain('Ablation Study');
    expect(md).toContain('q-sem-01');
    expect(md).toContain('q-oos-01');
  });

  it('nên hỗ trợ chạy Live Conversation Benchmark thông qua RetrievalService với đúng 4 searchMode flags', async () => {
    const searchMock = vi.fn().mockResolvedValue([
      {
        id: 'live-chunk-1',
        documentId: 'live-doc-1',
        fileName: 'Live.pdf',
        chunkIndex: 0,
        pageNumbers: [1],
        content: 'Nội dung live',
        headings: ['Chương 1'],
        chunkType: 'text',
        hasImage: false,
        hasTable: false,
        assets: [],
        rrfScore: 0.032,
        vectorRank: 1,
        keywordRank: 1,
        rerankScore: 0.88,
        subQueriesUsed: ['live query'],
      },
    ]);

    const retrievalMock = {
      searchRelevantChunks: searchMock,
      getAvailableDocumentsCatalog: vi
        .fn()
        .mockResolvedValue([{ documentId: 'live-doc-1', fileName: 'Live.pdf' }]),
    } as unknown as RetrievalService;

    const service = new RagBenchmarkService(retrievalMock);
    const report = await service.runLiveConversationBenchmark({
      userId: '11111111-1111-4111-8111-111111111111',
      conversationId: '22222222-2222-4222-8222-222222222222',
      queries: [
        {
          id: 'live-q1',
          category: 'semantic_lookup',
          question: 'Câu hỏi live?',
          semanticQuery: 'câu hỏi live',
          keywords: ['live'],
          expectedChunkIds: ['live-chunk-1'],
          relevanceGrades: { 'live-chunk-1': 3 },
        },
      ],
      persistToDisk: false,
    });

    expect(report.runnerType).toBe('live_database');
    expect(searchMock).toHaveBeenCalledTimes(4);
    expect(searchMock).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        searchMode: 'vector_only',
        enableQueryDecompose: false,
        enableRerank: false,
      }),
    );
    expect(searchMock).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        searchMode: 'keyword_only',
        enableQueryDecompose: false,
        enableRerank: false,
      }),
    );
    expect(searchMock).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({
        searchMode: 'hybrid',
        enableQueryDecompose: false,
        enableRerank: false,
      }),
    );
    expect(searchMock).toHaveBeenNthCalledWith(
      4,
      expect.objectContaining({
        searchMode: 'hybrid',
        enableQueryDecompose: true,
        enableRerank: true,
      }),
    );
  });

  it('nên xuất báo cáo vật lý xuống _ai_workspace/notes/UpgradeAi-Studymate khi persistToDisk=true', () => {
    const service = new RagBenchmarkService();
    const report = service.runGoldenAblationBenchmark({ persistToDisk: false });
    const { markdownPath, jsonPath } = service.persistReportArtifacts(report);

    expect(existsSync(markdownPath)).toBe(true);
    expect(existsSync(jsonPath)).toBe(true);

    const parsedJson = JSON.parse(readFileSync(jsonPath, 'utf-8')) as {
      datasetVersion: string;
      modeMetrics: unknown[];
    };
    expect(parsedJson.datasetVersion).toBe(report.datasetVersion);
    expect(parsedJson.modeMetrics).toHaveLength(4);
  });
});
