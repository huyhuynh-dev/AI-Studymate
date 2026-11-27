import {
  Body,
  Controller,
  Get,
  Put,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import type {
  UpsertWorkspaceStateResult,
  WorkspaceStateReadResult,
} from './domain/workspace-state.types.js';
import { UpsertWorkspaceStateDto } from './dto/upsert-workspace-state.dto.js';
import { WorkspaceStateService } from './workspace-state.service.js';

@Controller('workspace-state')
@UseGuards(JwtAuthGuard)
export class WorkspaceStateController {
  constructor(private readonly workspaceStateService: WorkspaceStateService) {}

  private getUserId(req: Request): string {
    const user = req.user as { userId?: string; sub?: string } | undefined;
    const userId = user?.userId || user?.sub;
    if (!userId) {
      throw new UnauthorizedException('Người dùng chưa được xác thực');
    }
    return userId;
  }

  @Get()
  async getWorkspaceState(
    @Req() req: Request,
  ): Promise<WorkspaceStateReadResult> {
    return this.workspaceStateService.getState(this.getUserId(req));
  }

  @Put()
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  async upsertWorkspaceState(
    @Req() req: Request,
    @Body() dto: UpsertWorkspaceStateDto,
  ): Promise<UpsertWorkspaceStateResult> {
    return this.workspaceStateService.upsertState(this.getUserId(req), dto);
  }
}
