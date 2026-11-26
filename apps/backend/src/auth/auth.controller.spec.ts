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

  it('refreshTokens truyền rememberMe từ RefreshTokenStrategy sang AuthService', async () => {
    const req = {
      user: {
        userId: 'user-1',
        email: 'a@b.com',
        refreshToken: 'rt-1',
        rememberMe: true,
      },
    } as unknown as Request;

    await controller.refreshTokens(req);
    expect(authServiceMock.refreshTokens).toHaveBeenCalledWith(
      'user-1',
      'rt-1',
      true,
    );
  });

  it('exchangeCode mặc định rememberMe=true khi không truyền', async () => {
    await controller.exchangeCode({ authCode: 'code-123' });
    expect(authServiceMock.exchangeGoogleAuthCode).toHaveBeenCalledWith(
      'code-123',
      true,
    );

    await controller.exchangeCode({ authCode: 'code-456', rememberMe: false });
    expect(authServiceMock.exchangeGoogleAuthCode).toHaveBeenCalledWith(
      'code-456',
      false,
    );
  });
});
