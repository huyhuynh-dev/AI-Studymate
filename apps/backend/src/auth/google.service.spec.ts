import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { createHash } from 'crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RedisService } from '../redis/redis.service.js';
import { GoogleService } from './google.service.js';

describe('GoogleService', () => {
  let service: GoogleService;
  let redisMock: {
    set: ReturnType<typeof vi.fn>;
    getAndDelete: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    redisMock = {
      set: vi.fn().mockResolvedValue(undefined),
      getAndDelete: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GoogleService,
        { provide: ConfigService, useValue: { get: () => undefined } },
        { provide: RedisService, useValue: redisMock },
      ],
    }).compile();

    service = module.get<GoogleService>(GoogleService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('getOAuth2ClientUrl tạo state và PKCE code_challenge (S256) lưu vào Redis', async () => {
    const generateAuthUrlMock = vi
      .fn()
      .mockReturnValue('https://accounts.google.com/o/oauth2/v2/auth?mock=1');
    vi.spyOn(service, 'getAuthClient').mockReturnValue({
      generateAuthUrl: generateAuthUrlMock,
    } as never);

    const res = await service.getOAuth2ClientUrl();
    expect(res.url).toBe('https://accounts.google.com/o/oauth2/v2/auth?mock=1');
    expect(redisMock.set).toHaveBeenCalledTimes(1);

    const [redisKey, rawStored, ttl] = redisMock.set.mock.calls[0] as [
      string,
      string,
      number,
    ];
    expect(redisKey.startsWith('oauth_state:')).toBe(true);
    expect(ttl).toBe(600);

    const parsed = JSON.parse(rawStored) as { codeVerifier: string };
    expect(parsed.codeVerifier).toBeTruthy();

    const expectedChallenge = createHash('sha256')
      .update(parsed.codeVerifier)
      .digest('base64url');
    expect(generateAuthUrlMock).toHaveBeenCalledWith(
      expect.objectContaining({
        state: redisKey.replace('oauth_state:', ''),
        code_challenge: expectedChallenge,
        code_challenge_method: 'S256',
      }),
    );
  });

  it('validateOAuthState trích xuất codeVerifier một lần và từ chối state không hợp lệ', async () => {
    await expect(service.validateOAuthState(undefined)).rejects.toThrow(
      UnauthorizedException,
    );

    redisMock.getAndDelete.mockResolvedValueOnce(null);
    await expect(service.validateOAuthState('expired-state')).rejects.toThrow(
      UnauthorizedException,
    );

    redisMock.getAndDelete.mockResolvedValueOnce(
      JSON.stringify({ codeVerifier: 'pkce-verifier-123' }),
    );
    await expect(service.validateOAuthState('valid-state')).resolves.toEqual({
      codeVerifier: 'pkce-verifier-123',
    });
  });
});
