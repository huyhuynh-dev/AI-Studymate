import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response as ExpressResponse } from 'express';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard.js';
import { AgentJobsQueueService } from './agent-jobs-queue.service.js';
import type { AgentBackgroundJobStatusType } from './agent-jobs.types.js';

@Controller('chat-agent/jobs')
@UseGuards(JwtAuthGuard)
export class AgentJobsController {
  constructor(private readonly agentJobsQueue: AgentJobsQueueService) {}

  private getUserId(req: Request): string {
    if (!req.user) {
      throw new UnauthorizedException('Người dùng chưa được xác thực');
    }
    return (req.user as { userId: string }).userId;
  }

  @Get()
  async listJobs(
    @Req() req: Request,
    @Query('conversationId') conversationId?: string,
    @Query('status') status?: AgentBackgroundJobStatusType,
    @Query('limit') limit?: string,
  ) {
    const parsedLimit = limit ? Number(limit) : undefined;
    return this.agentJobsQueue.listJobs(this.getUserId(req), {
      conversationId: conversationId?.trim() || undefined,
      status,
      limit:
        parsedLimit && Number.isFinite(parsedLimit) ? parsedLimit : undefined,
    });
  }

  @Get('stream')
  async streamJobs(
    @Req() req: Request,
    @Res() res: ExpressResponse,
  ): Promise<void> {
    const userId = this.getUserId(req);

    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    if (typeof res.flushHeaders === 'function') {
      res.flushHeaders();
    }

    const sendEvent = (eventName: string, data: unknown) => {
      if (res.writableEnded) return;
      res.write(`event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    sendEvent('connected', { userId, connectedAt: new Date().toISOString() });

    const unsubscribe = this.agentJobsQueue.subscribeUserJobs(userId, (job) => {
      sendEvent('job-updated', job);
    });

    const heartbeat = setInterval(() => {
      if (!res.writableEnded) {
        res.write(`: ping ${Date.now()}\n\n`);
      }
    }, 25_000);

    req.on('close', () => {
      clearInterval(heartbeat);
      unsubscribe();
      if (!res.writableEnded) {
        res.end();
      }
    });
  }

  @Get(':id')
  async getJobById(
    @Req() req: Request,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.agentJobsQueue.getJobById(this.getUserId(req), id);
  }

  @Post(':id/retry')
  async retryJob(
    @Req() req: Request,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.agentJobsQueue.retryFromCheckpoint(this.getUserId(req), id);
  }

  @Post(':id/cancel')
  async cancelJob(
    @Req() req: Request,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.agentJobsQueue.cancelJob(this.getUserId(req), id);
  }
}
