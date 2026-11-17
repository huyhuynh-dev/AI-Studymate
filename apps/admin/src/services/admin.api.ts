import { axiosAdmin } from '@/lib/axios.admin';
import type {
  AdminAiUsageData,
  AdminDocumentItem,
  AdminLoginInput,
  AdminOverviewData,
  AdminQueueData,
  AdminSessionUser,
  AdminUserItem,
  AdminUsersListData,
  AiDailyPoint,
  AiFeatureMetric,
  AiProfileMetric,
  AiUsageLogEntry,
  BenchmarkQueryCategory,
  QueueJobItem,
  RagBenchmarkMode,
  RagBenchmarkReportData,
  RagCategoryBreakdown,
  RagModeComparisonDelta,
  RagModeMetrics,
  RagSingleQueryResult,
  UpdateAdminUserStatusInput,
  UpdatedAdminUserStatus,
} from '@/types/admin';

interface RawUserMeResponse {
  id?: string;
  email?: string;
  name?: string;
  role?: string;
  avatar_url?: string | null;
}

interface RawLoginResponse {
  success: boolean;
  message?: string;
  user?: {
    id?: string;
    email?: string;
    name?: string;
    role?: string;
    avatarUrl?: string | null;
  };
}

interface RawOverviewResponse {
  generatedAt?: string;
  health?: {
    database?: 'up' | 'down';
    redis?: 'up' | 'down';
  };
  totals?: {
    users?: number;
    activeUsers?: number;
    subjects?: number;
    conversations?: number;
    documents?: number;
    documentChunks?: number;
    flashcards?: number;
    flashcardReviews?: number;
    quizzes?: number;
    quizAttempts?: number;
  };
  documentsByStatus?: {
    pending?: number;
    processing?: number;
    done?: number;
    failed?: number;
  };
  aiLast24Hours?: {
    requests?: number;
    totalTokens?: number;
    estimatedCostUsd?: number;
  };
}

interface RawQueueJob {
  id?: string;
  name?: string;
  state?: string;
  documentId?: string;
  fileName?: string | null;
  mimeType?: string | null;
  attemptsMade?: number;
  maxAttempts?: number;
  failedReason?: string | null;
  timestamp?: number;
  processedOn?: number | null;
  finishedOn?: number | null;
}

interface RawAdminDocument {
  id?: string;
  fileName?: string;
  mimeType?: string;
  fileSizeBytes?: number;
  ocrStatus?: string;
  embedStatus?: string;
  processingError?: string | null;
  pageCount?: number | null;
  uploadedAt?: string;
  userEmail?: string | null;
}

interface RawQueueResponse {
  queue?: {
    queueName?: string;
    connected?: boolean;
    isPaused?: boolean;
    counts?: {
      waiting?: number;
      active?: number;
      completed?: number;
      failed?: number;
      delayed?: number;
      paused?: number;
    };
    jobs?: RawQueueJob[];
  };
  recentDocuments?: RawAdminDocument[];
}

interface RawAiUsageResponse {
  windowDays?: number;
  summary?: {
    totalRequests?: number;
    successRequests?: number;
    errorRequests?: number;
    successRatePct?: number;
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
    estimatedCostUsd?: number;
    avgLatencyMs?: number;
  };
  byFeature?: Array<Partial<AiFeatureMetric>>;
  byProfile?: Array<Partial<AiProfileMetric>>;
  dailyTrend?: Array<Partial<AiDailyPoint>>;
  recentLogs?: Array<Partial<AiUsageLogEntry>>;
}

interface RawAdminUserItem {
  id?: string;
  email?: string;
  name?: string;
  role?: string;
  isActive?: boolean;
  is_active?: boolean;
  isVerified?: boolean;
  is_verified?: boolean;
  provider?: string | null;
  createdAt?: string;
  created_at?: string;
  stats?: {
    subjectsCount?: number;
    conversationsCount?: number;
    documentsCount?: number;
    aiRequestsCount?: number;
    totalTokensUsed?: number;
  };
}

interface RawUsersListResponse {
  total?: number;
  limit?: number;
  offset?: number;
  users?: RawAdminUserItem[];
}

