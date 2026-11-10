import { Injectable, Logger, OnApplicationShutdown, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';

export interface DocumentJobData {
    documentId: string;
    mimeType: string;
    storageKey: string;
    fileName?: string;
}

export interface DocumentEmbeddingJobData {
    documentId: string;
}

export const DOCUMENT_QUEUE_NAME = 'document-processing';
export const DOCUMENT_EMBEDDING_QUEUE_NAME = 'document-embedding';

@Injectable()
export class DocumentsQueueService implements OnModuleInit, OnApplicationShutdown {
    private readonly logger = new Logger(DocumentsQueueService.name);
    private queue: Queue<DocumentJobData>;
    private embeddingQueue: Queue<DocumentEmbeddingJobData>;

    constructor(private readonly configService: ConfigService) { }

    onModuleInit() {
        const redisUrl = this.configService.get<string>('REDIS_URL') || 'redis://localhost:6379';
        const redisPassword = this.configService.get<string>('REDIS_PASSWORD') || undefined;

        const connection = {
            url: redisUrl,
            password: redisPassword,
            maxRetriesPerRequest: null,
        };

        this.queue = new Queue<DocumentJobData>(DOCUMENT_QUEUE_NAME, {
            connection,
        });

        this.queue.on('error', (err) => {
            this.logger.warn(`BullMQ Queue [${DOCUMENT_QUEUE_NAME}] error: ${err.message}`);
        });

        this.embeddingQueue = new Queue<DocumentEmbeddingJobData>(DOCUMENT_EMBEDDING_QUEUE_NAME, {
            connection,
        });

        this.embeddingQueue.on('error', (err) => {
            this.logger.warn(`BullMQ Queue [${DOCUMENT_EMBEDDING_QUEUE_NAME}] error: ${err.message}`);
        });

        this.logger.log(
            `BullMQ Queues [${DOCUMENT_QUEUE_NAME}] & [${DOCUMENT_EMBEDDING_QUEUE_NAME}] đã khởi tạo thành công`
        );
    }

    async addProcessingJob(data: DocumentJobData): Promise<void> {
        if (!this.queue) {
            this.logger.warn(`Queue [${DOCUMENT_QUEUE_NAME}] chưa được khởi tạo, bỏ qua job cho document ${data.documentId}`);
            return;
        }

        await this.queue.add('process-document', data, {
            attempts: 3,
            backoff: {
                type: 'exponential',
                delay: 3000,
            },
            removeOnComplete: true,
            removeOnFail: false,
        });

        this.logger.log(`Đã đẩy job trích xuất văn bản [${data.documentId}] vào hàng đợi [${DOCUMENT_QUEUE_NAME}]`);
    }

    async addEmbeddingJob(data: DocumentEmbeddingJobData): Promise<void> {
        if (!this.embeddingQueue) {
            this.logger.warn(`Queue [${DOCUMENT_EMBEDDING_QUEUE_NAME}] chưa được khởi tạo, bỏ qua job cho document ${data.documentId}`);
            return;
        }

        await this.embeddingQueue.add('embed-document', data, {
            attempts: 3,
            backoff: {
                type: 'exponential',
                delay: 3000,
            },
            removeOnComplete: true,
            removeOnFail: false,
        });

        this.logger.log(`Đã đẩy job embedding [${data.documentId}] vào hàng đợi [${DOCUMENT_EMBEDDING_QUEUE_NAME}]`);
    }

    async onApplicationShutdown() {
        if (this.queue) {
            await this.queue.close().catch(() => {});
            this.logger.log(`BullMQ Queue [${DOCUMENT_QUEUE_NAME}] đã đóng kết nối`);
        }
        if (this.embeddingQueue) {
            await this.embeddingQueue.close().catch(() => {});
            this.logger.log(`BullMQ Queue [${DOCUMENT_EMBEDDING_QUEUE_NAME}] đã đóng kết nối`);
        }
    }
}
