import { Injectable, Logger, OnApplicationShutdown, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job, Worker } from 'bullmq';
import { StorageService } from '../storage/storage.service.js';
import { DocumentsRepoService } from '../repo/documents-repo/documents-repo.service.js';
import { DOCUMENT_QUEUE_NAME, DocumentJobData } from './documents-queue.service.js';

@Injectable()
export class DocumentsProcessorService implements OnModuleInit, OnApplicationShutdown {
    private readonly logger = new Logger(DocumentsProcessorService.name);
    private worker: Worker<DocumentJobData>;

    constructor(
        private readonly configService: ConfigService,
        private readonly storageService: StorageService,
        private readonly documentsRepo: DocumentsRepoService,
    ) { }

    onModuleInit() {
        const redisUrl = this.configService.get<string>('REDIS_URL') || 'redis://localhost:6379';
        const redisPassword = this.configService.get<string>('REDIS_PASSWORD') || undefined;

        this.worker = new Worker<DocumentJobData>(
            DOCUMENT_QUEUE_NAME,
            async (job: Job<DocumentJobData>) => {
                await this.processDocumentJob(job);
            },
            {
                connection: {
                    url: redisUrl,
                    password: redisPassword,
                    maxRetriesPerRequest: null,
                },
                concurrency: 5,
            }
        );

        this.worker.on('completed', (job) => {
            this.logger.log(`Job xử lý tài liệu [${job.data.documentId}] hoàn tất thành công`);
        });

        this.worker.on('failed', (job, err) => {
            this.logger.error(`Job xử lý tài liệu [${job?.data?.documentId}] thất bại: ${err.message}`);
        });

        this.worker.on('error', (err) => {
            this.logger.warn(`BullMQ Worker error: ${err.message}`);
        });

        this.logger.log(`BullMQ Worker cho [${DOCUMENT_QUEUE_NAME}] đã sẵn sàng lắng nghe`);
    }

    private async processDocumentJob(job: Job<DocumentJobData>): Promise<void> {
        const { documentId, mimeType, storageKey } = job.data;
        this.logger.log(`Bắt đầu xử lý tài liệu [${documentId}] (MIME: ${mimeType})`);

        try {
            // Bước 1: Cập nhật ocr_status = 'processing'
            await this.documentsRepo.updateDocumentById(documentId, {
                ocr_status: 'processing',
                processing_error: null,
            });

            let extractedText = '';

            // Bước 2: Phân loại định dạng tệp để xử lý
            if (mimeType === 'application/pdf') {
                const buffer = await this.storageService.getObjectBuffer(storageKey);
                extractedText = await this.extractPdfText(buffer);
            } else if (mimeType.startsWith('image/')) {
                // Với ảnh, ở bước này ta ghi nhận đã tải xong và đánh dấu sẵn sàng cho Vision OCR
                extractedText = '';
            }

            // Bước 3: Cập nhật raw_text và ocr_status = 'done'
            await this.documentsRepo.updateDocumentById(documentId, {
                raw_text: extractedText,
                ocr_status: 'done',
                processing_error: null,
            });

            this.logger.log(`Tài liệu [${documentId}] trích xuất thành công (${extractedText.length} ký tự)`);
        } catch (error: any) {
            this.logger.error(`Lỗi xử lý tài liệu [${documentId}]: ${error.message}`, error.stack);
            await this.documentsRepo.updateDocumentById(documentId, {
                ocr_status: 'failed',
                processing_error: error.message || 'Lỗi xử lý trích xuất văn bản',
            });
            throw error;
        }
    }

    private async extractPdfText(buffer: Buffer): Promise<string> {
        try {
            const pdfModule = await import('pdf-parse');
            const parseFn = (pdfModule as any).default || pdfModule;
            const data = await parseFn(buffer);
            return data?.text ? data.text.trim() : '';
        } catch (err: any) {
            throw new Error(`Không thể giải mã tệp PDF: ${err.message}`);
        }
    }

    async onApplicationShutdown() {
        if (this.worker) {
            await this.worker.close().catch(() => {});
            this.logger.log(`BullMQ Worker cho [${DOCUMENT_QUEUE_NAME}] đã đóng kết nối`);
        }
    }
}
