import {
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import { PrismaService } from '../prisma/prisma.service.js';
import { RedisService } from '../redis/redis.service.js';
import { parseExpiresInSeconds } from './utils/token-duration.util.js';

const REFRESH_ROTATION_GRACE_MS = 30_000;
const REDIS_GRACE_TTL_SECONDS = 30;
const USER_STATE_CACHE_TTL_SECONDS = 60;
const DEFAULT_ACCESS_TTL_SECONDS = 3600;

export interface SessionTokenPair {
  access_token: string;
  refresh_token: string;
}

export interface CreateSessionInput {
  sessionId: string;
  userId: string;
  refreshToken: string;
  rememberMe: boolean;
  expiresAt: Date;
  userAgent?: string;
  ipAddress?: string;
}

export interface RotateSessionInput {
  sessionId: string;
  userId: string;
  incomingRefreshToken: string;
  generateNextPair: () => Promise<SessionTokenPair & { expiresAt: Date }>;
}

interface CachedUserAuthState {
  isActive: boolean;
  tokenVersion: number;
}

export function hashSessionToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

@Injectable()
export class AuthSessionService {
  private readonly logger = new Logger(AuthSessionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
    private readonly configService: ConfigService,
  ) {}

  private getRevokedSessionKey(sessionId: string): string {
    return `auth:revoked-session:${sessionId}`;
  }

  private getUserStateKey(userId: string): string {
    return `auth:user-state:${userId}`;
  }

  private getGraceRotationKey(sessionId: string, tokenHash: string): string {
    return `auth:refresh-grace:${sessionId}:${tokenHash}`;
  }

  private getAccessTokenTtlSeconds(): number {
    return parseExpiresInSeconds(
      this.configService.get<string>('JWT_EXPIRES_IN'),
      DEFAULT_ACCESS_TTL_SECONDS,
    );
  }

  async createSession(input: CreateSessionInput): Promise<void> {
    const refreshTokenHash = hashSessionToken(input.refreshToken);

    await this.prisma.userSession.create({
      data: {
        id: input.sessionId,
        user_id: input.userId,
        refresh_token_hash: refreshTokenHash,
        remember_me: input.rememberMe,
        expires_at: input.expiresAt,
        user_agent: input.userAgent?.slice(0, 512) ?? null,
        ip_address: input.ipAddress?.slice(0, 64) ?? null,
      },
    });
  }

  async rotateSession(input: RotateSessionInput): Promise<SessionTokenPair> {
    const incomingHash = hashSessionToken(input.incomingRefreshToken);
    const graceKey = this.getGraceRotationKey(input.sessionId, incomingHash);

    try {
      const cachedGrace = await this.redisService.get(graceKey);
      if (cachedGrace) {
        const parsed = JSON.parse(cachedGrace) as Partial<SessionTokenPair>;
        if (parsed.access_token && parsed.refresh_token) {
          return {
            access_token: parsed.access_token,
            refresh_token: parsed.refresh_token,
          };
        }
      }
    } catch (error) {
      this.logger.warn(
        `Không thể đọc grace cache khi refresh session ${input.sessionId}: ${String(error)}`,
      );
    }

    const nextPair = await input.generateNextPair();
    const nextHash = hashSessionToken(nextPair.refresh_token);
    const now = new Date();

    const outcome = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.userSession.updateMany({
        where: {
          id: input.sessionId,
          user_id: input.userId,
          refresh_token_hash: incomingHash,
          revoked_at: null,
          expires_at: { gt: now },
        },
        data: {
          prev_refresh_token_hash: incomingHash,
          refresh_token_hash: nextHash,
          rotated_at: now,
          expires_at: nextPair.expiresAt,
          last_used_at: now,
        },
      });

      if (updated.count === 1) {
        return { status: 'rotated' as const };
      }

      const existing = await tx.userSession.findUnique({
        where: { id: input.sessionId },
      });

      if (
        !existing ||
        existing.user_id !== input.userId ||
        existing.revoked_at !== null ||
        existing.expires_at <= now
      ) {
        return { status: 'denied' as const };
      }

      if (
        existing.prev_refresh_token_hash === incomingHash &&
        existing.rotated_at &&
        now.getTime() - existing.rotated_at.getTime() <=
          REFRESH_ROTATION_GRACE_MS
      ) {
        return { status: 'within_grace' as const };
      }

      // Token cũ được sử dụng lại ngoài grace window -> nghi ngờ token reuse -> thu hồi phiên
      await tx.userSession.updateMany({
        where: {
          id: input.sessionId,
          revoked_at: null,
        },
        data: {
          revoked_at: now,
          revoke_reason: 'refresh_token_reuse',
        },
      });

      return { status: 'reused' as const };
    });

    if (outcome.status === 'rotated') {
      const tokens: SessionTokenPair = {
        access_token: nextPair.access_token,
        refresh_token: nextPair.refresh_token,
      };
      try {
        await this.redisService.set(
          graceKey,
          JSON.stringify(tokens),
          REDIS_GRACE_TTL_SECONDS,
        );
      } catch (error) {
        this.logger.warn(
          `Không thể lưu grace cache cho session ${input.sessionId}: ${String(error)}`,
        );
      }
      return tokens;
    }

    if (outcome.status === 'within_grace') {
      try {
        const cachedAfterTx = await this.redisService.get(graceKey);
        if (cachedAfterTx) {
          const parsed = JSON.parse(cachedAfterTx) as Partial<SessionTokenPair>;
          if (parsed.access_token && parsed.refresh_token) {
            return {
              access_token: parsed.access_token,
              refresh_token: parsed.refresh_token,
            };
          }
        }
      } catch {
        // Fallback từ chối nhẹ nhàng mà không thu hồi phiên đang hợp lệ
      }
      throw new ForbiddenException('Access denied');
    }

    if (outcome.status === 'reused') {
      await this.markSessionRevokedInRedis(input.sessionId);
      this.logger.warn(
        `Phát hiện refresh token reuse trên session ${input.sessionId} (user ${input.userId})`,
      );
    }

    throw new ForbiddenException('Access denied');
  }

  async markSessionRevokedInRedis(sessionId: string): Promise<void> {
    try {
      await this.redisService.set(
        this.getRevokedSessionKey(sessionId),
        '1',
        this.getAccessTokenTtlSeconds(),
      );
    } catch (error) {
      this.logger.warn(
        `Không thể đánh dấu session ${sessionId} bị thu hồi trong Redis: ${String(error)}`,
      );
    }
  }

  async invalidateUserStateCache(userId: string): Promise<void> {
    try {
      await this.redisService.del(this.getUserStateKey(userId));
    } catch (error) {
      this.logger.warn(
        `Không thể xóa cache trạng thái user ${userId}: ${String(error)}`,
      );
    }
  }

  async revokeSession(
    sessionId: string,
    reason: string,
    userId?: string,
  ): Promise<boolean> {
    const result = await this.prisma.userSession.updateMany({
      where: {
        id: sessionId,
        ...(userId ? { user_id: userId } : {}),
        revoked_at: null,
      },
      data: {
        revoked_at: new Date(),
        revoke_reason: reason,
      },
    });

    await this.markSessionRevokedInRedis(sessionId);
    return result.count > 0;
  }

  async revokeAllUserSessions(userId: string, reason: string): Promise<void> {
    const now = new Date();
    const activeSessions = await this.prisma.userSession.findMany({
      where: { user_id: userId, revoked_at: null },
      select: { id: true },
    });

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: {
          token_version: { increment: 1 },
          refresh_token: null,
        },
      }),
      this.prisma.userSession.updateMany({
        where: { user_id: userId, revoked_at: null },
        data: {
          revoked_at: now,
          revoke_reason: reason,
        },
      }),
    ]);

    await this.invalidateUserStateCache(userId);
    await Promise.all(
      activeSessions.map((session) =>
        this.markSessionRevokedInRedis(session.id),
      ),
    );
  }

  async validateAccessTokenSession(params: {
    userId: string;
    sessionId?: string;
    tokenVersion?: number;
  }): Promise<void> {
    const { userId, sessionId, tokenVersion } = params;

    if (sessionId) {
      try {
        const isRevoked = await this.redisService.get(
          this.getRevokedSessionKey(sessionId),
        );
        if (isRevoked) {
          throw new UnauthorizedException('Phiên đăng nhập đã bị thu hồi');
        }
      } catch (error) {
        if (error instanceof UnauthorizedException) {
          throw error;
        }
        // Redis lỗi -> fallback kiểm tra DB bên dưới
      }
    }

    let userState: CachedUserAuthState | null = null;
    try {
      const cached = await this.redisService.get(this.getUserStateKey(userId));
      if (cached) {
        userState = JSON.parse(cached) as CachedUserAuthState;
      }
    } catch {
      userState = null;
    }

    if (!userState) {
      const dbUser = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { is_active: true, token_version: true },
      });

      if (!dbUser) {
        throw new UnauthorizedException('Tài khoản không tồn tại');
      }

      userState = {
        isActive: dbUser.is_active,
        tokenVersion: dbUser.token_version,
      };

      if (sessionId) {
        const dbSession = await this.prisma.userSession.findUnique({
          where: { id: sessionId },
          select: { user_id: true, revoked_at: true, expires_at: true },
        });
        if (
          !dbSession ||
          dbSession.user_id !== userId ||
          dbSession.revoked_at !== null ||
          dbSession.expires_at <= new Date()
        ) {
          await this.markSessionRevokedInRedis(sessionId);
          throw new UnauthorizedException('Phiên đăng nhập đã bị thu hồi');
        }
      }

      try {
        await this.redisService.set(
          this.getUserStateKey(userId),
          JSON.stringify(userState),
          USER_STATE_CACHE_TTL_SECONDS,
        );
      } catch {
        // Bỏ qua lỗi ghi cache Redis
      }
    }

    if (
      (tokenVersion !== undefined && tokenVersion !== userState.tokenVersion) ||
      (tokenVersion === undefined && userState.tokenVersion > 0)
    ) {
      throw new UnauthorizedException('Phiên đăng nhập đã hết hiệu lực');
    }
  }
}
