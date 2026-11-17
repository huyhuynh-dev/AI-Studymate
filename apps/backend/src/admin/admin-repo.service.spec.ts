import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../prisma/prisma.service.js';
import { AdminRepoService } from './admin-repo.service.js';

describe('AdminRepoService', () => {
  let repo: AdminRepoService;
  let prismaMock: {
    $executeRawUnsafe: ReturnType<typeof vi.fn>;
    $queryRaw: ReturnType<typeof vi.fn>;
    user: {
      count: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
      findUnique: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
    };
    subject: { count: ReturnType<typeof vi.fn> };
    conversation: { count: ReturnType<typeof vi.fn> };
    document: {
      count: ReturnType<typeof vi.fn>;
      groupBy: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
    };
    documentChunk: { count: ReturnType<typeof vi.fn> };
    flashcard: { count: ReturnType<typeof vi.fn> };
    flashcardReview: { count: ReturnType<typeof vi.fn> };
    quiz: { count: ReturnType<typeof vi.fn> };
    quizAttempt: { count: ReturnType<typeof vi.fn> };
    aiUsageLog: {
      aggregate: ReturnType<typeof vi.fn>;
      count: ReturnType<typeof vi.fn>;
      groupBy: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
    };
  };

  beforeEach(() => {
    prismaMock = {
      $executeRawUnsafe: vi.fn().mockResolvedValue(0),
      $queryRaw: vi.fn().mockResolvedValue([{ '?column?': 1 }]),
      user: {
        count: vi.fn().mockResolvedValueOnce(10).mockResolvedValueOnce(9),
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'u-1',
            email: 'admin@studymate.local',
            name: 'Admin User',
            role: 'admin',
            is_active: true,
            is_verified: true,
            provider: 'local',
            created_at: new Date('2026-11-01T00:00:00Z'),
            _count: {
              subjects: 2,
              conversations: 4,
              documents: 6,
              ai_usage_logs: 15,
            },
          },
        ]),
        findUnique: vi.fn().mockResolvedValue(null),
        update: vi.fn().mockResolvedValue({
          id: 'u-2',
          email: 'student@studymate.local',
          name: 'Student',
          role: 'admin',
          is_active: true,
          is_verified: true,
        }),
      },
      subject: { count: vi.fn().mockResolvedValue(4) },
      conversation: { count: vi.fn().mockResolvedValue(8) },
      document: {
        count: vi.fn().mockResolvedValue(12),
        groupBy: vi.fn().mockResolvedValue([
          { ocr_status: 'done', _count: { _all: 9 } },
          { ocr_status: 'processing', _count: { _all: 1 } },
          { ocr_status: 'pending', _count: { _all: 1 } },
          { ocr_status: 'failed', _count: { _all: 1 } },
        ]),
        findMany: vi.fn().mockResolvedValue([]),
      },
      documentChunk: { count: vi.fn().mockResolvedValue(320) },
      flashcard: { count: vi.fn().mockResolvedValue(45) },
      flashcardReview: { count: vi.fn().mockResolvedValue(110) },
      quiz: { count: vi.fn().mockResolvedValue(7) },
      quizAttempt: { count: vi.fn().mockResolvedValue(18) },
      aiUsageLog: {
        aggregate: vi.fn().mockResolvedValue({
          _count: { _all: 20 },
          _sum: {
            prompt_tokens: 12000,
            completion_tokens: 4000,
            total_tokens: 16000,
            estimated_cost_usd: 0.00845,
          },
          _avg: {
            latency_ms: 425.4,
          },
        }),
        count: vi.fn().mockResolvedValue(19),
        groupBy: vi
          .fn()
          .mockResolvedValueOnce([
            {
              feature_key: 'QUIZ_GENERATE',
              _count: { _all: 5 },
              _sum: {
                prompt_tokens: 3000,
                completion_tokens: 1000,
                total_tokens: 4000,
                estimated_cost_usd: 0.002,
              },
              _avg: { latency_ms: 600 },
            },
            {
              feature_key: 'CHAT_AGENT',
              _count: { _all: 15 },
              _sum: {
                prompt_tokens: 9000,
                completion_tokens: 3000,
                total_tokens: 12000,
                estimated_cost_usd: 0.00645,
              },
              _avg: { latency_ms: 350 },
            },
          ])
          .mockResolvedValueOnce([
            {
              profile: 'REASONING',
              _count: { _all: 15 },
              _sum: { total_tokens: 12000, estimated_cost_usd: 0.00645 },
              _avg: { latency_ms: 350 },
            },
          ]),
        findMany: vi
          .fn()
          .mockResolvedValueOnce([
            {
              total_tokens: 6000,
              estimated_cost_usd: 0.003,
              created_at: new Date('2026-11-16T08:00:00Z'),
            },
            {
              total_tokens: 10000,
              estimated_cost_usd: 0.00545,
              created_at: new Date('2026-11-16T14:00:00Z'),
            },
          ])
          .mockResolvedValueOnce([
            {
              id: 'log-1',
              feature_key: 'CHAT_AGENT',
              profile: 'REASONING',
              model_name: 'gemini-2.5-flash',
              prompt_tokens: 900,
              completion_tokens: 300,
              total_tokens: 1200,
              estimated_cost_usd: 0.0005,
              latency_ms: 320,
              status: 'success',
              error_message: null,
              created_at: new Date('2026-11-16T14:00:00Z'),
              user: { email: 'admin@studymate.local' },
            },
          ]),
      },
    };

    repo = new AdminRepoService(prismaMock as unknown as PrismaService);
  });

  it('nên tự động khởi tạo bảng ai_usage_logs idempotent 1 lần duy nhất và không sập nếu DDL lỗi', async () => {
    await repo.ensureAiUsageLogsTable();
    await repo.ensureAiUsageLogsTable();

    expect(prismaMock.$executeRawUnsafe).toHaveBeenCalledTimes(5);

    const failingPrisma = {
      $executeRawUnsafe: vi.fn().mockRejectedValue(new Error('permission denied')),
    };
    const resilientRepo = new AdminRepoService(
      failingPrisma as unknown as PrismaService,
    );
    await expect(resilientRepo.ensureAiUsageLogsTable()).resolves.toBeUndefined();
  });

  it('nên tổng hợp chính xác getOverviewCounts bao gồm documentsByStatus và aiLast24Hours', async () => {
    const overview = await repo.getOverviewCounts();

    expect(overview.totals).toEqual({
      users: 10,
      activeUsers: 9,
      subjects: 4,
      conversations: 8,
      documents: 12,
      documentChunks: 320,
      flashcards: 45,
      flashcardReviews: 110,
      quizzes: 7,
      quizAttempts: 18,
    });
    expect(overview.documentsByStatus).toEqual({
      pending: 1,
      processing: 1,
      done: 9,
      failed: 1,
    });
    expect(overview.aiLast24Hours).toEqual({
      requests: 20,
      totalTokens: 16000,
      estimatedCostUsd: 0.00845,
    });
  });

  it('nên phân tích getAiUsageAnalytics sắp xếp giảm dần theo totalTokens và gom nhóm theo ngày', async () => {
    const analytics = await repo.getAiUsageAnalytics(30);

    expect(analytics.summary).toEqual({
      totalRequests: 20,
      successRequests: 19,
      errorRequests: 1,
      successRatePct: 95,
      promptTokens: 12000,
      completionTokens: 4000,
      totalTokens: 16000,
      estimatedCostUsd: 0.00845,
      avgLatencyMs: 425,
    });
    expect(analytics.byFeature[0].featureKey).toBe('CHAT_AGENT');
    expect(analytics.byFeature[1].featureKey).toBe('QUIZ_GENERATE');
    expect(analytics.dailyTrend).toEqual([
      {
        date: '2026-11-16',
        requests: 2,
        totalTokens: 16000,
        estimatedCostUsd: 0.00845,
      },
    ]);
    expect(analytics.recentLogs[0].userEmail).toBe('admin@studymate.local');
  });

  it('nên ghép tổng token tiêu thụ cho danh sách listUsers', async () => {
    prismaMock.aiUsageLog.groupBy = vi.fn().mockResolvedValue([
      { user_id: 'u-1', _sum: { total_tokens: 9500 } },
    ]);

    const res = await repo.listUsers({ limit: 25, offset: 0 });
    expect(res.users[0]).toMatchObject({
      id: 'u-1',
      email: 'admin@studymate.local',
      role: 'admin',
      isActive: true,
      stats: {
        subjectsCount: 2,
        conversationsCount: 4,
        documentsCount: 6,
        aiRequestsCount: 15,
        totalTokensUsed: 9500,
      },
    });
  });
});