interface RawUpdateUserStatusResponse {
  id?: string;
  email?: string;
  name?: string;
  role?: string;
  is_active?: boolean;
  isActive?: boolean;
  is_verified?: boolean;
  isVerified?: boolean;
}

function toIsoDate(value: unknown): string {
  if (typeof value === 'string' && value.trim()) return value;
  if (value instanceof Date) return value.toISOString();
  return new Date().toISOString();
}

function mapSessionUser(raw: RawUserMeResponse): AdminSessionUser {
  return {
    id: raw.id ?? '',
    email: raw.email ?? '',
    name: raw.name ?? 'Quản trị viên',
    role: raw.role ?? 'admin',
    avatarUrl: raw.avatar_url ?? null,
  };
}

function mapOverview(raw: RawOverviewResponse): AdminOverviewData {
  return {
    generatedAt: toIsoDate(raw.generatedAt),
    health: {
      database: raw.health?.database === 'up' ? 'up' : 'down',
      redis: raw.health?.redis === 'up' ? 'up' : 'down',
    },
    totals: {
      users: Number(raw.totals?.users ?? 0),
      activeUsers: Number(raw.totals?.activeUsers ?? 0),
      subjects: Number(raw.totals?.subjects ?? 0),
      conversations: Number(raw.totals?.conversations ?? 0),
      documents: Number(raw.totals?.documents ?? 0),
      documentChunks: Number(raw.totals?.documentChunks ?? 0),
      flashcards: Number(raw.totals?.flashcards ?? 0),
      flashcardReviews: Number(raw.totals?.flashcardReviews ?? 0),
      quizzes: Number(raw.totals?.quizzes ?? 0),
      quizAttempts: Number(raw.totals?.quizAttempts ?? 0),
    },
    documentsByStatus: {
      pending: Number(raw.documentsByStatus?.pending ?? 0),
      processing: Number(raw.documentsByStatus?.processing ?? 0),
      done: Number(raw.documentsByStatus?.done ?? 0),
      failed: Number(raw.documentsByStatus?.failed ?? 0),
    },
    aiLast24Hours: {
      requests: Number(raw.aiLast24Hours?.requests ?? 0),
      totalTokens: Number(raw.aiLast24Hours?.totalTokens ?? 0),
      estimatedCostUsd: Number(raw.aiLast24Hours?.estimatedCostUsd ?? 0),
    },
  };
}

function mapQueueJob(raw: RawQueueJob): QueueJobItem {
  return {
    id: String(raw.id ?? ''),
    name: raw.name ?? 'ingest-document',
    state: raw.state ?? 'unknown',
    documentId: raw.documentId ?? '',
    fileName: raw.fileName ?? null,
    mimeType: raw.mimeType ?? null,
    attemptsMade: Number(raw.attemptsMade ?? 0),
    maxAttempts: Number(raw.maxAttempts ?? 1),
    failedReason: raw.failedReason ?? null,
    timestamp: Number(raw.timestamp ?? 0),
    processedOn: raw.processedOn ?? null,
    finishedOn: raw.finishedOn ?? null,
  };
}

function mapAdminDocument(raw: RawAdminDocument): AdminDocumentItem {
  return {
    id: raw.id ?? '',
    fileName: raw.fileName ?? 'Không rõ tên tệp',
    mimeType: raw.mimeType ?? 'application/octet-stream',
    fileSizeBytes: Number(raw.fileSizeBytes ?? 0),
    ocrStatus: raw.ocrStatus ?? 'pending',
    embedStatus: raw.embedStatus ?? 'pending',
    processingError: raw.processingError ?? null,
    pageCount: raw.pageCount ?? null,
    uploadedAt: toIsoDate(raw.uploadedAt),
    userEmail: raw.userEmail ?? null,
  };
}

