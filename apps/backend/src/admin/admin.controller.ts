import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { AdminOnly } from '../auth/decorators/admin-only.decorator.js';
import { AdminGuard } from '../auth/guards/admin.guard.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { AdminService } from './admin.service.js';
import {
  AdminAiUsageQueryDto,
  AdminUsersQueryDto,
  UpdateAdminUserStatusDto,
} from './dto/admin.dto.js';

@Controller('admin')
@UseGuards(JwtAuthGuard, AdminGuard)
@AdminOnly()
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  private getAdminUserId(req: Request): string {
    const user = req.user as { userId?: string; sub?: string } | undefined;
    const userId = user?.userId || user?.sub;
    if (!userId) {
      throw new UnauthorizedException('Người dùng chưa được xác thực');
    }
    return userId;
  }

  @Get('overview')
  async getOverview() {
    return this.adminService.getOverview();
  }

  @Get('queues')
  async getQueues() {
    return this.adminService.getQueueStatus();
  }

  @Post('queues/jobs/:jobId/retry')
  async retryQueueJob(@Param('jobId') jobId: string) {
    return this.adminService.retryQueueJob(jobId);
  }

  @Delete('queues/jobs/:jobId')
  async removeQueueJob(@Param('jobId') jobId: string) {
    return this.adminService.removeQueueJob(jobId);
  }

  @Get('ai-usage')
  async getAiUsage(@Query() query: AdminAiUsageQueryDto) {
    return this.adminService.getAiUsageAnalytics(query.windowDays ?? 30);
  }

  @Get('users')
  async listUsers(@Query() query: AdminUsersQueryDto) {
    return this.adminService.listUsers(query);
  }

  @Patch('users/:id/status')
  async updateUserStatus(
    @Req() req: Request,
    @Param('id', new ParseUUIDPipe()) targetUserId: string,
    @Body() dto: UpdateAdminUserStatusDto,
  ) {
    return this.adminService.updateUserStatus(
      this.getAdminUserId(req),
      targetUserId,
      dto,
    );
  }

  @Get('rag-benchmark')
  getRagBenchmark() {
    return this.adminService.getRagBenchmarkLatest();
  }

  @Post('rag-benchmark/run')
  runRagBenchmark() {
    return this.adminService.runRagBenchmark();
  }
}
