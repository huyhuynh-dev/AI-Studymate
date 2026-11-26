import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import bcrypt from 'bcrypt';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MailService } from '../mail/mail.service.js';
import { RedisService } from '../redis/redis.service.js';
import { UsersService } from '../users/users.service.js';
import { AuthService } from './auth.service.js';
import { GoogleService } from './google.service.js';

describe('AuthService', () => {
  let service: AuthService;
  let configValues: Record<string, string | undefined>;
  let jwtServiceMock: { signAsync: ReturnType<typeof vi.fn> };
  let usersServiceMock: {
    findUserByEmail: ReturnType<typeof vi.fn>;
    findUserById: ReturnType<typeof vi.fn>;
    updateUser: ReturnType<typeof vi.fn>;
  };
  let redisServiceMock: {
    getAndDelete: ReturnType<typeof vi.fn>;
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
    };

    usersServiceMock = {
      findUserByEmail: vi.fn(),
      findUserById: vi.fn(),
      updateUser: vi.fn().mockResolvedValue({}),
    };

    redisServiceMock = {
      getAndDelete: vi.fn(),
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
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('signInWithEmailAndPassword cấp refresh token 7 ngày khi rememberMe=false', async () => {
    const passwordHash = await bcrypt.hash('Password@123', 4);
    usersServiceMock.findUserByEmail.mockResolvedValueOnce({
      id: 'user-1',
      email: 'student@studymate.vn',
      password_hash: passwordHash,
      is_verified: true,
    });

    const result = await service.signInWithEmailAndPassword({
      email: 'student@studymate.vn',
      password: 'Password@123',
      rememberMe: false,
    });

    expect(result).toEqual({
      access_token: 'signed-access-jwt',
      refresh_token: 'signed-refresh-jwt',
    });
    expect(jwtServiceMock.signAsync).toHaveBeenNthCalledWith(
      1,
      { sub: 'user-1', email: 'student@studymate.vn' },
      { secret: 'test-access-secret', expiresIn: 3600 },
    );
    expect(jwtServiceMock.signAsync).toHaveBeenNthCalledWith(
      2,
      { sub: 'user-1', email: 'student@studymate.vn', rem: false },
      { secret: 'test-refresh-secret', expiresIn: 604800 },
    );
  });

  it('signInWithEmailAndPassword cấp refresh token 30 ngày khi rememberMe=true', async () => {
    const passwordHash = await bcrypt.hash('Password@123', 4);
    usersServiceMock.findUserByEmail.mockResolvedValueOnce({
      id: 'user-1',
      email: 'student@studymate.vn',
      password_hash: passwordHash,
      is_verified: true,
    });

    await service.signInWithEmailAndPassword({
      email: 'student@studymate.vn',
      password: 'Password@123',
      rememberMe: true,
    });

    expect(jwtServiceMock.signAsync).toHaveBeenNthCalledWith(
      2,
      { sub: 'user-1', email: 'student@studymate.vn', rem: true },
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
    });

    await service.signInWithEmailAndPassword({
      email: 'student@studymate.vn',
      password: 'Password@123',
      rememberMe: false,
    });

    expect(jwtServiceMock.signAsync).toHaveBeenNthCalledWith(
      2,
      { sub: 'user-1', email: 'student@studymate.vn', rem: false },
      { secret: 'test-refresh-secret', expiresIn: 604800 },
    );
  });

  it('refreshTokens bảo toàn thời hạn 30 ngày khi rememberMe=true và 7 ngày khi false', async () => {
    const refreshHash = await bcrypt.hash('old-refresh-token', 4);
    usersServiceMock.findUserById.mockResolvedValue({
      id: 'user-1',
      email: 'student@studymate.vn',
      refresh_token: refreshHash,
    });

    await service.refreshTokens('user-1', 'old-refresh-token', true);

    expect(jwtServiceMock.signAsync).toHaveBeenNthCalledWith(
      2,
      { sub: 'user-1', email: 'student@studymate.vn', rem: true },
      { secret: 'test-refresh-secret', expiresIn: 2592000 },
    );
  });

  it('exchangeGoogleAuthCode mặc định cấp phiên 30 ngày (rememberMe=true)', async () => {
    redisServiceMock.getAndDelete.mockResolvedValueOnce('user-google-1');
    usersServiceMock.findUserById.mockResolvedValueOnce({
      id: 'user-google-1',
      email: 'google@studymate.vn',
    });

    await service.exchangeGoogleAuthCode('valid-auth-code');

    expect(jwtServiceMock.signAsync).toHaveBeenNthCalledWith(
      2,
      { sub: 'user-google-1', email: 'google@studymate.vn', rem: true },
      { secret: 'test-refresh-secret', expiresIn: 2592000 },
    );
  });
});