function mapQueue(raw: RawQueueResponse): AdminQueueData {
  return {
    queue: {
      queueName: raw.queue?.queueName ?? 'document-processing',
      connected: Boolean(raw.queue?.connected),
      isPaused: Boolean(raw.queue?.isPaused),
      counts: {
        waiting: Number(raw.queue?.counts?.waiting ?? 0),
        active: Number(raw.queue?.counts?.active ?? 0),
        completed: Number(raw.queue?.counts?.completed ?? 0),
        failed: Number(raw.queue?.counts?.failed ?? 0),
        delayed: Number(raw.queue?.counts?.delayed ?? 0),
        paused: Number(raw.queue?.counts?.paused ?? 0),
      },
      jobs: Array.isArray(raw.queue?.jobs)
        ? raw.queue.jobs.map(mapQueueJob)
        : [],
    },
    recentDocuments: Array.isArray(raw.recentDocuments)
      ? raw.recentDocuments.map(mapAdminDocument)
      : [],
  };
}

function mapAiUsage(raw: RawAiUsageResponse): AdminAiUsageData {
  return {
    windowDays: Number(raw.windowDays ?? 30),
    summary: {
      totalRequests: Number(raw.summary?.totalRequests ?? 0),
      successRequests: Number(raw.summary?.successRequests ?? 0),
      errorRequests: Number(raw.summary?.errorRequests ?? 0),
      successRatePct: Number(raw.summary?.successRatePct ?? 100),
      promptTokens: Number(raw.summary?.promptTokens ?? 0),
      completionTokens: Number(raw.summary?.completionTokens ?? 0),
      totalTokens: Number(raw.summary?.totalTokens ?? 0),
      estimatedCostUsd: Number(raw.summary?.estimatedCostUsd ?? 0),
      avgLatencyMs: Number(raw.summary?.avgLatencyMs ?? 0),
    },
    byFeature: Array.isArray(raw.byFeature)
      ? raw.byFeature.map((f) => ({
          featureKey: f.featureKey ?? 'UNKNOWN',
          requests: Number(f.requests ?? 0),
          promptTokens: Number(f.promptTokens ?? 0),
          completionTokens: Number(f.completionTokens ?? 0),
          totalTokens: Number(f.totalTokens ?? 0),
          estimatedCostUsd: Number(f.estimatedCostUsd ?? 0),
          avgLatencyMs: Number(f.avgLatencyMs ?? 0),
        }))
      : [],
    byProfile: Array.isArray(raw.byProfile)
      ? raw.byProfile.map((p) => ({
          profile: p.profile ?? 'STANDARD',
          requests: Number(p.requests ?? 0),
          totalTokens: Number(p.totalTokens ?? 0),
          estimatedCostUsd: Number(p.estimatedCostUsd ?? 0),
          avgLatencyMs: Number(p.avgLatencyMs ?? 0),
        }))
      : [],
    dailyTrend: Array.isArray(raw.dailyTrend)
      ? raw.dailyTrend.map((d) => ({
          date: d.date ?? '',
          requests: Number(d.requests ?? 0),
          totalTokens: Number(d.totalTokens ?? 0),
          estimatedCostUsd: Number(d.estimatedCostUsd ?? 0),
        }))
      : [],
    recentLogs: Array.isArray(raw.recentLogs)
      ? raw.recentLogs.map((log) => ({
          id: log.id ?? '',
          userEmail: log.userEmail ?? null,
          featureKey: log.featureKey ?? 'UNKNOWN',
          profile: log.profile ?? 'STANDARD',
          modelName: log.modelName ?? 'unknown',
          promptTokens: Number(log.promptTokens ?? 0),
          completionTokens: Number(log.completionTokens ?? 0),
          totalTokens: Number(log.totalTokens ?? 0),
          estimatedCostUsd: Number(log.estimatedCostUsd ?? 0),
          latencyMs: Number(log.latencyMs ?? 0),
          status: log.status ?? 'success',
          errorMessage: log.errorMessage ?? null,
          createdAt: toIsoDate(log.createdAt),
        }))
      : [],
  };
}

