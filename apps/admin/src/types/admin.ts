export type AdminTabKey =
  | 'overview'
  | 'queues'
  | 'ai-telemetry'
  | 'rag-benchmark';

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

export interface AdminSessionUser {
  id: string;
  email: string;
  name: string;
  role: string;
  avatarUrl: string | null;
}

export interface AdminLoginInput {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export interface AdminOverviewData {
  generatedAt: string;
  health: {
    database: 'up' | 'down';
    redis: 'up' | 'down';
  };
  totals: {
    users: number;
    activeUsers: number;
    subjects: number;
    conversations: number;
    documents: number;
    documentChunks: number;
    flashcards: number;
    flashcardReviews: number;
    quizzes: number;
    quizAttempts: number;
  };
  documentsByStatus: {
    pending: number;
    processing: number;
    done: number;
    failed: number;
  };
  aiLast24Hours: {
    requests: number;
    totalTokens: number;
    estimatedCostUsd: number;
  };
}

export interface QueueJobCounts {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: number;
}

export interface QueueJobItem {
  id: string;
  name: string;
  state: string;
  documentId: string;
  fileName: string | null;
  mimeType: string | null;
  attemptsMade: number;
  maxAttempts: number;
  failedReason: string | null;
  timestamp: number;
  processedOn: number | null;
  finishedOn: number | null;
}

export interface AdminDocumentItem {
  id: string;
  fileName: string;
  mimeType: string;
  fileSizeBytes: number;
  ocrStatus: string;
  embedStatus: string;
  processingError: string | null;
  pageCount: number | null;
  uploadedAt: string;
  userEmail: string | null;
}

export interface AdminQueueData {
  queue: {
    queueName: string;
    connected: boolean;
    isPaused: boolean;
    counts: QueueJobCounts;
    jobs: QueueJobItem[];
  };
  recentDocuments: AdminDocumentItem[];
}

export interface AiFeatureMetric {
  featureKey: string;
  requests: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCostUsd: number;
  avgLatencyMs: number;
}

export interface AiProfileMetric {
  profile: string;
  requests: number;
  totalTokens: number;
  estimatedCostUsd: number;
  avgLatencyMs: number;
}

export interface AiDailyPoint {
  date: string;
  requests: number;
  totalTokens: number;
  estimatedCostUsd: number;
}

export interface AiUsageLogEntry {
  id: string;
  userEmail: string | null;
  featureKey: string;
  profile: string;
  modelName: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCostUsd: number;
  latencyMs: number;
  status: string;
  errorMessage: string | null;
  createdAt: string;
}

export interface AdminAiUsageData {
  windowDays: number;
  summary: {
    totalRequests: number;
    successRequests: number;
    errorRequests: number;
    successRatePct: number;
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    estimatedCostUsd: number;
    avgLatencyMs: number;
  };
  byFeature: AiFeatureMetric[];
  byProfile: AiProfileMetric[];
  dailyTrend: AiDailyPoint[];
  recentLogs: AiUsageLogEntry[];
}

export interface AdminUserItem {
  id: string;
  email: string;
  name: string;
  role: 'user' | 'admin' | string;
  isActive: boolean;
  isVerified: boolean;
  provider: string | null;
  createdAt: string;
  stats: {
    subjectsCount: number;
    conversationsCount: number;
    documentsCount: number;
    aiRequestsCount: number;
    totalTokensUsed: number;
  };
}

export interface AdminUsersListData {
  total: number;
  limit: number;
  offset: number;
  users: AdminUserItem[];
}

export interface UpdateAdminUserStatusInput {
  isActive?: boolean;
  role?: 'user' | 'admin';
}

export interface UpdatedAdminUserStatus {
  id: string;
  email: string;
  name: string;
  role: string;
  isActive: boolean;
  isVerified: boolean;
}

export interface RagModeMetrics {
  mode: RagBenchmarkMode;
  modeLabel: string;
  totalQueries: number;
  inScopeQueries: number;
  outOfScopeQueries: number;
  hitRateAt1: number;
  hitRateAt3: number;
  hitRateAt5: number;
  hitRateAt8: number;
  mrrAt5: number;
  mrrAt8: number;
  recallAt5: number;
  recallAt8: number;
  precisionAt5: number;
  ndcgAt5: number;
  ndcgAt8: number;
  antiHallucinationRate: number;
  avgLatencyMs: number;
  p50LatencyMs: number;
  p95LatencyMs: number;
}

export interface RagModeComparisonDelta {
  baselineMode: RagBenchmarkMode;
  proposedMode: RagBenchmarkMode;
  hitRateAt1DeltaPct: number;
  hitRateAt5DeltaPct: number;
  mrrAt5DeltaPct: number;
  recallAt5DeltaPct: number;
  ndcgAt5DeltaPct: number;
  antiHallucinationDeltaPct: number;
}

export interface RagCategoryModeSummary {
  hitRateAt5: number;
  mrrAt5: number;
  recallAt5: number;
  ndcgAt5: number;
  antiHallucinationRate: number | null;
}

export interface RagCategoryBreakdown {
  category: BenchmarkQueryCategory;
  categoryLabel: string;
  queryCount: number;
  byMode: Record<RagBenchmarkMode, RagCategoryModeSummary>;
}

export interface RagSingleQueryResult {
  queryId: string;
  category: BenchmarkQueryCategory;
  question: string;
  isOutOfScope: boolean;
  expectedChunkIds: string[];
  returnedChunkIds: string[];
  topCandidateScore: number;
  firstRelevantRank: number | null;
  hitAt1: number;
  hitAt3: number;
  hitAt5: number;
  hitAt8: number;
  reciprocalRankAt5: number;
  reciprocalRankAt8: number;
  recallAt5: number;
  recallAt8: number;
  precisionAt5: number;
  ndcgAt5: number;
  ndcgAt8: number;
  rejectedOutOfScope: boolean | null;
  latencyMs: number;
  subQueriesUsed: string[];
}

export interface RagBenchmarkReportData {
  generatedAt: string;
  datasetVersion: string;
  runnerType: 'golden_ablation' | 'live_database';
  corpusStats: {
    documentCount: number;
    chunkCount: number;
    totalQueries: number;
    inScopeQueries: number;
    outOfScopeQueries: number;
  };
  modeMetrics: RagModeMetrics[];
  deltasVsVectorOnly: RagModeComparisonDelta;
  deltasVsHybridRrf: RagModeComparisonDelta;
  categoryBreakdown: RagCategoryBreakdown[];
  queryResultsByMode: Record<RagBenchmarkMode, RagSingleQueryResult[]>;
}
