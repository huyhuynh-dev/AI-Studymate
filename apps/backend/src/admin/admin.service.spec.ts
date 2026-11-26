import { BadRequestException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthSessionService } from '../auth/auth-session.service.js';
import type { DocumentsQueueService } from '../documents/services/documents-queue.service.js';
import type { RagBenchmarkService } from '../rag-benchmark/rag-benchmark.service.js';
import type { RedisService } from '../redis/redis.service.js';
import type { AdminRepoService } from './admin-repo.service.js';
import { AdminService } from './admin.service.js';

describe('AdminService', () => {
  let service: AdminService;
  let repoMock: {
    pingDatabase: ReturnType<typeof vi.fn>;
    getOverviewCounts: ReturnType<typeof vi.fn>;
    getRecentDocumentsForQueue: ReturnType<typeof vi.fn>;
    getAiUsageAnalytics: ReturnType<typeof vi.fn>;
    listUsers: ReturnType<typeof vi.fn>;
    findUserById: ReturnType<typeof vi.fn>;
    updateUserStatus: ReturnType<typeof vi.fn>;
  };
  let queueMock: {
    getQueueMetrics: ReturnType<typeof vi.fn>;
    retryJob: ReturnType<typeof vi.fn>;
    removeJob: ReturnType<typeof vi.fn>;
  };
  let ragMock: {
    getLatestReport: ReturnType<typeof vi.fn>;
    runGoldenAblationBenchmark: ReturnType<typeof vi.fn>;
  };
  let redisMock: {
    getRedisClient: ReturnType<typeof vi.fn>;
  };
  let authSessionMock: {
    revokeAllUserSessions: ReturnType<typeof vi.fn>;
    invalidateUserStateCache: ReturnType<typeof vi.fn>;
  };

  const adminId = '11111111-1111-4111-8111-111111111111';
  const targetId = '22222222-2222-4222-8222-222222222222';

  beforeEach(() => {
    repoMock = {
      pingDatabase: vi.fn().mockResolvedValue(true),
      getOverviewCounts: vi.fn().mockResolvedValue({
        totals: { users: 5 },
        documentsByStatus: { pending: 0, processing: 1, done: 10, failed: 0 },
        aiLast24Hours: { requests: 12, totalTokens: 4500, estimatedCostUsd: 0.01 },
      }),
      getRecentDocumentsForQueue: vi.fn().mockResolvedValue([]),
      getAiUsageAnalytics: vi.fn().mockResolvedValue({ windowDays: 30 }),
      listUsers: vi.fn().mockResolvedValue({ total: 1, users: [] }),
      findUserById: vi.fn().mockResolvedValue({ id: targetId, role: 'user' }),
      updateUserStatus: vi.fn().mockResolvedValue({ id: targetId, is_active: false }),
    };

    queueMock = {
      getQueueMetrics: vi.fn().mockResolvedValue({ queueName: 'document-processing', connected: true }),
      retryJob: vi.fn().mockResolvedValue({ jobId: 'ingest-1', status: 'requeued' }),
      removeJob: vi.fn().mockResolvedValue({ jobId: 'ingest-1', removed: true }),
    };

    ragMock = {
      getLatestReport: vi.fn().mockReturnValue(null),
      runGoldenAblationBenchmark: vi.fn().mockReturnValue({ datasetVersion: 'v1' }),
    };

    redisMock = {
      getRedisClient: vi.fn().mockReturnValue({
        isOpen: true,
        ping: vi.fn().mockResolvedValue('PONG'),
      }),
    };

    authSessionMock = {
      revokeAllUserSessions: vi.fn().mockResolvedValue(undefined),
      invalidateUserStateCache: vi.fn().mockResolvedValue(undefined),
    };

    service = new AdminService(
      repoMock as unknown as AdminRepoService,
      queueMock as unknown as DocumentsQueueService,
      ragMock as unknown as RagBenchmarkService,
      redisMock as unknown as RedisService,
      authSessionMock as unknown as AuthSessionService,
    );
  });

  it('nên trả về trạng thái tổng quan kèm health database & redis', async () => {
    const overview = await service.getOverview();
    expect(overview.health).toEqual({ database: 'up', redis: 'up' });
    expect(overview.totals.users).toBe(5);
  });

  it('nên chặn Admin tự khóa hoặc tự hạ quyền của chính mình', async () => {
    await expect(
      service.updateUserStatus(adminId, adminId, { isActive: false }),
    ).rejects.toThrow(BadRequestException);

    await expect(
      service.updateUserStatus(adminId, adminId, { role: 'user' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('nên ném NotFoundException nếu cập nhật user không tồn tại', async () => {
    repoMock.findUserById.mockResolvedValueOnce(null);
    await expect(
      service.updateUserStatus(adminId, targetId, { isActive: false }),
    ).rejects.toThrow(NotFoundException);
  });

  it('nên thu hồi toàn bộ phiên và xóa cache Redis khi khóa hoặc mở khóa tài khoản user', async () => {
    await service.updateUserStatus(adminId, targetId, { isActive: false });
    expect(authSessionMock.revokeAllUserSessions).toHaveBeenCalledWith(
      targetId,
      'account_disabled',
    );

    repoMock.updateUserStatus.mockResolvedValueOnce({
      id: targetId,
      is_active: true,
    });
    await service.updateUserStatus(adminId, targetId, { isActive: true });
    expect(authSessionMock.invalidateUserStateCache).toHaveBeenCalledWith(
      targetId,
    );
  });

  it('nên ủy quyền điều khiển queue retry/remove và fallback chạy RAG benchmark nếu chưa có cache', async () => {
    await expect(service.retryQueueJob('ingest-1')).resolves.toEqual({
      jobId: 'ingest-1',
      status: 'requeued',
    });
    await expect(service.removeQueueJob('ingest-1')).resolves.toEqual({
      jobId: 'ingest-1',
      removed: true,
    });

    const report = service.getRagBenchmarkLatest();
    expect(ragMock.runGoldenAblationBenchmark).toHaveBeenCalledWith({
      persistToDisk: true,
    });
    expect(report).toEqual({ datasetVersion: 'v1' });
  });
});
