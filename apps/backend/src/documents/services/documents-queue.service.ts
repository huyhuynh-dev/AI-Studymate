import {
  Injectable,
  Logger,
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
      removeOnComplete: true,
      removeOnFail: false,
    });

    this.logger.log(
      `Đã đẩy job xử lý tài liệu [${data.documentId}] vào hàng đợi [${DOCUMENT_QUEUE_NAME}]`,
    );
  }

  async onApplicationShutdown() {
    if (this.queue) {
      await this.queue.close().catch(() => {});
      this.logger.log(`BullMQ Queue [${DOCUMENT_QUEUE_NAME}] đã đóng kết nối`);
    }
  }
}
