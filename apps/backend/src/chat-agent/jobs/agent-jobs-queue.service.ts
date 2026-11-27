import { EventEmitter } from 'node:events';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  OnApplicationShutdown,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import type { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import type {
  AgentBackgroundJobDto,
  AgentBackgroundJobPayload,
  AgentBackgroundJobResult,
  AgentBackgroundJobStatusType,
  AgentBackgroundJobType,
  AgentBullMqJobData,
  AgentJobStepLog,
  EnqueueAgentJobInput,
} from './agent-jobs.types.js';

export const AGENT_BACKGROUND_QUEUE_NAME = 'agent-background-jobs';

export function buildInitialStepLogs(
  jobType: AgentBackgroundJobType,
  payload: AgentBackgroundJobPayload,
): AgentJobStepLog[] {
  switch (jobType) {
    case 'bulk_flashcards': {
      const total = Math.max(10, Math.min(200, payload.count ?? 60));
      const batchSize = 25;
      const batchCount = Math.max(1, Math.ceil(total / batchSize));
      const steps: AgentJobStepLog[] = [
        {
          stepIndex: 0,
          stepKey: 'create_deck',
          label: 'Khởi tạo bộ thẻ Flashcard mục tiêu',
          status: 'pending',
        },
      ];
      for (let i = 0; i < batchCount; i += 1) {
        const currentBatch =
          i === batchCount - 1 ? total - i * batchSize : batchSize;
        steps.push({
          stepIndex: i + 1,
          stepKey: `batch_cards_${i + 1}`,
          label: `Sinh đợt ${i + 1}/${batchCount} (${currentBatch} thẻ)`,
          status: 'pending',
        });
      }
      return steps;
    }
    case 'bulk_quiz': {
      const total = Math.max(5, Math.min(100, payload.count ?? 30));
      const batchSize = 15;
      const batchCount = Math.max(1, Math.ceil(total / batchSize));
      const steps: AgentJobStepLog[] = [
        {
          stepIndex: 0,
          stepKey: 'prepare_quiz',
          label: 'Chuẩn bị khung đề kiểm tra Quiz',
          status: 'pending',
        },
      ];
      for (let i = 0; i < batchCount; i += 1) {
        const currentBatch =
          i === batchCount - 1 ? total - i * batchSize : batchSize;
        steps.push({
          stepIndex: i + 1,
          stepKey: `batch_quiz_${i + 1}`,
          label: `Sinh đợt câu hỏi ${i + 1}/${batchCount} (${currentBatch} câu)`,
          status: 'pending',
        });
      }
      return steps;
    }
    case 'deep_multi_doc_summary':
      return [
        {
          stepIndex: 0,
          stepKey: 'collect_sources',
          label: 'Thu thập và phân cụm tài liệu nguồn',
          status: 'pending',
        },
        {
          stepIndex: 1,
          stepKey: 'synthesize_note',
          label: 'Tổng hợp báo cáo học tập chuyên sâu thành Note',
          status: 'pending',
        },
      ];
    case 'batch_study_workflow':
      return [
        {
          stepIndex: 0,
          stepKey: 'step_summary',
          label: 'Tạo ghi chú tổng hợp kiến thức trọng tâm',
          status: 'pending',
        },
        {
          stepIndex: 1,
          stepKey: 'step_flashcards',
          label: 'Tạo bộ thẻ Flashcards ôn tập từ tài liệu',
          status: 'pending',
        },
        {
          stepIndex: 2,
          stepKey: 'step_quiz',
          label: 'Tạo đề kiểm tra đánh giá kiến thức',
          status: 'pending',
        },
      ];
  }
}

export function serializeAgentJobRow(row: {
  id: string;
  user_id: string;
  conversation_id: string;
  chat_session_id: string | null;
  job_type: string;
  title: string;
  status: string;
  progress_percent: number;
  total_steps: number;
  completed_steps: number;
  step_logs: unknown;
  result_json: unknown;
  error_message: string | null;
  started_at: Date | null;
  finished_at: Date | null;
  created_at: Date;
  updated_at: Date;
}): AgentBackgroundJobDto {
  return {
    id: row.id,
    userId: row.user_id,
    conversationId: row.conversation_id,
    chatSessionId: row.chat_session_id,
    jobType: row.job_type as AgentBackgroundJobType,
    title: row.title,
    status: row.status as AgentBackgroundJobStatusType,
    progressPercent: row.progress_percent,
    totalSteps: row.total_steps,
    completedSteps: row.completed_steps,
    stepLogs: Array.isArray(row.step_logs)
      ? (row.step_logs as AgentJobStepLog[])
      : [],
    result:
      row.result_json && typeof row.result_json === 'object'
        ? (row.result_json as AgentBackgroundJobResult)
        : null,
    errorMessage: row.error_message,
    startedAt: row.started_at ? row.started_at.toISOString() : null,
    finishedAt: row.finished_at ? row.finished_at.toISOString() : null,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

@Injectable()
export class AgentJobsQueueService
  implements OnModuleInit, OnApplicationShutdown
{
  private readonly logger = new Logger(AgentJobsQueueService.name);
  private readonly emitter = new EventEmitter();
  private queue: Queue<AgentBullMqJobData> | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    this.emitter.setMaxListeners(100);
  }

  onModuleInit() {
    if (
      process.env.NODE_ENV === 'test' ||
      process.env.DISABLE_BULLMQ_WORKERS === 'true'
    ) {
      return;
    }

    const redisUrl =
      this.configService.get<string>('REDIS_URL') || 'redis://localhost:6379';
    const redisPassword =
      this.configService.get<string>('REDIS_PASSWORD') || undefined;

    this.queue = new Queue<AgentBullMqJobData>(AGENT_BACKGROUND_QUEUE_NAME, {
      connection: {
        url: redisUrl,
        password: redisPassword,
        maxRetriesPerRequest: null,
      },
    });

    this.queue.on('error', (err) => {
      this.logger.warn(
        `BullMQ Queue [${AGENT_BACKGROUND_QUEUE_NAME}] error: ${err.message}`,
      );
    });
  }

  emitJobUpdate(dto: AgentBackgroundJobDto): void {
    this.emitter.emit(`user:${dto.userId}`, dto);
  }

  subscribeUserJobs(
    userId: string,
    listener: (dto: AgentBackgroundJobDto) => void,
  ): () => void {
    const eventKey = `user:${userId}`;
    this.emitter.on(eventKey, listener);
    return () => {
      this.emitter.off(eventKey, listener);
    };
  }

  async enqueueJob(input: EnqueueAgentJobInput): Promise<AgentBackgroundJobDto> {
    const steps = buildInitialStepLogs(input.jobType, input.payload);
    const created = await this.prisma.agentBackgroundJob.create({
      data: {
        user_id: input.userId,
        conversation_id: input.conversationId,
        chat_session_id: input.chatSessionId ?? null,
        job_type: input.jobType,
        title: input.title.trim().slice(0, 255),
        status: 'queued',
        progress_percent: 0,
        total_steps: steps.length,
        completed_steps: 0,
        step_logs: steps as unknown as Prisma.InputJsonValue,
        payload_json: input.payload as unknown as Prisma.InputJsonValue,
      },
    });

    const bullJobId = `agent-job-${created.id}`;
    if (this.queue) {
      try {
        await this.queue.add(
          input.jobType,
          {
            jobId: created.id,
            userId: input.userId,
            conversationId: input.conversationId,
            jobType: input.jobType,
          },
          {
            jobId: bullJobId,
            attempts: 1,
            removeOnComplete: { count: 100 },
            removeOnFail: { count: 100 },
          },
        );
        await this.prisma.agentBackgroundJob.update({
          where: { id: created.id },
          data: { bullmq_job_id: bullJobId },
        });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.warn(`Không thể đẩy job [${created.id}] vào BullMQ: ${msg}`);
      }
    }

    const dto = serializeAgentJobRow(created);
    this.emitJobUpdate(dto);
    return dto;
  }

  async listJobs(
    userId: string,
    options?: {
      conversationId?: string;
      status?: AgentBackgroundJobStatusType;
      limit?: number;
    },
  ): Promise<AgentBackgroundJobDto[]> {
    const take = Math.min(Math.max(1, options?.limit ?? 20), 50);
    const rows = await this.prisma.agentBackgroundJob.findMany({
      where: {
        user_id: userId,
        ...(options?.conversationId
          ? { conversation_id: options.conversationId }
          : {}),
        ...(options?.status ? { status: options.status } : {}),
      },
      orderBy: { created_at: 'desc' },
      take,
    });
    return rows.map(serializeAgentJobRow);
  }

  async getJobById(
    userId: string,
    jobId: string,
  ): Promise<AgentBackgroundJobDto> {
    const row = await this.prisma.agentBackgroundJob.findUnique({
      where: { id: jobId },
    });
    if (!row) {
      throw new NotFoundException('Không tìm thấy tác vụ nền được yêu cầu');
    }
    if (row.user_id !== userId) {
      throw new ForbiddenException('Bạn không có quyền truy cập tác vụ nền này');
    }
    return serializeAgentJobRow(row);
  }

  async retryFromCheckpoint(
    userId: string,
    jobId: string,
  ): Promise<AgentBackgroundJobDto> {
    const row = await this.prisma.agentBackgroundJob.findUnique({
      where: { id: jobId },
    });
    if (!row) {
      throw new NotFoundException('Không tìm thấy tác vụ nền được yêu cầu');
    }
    if (row.user_id !== userId) {
      throw new ForbiddenException('Bạn không có quyền thử lại tác vụ nền này');
    }
    if (row.status !== 'failed' && row.status !== 'cancelled') {
      throw new BadRequestException(
        `Chỉ có thể thử lại tác vụ ở trạng thái failed/cancelled (hiện tại: ${row.status})`,
      );
    }

    const existingSteps = Array.isArray(row.step_logs)
      ? (row.step_logs as unknown as AgentJobStepLog[])
      : [];
    const nextSteps: AgentJobStepLog[] = existingSteps.map((s) =>
      s.status === 'completed'
        ? s
        : {
            ...s,
            status: 'pending',
            error: undefined,
            finishedAt: undefined,
          },
    );

    const updated = await this.prisma.agentBackgroundJob.update({
      where: { id: row.id },
      data: {
        status: 'queued',
        error_message: null,
        finished_at: null,
        step_logs: nextSteps as unknown as Prisma.InputJsonValue,
      },
    });

    if (this.queue) {
      const bullJobId = `agent-job-${row.id}-retry-${Date.now()}`;
      try {
        await this.queue.add(
          row.job_type,
          {
            jobId: row.id,
            userId: row.user_id,
            conversationId: row.conversation_id,
            jobType: row.job_type as AgentBackgroundJobType,
          },
          {
            jobId: bullJobId,
            attempts: 1,
            removeOnComplete: { count: 100 },
            removeOnFail: { count: 100 },
          },
        );
        await this.prisma.agentBackgroundJob.update({
          where: { id: row.id },
          data: { bullmq_job_id: bullJobId },
        });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.warn(`Không thể re-queue job [${row.id}]: ${msg}`);
      }
    }

    const dto = serializeAgentJobRow(updated);
    this.emitJobUpdate(dto);
    return dto;
  }

  async cancelJob(
    userId: string,
    jobId: string,
  ): Promise<AgentBackgroundJobDto> {
    const row = await this.prisma.agentBackgroundJob.findUnique({
      where: { id: jobId },
    });
    if (!row) {
      throw new NotFoundException('Không tìm thấy tác vụ nền được yêu cầu');
    }
    if (row.user_id !== userId) {
      throw new ForbiddenException('Bạn không có quyền hủy tác vụ nền này');
    }
    if (
      row.status === 'completed' ||
      row.status === 'cancelled' ||
      row.status === 'failed'
    ) {
      return serializeAgentJobRow(row);
    }

    if (this.queue && row.bullmq_job_id) {
      try {
        const bullJob = await this.queue.getJob(row.bullmq_job_id);
        if (bullJob) {
          const state = await bullJob.getState();
          if (state === 'waiting' || state === 'delayed') {
            await bullJob.remove().catch(() => {});
          }
        }
      } catch {
        // Bỏ qua nếu BullMQ job đã chạy dở; Processor sẽ kiểm tra status === 'cancelled' trước mỗi step
      }
    }

    const updated = await this.prisma.agentBackgroundJob.update({
      where: { id: row.id },
      data: {
        status: 'cancelled',
        finished_at: new Date(),
      },
    });

    const dto = serializeAgentJobRow(updated);
    this.emitJobUpdate(dto);
    return dto;
  }

  async onApplicationShutdown() {
    if (this.queue) {
      await this.queue.close().catch(() => {});
    }
  }
}
