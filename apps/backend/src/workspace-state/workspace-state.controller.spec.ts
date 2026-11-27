import { UnauthorizedException } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { Test, type TestingModule } from '@nestjs/testing';
import type { Request } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WorkspaceStateController } from './workspace-state.controller.js';
import { WorkspaceStateService } from './workspace-state.service.js';

describe('WorkspaceStateController', () => {
  let controller: WorkspaceStateController;
  const mockService = {
    getState: vi.fn(),
    upsertState: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      imports: [ThrottlerModule.forRoot([{ ttl: 60000, limit: 60 }])],
      controllers: [WorkspaceStateController],
      providers: [{ provide: WorkspaceStateService, useValue: mockService }],
    }).compile();

    controller = module.get<WorkspaceStateController>(WorkspaceStateController);
  });

  it('từ chối request thiếu req.user với UnauthorizedException', async () => {
    const req = {} as Request;
    await expect(controller.getWorkspaceState(req)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('lấy userId từ req.user và ủy quyền cho WorkspaceStateService', async () => {
    const userId = '11111111-1111-4111-8111-111111111111';
    const req = { user: { userId } } as unknown as Request;
    mockService.getState.mockResolvedValue({
      schemaVersion: 1,
      location: null,
      layout: null,
    });

    const readRes = await controller.getWorkspaceState(req);
    expect(mockService.getState).toHaveBeenCalledWith(userId);
    expect(readRes).toEqual({ schemaVersion: 1, location: null, layout: null });

    const dto = {
      sourceId: 'source-123456',
      seq: 1,
      layout: { leftSidebarCollapsed: true, rightSidebarCollapsed: false },
    };
    mockService.upsertState.mockResolvedValue({ layoutApplied: true });
    const writeRes = await controller.upsertWorkspaceState(req, dto);
    expect(mockService.upsertState).toHaveBeenCalledWith(userId, dto);
    expect(writeRes).toEqual({ layoutApplied: true });
  });
});
