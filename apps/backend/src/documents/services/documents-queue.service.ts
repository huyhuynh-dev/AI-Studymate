import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnApplicationShutdown,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';

export interface DocumentJobData {
  documentId: string;
  mimeType: string;
  storageKey: string;
  fileName?: string;
}

export interface QueueJobCounts {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: number;
}

export interface QueueJobSummary {
  id: string;
  name: string;
  state: string;
  documentId: string;
  fileName: string | null;
  mimeType: string | null;
  attemptsMade: number;
  maxAttempts: number;
  failedReason: string | null;
  timestamp: number;
  processedOn: number | null;
  finishedOn: number | null;
}

export interface DocumentQueueSnapshot {
  queueName: string;
  connected: boolean;
  isPaused: boolean;
  counts: QueueJobCounts;
  jobs: QueueJobSummary[];
}

export const DOCUMENT_QUEUE_NAME = 'document-processing';

@Injectable()
export class DocumentsQueueService
  implements OnModuleInit, OnApplicationShutdown
{
  private readonly logger = new Logger(DocumentsQueueService.name);
  private queue: Queue<DocumentJobData>;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    const redisUrl =
      this.configService.get<string>('REDIS_URL') || 'redis://localhost:6379';
    const redisPassword =
      this.configService.get<string>('REDIS_PASSWORD') || undefined;

    this.queue = new Queue<DocumentJobData>(DOCUMENT_QUEUE_NAME, {
      connection: {
        url: redisUrl,
        password: redisPassword,
        maxRetriesPerRequest: null,
      },
    });

    this.queue.on('error', (err) => {
      this.logger.warn(
        `BullMQ Queue [${DOCUMENT_QUEUE_NAME}] error: ${err.message}`,
      );
    });

    this.logger.log(
      `BullMQ Queue [${DOCUMENT_QUEUE_NAME}] đã khởi tạo thành công`,
    );

    void this.deduplicatePendingJobs();
  }

  /**
   * Dọn dẹp các job bị trùng lặp cùng documentId đang nằm chờ (waiting/delayed) trong Redis
   * từ các phiên trước (đặc biệt các job cũ dùng jobId chứa timestamp).
   */
  private async deduplicatePendingJobs(): Promise<void> {
    if (!this.queue) return;
    try {
      const pendingJobs = await this.queue.getJobs(['waiting', 'delayed']);
      const seenDocIds = new Set<string>();

      for (const job of pendingJobs) {
        const docId = job?.data?.documentId;
        if (!docId) continue;

        if (seenDocIds.has(docId)) {
          await job.remove().catch(() => {});
          this.logger.warn(
            `Đã xóa job trùng lặp [${job.id}] trong hàng đợi cho tài liệu [${docId}]`,
          );
        } else {
          seenDocIds.add(docId);
        }
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Không thể dọn dẹp job trùng lặp: ${message}`);
    }
  }

  async addProcessingJob(data: DocumentJobData): Promise<void> {
    if (!this.queue) {
      this.logger.warn(
        `Queue [${DOCUMENT_QUEUE_NAME}] chưa được khởi tạo, bỏ qua job cho document ${data.documentId}`,
      );
      return;
    }

    const jobId = `ingest-${data.documentId}`;

    try {
      const existingJob = await this.queue.getJob(jobId);
      if (existingJob) {
        const state = await existingJob.getState();
        if (
          state === 'active' ||
          state === 'waiting' ||
          state === 'delayed' ||
          state === 'prioritized' ||
          state === 'waiting-children'
        ) {
          this.logger.debug(
            `Bỏ qua đẩy job trùng lặp: Tài liệu [${data.documentId}] đã có job [${jobId}] đang ở trạng thái [${state}]`,
          );
          return;
        }
        await existingJob.remove().catch(() => {});
      }
    } catch {
      // Nếu không đọc/xóa được job cũ, tiếp tục thử add vào queue
    }

    await this.queue.add('ingest-document', data, {
      jobId,
      attempts: 2,
      backoff: {
        type: 'exponential',
        delay: 15_000,
      },
      removeOnComplete: { count: 50 },
      removeOnFail: false,
    });

    this.logger.log(
      `Đã đẩy job xử lý tài liệu [${data.documentId}] vào hàng đợi [${DOCUMENT_QUEUE_NAME}]`,
    );
  }

  async getQueueMetrics(): Promise<DocumentQueueSnapshot> {
    if (!this.queue) {
      return {
        queueName: DOCUMENT_QUEUE_NAME,
        connected: false,
        isPaused: false,
        counts: {
          waiting: 0,
          active: 0,
          completed: 0,
          failed: 0,
          delayed: 0,
          paused: 0,
        },
        jobs: [],
      };
    }

    try {
      const [rawCounts, isPaused, rawJobs] = await Promise.all([
        this.queue.getJobCounts(
          'waiting',
          'active',
          'completed',
          'failed',
          'delayed',
        ),
        this.queue.isPaused(),
        this.queue.getJobs(
          ['active', 'waiting', 'delayed', 'failed', 'completed'],
          0,
          29,
          false,
        ),
      ]);

      const jobs: QueueJobSummary[] = await Promise.all(
        rawJobs.map(async (job) => {
          const state = await job.getState().catch(() => 'unknown');
          return {
            id: String(job.id ?? ''),
            name: job.name,
            state,
            documentId: job.data?.documentId ?? '',
            fileName: job.data?.fileName ?? null,
            mimeType: job.data?.mimeType ?? null,
            attemptsMade: job.attemptsMade ?? 0,
            maxAttempts: job.opts?.attempts ?? 1,
            failedReason: job.failedReason ?? null,
            timestamp: job.timestamp ?? 0,
            processedOn: job.processedOn ?? null,
            finishedOn: job.finishedOn ?? null,
          };
        }),
      );

      jobs.sort((a, b) => b.timestamp - a.timestamp);

      return {
        queueName: DOCUMENT_QUEUE_NAME,
        connected: true,
        isPaused,
        counts: {
          waiting: rawCounts.waiting ?? 0,
          active: rawCounts.active ?? 0,
          completed: rawCounts.completed ?? 0,
          failed: rawCounts.failed ?? 0,
          delayed: rawCounts.delayed ?? 0,
          paused: 0,
        },
        jobs,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Không thể đọc số liệu BullMQ: ${msg}`);
      return {
        queueName: DOCUMENT_QUEUE_NAME,
        connected: false,
        isPaused: false,
        counts: {
          waiting: 0,
          active: 0,
          completed: 0,
          failed: 0,
          delayed: 0,
          paused: 0,
        },
        jobs: [],
      };
    }
  }

  async retryJob(jobId: string): Promise<{ jobId: string; status: string }> {
    if (!this.queue) {
      throw new BadRequestException('Hàng đợi BullMQ chưa sẵn sàng');
    }
    const job = await this.queue.getJob(jobId);
    if (!job) {
      throw new NotFoundException(`Không tìm thấy job [${jobId}] trong hàng đợi`);
    }
    const state = await job.getState();
    if (state !== 'failed') {
      throw new BadRequestException(
        `Chỉ có thể chạy lại job ở trạng thái 'failed' (hiện tại: '${state}')`,
      );
    }
    await job.retry();
    this.logger.log(`Đã đẩy chạy lại job [${jobId}] từ giao diện quản trị`);
    return { jobId, status: 'requeued' };
  }

  async removeJob(jobId: string): Promise<{ jobId: string; removed: boolean }> {
    if (!this.queue) {
      throw new BadRequestException('Hàng đợi BullMQ chưa sẵn sàng');
    }
    const job = await this.queue.getJob(jobId);
    if (!job) {
      throw new NotFoundException(`Không tìm thấy job [${jobId}] trong hàng đợi`);
    }
    await job.remove();
    this.logger.log(`Đã xóa job [${jobId}] khỏi hàng đợi BullMQ`);
    return { jobId, removed: true };
  }

  async onApplicationShutdown() {
    if (this.queue) {
      await this.queue.close().catch(() => {});
      this.logger.log(`BullMQ Queue [${DOCUMENT_QUEUE_NAME}] đã đóng kết nối`);
    }
  }
}
