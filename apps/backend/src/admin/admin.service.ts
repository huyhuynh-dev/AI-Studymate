import {
  BadRequestException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { AuthSessionService } from '../auth/auth-session.service.js';
import { DocumentsQueueService } from '../documents/services/documents-queue.service.js';
import { RagBenchmarkService } from '../rag-benchmark/rag-benchmark.service.js';
import type { RagBenchmarkReport } from '../rag-benchmark/rag-benchmark.types.js';
import { RedisService } from '../redis/redis.service.js';
import { AdminRepoService } from './admin-repo.service.js';
import type {
  AdminAiUsageResponse,
  AdminOverviewResponse,
  AdminQueueResponse,
  AdminUsersListResponse,
} from './admin.types.js';
import type {
  AdminUsersQueryDto,
  UpdateAdminUserStatusDto,
} from './dto/admin.dto.js';

@Injectable()
export class AdminService {
  constructor(
    private readonly adminRepo: AdminRepoService,
    private readonly documentsQueueService: DocumentsQueueService,
    private readonly ragBenchmarkService: RagBenchmarkService,
    private readonly redisService: RedisService,
    @Optional() private readonly authSessionService?: AuthSessionService,
  ) {}

  private async pingRedis(): Promise<boolean> {
    try {
      const client = this.redisService.getRedisClient();
      if (!client?.isOpen) return false;
      const pong = await client.ping();
      return pong === 'PONG';
    } catch {
      return false;
    }
  }

  async getOverview(): Promise<AdminOverviewResponse> {
    const [dbUp, redisUp, counts] = await Promise.all([
      this.adminRepo.pingDatabase(),
      this.pingRedis(),
      this.adminRepo.getOverviewCounts(),
    ]);

    return {
      generatedAt: new Date().toISOString(),
      health: {
        database: dbUp ? 'up' : 'down',
        redis: redisUp ? 'up' : 'down',
      },
      ...counts,
    };
  }

  async getQueueStatus(): Promise<AdminQueueResponse> {
    const [queue, recentDocuments] = await Promise.all([
      this.documentsQueueService.getQueueMetrics(),
      this.adminRepo.getRecentDocumentsForQueue(25),
    ]);

    return {
      queue,
      recentDocuments,
    };
  }

  async retryQueueJob(jobId: string) {
    return this.documentsQueueService.retryJob(jobId);
  }

  async removeQueueJob(jobId: string) {
    return this.documentsQueueService.removeJob(jobId);
  }

  async getAiUsageAnalytics(windowDays = 30): Promise<AdminAiUsageResponse> {
    return this.adminRepo.getAiUsageAnalytics(windowDays);
  }

  async listUsers(query: AdminUsersQueryDto): Promise<AdminUsersListResponse> {
    const limit = query.limit ?? 25;
    const offset = query.offset ?? 0;
    const { total, users } = await this.adminRepo.listUsers({
      search: query.search,
      limit,
      offset,
    });

    return {
      total,
      limit,
      offset,
      users,
    };
  }

  async updateUserStatus(
    adminUserId: string,
    targetUserId: string,
    dto: UpdateAdminUserStatusDto,
  ) {
    if (dto.isActive === undefined && dto.role === undefined) {
      throw new BadRequestException(
        'Vui lòng cung cấp ít nhất một trường cần cập nhật (isActive hoặc role)',
      );
    }

    if (adminUserId === targetUserId) {
      if (dto.isActive === false) {
        throw new BadRequestException(
          'Không thể tự khóa tài khoản quản trị đang đăng nhập',
        );
      }
      if (dto.role === 'user') {
        throw new BadRequestException(
          'Không thể tự hạ quyền quản trị của chính bạn',
        );
      }
    }

    const existing = await this.adminRepo.findUserById(targetUserId);
    if (!existing) {
      throw new NotFoundException('Không tìm thấy tài khoản người dùng');
    }

    const updated = await this.adminRepo.updateUserStatus(targetUserId, {
      ...(dto.isActive !== undefined ? { is_active: dto.isActive } : {}),
      ...(dto.role !== undefined ? { role: dto.role } : {}),
    });

    if (this.authSessionService) {
      if (dto.isActive === false) {
        await this.authSessionService.revokeAllUserSessions(
          targetUserId,
          'account_disabled',
        );
      } else if (dto.isActive === true) {
        await this.authSessionService.invalidateUserStateCache(targetUserId);
      }
    }

    return updated;
  }

  getRagBenchmarkLatest(): RagBenchmarkReport {
    return (
      this.ragBenchmarkService.getLatestReport() ??
      this.ragBenchmarkService.runGoldenAblationBenchmark({
        persistToDisk: true,
      })
    );
  }

  runRagBenchmark(): RagBenchmarkReport {
    return this.ragBenchmarkService.runGoldenAblationBenchmark({
      persistToDisk: true,
    });
  }
}
