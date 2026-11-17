import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { AnalyticsService } from './analytics.service.js';
import { AnalyticsQueryDto } from './dto/analytics.dto.js';

@Controller('analytics')
@UseGuards(JwtAuthGuard)
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  private getUserId(req: Request): string {
    const user = req.user as { userId?: string; sub?: string } | undefined;
    const userId = user?.userId || user?.sub;
    if (!userId) {
      throw new UnauthorizedException('Người dùng chưa được xác thực');
    }
    return userId;
  }

  @Get('conversations/:conversationId')
  async getConversationAnalytics(
    @Req() req: Request,
    @Param('conversationId', new ParseUUIDPipe()) conversationId: string,
    @Query() query: AnalyticsQueryDto,
  ) {
    return this.analyticsService.getConversationAnalytics(
      this.getUserId(req),
      conversationId,
      query,
    );
  }

  @Get('documents/:documentId/mastery')
  async getDocumentMastery(
    @Req() req: Request,
    @Param('documentId', new ParseUUIDPipe()) documentId: string,
  ) {
    return this.analyticsService.getDocumentMastery(
      this.getUserId(req),
      documentId,
    );
  }

  @Get('subjects/:subjectId')
  async getSubjectAnalytics(
    @Req() req: Request,
    @Param('subjectId', new ParseUUIDPipe()) subjectId: string,
    @Query() query: AnalyticsQueryDto,
  ) {
    return this.analyticsService.getSubjectAnalytics(
      this.getUserId(req),
      subjectId,
      query,
    );
  }
}
