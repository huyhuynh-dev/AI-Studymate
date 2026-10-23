import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface DoclingChunkResult {
    index: number;
    content: string;
}

export class DoclingTaskError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'DoclingTaskError';
    }
}

@Injectable()
export class DoclingService {
    private readonly logger = new Logger(DoclingService.name);
    private readonly baseUrl: string;
    private readonly timeoutMs: number;
    private readonly pollWaitSeconds = 2;
    private readonly pollIntervalMs = 1000;

    constructor(private readonly configService: ConfigService) {
        const rawUrl = this.configService.get<string>('DOCLING_SERVER_URL') || 'http://localhost:5001';
        this.baseUrl = rawUrl.replace(/\/+$/, '');

        const timeoutSec = Number(this.configService.get<string>('DOCLING_TIMEOUT_SECONDS')) || 120;
        this.timeoutMs = timeoutSec * 1000;

        this.logger.log(`DoclingService khởi tạo thành công [URL: ${this.baseUrl}, Timeout: ${timeoutSec}s]`);
    }

    /**
     * Kiểm tra trạng thái hoạt động của Docling Server
     */
    async isHealthy(): Promise<boolean> {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 3000);

            const res = await fetch(`${this.baseUrl}/health`, {
                signal: controller.signal,
            });
            clearTimeout(timeoutId);

