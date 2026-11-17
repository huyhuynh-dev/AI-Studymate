import { UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminController } from './admin.controller.js';
import type { AdminService } from './admin.service.js';

describe('AdminController', () => {
  let controller: AdminController;
  let adminServiceMock: {
    getOverview: ReturnType<typeof vi.fn>;
    getQueueStatus: ReturnType<typeof vi.fn>;
    retryQueueJob: ReturnType<typeof vi.fn>;
    removeQueueJob: ReturnType<typeof vi.fn>;
    getAiUsageAnalytics: ReturnType<typeof vi.fn>;
    listUsers: ReturnType<typeof vi.fn>;
    updateUserStatus: ReturnType<typeof vi.fn>;
    getRagBenchmarkLatest: ReturnType<typeof vi.fn>;
    runRagBenchmark: ReturnType<typeof vi.fn>;
  };

  const adminId = '11111111-1111-4111-8111-111111111111';
  const targetId = '22222222-2222-4222-8222-222222222222';
  const authReq = { user: { userId: adminId } } as unknown as Request;

  beforeEach(() => {
    adminServiceMock = {
      getOverview: vi.fn().mockResolvedValue({ totals: {} }),
      getQueueStatus: vi.fn().mockResolvedValue({ queue: {} }),
      retryQueueJob: vi.fn().mockResolvedValue({ status: 'requeued' }),
      removeQueueJob: vi.fn().mockResolvedValue({ removed: true }),
      getAiUsageAnalytics: vi.fn().mockResolvedValue({ windowDays: 30 }),
      listUsers: vi.fn().mockResolvedValue({ total: 0, users: [] }),
      updateUserStatus: vi.fn().mockResolvedValue({ id: targetId }),
      getRagBenchmarkLatest: vi.fn().mockReturnValue({ datasetVersion: 'v1' }),
      runRagBenchmark: vi.fn().mockReturnValue({ datasetVersion: 'v1' }),
    };

    controller = new AdminController(
      adminServiceMock as unknown as AdminService,
    );
  });

  it('nên ném UnauthorizedException nếu updateUserStatus thiếu req.user', async () => {
    await expect(
      controller.updateUserStatus({} as Request, targetId, { isActive: false }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('nên gọi đúng các phương thức của AdminService cho toàn bộ 9 endpoints', async () => {
    await controller.getOverview();
    expect(adminServiceMock.getOverview).toHaveBeenCalledTimes(1);

    await controller.getQueues();
    expect(adminServiceMock.getQueueStatus).toHaveBeenCalledTimes(1);

    await controller.retryQueueJob('ingest-1');
    expect(adminServiceMock.retryQueueJob).toHaveBeenCalledWith('ingest-1');

    await controller.removeQueueJob('ingest-1');
    expect(adminServiceMock.removeQueueJob).toHaveBeenCalledWith('ingest-1');

    await controller.getAiUsage({ windowDays: 7 });
    expect(adminServiceMock.getAiUsageAnalytics).toHaveBeenCalledWith(7);

    await controller.listUsers({ search: 'huy', limit: 10, offset: 0 });
    expect(adminServiceMock.listUsers).toHaveBeenCalledWith({
      search: 'huy',
      limit: 10,
      offset: 0,
    });

    await controller.updateUserStatus(authReq, targetId, { isActive: false });
    expect(adminServiceMock.updateUserStatus).toHaveBeenCalledWith(
      adminId,
      targetId,
      { isActive: false },
    );

    controller.getRagBenchmark();
    expect(adminServiceMock.getRagBenchmarkLatest).toHaveBeenCalledTimes(1);

    controller.runRagBenchmark();
    expect(adminServiceMock.runRagBenchmark).toHaveBeenCalledTimes(1);
  });
});
