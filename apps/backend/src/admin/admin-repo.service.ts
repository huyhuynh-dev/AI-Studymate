import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type {
  AdminDocumentQueueItem,
  AdminUserSummary,
  AiUsageDailyPoint,
  AiUsageFeatureBreakdown,
  AiUsageLogItem,
  AiUsageProfileBreakdown,
} from './admin.types.js';

@Injectable()
export class AdminRepoService implements OnModuleInit {
  private readonly logger = new Logger(AdminRepoService.name);
  private schemaEnsured = false;
  private ensureSchemaPromise: Promise<void> | null = null;

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit(): Promise<void> {
    await this.ensureAiUsageLogsTable();
  }

  /**
   * Đảm bảo bảng ai_usage_logs tồn tại trên PostgreSQL ngay cả khi người dùng
   * khởi động lại backend mà chưa kịp chạy `prisma migrate deploy`.
   */
  async ensureAiUsageLogsTable(): Promise<void> {
    if (this.schemaEnsured) {
      return;
    }

    if (typeof this.prisma.$executeRawUnsafe !== 'function') {
      this.schemaEnsured = true;
      return;
    }

    if (this.ensureSchemaPromise) {
      return this.ensureSchemaPromise;
    }

    this.ensureSchemaPromise = (async () => {
      try {
        await this.prisma.$executeRawUnsafe(`
          CREATE TABLE IF NOT EXISTS "ai_usage_logs" (
            "id" UUID NOT NULL DEFAULT gen_random_uuid(),
            "user_id" UUID,
            "feature_key" VARCHAR(60) NOT NULL,
            "profile" VARCHAR(30) NOT NULL,
            "model_name" VARCHAR(120) NOT NULL,
            "prompt_tokens" INTEGER NOT NULL DEFAULT 0,
            "completion_tokens" INTEGER NOT NULL DEFAULT 0,
            "total_tokens" INTEGER NOT NULL DEFAULT 0,
            "estimated_cost_usd" DOUBLE PRECISION NOT NULL DEFAULT 0,
            "latency_ms" INTEGER NOT NULL DEFAULT 0,
            "status" VARCHAR(20) NOT NULL DEFAULT 'success',
            "error_message" TEXT,
            "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT "ai_usage_logs_pkey" PRIMARY KEY ("id")
          )
        `);

        await this.prisma.$executeRawUnsafe(
          `CREATE INDEX IF NOT EXISTS "idx_ai_usage_logs_created_at" ON "ai_usage_logs"("created_at" DESC)`,
        );
        await this.prisma.$executeRawUnsafe(
          `CREATE INDEX IF NOT EXISTS "idx_ai_usage_logs_feature_date" ON "ai_usage_logs"("feature_key", "created_at" DESC)`,
        );
        await this.prisma.$executeRawUnsafe(
          `CREATE INDEX IF NOT EXISTS "idx_ai_usage_logs_user_date" ON "ai_usage_logs"("user_id", "created_at" DESC)`,
        );
        await this.prisma.$executeRawUnsafe(`
          DO $$
          BEGIN
            IF NOT EXISTS (
              SELECT 1 FROM pg_constraint WHERE conname = 'ai_usage_logs_user_id_fkey'
            ) THEN
              ALTER TABLE "ai_usage_logs"
                ADD CONSTRAINT "ai_usage_logs_user_id_fkey"
                FOREIGN KEY ("user_id") REFERENCES "users"("id")
                ON DELETE SET NULL ON UPDATE CASCADE;
            END IF;
          END
          $$;
        `);

        this.schemaEnsured = true;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.warn(
          `Không thể tự động khởi tạo bảng ai_usage_logs: ${msg}`,
        );
      } finally {
        this.ensureSchemaPromise = null;
      }
    })();

    return this.ensureSchemaPromise;
  }

