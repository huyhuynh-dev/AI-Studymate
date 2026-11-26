import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { Request } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';

describe('AuthController', () => {
  let controller: AuthController;
  let authServiceMock: {
    refreshTokens: ReturnType<typeof vi.fn>;
    exchangeGoogleAuthCode: ReturnType<typeof vi.fn>;
    logoutByTokens: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    authServiceMock = {
      refreshTokens: vi.fn().mockResolvedValue({
        access_token: 'new-access',
        refresh_token: 'new-refresh',
      }),
      exchangeGoogleAuthCode: vi.fn().mockResolvedValue({
        access_token: 'google-access',
        refresh_token: 'google-refresh',
      }),
      logoutByTokens: vi.fn().mockResolvedValue({
        message: 'Logged out successfully',
        revoked: true,
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: authServiceMock },
        { provide: ConfigService, useValue: { get: () => undefined } },
      ],
    })
      .overrideGuard(ThrottlerGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<AuthController>(AuthController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('refreshTokens truyền rememberMe và sessionId từ RefreshTokenStrategy sang AuthService', async () => {
    const req = {
      user: {
        userId: 'user-1',
        email: 'a@b.com',
        refreshToken: 'rt-1',
        rememberMe: true,
        sessionId: 'sid-99',
      },
      ip: '127.0.0.1',
      get: () => undefined,
    } as unknown as Request;

    await controller.refreshTokens(req);
    expect(authServiceMock.refreshTokens).toHaveBeenCalledWith(
      'user-1',
      'rt-1',
      true,
      'sid-99',
      { userAgent: undefined, ipAddress: '127.0.0.1' },
    );
  });

  it('exchangeCode mặc định rememberMe=true khi không truyền', async () => {
    const req = {
      ip: '10.0.0.1',
      get: (name: string) =>
        name.toLowerCase() === 'user-agent' ? 'Edge' : undefined,
    } as unknown as Request;

    await controller.exchangeCode({ authCode: 'code-123' }, req);
    expect(authServiceMock.exchangeGoogleAuthCode).toHaveBeenCalledWith(
      'code-123',
      true,
      { userAgent: 'Edge', ipAddress: '10.0.0.1' },
    );

    await controller.exchangeCode(
      { authCode: 'code-456', rememberMe: false },
      req,
    );
    expect(authServiceMock.exchangeGoogleAuthCode).toHaveBeenCalledWith(
      'code-456',
      false,
      { userAgent: 'Edge', ipAddress: '10.0.0.1' },
    );
  });

  it('logout nhận cả Bearer access token lẫn refreshToken trong body', async () => {
    const req = {
      get: (name: string) =>
        name === 'Authorization' ? 'Bearer access-123' : undefined,
    } as unknown as Request;

    await controller.logout(req, { refreshToken: 'refresh-456' });
    expect(authServiceMock.logoutByTokens).toHaveBeenCalledWith({
      accessToken: 'access-123',
      refreshToken: 'refresh-456',
    });
  });
});
