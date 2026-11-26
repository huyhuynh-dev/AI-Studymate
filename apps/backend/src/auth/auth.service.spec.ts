import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import bcrypt from 'bcrypt';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MailService } from '../mail/mail.service.js';
import { RedisService } from '../redis/redis.service.js';
import { UsersService } from '../users/users.service.js';
import { AuthSessionService } from './auth-session.service.js';
import { AuthService } from './auth.service.js';
import { GoogleService } from './google.service.js';

describe('AuthService', () => {
  let service: AuthService;
  let configValues: Record<string, string | undefined>;
  let jwtServiceMock: {
    signAsync: ReturnType<typeof vi.fn>;
    verifyAsync: ReturnType<typeof vi.fn>;
  };
  let usersServiceMock: {
    findUserByEmail: ReturnType<typeof vi.fn>;
    findUserById: ReturnType<typeof vi.fn>;
    updateUser: ReturnType<typeof vi.fn>;
  };
  let redisServiceMock: {
    getAndDelete: ReturnType<typeof vi.fn>;
    get: ReturnType<typeof vi.fn>;
    del: ReturnType<typeof vi.fn>;
  };
  let authSessionServiceMock: {
    createSession: ReturnType<typeof vi.fn>;
    rotateSession: ReturnType<typeof vi.fn>;
    revokeSession: ReturnType<typeof vi.fn>;
    revokeAllUserSessions: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    configValues = {
      JWT_SECRET: 'test-access-secret',
      JWT_REFRESH_SECRET: 'test-refresh-secret',
      JWT_EXPIRES_IN: '3600',
      JWT_REFRESH_EXPIRES_IN: '7d',
      JWT_REFRESH_REMEMBER_EXPIRES_IN: '30d',
    };

    jwtServiceMock = {
      signAsync: vi
        .fn()
        .mockResolvedValueOnce('signed-access-jwt')
        .mockResolvedValueOnce('signed-refresh-jwt'),
      verifyAsync: vi.fn(),
    };

    usersServiceMock = {
      findUserByEmail: vi.fn(),
      findUserById: vi.fn(),
      updateUser: vi.fn().mockResolvedValue({}),
    };

    redisServiceMock = {
      getAndDelete: vi.fn(),
      get: vi.fn(),
      del: vi.fn().mockResolvedValue(undefined),
    };

    authSessionServiceMock = {
      createSession: vi.fn().mockResolvedValue(undefined),
      rotateSession: vi.fn().mockResolvedValue({
        access_token: 'rotated-access-jwt',
        refresh_token: 'rotated-refresh-jwt',
      }),
      revokeSession: vi.fn().mockResolvedValue(true),
      revokeAllUserSessions: vi.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) => configValues[key],
            getOrThrow: (key: string) => {
              const val = configValues[key];
              if (!val) throw new Error(`Missing config: ${key}`);
              return val;
            },
          },
        },
        { provide: GoogleService, useValue: {} },
        { provide: JwtService, useValue: jwtServiceMock },
        { provide: UsersService, useValue: usersServiceMock },
        { provide: RedisService, useValue: redisServiceMock },
        { provide: MailService, useValue: {} },
        { provide: AuthSessionService, useValue: authSessionServiceMock },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('signInWithEmailAndPassword tạo UserSession 7 ngày khi rememberMe=false', async () => {
    const passwordHash = await bcrypt.hash('Password@123', 4);
    usersServiceMock.findUserByEmail.mockResolvedValueOnce({
      id: 'user-1',
      email: 'student@studymate.vn',
      password_hash: passwordHash,
      is_verified: true,
      token_version: 2,
    });

    const result = await service.signInWithEmailAndPassword(
      {
        email: 'student@studymate.vn',
        password: 'Password@123',
        rememberMe: false,
      },
      { userAgent: 'Chrome', ipAddress: '127.0.0.1' },
    );

    expect(result).toEqual({
      access_token: 'signed-access-jwt',
      refresh_token: 'signed-refresh-jwt',
    });
    expect(jwtServiceMock.signAsync).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        sub: 'user-1',
        email: 'student@studymate.vn',
        ver: 2,
        sid: expect.any(String),
      }),
      { secret: 'test-access-secret', expiresIn: 3600 },
    );
    expect(jwtServiceMock.signAsync).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        sub: 'user-1',
        email: 'student@studymate.vn',
        rem: false,
        sid: expect.any(String),
        jti: expect.any(String),
      }),
      { secret: 'test-refresh-secret', expiresIn: 604800 },
    );
    expect(authSessionServiceMock.createSession).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        refreshToken: 'signed-refresh-jwt',
        rememberMe: false,
        userAgent: 'Chrome',
        ipAddress: '127.0.0.1',
      }),
    );
  });

  it('signInWithEmailAndPassword tạo UserSession 30 ngày khi rememberMe=true', async () => {
    const passwordHash = await bcrypt.hash('Password@123', 4);
    usersServiceMock.findUserByEmail.mockResolvedValueOnce({
      id: 'user-1',
      email: 'student@studymate.vn',
      password_hash: passwordHash,
      is_verified: true,
      token_version: 0,
    });

    await service.signInWithEmailAndPassword({
      email: 'student@studymate.vn',
      password: 'Password@123',
      rememberMe: true,
    });

    expect(jwtServiceMock.signAsync).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ rem: true }),
      { secret: 'test-refresh-secret', expiresIn: 2592000 },
    );
  });

  it('xử lý JWT_REFRESH_EXPIRES_IN dạng chuỗi số thuần túy là giây (không bị hiểu nhầm ms)', async () => {
    configValues.JWT_REFRESH_EXPIRES_IN = '604800';
    const passwordHash = await bcrypt.hash('Password@123', 4);
    usersServiceMock.findUserByEmail.mockResolvedValueOnce({
      id: 'user-1',
      email: 'student@studymate.vn',
      password_hash: passwordHash,
      is_verified: true,
      token_version: 0,
    });

    await service.signInWithEmailAndPassword({
      email: 'student@studymate.vn',
      password: 'Password@123',
      rememberMe: false,
    });

    expect(jwtServiceMock.signAsync).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ rem: false }),
      { secret: 'test-refresh-secret', expiresIn: 604800 },
    );
  });

  it('refreshTokens có sessionId gọi rotateSession nguyên tử và bảo toàn rememberMe', async () => {
    usersServiceMock.findUserById.mockResolvedValueOnce({
      id: 'user-1',
      email: 'student@studymate.vn',
      token_version: 1,
    });

    authSessionServiceMock.rotateSession.mockImplementationOnce(
      async ({ generateNextPair }) => {
        const next = await generateNextPair();
        return {
          access_token: next.access_token,
          refresh_token: next.refresh_token,
        };
      },
    );

    const result = await service.refreshTokens(
      'user-1',
      'old-refresh-token',
      true,
      'sid-123',
    );

    expect(result).toEqual({
      access_token: 'signed-access-jwt',
      refresh_token: 'signed-refresh-jwt',
    });
    expect(jwtServiceMock.signAsync).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ sid: 'sid-123', rem: true }),
      { secret: 'test-refresh-secret', expiresIn: 2592000 },
    );
  });

  it('refreshTokens tương thích ngược nâng cấp token legacy (không có sid) lên UserSession', async () => {
    const refreshHash = await bcrypt.hash('legacy-rt', 4);
    usersServiceMock.findUserById.mockResolvedValueOnce({
      id: 'user-1',
      email: 'student@studymate.vn',
      refresh_token: refreshHash,
      token_version: 0,
    });

    const result = await service.refreshTokens('user-1', 'legacy-rt', false);

    expect(result).toEqual({
      access_token: 'signed-access-jwt',
      refresh_token: 'signed-refresh-jwt',
    });
    expect(authSessionServiceMock.createSession).toHaveBeenCalledTimes(1);
    expect(usersServiceMock.updateUser).toHaveBeenCalledWith('user-1', {
      refresh_token: null,
    });
  });

  it('exchangeGoogleAuthCode mặc định cấp UserSession 30 ngày (rememberMe=true)', async () => {
    redisServiceMock.getAndDelete.mockResolvedValueOnce('user-google-1');
    usersServiceMock.findUserById.mockResolvedValueOnce({
      id: 'user-google-1',
      email: 'google@studymate.vn',
      token_version: 0,
    });

    await service.exchangeGoogleAuthCode('valid-auth-code');

    expect(jwtServiceMock.signAsync).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        sub: 'user-google-1',
        email: 'google@studymate.vn',
        rem: true,
      }),
      { secret: 'test-refresh-secret', expiresIn: 2592000 },
    );
    expect(authSessionServiceMock.createSession).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-google-1', rememberMe: true }),
    );
  });

  it('logoutByTokens thu hồi được đúng session ngay cả khi chỉ có refreshToken (accessToken đã hết hạn/vắng mặt)', async () => {
    jwtServiceMock.verifyAsync.mockResolvedValueOnce({
      sub: 'user-1',
      sid: 'sid-only-rt',
    });

    const result = await service.logoutByTokens({
      refreshToken: 'valid-rt',
    });

    expect(result).toEqual({ message: 'Logged out successfully', revoked: true });
    expect(authSessionServiceMock.revokeSession).toHaveBeenCalledWith(
      'sid-only-rt',
      'user_logout',
      'user-1',
    );
  });

  it('resetPassword gọi revokeAllUserSessions để thu hồi cả refresh session và access token', async () => {
    redisServiceMock.get.mockResolvedValueOnce('user-1');
    usersServiceMock.findUserById.mockResolvedValueOnce({
      id: 'user-1',
      email: 'student@studymate.vn',
    });

    await service.resetPassword('valid-reset-token', 'NewPass@123');

    expect(authSessionServiceMock.revokeAllUserSessions).toHaveBeenCalledWith(
      'user-1',
      'password_reset',
    );
    expect(redisServiceMock.del).toHaveBeenCalledWith(
      'reset_token:valid-reset-token',
    );
  });
});