function mapAdminUser(raw: RawAdminUserItem): AdminUserItem {
  return {
    id: raw.id ?? '',
    email: raw.email ?? '',
    name: raw.name ?? 'Người dùng',
    role: raw.role ?? 'user',
    isActive: raw.isActive ?? raw.is_active ?? true,
    isVerified: raw.isVerified ?? raw.is_verified ?? false,
    provider: raw.provider ?? null,
    createdAt: toIsoDate(raw.createdAt ?? raw.created_at),
    stats: {
      subjectsCount: Number(raw.stats?.subjectsCount ?? 0),
      conversationsCount: Number(raw.stats?.conversationsCount ?? 0),
      documentsCount: Number(raw.stats?.documentsCount ?? 0),
      aiRequestsCount: Number(raw.stats?.aiRequestsCount ?? 0),
      totalTokensUsed: Number(raw.stats?.totalTokensUsed ?? 0),
    },
  };
}

function mapUsersList(raw: RawUsersListResponse): AdminUsersListData {
  return {
    total: Number(raw.total ?? 0),
    limit: Number(raw.limit ?? 25),
    offset: Number(raw.offset ?? 0),
    users: Array.isArray(raw.users) ? raw.users.map(mapAdminUser) : [],
  };
}

function mapUpdatedUserStatus(
  raw: RawUpdateUserStatusResponse,
): UpdatedAdminUserStatus {
  return {
    id: raw.id ?? '',
    email: raw.email ?? '',
    name: raw.name ?? '',
    role: raw.role ?? 'user',
    isActive: raw.isActive ?? raw.is_active ?? true,
    isVerified: raw.isVerified ?? raw.is_verified ?? false,
  };
}

function mapRagDelta(
  raw: Partial<RagModeComparisonDelta> | undefined,
  baselineMode: RagBenchmarkMode,
): RagModeComparisonDelta {
  return {
    baselineMode: raw?.baselineMode ?? baselineMode,
    proposedMode: raw?.proposedMode ?? 'hybrid_rrf_rerank',
    hitRateAt1DeltaPct: Number(raw?.hitRateAt1DeltaPct ?? 0),
    hitRateAt5DeltaPct: Number(raw?.hitRateAt5DeltaPct ?? 0),
    mrrAt5DeltaPct: Number(raw?.mrrAt5DeltaPct ?? 0),
    recallAt5DeltaPct: Number(raw?.recallAt5DeltaPct ?? 0),
    ndcgAt5DeltaPct: Number(raw?.ndcgAt5DeltaPct ?? 0),
    antiHallucinationDeltaPct: Number(raw?.antiHallucinationDeltaPct ?? 0),
  };
}

function mapRagBenchmark(raw: Partial<RagBenchmarkReportData>): RagBenchmarkReportData {
  const defaultQueryResults: Record<RagBenchmarkMode, RagSingleQueryResult[]> = {
    vector_only: [],
    keyword_only: [],
    hybrid_rrf: [],
    hybrid_rrf_rerank: [],
  };

  if (raw.queryResultsByMode) {
    (['vector_only', 'keyword_only', 'hybrid_rrf', 'hybrid_rrf_rerank'] as RagBenchmarkMode[]).forEach(
      (mode) => {
        const list = raw.queryResultsByMode?.[mode];
        defaultQueryResults[mode] = Array.isArray(list) ? list : [];
      },
    );
  }

  return {
    generatedAt: toIsoDate(raw.generatedAt),
    datasetVersion: raw.datasetVersion ?? '1.0.0',
    runnerType: raw.runnerType ?? 'golden_ablation',
    corpusStats: {
      documentCount: Number(raw.corpusStats?.documentCount ?? 0),
      chunkCount: Number(raw.corpusStats?.chunkCount ?? 0),
      totalQueries: Number(raw.corpusStats?.totalQueries ?? 0),
      inScopeQueries: Number(raw.corpusStats?.inScopeQueries ?? 0),
      outOfScopeQueries: Number(raw.corpusStats?.outOfScopeQueries ?? 0),
    },
    modeMetrics: Array.isArray(raw.modeMetrics)
      ? (raw.modeMetrics as RagModeMetrics[])
      : [],
    deltasVsVectorOnly: mapRagDelta(raw.deltasVsVectorOnly, 'vector_only'),
    deltasVsHybridRrf: mapRagDelta(raw.deltasVsHybridRrf, 'hybrid_rrf'),
    categoryBreakdown: Array.isArray(raw.categoryBreakdown)
      ? (raw.categoryBreakdown as RagCategoryBreakdown[]).map((item) => ({
          ...item,
          category: item.category as BenchmarkQueryCategory,
        }))
      : [],
    queryResultsByMode: defaultQueryResults,
  };
}

