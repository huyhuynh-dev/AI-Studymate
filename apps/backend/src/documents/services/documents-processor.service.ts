import { Injectable, Logger, OnApplicationShutdown, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job, Worker } from 'bullmq';
import { StorageService } from '../../storage/storage.service.js';
import { DocumentsRepoService } from '../../repo/documents-repo/documents-repo.service.js';
import { GeminiVisionService } from './gemini-vision.service.js';
import {
    DOCUMENT_QUEUE_NAME,
    DocumentJobData,
    DocumentsQueueService,
} from './documents-queue.service.js';

@Injectable()
export class DocumentsProcessorService implements OnModuleInit, OnApplicationShutdown {
    private readonly logger = new Logger(DocumentsProcessorService.name);
    private worker: Worker<DocumentJobData>;

    constructor(
        private readonly configService: ConfigService,
        private readonly storageService: StorageService,
        private readonly documentsRepo: DocumentsRepoService,
        private readonly geminiVisionService: GeminiVisionService,
        private readonly documentsQueueService: DocumentsQueueService,
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
            // Bước 1: Validate thông tin công việc
            if (!documentId || !storageKey || !mimeType) {
                throw new Error('Dữ liệu công việc không hợp lệ: thiếu documentId, storageKey hoặc mimeType');
            }

            // Bước 2: Cập nhật ocr_status = 'processing'
            await this.documentsRepo.updateDocumentById(documentId, {
                ocr_status: 'processing',
                processing_error: null,
            });

            let extractedText = '';

            // Bước 3: Phân loại định dạng tệp để xử lý
            if (mimeType === 'application/pdf') {
                const buffer = await this.storageService.getObjectBuffer(storageKey);
                extractedText = await this.extractPdfText(buffer);
            } else if (mimeType.startsWith('image/')) {
                const buffer = await this.storageService.getObjectBuffer(storageKey);
                extractedText = await this.geminiVisionService.extractTextFromImage(buffer, mimeType);
            } else {
                throw new Error(`Định dạng tệp không được hỗ trợ xử lý OCR: ${mimeType}`);
            }

            const hasTextContent = extractedText.trim().length > 0;

            // Bước 4: Cập nhật raw_text và ocr_status = 'done'
            await this.documentsRepo.updateDocumentById(documentId, {
                raw_text: extractedText,
                ocr_status: 'done',
                embed_status: hasTextContent ? 'pending' : 'done',
                processing_error: null,
            });

            this.logger.log(`Tài liệu [${documentId}] trích xuất thành công (${extractedText.length} ký tự)`);

            // Bước 5: Đẩy sang hàng đợi Embedding riêng biệt (nếu có nội dung văn bản)
            if (hasTextContent) {
                await this.documentsQueueService.addEmbeddingJob({ documentId });
            } else {
                this.logger.log(`Tài liệu [${documentId}] không có chữ, bỏ qua hàng đợi Embedding`);
            }
        } catch (error: any) {
            this.logger.error(`Lỗi xử lý tài liệu [${documentId}]: ${error.message}`, error.stack);
            await this.documentsRepo.updateDocumentById(documentId, {
                ocr_status: 'failed',
                embed_status: 'failed',
                processing_error: error.message || 'Lỗi xử lý trích xuất văn bản',
            });
            throw error;
        }
    }

    private async extractPdfText(buffer: Buffer): Promise<string> {
        try {
            const pdfModule = await import('pdf-parse');

            // Tương thích chuẩn pdf-parse v2.x (Class PDFParse)
            if (pdfModule.PDFParse) {
                const parser = new pdfModule.PDFParse({ data: buffer });
                const result = await parser.getText();
                await parser.destroy();
                return result?.text ? result.text.trim() : '';
            }

            // Fallback tương thích nếu dùng pdf-parse v1.x cũ
            const parseFn = (pdfModule as any).default || pdfModule;
            if (typeof parseFn === 'function') {
                const data = await parseFn(buffer);
                return data?.text ? data.text.trim() : '';
            }

            throw new Error('Không tìm thấy trình trích xuất PDF hợp lệ trong module pdf-parse');
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
