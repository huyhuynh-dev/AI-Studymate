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
  }

  async addProcessingJob(data: DocumentJobData): Promise<void> {
    if (!this.queue) {
      this.logger.warn(
        `Queue [${DOCUMENT_QUEUE_NAME}] chưa được khởi tạo, bỏ qua job cho document ${data.documentId}`,
      );
      return;
    }

    await this.queue.add('ingest-document', data, {
      jobId: `ingest-${data.documentId}-${Date.now()}`,
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 3000,
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