            if (!res.ok) return false;
            const data = await res.json();
            return data?.status === 'ok';
        } catch {
            return false;
        }
    }

    /**
     * Chuyển đổi tài liệu (PDF, Image,...) sang định dạng Markdown qua Docling Server
     * @param fileBuffer Dữ liệu binary của tài liệu
     * @param fileName Tên tài liệu (dùng để Docling nhận dạng loại tài liệu)
     * @returns Nội dung văn bản định dạng Markdown
     */
    async convertDocumentToMarkdown(fileBuffer: Buffer, fileName: string): Promise<string> {
        if (!fileBuffer || fileBuffer.length === 0) {
            return '';
        }

        const base64String = fileBuffer.toString('base64');
        const reqBody = {
            sources: [
                {
                    kind: 'file',
                    filename: fileName,
                    base64_string: base64String,
                },
            ],
            options: {
                to_formats: ['md'],
                image_export_mode: 'placeholder',
                do_ocr: true,
                table_mode: 'accurate',
            },
        };

        this.logger.debug(`Bắt đầu gửi request convert async tới Docling Server cho [${fileName}]`);
        const submitRes = await fetch(`${this.baseUrl}/v1/convert/source/async`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(reqBody),
        });

        if (!submitRes.ok) {
            const errText = await submitRes.text().catch(() => '');
            throw new Error(`Docling convert request thất bại (HTTP ${submitRes.status}): ${errText}`);
        }

        const submitData = await submitRes.json();
        const taskId = submitData.task_id;
        if (!taskId) {
            throw new Error('Docling không trả về task_id hợp lệ cho tác vụ convert');
        }

        this.logger.debug(`Nhận task_id [${taskId}] cho tác vụ convert [${fileName}], tiến hành polling...`);
        await this.pollTaskStatus(taskId, `convert [${fileName}]`);

        // Lấy kết quả Markdown sau khi hoàn tất
        const resultRes = await fetch(`${this.baseUrl}/v1/result/${taskId}`);
        if (!resultRes.ok) {
            const errText = await resultRes.text().catch(() => '');
            throw new Error(`Docling get result thất bại (HTTP ${resultRes.status}): ${errText}`);
        }

        const resultData = await resultRes.json();
        const mdContent = resultData.document?.md_content;
        return typeof mdContent === 'string' ? mdContent.trim() : '';
    }

    /**
     * Phân mảnh văn bản Markdown theo thuật toán HybridChunker của Docling Server
     * @param markdown Nội dung văn bản Markdown
     * @param fileName Tên tệp giả định (mặc định document.md)
     * @returns Danh sách các chunk có index và content đã chuẩn hóa
     */
    async chunkMarkdownHybrid(markdown: string, fileName = 'document.md'): Promise<DoclingChunkResult[]> {
        if (!markdown || markdown.trim().length === 0) {
            return [];
        }

        const safeFileName = fileName.endsWith('.md') ? fileName : `${fileName}.md`;
        const base64String = Buffer.from(markdown, 'utf-8').toString('base64');

        const reqBody = {
            sources: [
                {
                    kind: 'file',
                    filename: safeFileName,
                    base64_string: base64String,
                },
            ],
            chunking_options: {
                chunker: 'hybrid',
                tokenizer: 'sentence-transformers/all-MiniLM-L6-v2',
                merge_peers: true,
            },
        };

        this.logger.debug(`Bắt đầu gửi request chunk hybrid async tới Docling Server cho [${safeFileName}]`);
        const submitRes = await fetch(`${this.baseUrl}/v1/chunk/hybrid/source/async`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(reqBody),
        });

        if (!submitRes.ok) {
            const errText = await submitRes.text().catch(() => '');
            throw new Error(`Docling chunk request thất bại (HTTP ${submitRes.status}): ${errText}`);
        }

        const submitData = await submitRes.json();
        const taskId = submitData.task_id;
        if (!taskId) {
            throw new Error('Docling không trả về task_id hợp lệ cho tác vụ chunk');
        }

        this.logger.debug(`Nhận task_id [${taskId}] cho tác vụ chunk [${safeFileName}], tiến hành polling...`);
        await this.pollTaskStatus(taskId, `chunk [${safeFileName}]`);

        // Lấy kết quả Chunks sau khi hoàn tất
        const resultRes = await fetch(`${this.baseUrl}/v1/result/${taskId}`);
        if (!resultRes.ok) {
            const errText = await resultRes.text().catch(() => '');
            throw new Error(`Docling get chunk result thất bại (HTTP ${resultRes.status}): ${errText}`);
        }

        const resultData = await resultRes.json();
        const rawChunks = resultData.chunks;

        if (!Array.isArray(rawChunks)) {
            return [];
        }

        return rawChunks
            .filter((c: any) => typeof c.text === 'string' && c.text.trim().length > 0)
            .map((c: any, defaultIdx: number) => ({
                index: typeof c.chunk_index === 'number' ? c.chunk_index : defaultIdx,
                content: c.text.trim(),
            }));
    }

    /**
     * Polling trạng thái tác vụ bất đồng bộ trên Docling Server
     */
    private async pollTaskStatus(taskId: string, actionName: string): Promise<void> {
        const startTime = Date.now();

        while (Date.now() - startTime < this.timeoutMs) {
            try {
                const pollUrl = `${this.baseUrl}/v1/status/poll/${taskId}?wait=${this.pollWaitSeconds}`;
                const res = await fetch(pollUrl);

                if (!res.ok) {
                    const errText = await res.text().catch(() => '');
                    throw new Error(`Docling poll status HTTP ${res.status}: ${errText}`);
                }

                const data = await res.json();
                const status = data.task_status;

                if (status === 'success') {
                    return;
                }

                if (status === 'failure') {
                    throw new DoclingTaskError(data.error_message || `Docling task [${taskId}] thất bại`);
                }

                // Nếu trạng thái là 'pending' hoặc 'started', tiếp tục chờ và lặp
                await new Promise((resolve) => setTimeout(resolve, this.pollIntervalMs));
            } catch (err: any) {
                if (err instanceof DoclingTaskError) {
                    throw err;
                }
                this.logger.warn(`Lỗi tạm thời khi polling task [${taskId}] (${actionName}): ${err.message}`);
                await new Promise((resolve) => setTimeout(resolve, this.pollIntervalMs));
            }
        }

        throw new Error(`Quá thời gian chờ (${this.timeoutMs / 1000}s) khi xử lý Docling task [${taskId}] cho ${actionName}`);
    }
}
