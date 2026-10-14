import { Injectable, Logger, OnApplicationShutdown, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job, Worker } from 'bullmq';
import { DocumentsRepoService } from '../../repo/documents-repo/documents-repo.service.js';
import { DocumentChunksRepoService } from '../../repo/document-chunks-repo/document-chunks-repo.service.js';
import { GeminiEmbeddingService } from './gemini-embedding.service.js';
import {
    DOCUMENT_EMBEDDING_QUEUE_NAME,
    DocumentEmbeddingJobData,
    DocumentsQueueService,
} from './documents-queue.service.js';
import { chunkText } from './text-chunker.js';

const EMBED_BATCH_SIZE = 20;

@Injectable()
export class DocumentsEmbedProcessorService implements OnModuleInit, OnApplicationShutdown {
    private readonly logger = new Logger(DocumentsEmbedProcessorService.name);
    private worker: Worker<DocumentEmbeddingJobData>;

    constructor(
        private readonly configService: ConfigService,
        private readonly documentsRepo: DocumentsRepoService,
        private readonly documentChunksRepo: DocumentChunksRepoService,
        private readonly geminiEmbeddingService: GeminiEmbeddingService,
        private readonly documentsQueueService: DocumentsQueueService,
    ) { }

    onModuleInit() {
        const redisUrl = this.configService.get<string>('REDIS_URL') || 'redis://localhost:6379';
        const redisPassword = this.configService.get<string>('REDIS_PASSWORD') || undefined;

        this.worker = new Worker<DocumentEmbeddingJobData>(
            DOCUMENT_EMBEDDING_QUEUE_NAME,
            async (job: Job<DocumentEmbeddingJobData>) => {
                await this.processEmbeddingJob(job);
            },
            {
                connection: {
                    url: redisUrl,
                    password: redisPassword,
                    maxRetriesPerRequest: null,
                },
                concurrency: 3,
            }
        );

        this.worker.on('completed', (job) => {
            this.logger.log(`Job embedding tài liệu [${job.data.documentId}] hoàn tất thành công`);
        });

        this.worker.on('failed', (job, err) => {
            this.logger.error(`Job embedding tài liệu [${job?.data?.documentId}] thất bại: ${err.message}`);
        });

        this.worker.on('error', (err) => {
            this.logger.warn(`BullMQ Embed Worker error: ${err.message}`);
        });

        this.logger.log(`BullMQ Embed Worker cho [${DOCUMENT_EMBEDDING_QUEUE_NAME}] đã sẵn sàng lắng nghe`);

        // Tự động phục hồi các tài liệu đã xong OCR nhưng chưa chạy Embedding (ví dụ từ các phiên trước)
        void this.recoverPendingEmbeddings();
    }

    private async recoverPendingEmbeddings(): Promise<void> {
        try {
            const pendingDocs = await this.documentsRepo.findDocumentsPendingEmbedding();
            if (pendingDocs.length > 0) {
                this.logger.log(
                    `Phát hiện ${pendingDocs.length} tài liệu đã hoàn tất OCR nhưng đang chờ Embedding, tiến hành đẩy vào hàng đợi...`
                );
                for (const doc of pendingDocs) {
                    await this.documentsQueueService.addEmbeddingJob({ documentId: doc.id });
                }
            }
        } catch (err: any) {
            this.logger.warn(`Không thể phục hồi các tài liệu chờ Embedding: ${err.message}`);
        }
    }

    private async processEmbeddingJob(job: Job<DocumentEmbeddingJobData>): Promise<void> {
        const { documentId } = job.data;
        if (!documentId) {
            throw new Error('Dữ liệu job embedding không hợp lệ: thiếu documentId');
        }

        const doc = await this.documentsRepo.findRawDocumentById(documentId);
        if (!doc) {
            this.logger.warn(`Không tìm thấy tài liệu [${documentId}] trong CSDL (có thể đã bị xóa), bỏ qua embedding`);
            return;
        }

        const rawText = doc.raw_text?.trim() || '';
        if (!rawText) {
            await this.documentsRepo.updateDocumentById(documentId, {
                embed_status: 'done',
                processing_error: null,
            });
            this.logger.log(`Tài liệu [${documentId}] không có nội dung văn bản, hoàn tất trạng thái embed_status='done'`);
            return;
        }

        this.logger.log(`Bắt đầu pha Embedding cho tài liệu [${documentId}] (${rawText.length} ký tự)`);

        try {
            // Bước 1: Cập nhật embed_status = 'processing'
            await this.documentsRepo.updateDocumentById(documentId, {
                embed_status: 'processing',
                processing_error: null,
            });

            // Bước 2: Chia raw_text thành các chunks (~500 tokens, overlap ~50 tokens)
            const chunks = chunkText(rawText);
            this.logger.log(`Tài liệu [${documentId}] được chia thành ${chunks.length} chunks`);

            if (chunks.length === 0) {
                await this.documentsRepo.updateDocumentById(documentId, {
                    embed_status: 'done',
                    processing_error: null,
                });
                return;
            }

            // Bước 3: Gọi Gemini Embedding API theo từng batch (tối đa 20 chunks/request)
            const chunksWithEmbeddings: Array<{
                chunkIndex: number;
                content: string;
                embedding: number[];
            }> = [];

            for (let i = 0; i < chunks.length; i += EMBED_BATCH_SIZE) {
                const batch = chunks.slice(i, i + EMBED_BATCH_SIZE);
                const batchTexts = batch.map((c) => c.content);

                const embeddings = await this.geminiEmbeddingService.embedBatch(batchTexts);

                for (let j = 0; j < batch.length; j++) {
                    chunksWithEmbeddings.push({
                        chunkIndex: batch[j].index,
                        content: batch[j].content,
                        embedding: embeddings[j].values,
                    });
                }
            }

            // Bước 4: Lưu toàn bộ chunks kèm vector 768 chiều vào bảng document_chunks (pgvector)
            const insertedCount = await this.documentChunksRepo.replaceChunksWithEmbeddings(
                documentId,
                chunksWithEmbeddings
            );

            // Bước 5: Cập nhật embed_status = 'done'
            await this.documentsRepo.updateDocumentById(documentId, {
                embed_status: 'done',
                processing_error: null,
            });

            this.logger.log(
                `Tài liệu [${documentId}] hoàn tất Embedding: đã lưu ${insertedCount} chunks vào pgvector`
            );
        } catch (error: any) {
            this.logger.error(
                `Lỗi trong quá trình Embedding tài liệu [${documentId}]: ${error.message}`,
                error.stack
            );
            await this.documentsRepo.updateDocumentById(documentId, {
                embed_status: 'failed',
                processing_error: error.message || 'Lỗi tạo chỉ mục vector (Embedding)',
            });
            throw error;
        }
    }

    async onApplicationShutdown() {
        if (this.worker) {
            await this.worker.close().catch(() => {});
            this.logger.log(`BullMQ Embed Worker cho [${DOCUMENT_EMBEDDING_QUEUE_NAME}] đã đóng kết nối`);
        }
    }
}
