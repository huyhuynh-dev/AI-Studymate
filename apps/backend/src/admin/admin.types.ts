import type { DocumentQueueSnapshot } from '../documents/services/documents-queue.service.js';

export interface AdminOverviewResponse {
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

export interface AdminDocumentQueueItem {
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

export interface AdminQueueResponse {
  queue: DocumentQueueSnapshot;
  recentDocuments: AdminDocumentQueueItem[];
}

export interface AiUsageFeatureBreakdown {
  featureKey: string;
  requests: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCostUsd: number;
  avgLatencyMs: number;
}

export interface AiUsageProfileBreakdown {
  profile: string;
  requests: number;
  totalTokens: number;
  estimatedCostUsd: number;
  avgLatencyMs: number;
}

export interface AiUsageDailyPoint {
  date: string;
  requests: number;
  totalTokens: number;
  estimatedCostUsd: number;
}

export interface AiUsageLogItem {
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

export interface AdminAiUsageResponse {
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
  byFeature: AiUsageFeatureBreakdown[];
  byProfile: AiUsageProfileBreakdown[];
  dailyTrend: AiUsageDailyPoint[];
  recentLogs: AiUsageLogItem[];
}

export interface AdminUserSummary {
  id: string;
  email: string;
  name: string;
  role: string;
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

export interface AdminUsersListResponse {
  total: number;
  limit: number;
  offset: number;
  users: AdminUserSummary[];
}
