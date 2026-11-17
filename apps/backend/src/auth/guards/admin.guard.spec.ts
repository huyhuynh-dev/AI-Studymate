import {
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { UsersService } from '../../users/users.service.js';
import { AdminGuard } from './admin.guard.js';

function createHttpContext(user?: { userId?: string; sub?: string }): ExecutionContext {
  return {
    getType: () => 'http',
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
  } as unknown as ExecutionContext;
}

describe('AdminGuard', () => {
  let guard: AdminGuard;
  let usersMock: { findUserById: ReturnType<typeof vi.fn> };
  let configMock: { get: ReturnType<typeof vi.fn> };

  const userId = '11111111-1111-4111-8111-111111111111';

  beforeEach(() => {
    usersMock = { findUserById: vi.fn() };
    configMock = { get: vi.fn().mockReturnValue('boss@studymate.vn') };
    guard = new AdminGuard(
      usersMock as unknown as UsersService,
      configMock as unknown as ConfigService,
    );
  });

  it('nên ném UnauthorizedException nếu thiếu req.user', async () => {
    await expect(guard.canActivate(createHttpContext(undefined))).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('nên ném ForbiddenException đối với tài khoản user thường hoặc bị khóa', async () => {
    usersMock.findUserById.mockResolvedValueOnce({
      id: userId,
      email: 'student@studymate.vn',
      role: 'user',
      is_active: true,
    });
    await expect(guard.canActivate(createHttpContext({ userId }))).rejects.toThrow(
      ForbiddenException,
    );

    usersMock.findUserById.mockResolvedValueOnce({
      id: userId,
      email: 'boss@studymate.vn',
      role: 'admin',
      is_active: false,
    });
    await expect(guard.canActivate(createHttpContext({ userId }))).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('nên cho phép truy cập nếu role === admin hoặc email thuộc ADMIN_EMAILS', async () => {
    usersMock.findUserById.mockResolvedValueOnce({
      id: userId,
      email: 'any@studymate.vn',
      role: 'admin',
      is_active: true,
    });
    await expect(guard.canActivate(createHttpContext({ userId }))).resolves.toBe(
      true,
    );

    usersMock.findUserById.mockResolvedValueOnce({
      id: userId,
      email: 'BOSS@studymate.vn',
      role: 'user',
      is_active: true,
    });
    await expect(guard.canActivate(createHttpContext({ userId }))).resolves.toBe(
      true,
    );
  });
});
