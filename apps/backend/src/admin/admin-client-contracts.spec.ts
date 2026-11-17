import { describe, expect, it, vi } from 'vitest';
import type { DocumentsQueueService } from '../documents/services/documents-queue.service.js';
import { GOLDEN_BENCHMARK_QUERIES } from '../rag-benchmark/datasets/golden-dataset.js';
import { RagBenchmarkService } from '../rag-benchmark/rag-benchmark.service.js';
import type { RedisService } from '../redis/redis.service.js';
import type { AdminRepoService } from './admin-repo.service.js';
import { AdminService } from './admin.service.js';

describe('Admin Backend <-> apps/admin DTO Contracts', () => {
  it('nên trả về hợp đồng dữ liệu chuẩn xác cho cả 4 phân khu trên apps/admin (Overview, Queues, AI Usage, RAG Benchmark)', async () => {
    const ragService = new RagBenchmarkService();

    const repoMock = {
      pingDatabase: vi.fn().mockResolvedValue(true),
      getOverviewCounts: vi.fn().mockResolvedValue({
        totals: {
          users: 3,
          activeUsers: 3,
          subjects: 2,
          conversations: 5,
          documents: 4,
          documentChunks: 120,
          flashcards: 20,
          flashcardReviews: 40,
          quizzes: 3,
          quizAttempts: 6,
        },
        documentsByStatus: { pending: 0, processing: 0, done: 4, failed: 0 },
        aiLast24Hours: {
          requests: 8,
          totalTokens: 5400,
          estimatedCostUsd: 0.0012,
        },
      }),
      getRecentDocumentsForQueue: vi.fn().mockResolvedValue([
        {
          id: 'doc-1',
          fileName: 'lecture.pdf',
          mimeType: 'application/pdf',
          fileSizeBytes: 204800,
          ocrStatus: 'done',
          embedStatus: 'done',
          processingError: null,
          pageCount: 12,
          uploadedAt: '2026-11-17T01:00:00.000Z',
          userEmail: 'student@studymate.local',
        },
      ]),
      getAiUsageAnalytics: vi.fn().mockResolvedValue({
        windowDays: 30,
        summary: {
          totalRequests: 8,
          successRequests: 8,
          errorRequests: 0,
          successRatePct: 100,
          promptTokens: 4000,
          completionTokens: 1400,
          totalTokens: 5400,
          estimatedCostUsd: 0.0012,
          avgLatencyMs: 280,
        },
        byFeature: [],
        byProfile: [],
        dailyTrend: [],
        recentLogs: [],
      }),
      listUsers: vi.fn().mockResolvedValue({ total: 1, users: [] }),
      findUserById: vi.fn(),
      updateUserStatus: vi.fn(),
    };

    const queueMock = {
      getQueueMetrics: vi.fn().mockResolvedValue({
        queueName: 'document-processing',
        connected: true,
        isPaused: false,
        counts: {
          waiting: 0,
          active: 0,
          completed: 4,
          failed: 0,
          delayed: 0,
          paused: 0,
        },
        jobs: [],
      }),
      retryJob: vi.fn(),
      removeJob: vi.fn(),
    };

    const redisMock = {
      getRedisClient: vi.fn().mockReturnValue({
        isOpen: true,
        ping: vi.fn().mockResolvedValue('PONG'),
      }),
    };

    const adminService = new AdminService(
      repoMock as unknown as AdminRepoService,
      queueMock as unknown as DocumentsQueueService,
      ragService,
      redisMock as unknown as RedisService,
    );

    const [overview, queueStatus, aiUsage] = await Promise.all([
      adminService.getOverview(),
      adminService.getQueueStatus(),
      adminService.getAiUsageAnalytics(30),
    ]);

    expect(overview.health).toEqual({ database: 'up', redis: 'up' });
    expect(overview.aiLast24Hours.totalTokens).toBe(5400);
    expect(queueStatus.queue.queueName).toBe('document-processing');
    expect(queueStatus.recentDocuments[0].fileName).toBe('lecture.pdf');
    expect(aiUsage.summary.successRatePct).toBe(100);

    // Xác minh RAG Benchmark Report trả về đầy đủ 4 chế độ cho Tab Benchmark của apps/admin
    const datasetSummary = ragService.getDatasetSummary();
    expect(datasetSummary.totalQueries).toBe(GOLDEN_BENCHMARK_QUERIES.length);
    const ragReport = ragService.runGoldenAblationBenchmark({
      persistToDisk: false,
    });
    expect(ragReport.modeMetrics.map((m) => m.mode)).toEqual([
      'vector_only',
      'keyword_only',
      'hybrid_rrf',
      'hybrid_rrf_rerank',
    ]);
    expect(ragReport.deltasVsVectorOnly.mrrAt5DeltaPct).toBeGreaterThan(0);
  });
});