  async pingDatabase(): Promise<boolean> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  }

  async getOverviewCounts() {
    await this.ensureAiUsageLogsTable();
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const [
      usersCount,
      activeUsersCount,
      subjectsCount,
      conversationsCount,
      documentsCount,
      documentChunksCount,
      flashcardsCount,
      flashcardReviewsCount,
      quizzesCount,
      quizAttemptsCount,
      docStatusGroups,
      ai24hAgg,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { is_active: true } }),
      this.prisma.subject.count(),
      this.prisma.conversation.count(),
      this.prisma.document.count(),
      this.prisma.documentChunk.count(),
      this.prisma.flashcard.count(),
      this.prisma.flashcardReview.count(),
      this.prisma.quiz.count(),
      this.prisma.quizAttempt.count(),
      this.prisma.document.groupBy({
        by: ['ocr_status'],
        _count: { _all: true },
      }),
      this.prisma.aiUsageLog.aggregate({
        where: { created_at: { gte: since24h } },
        _count: { _all: true },
        _sum: {
          total_tokens: true,
          estimated_cost_usd: true,
        },
      }),
    ]);

    const statusMap = {
      pending: 0,
      processing: 0,
      done: 0,
      failed: 0,
    };

    for (const grp of docStatusGroups) {
      if (grp.ocr_status in statusMap) {
        statusMap[grp.ocr_status as keyof typeof statusMap] = grp._count._all;
      }
    }

    return {
      totals: {
        users: usersCount,
        activeUsers: activeUsersCount,
        subjects: subjectsCount,
        conversations: conversationsCount,
        documents: documentsCount,
        documentChunks: documentChunksCount,
        flashcards: flashcardsCount,
        flashcardReviews: flashcardReviewsCount,
        quizzes: quizzesCount,
        quizAttempts: quizAttemptsCount,
      },
      documentsByStatus: statusMap,
      aiLast24Hours: {
        requests: ai24hAgg._count._all,
        totalTokens: ai24hAgg._sum.total_tokens ?? 0,
        estimatedCostUsd: Number(
          (ai24hAgg._sum.estimated_cost_usd ?? 0).toFixed(6),
        ),
      },
    };
  }

  async getRecentDocumentsForQueue(
    limit = 25,
  ): Promise<AdminDocumentQueueItem[]> {
    const docs = await this.prisma.document.findMany({
      take: limit,
      orderBy: { uploaded_at: 'desc' },
      select: {
        id: true,
        file_name: true,
        mime_type: true,
        file_size: true,
        ocr_status: true,
        embed_status: true,
        processing_error: true,
        page_count: true,
        uploaded_at: true,
        user: { select: { email: true } },
      },
    });

    return docs.map((d) => ({
      id: d.id,
      fileName: d.file_name,
      mimeType: d.mime_type,
      fileSizeBytes: Number(d.file_size ?? 0),
      ocrStatus: d.ocr_status,
      embedStatus: d.embed_status,
      processingError: d.processing_error,
      pageCount: d.page_count,
      uploadedAt: d.uploaded_at.toISOString(),
      userEmail: d.user?.email ?? null,
    }));
  }

  async getAiUsageAnalytics(windowDays: number) {
    await this.ensureAiUsageLogsTable();
    const sinceDate = new Date(
      Date.now() - windowDays * 24 * 60 * 60 * 1000,
    );

    const [
      overallAgg,
      successCount,
      featureGroups,
      profileGroups,
      rawLogsForTrend,
      recentRows,
    ] = await Promise.all([
      this.prisma.aiUsageLog.aggregate({
        where: { created_at: { gte: sinceDate } },
        _count: { _all: true },
        _sum: {
          prompt_tokens: true,
          completion_tokens: true,
          total_tokens: true,
          estimated_cost_usd: true,
        },
        _avg: {
          latency_ms: true,
        },
      }),
      this.prisma.aiUsageLog.count({
        where: { created_at: { gte: sinceDate }, status: 'success' },
      }),
      this.prisma.aiUsageLog.groupBy({
        by: ['feature_key'],
        where: { created_at: { gte: sinceDate } },
        _count: { _all: true },
        _sum: {
          prompt_tokens: true,
          completion_tokens: true,
          total_tokens: true,
          estimated_cost_usd: true,
        },
        _avg: {
          latency_ms: true,
        },
      }),
      this.prisma.aiUsageLog.groupBy({
        by: ['profile'],
        where: { created_at: { gte: sinceDate } },
        _count: { _all: true },
        _sum: {
          total_tokens: true,
          estimated_cost_usd: true,
        },
        _avg: {
          latency_ms: true,
        },
      }),
      this.prisma.aiUsageLog.findMany({
        where: { created_at: { gte: sinceDate } },
        select: {
          total_tokens: true,
          estimated_cost_usd: true,
          created_at: true,
        },
        orderBy: { created_at: 'asc' },
      }),
      this.prisma.aiUsageLog.findMany({
        take: 20,
        orderBy: { created_at: 'desc' },
        select: {
          id: true,
          feature_key: true,
          profile: true,
          model_name: true,
          prompt_tokens: true,
          completion_tokens: true,
          total_tokens: true,
          estimated_cost_usd: true,
          latency_ms: true,
          status: true,
          error_message: true,
          created_at: true,
          user: { select: { email: true } },
        },
      }),
    ]);

    const totalRequests = overallAgg._count._all;
    const errorRequests = Math.max(0, totalRequests - successCount);

    const byFeature: AiUsageFeatureBreakdown[] = featureGroups
      .map((g) => ({
        featureKey: g.feature_key,
        requests: g._count._all,
        promptTokens: g._sum.prompt_tokens ?? 0,
        completionTokens: g._sum.completion_tokens ?? 0,
        totalTokens: g._sum.total_tokens ?? 0,
        estimatedCostUsd: Number(
          (g._sum.estimated_cost_usd ?? 0).toFixed(6),
        ),
        avgLatencyMs: Math.round(g._avg.latency_ms ?? 0),
      }))
      .sort((a, b) => b.totalTokens - a.totalTokens);

    const byProfile: AiUsageProfileBreakdown[] = profileGroups
      .map((g) => ({
        profile: g.profile,
        requests: g._count._all,
        totalTokens: g._sum.total_tokens ?? 0,
        estimatedCostUsd: Number(
          (g._sum.estimated_cost_usd ?? 0).toFixed(6),
        ),
        avgLatencyMs: Math.round(g._avg.latency_ms ?? 0),
      }))
      .sort((a, b) => b.totalTokens - a.totalTokens);

    const dailyMap = new Map<
      string,
      { requests: number; totalTokens: number; estimatedCostUsd: number }
    >();
    for (const row of rawLogsForTrend) {
      const dateKey = row.created_at.toISOString().slice(0, 10);
      const bucket = dailyMap.get(dateKey) ?? {
        requests: 0,
        totalTokens: 0,
        estimatedCostUsd: 0,
      };
      bucket.requests += 1;
      bucket.totalTokens += row.total_tokens;
      bucket.estimatedCostUsd += row.estimated_cost_usd;
      dailyMap.set(dateKey, bucket);
    }

    const dailyTrend: AiUsageDailyPoint[] = Array.from(dailyMap.entries()).map(
      ([date, val]) => ({
        date,
        requests: val.requests,
        totalTokens: val.totalTokens,
        estimatedCostUsd: Number(val.estimatedCostUsd.toFixed(6)),
      }),
    );

    const recentLogs: AiUsageLogItem[] = recentRows.map((r) => ({
      id: r.id,
      userEmail: r.user?.email ?? null,
      featureKey: r.feature_key,
      profile: r.profile,
      modelName: r.model_name,
      promptTokens: r.prompt_tokens,
      completionTokens: r.completion_tokens,
      totalTokens: r.total_tokens,
      estimatedCostUsd: Number(r.estimated_cost_usd.toFixed(6)),
      latencyMs: r.latency_ms,
      status: r.status,
      errorMessage: r.error_message,
      createdAt: r.created_at.toISOString(),
    }));

    return {
      windowDays,
      summary: {
        totalRequests,
        successRequests: successCount,
        errorRequests,
        successRatePct:
          totalRequests > 0
            ? Number(((successCount / totalRequests) * 100).toFixed(2))
            : 100,
        promptTokens: overallAgg._sum.prompt_tokens ?? 0,
        completionTokens: overallAgg._sum.completion_tokens ?? 0,
        totalTokens: overallAgg._sum.total_tokens ?? 0,
        estimatedCostUsd: Number(
          (overallAgg._sum.estimated_cost_usd ?? 0).toFixed(6),
        ),
        avgLatencyMs: Math.round(overallAgg._avg.latency_ms ?? 0),
      },
      byFeature,
      byProfile,
      dailyTrend,
      recentLogs,
    };
  }

  async listUsers(params: {
    search?: string;
    limit: number;
    offset: number;
  }): Promise<{ total: number; users: AdminUserSummary[] }> {
    await this.ensureAiUsageLogsTable();
    const trimmedSearch = params.search?.trim();
    const where = trimmedSearch
      ? {
          OR: [
            { email: { contains: trimmedSearch, mode: 'insensitive' as const } },
            { name: { contains: trimmedSearch, mode: 'insensitive' as const } },
          ],
        }
      : {};

    const [total, rows] = await Promise.all([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        take: params.limit,
        skip: params.offset,
        orderBy: { created_at: 'desc' },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          is_active: true,
          is_verified: true,
          provider: true,
          created_at: true,
          _count: {
            select: {
              subjects: true,
              conversations: true,
              documents: true,
              ai_usage_logs: true,
            },
          },
        },
      }),
    ]);

    const userIds = rows.map((r) => r.id);
    const tokenGroups =
      userIds.length > 0
        ? await this.prisma.aiUsageLog.groupBy({
            by: ['user_id'],
            where: { user_id: { in: userIds } },
            _sum: { total_tokens: true },
          })
        : [];

    const tokenMap = new Map<string, number>();
    for (const grp of tokenGroups) {
      if (grp.user_id) {
        tokenMap.set(grp.user_id, grp._sum.total_tokens ?? 0);
      }
    }

    const users: AdminUserSummary[] = rows.map((row) => ({
      id: row.id,
      email: row.email,
      name: row.name,
      role: row.role,
      isActive: row.is_active,
      isVerified: row.is_verified,
      provider: row.provider,
      createdAt: row.created_at.toISOString(),
      stats: {
        subjectsCount: row._count.subjects,
        conversationsCount: row._count.conversations,
        documentsCount: row._count.documents,
        aiRequestsCount: row._count.ai_usage_logs,
        totalTokensUsed: tokenMap.get(row.id) ?? 0,
      },
    }));

    return { total, users };
  }

  async findUserById(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        is_active: true,
      },
    });
  }

  async updateUserStatus(
    userId: string,
    data: { is_active?: boolean; role?: string },
  ) {
    return this.prisma.user.update({
      where: { id: userId },
      data,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        is_active: true,
        is_verified: true,
      },
    });
  }
}
