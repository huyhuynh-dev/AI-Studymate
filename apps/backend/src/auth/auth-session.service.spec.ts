import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { RedisService } from '../redis/redis.service.js';
import {
  AuthSessionService,
  hashSessionToken,
} from './auth-session.service.js';

describe('AuthSessionService', () => {
  let service: AuthSessionService;
  let txMock: {
    userSession: {
      updateMany: ReturnType<typeof vi.fn>;
      findUnique: ReturnType<typeof vi.fn>;
    };
  };
  let prismaMock: {
    $transaction: ReturnType<typeof vi.fn>;
    userSession: {
      create: ReturnType<typeof vi.fn>;
      updateMany: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
      findUnique: ReturnType<typeof vi.fn>;
    };
    user: {
      update: ReturnType<typeof vi.fn>;
      findUnique: ReturnType<typeof vi.fn>;
    };
  };
  let redisMock: {
    get: ReturnType<typeof vi.fn>;
    set: ReturnType<typeof vi.fn>;
    del: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    txMock = {
      userSession: {
        updateMany: vi.fn(),
        findUnique: vi.fn(),
      },
    };

    prismaMock = {
      $transaction: vi.fn(async (arg: unknown) => {
        if (typeof arg === 'function') {
          return (arg as (tx: typeof txMock) => Promise<unknown>)(txMock);
        }
        return Promise.all(arg as Promise<unknown>[]);
      }),
      userSession: {
        create: vi.fn().mockResolvedValue({}),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findMany: vi.fn().mockResolvedValue([]),
        findUnique: vi.fn(),
      },
      user: {
        update: vi.fn().mockResolvedValue({}),
        findUnique: vi.fn(),
      },
    };

    redisMock = {
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue(undefined),
      del: vi.fn().mockResolvedValue(undefined),
    };

    const configMock = {
      get: vi.fn((key: string) =>
        key === 'JWT_EXPIRES_IN' ? '3600' : undefined,
      ),
    } as unknown as ConfigService;

    service = new AuthSessionService(
      prismaMock as unknown as PrismaService,
      redisMock as unknown as RedisService,
      configMock,
    );
  });

  it('hashSessionToken phân biệt được các JWT dài > 72 bytes có cùng phần đầu', () => {
    const commonPrefix = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.' + 'a'.repeat(50);
    const token1 = `${commonPrefix}.sig_one`;
    const token2 = `${commonPrefix}.sig_two`;

    const hash1 = hashSessionToken(token1);
    const hash2 = hashSessionToken(token2);

    expect(hash1).toHaveLength(64);
    expect(hash2).toHaveLength(64);
    expect(hash1).not.toBe(hash2);
  });

  it('rotateSession xoay vòng nguyên tử thành công và lưu grace cache 30s trong Redis', async () => {
    txMock.userSession.updateMany.mockResolvedValueOnce({ count: 1 });

    const result = await service.rotateSession({
      sessionId: 'sid-1',
      userId: 'user-1',
      incomingRefreshToken: 'old-rt',
      generateNextPair: async () => ({
        access_token: 'new-at',
        refresh_token: 'new-rt',
        expiresAt: new Date(Date.now() + 604800_000),
      }),
    });

    expect(result).toEqual({
      access_token: 'new-at',
      refresh_token: 'new-rt',
    });
    expect(redisMock.set).toHaveBeenCalledWith(
      `auth:refresh-grace:sid-1:${hashSessionToken('old-rt')}`,
      JSON.stringify({ access_token: 'new-at', refresh_token: 'new-rt' }),
      30,
    );
  });

  it('rotateSession trả về cặp token đã cache nếu request song song tới trong grace window', async () => {
    redisMock.get.mockResolvedValueOnce(
      JSON.stringify({ access_token: 'cached-at', refresh_token: 'cached-rt' }),
    );

    const generateNextPair = vi.fn();
    const result = await service.rotateSession({
      sessionId: 'sid-1',
      userId: 'user-1',
      incomingRefreshToken: 'old-rt',
      generateNextPair,
    });

    expect(result).toEqual({
      access_token: 'cached-at',
      refresh_token: 'cached-rt',
    });
    expect(generateNextPair).not.toHaveBeenCalled();
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it('rotateSession phát hiện refresh token reuse ngoài grace window và thu hồi session', async () => {
    txMock.userSession.updateMany
      .mockResolvedValueOnce({ count: 0 })
      .mockResolvedValueOnce({ count: 1 });
    txMock.userSession.findUnique.mockResolvedValueOnce({
      id: 'sid-1',
      user_id: 'user-1',
      revoked_at: null,
      expires_at: new Date(Date.now() + 100_000),
      prev_refresh_token_hash: hashSessionToken('old-rt'),
      rotated_at: new Date(Date.now() - 60_000), // quá 30s grace window
    });

    await expect(
      service.rotateSession({
        sessionId: 'sid-1',
        userId: 'user-1',
        incomingRefreshToken: 'old-rt',
        generateNextPair: async () => ({
          access_token: 'new-at',
          refresh_token: 'new-rt',
          expiresAt: new Date(Date.now() + 604800_000),
        }),
      }),
    ).rejects.toThrow(ForbiddenException);

    expect(txMock.userSession.updateMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: { id: 'sid-1', revoked_at: null },
        data: expect.objectContaining({ revoke_reason: 'refresh_token_reuse' }),
      }),
    );
    expect(redisMock.set).toHaveBeenCalledWith(
      'auth:revoked-session:sid-1',
      '1',
      3600,
    );
  });

  it('validateAccessTokenSession từ chối ngay access token khi session đã bị thu hồi hoặc lệch token_version', async () => {
    redisMock.get.mockResolvedValueOnce('1');
    await expect(
      service.validateAccessTokenSession({
        userId: 'user-1',
        sessionId: 'sid-revoked',
        tokenVersion: 0,
      }),
    ).rejects.toThrow(UnauthorizedException);

    redisMock.get
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(JSON.stringify({ isActive: true, tokenVersion: 2 }));
    await expect(
      service.validateAccessTokenSession({
        userId: 'user-1',
        sessionId: 'sid-active',
        tokenVersion: 1,
      }),
    ).rejects.toThrow(UnauthorizedException);

    redisMock.get
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(JSON.stringify({ isActive: true, tokenVersion: 2 }));
    await expect(
      service.validateAccessTokenSession({
        userId: 'user-1',
        sessionId: 'sid-active',
        tokenVersion: 2,
      }),
    ).resolves.toBeUndefined();

    redisMock.get
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(JSON.stringify({ isActive: false, tokenVersion: 2 }));
    await expect(
      service.validateAccessTokenSession({
        userId: 'user-1',
        sessionId: 'sid-active',
        tokenVersion: 2,
      }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('revokeOtherUserSessions chỉ thu hồi các phiên khác và giữ nguyên phiên hiện tại', async () => {
    prismaMock.userSession.findMany.mockResolvedValueOnce([
      { id: 'sid-other-1' },
      { id: 'sid-other-2' },
    ]);

    await service.revokeOtherUserSessions(
      'user-1',
      'sid-current',
      'password_change',
    );

    expect(prismaMock.userSession.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          user_id: 'user-1',
          id: { not: 'sid-current' },
          revoked_at: null,
        },
        data: expect.objectContaining({ revoke_reason: 'password_change' }),
      }),
    );
    expect(redisMock.set).toHaveBeenCalledWith(
      'auth:revoked-session:sid-other-1',
      '1',
      3600,
    );
    expect(redisMock.set).toHaveBeenCalledWith(
      'auth:revoked-session:sid-other-2',
      '1',
      3600,
    );
  });

  it('revokeAllUserSessions tăng token_version, thu hồi toàn bộ phiên và đánh dấu Redis', async () => {
    prismaMock.userSession.findMany.mockResolvedValueOnce([
      { id: 'sid-a' },
      { id: 'sid-b' },
    ]);

    await service.revokeAllUserSessions('user-1', 'password_reset');

    expect(prismaMock.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { token_version: { increment: 1 }, refresh_token: null },
    });
    expect(redisMock.del).toHaveBeenCalledWith('auth:user-state:user-1');
    expect(redisMock.set).toHaveBeenCalledWith(
      'auth:revoked-session:sid-a',
      '1',
      3600,
    );
    expect(redisMock.set).toHaveBeenCalledWith(
      'auth:revoked-session:sid-b',
      '1',
      3600,
    );
  });
});