export const adminApi = {
  loginAdmin: async (input: AdminLoginInput): Promise<AdminSessionUser> => {
    const res = await axiosAdmin.authPost<RawLoginResponse>(
      '/api/auth/login',
      input,
    );
    return {
      id: res.data.user?.id ?? '',
      email: res.data.user?.email ?? input.email,
      name: res.data.user?.name ?? input.email.split('@')[0],
      role: res.data.user?.role ?? 'admin',
      avatarUrl: res.data.user?.avatarUrl ?? null,
    };
  },

  logoutAdmin: async (): Promise<void> => {
    await axiosAdmin.authPost<{ success: boolean }>('/api/auth/logout', {});
  },

  getCurrentAdminProfile: async (): Promise<AdminSessionUser> => {
    const res = await axiosAdmin.get<RawUserMeResponse>('/users/me');
    return mapSessionUser(res.data);
  },

  getOverview: async (): Promise<AdminOverviewData> => {
    const res = await axiosAdmin.get<RawOverviewResponse>('/admin/overview');
    return mapOverview(res.data);
  },

  getQueueStatus: async (): Promise<AdminQueueData> => {
    const res = await axiosAdmin.get<RawQueueResponse>('/admin/queues');
    return mapQueue(res.data);
  },

  retryQueueJob: async (jobId: string): Promise<{ jobId: string; status: string }> => {
    const res = await axiosAdmin.post<{ jobId?: string; status?: string }>(
      `/admin/queues/jobs/${encodeURIComponent(jobId)}/retry`,
      {},
    );
    return {
      jobId: res.data.jobId ?? jobId,
      status: res.data.status ?? 'retried',
    };
  },

  removeQueueJob: async (jobId: string): Promise<{ jobId: string; status: string }> => {
    const res = await axiosAdmin.delete<{ jobId?: string; status?: string }>(
      `/admin/queues/jobs/${encodeURIComponent(jobId)}`,
    );
    return {
      jobId: res.data.jobId ?? jobId,
      status: res.data.status ?? 'removed',
    };
  },

  getAiUsage: async (windowDays = 30): Promise<AdminAiUsageData> => {
    const res = await axiosAdmin.get<RawAiUsageResponse>('/admin/ai-usage', {
      params: { windowDays },
    });
    return mapAiUsage(res.data);
  },

  getUsers: async (params?: {
    search?: string;
    limit?: number;
    offset?: number;
  }): Promise<AdminUsersListData> => {
    const res = await axiosAdmin.get<RawUsersListResponse>('/admin/users', {
      params: {
        search: params?.search,
        limit: params?.limit ?? 50,
        offset: params?.offset ?? 0,
      },
    });
    return mapUsersList(res.data);
  },

  updateUserStatus: async (
    userId: string,
    dto: UpdateAdminUserStatusInput,
  ): Promise<UpdatedAdminUserStatus> => {
    const res = await axiosAdmin.patch<RawUpdateUserStatusResponse>(
      `/admin/users/${encodeURIComponent(userId)}/status`,
      dto,
    );
    return mapUpdatedUserStatus(res.data);
  },

  getRagBenchmark: async (): Promise<RagBenchmarkReportData> => {
    const res = await axiosAdmin.get<Partial<RagBenchmarkReportData>>(
      '/admin/rag-benchmark',
    );
    return mapRagBenchmark(res.data);
  },

  runRagBenchmark: async (): Promise<RagBenchmarkReportData> => {
    const res = await axiosAdmin.post<Partial<RagBenchmarkReportData>>(
      '/admin/rag-benchmark/run',
      {},
    );
    return mapRagBenchmark(res.data);
  },
};
