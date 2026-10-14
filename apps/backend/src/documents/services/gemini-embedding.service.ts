import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenAI } from '@google/genai';

export interface EmbeddingResult {
    index: number;
    values: number[];
}

export const EMBEDDING_DIMENSIONS = 768;
const MAX_CHUNKS_PER_REQUEST = 25;
const MAX_CHARS_PER_REQUEST = 12000; // An toàn dưới ngưỡng 8,192 tokens của gemini-embedding-2

@Injectable()
export class GeminiEmbeddingService {
    private readonly logger = new Logger(GeminiEmbeddingService.name);
    private genAI: GoogleGenAI | null = null;
    private readonly modelName: string;
    private readonly dimensions = EMBEDDING_DIMENSIONS;

    constructor(private readonly configService: ConfigService) {
        this.modelName =
            this.configService.get<string>('GEMINI_EMBEDDING_MODEL') || 'gemini-embedding-2';

        const apiKey = this.configService.get<string>('GEMINI_API_KEY');
        if (apiKey) {
            this.genAI = new GoogleGenAI({ apiKey });
            this.logger.log(
                `GeminiEmbeddingService đã khởi tạo [model: ${this.modelName}, dims: ${this.dimensions}]`
            );
        } else {
            this.logger.warn('Chưa cấu hình GEMINI_API_KEY trong file môi trường (.env)');
        }
    }

    private ensureClient(): GoogleGenAI {
        if (!this.genAI) {
            const apiKey = this.configService.get<string>('GEMINI_API_KEY');
            if (!apiKey) {
                throw new Error('GEMINI_API_KEY chưa được cấu hình trong biến môi trường');
            }
            this.genAI = new GoogleGenAI({ apiKey });
        }
        return this.genAI;
    }

    /**
     * Sinh embedding vector (768 chiều) cho một đoạn văn bản đơn lẻ (dùng cho cả RAG query sau này)
     */
    async embedSingle(text: string): Promise<number[]> {
        const results = await this.embedBatch([text]);
        if (!results.length) {
            throw new Error('Không nhận được kết quả embedding từ Gemini API');
        }
        return results[0].values;
    }

    /**
     * Sinh embedding vectors cho danh sách các đoạn văn bản.
     * Tự động phân chia thành các sub-batch an toàn (<=25 chunks, <=12,000 ký tự)
     * và đóng gói từng chunk vào Content object riêng để gửi trong 1 request duy nhất.
     */
    async embedBatch(texts: string[]): Promise<EmbeddingResult[]> {
        if (!texts || texts.length === 0) {
            return [];
        }

        const client = this.ensureClient();
        const batches = this.splitIntoSafeBatches(texts);
        const allResults: EmbeddingResult[] = [];
        let globalIndex = 0;

        this.logger.log(
            `Bắt đầu sinh embedding cho ${texts.length} chunks (chia thành ${batches.length} request(s) tới Gemini API)`
        );

        for (let b = 0; b < batches.length; b++) {
            const subBatch = batches[b];
            const contents = subBatch.map((text) => ({
                role: 'user',
                parts: [{ text }],
            }));

            const response = await this.callEmbedWithRetry(client, contents, b + 1, batches.length);
            const embeddings = response.embeddings;

            if (!embeddings || embeddings.length !== subBatch.length) {
                throw new Error(
                    `Gemini Embedding trả về ${embeddings?.length ?? 0} vectors cho ${subBatch.length} đoạn văn bản trong batch #${b + 1}`
                );
            }

            for (let i = 0; i < embeddings.length; i++) {
                const rawValues = embeddings[i].values;
                if (!rawValues || rawValues.length === 0) {
                    throw new Error(`Vector embedding tại vị trí ${globalIndex} bị rỗng`);
                }

                const sliced =
                    rawValues.length > this.dimensions
                        ? rawValues.slice(0, this.dimensions)
                        : rawValues;

                if (sliced.length !== this.dimensions) {
                    throw new Error(
                        `Chiều vector trả về (${sliced.length}) không khớp cấu hình (${this.dimensions})`
                    );
                }

                allResults.push({
                    index: globalIndex++,
                    values: this.normalizeVector(sliced),
                });
            }

            // Pacing nhẹ giữa các batch để tránh spike RPM
            if (b < batches.length - 1) {
                await new Promise((resolve) => setTimeout(resolve, 300));
            }
        }

        return allResults;
    }

    /**
     * Chia danh sách texts thành các sub-batches thỏa mãn:
     * 1. Số lượng chunks <= MAX_CHUNKS_PER_REQUEST (25)
     * 2. Tổng số ký tự <= MAX_CHARS_PER_REQUEST (12,000)
     */
    private splitIntoSafeBatches(texts: string[]): string[][] {
        const batches: string[][] = [];
        let currentBatch: string[] = [];
        let currentChars = 0;

        for (const text of texts) {
            const textLen = text.length;
            const wouldExceedChunks = currentBatch.length >= MAX_CHUNKS_PER_REQUEST;
            const wouldExceedChars =
                currentChars + textLen > MAX_CHARS_PER_REQUEST && currentBatch.length > 0;

            if (wouldExceedChunks || wouldExceedChars) {
                batches.push(currentBatch);
                currentBatch = [];
                currentChars = 0;
            }

            currentBatch.push(text);
            currentChars += textLen;
        }

        if (currentBatch.length > 0) {
            batches.push(currentBatch);
        }

        return batches;
    }

    /**
     * Gọi Gemini API kèm cơ chế retry thông minh với Exponential Backoff khi gặp lỗi 429 (Rate Limit)
     */
    private async callEmbedWithRetry(
        client: GoogleGenAI,
        contents: any[],
        batchIndex: number,
        totalBatches: number,
        maxRetries = 3
    ): Promise<any> {
        let attempt = 0;
        let lastError: any = null;

        while (attempt < maxRetries) {
            try {
                return await client.models.embedContent({
                    model: this.modelName,
                    contents,
                    config: {
                        outputDimensionality: this.dimensions,
                    },
                });
            } catch (error: any) {
                lastError = error;
                attempt++;

                const errMsg = error.message || '';
                const isRateLimit =
                    error.status === 429 ||
                    error.code === 429 ||
                    /429|resource_exhausted|quota/i.test(errMsg);

                if (isRateLimit && attempt < maxRetries) {
                    // Trích xuất số giây retry nếu Google trả về (ví dụ "retry in 26s")
                    const match = errMsg.match(/retry in ([\d.]+)s/i);
                    const suggestedDelaySec = match ? Math.ceil(parseFloat(match[1])) : attempt * 5;
                    const delayMs = Math.min(Math.max(suggestedDelaySec, 3), 35) * 1000;

                    this.logger.warn(
                        `Gemini API bị giới hạn Quota (429) ở batch ${batchIndex}/${totalBatches}. Thử lại lần ${attempt}/${maxRetries} sau ${delayMs / 1000}s...`
                    );
                    await new Promise((resolve) => setTimeout(resolve, delayMs));
                    continue;
                }

                this.logger.error(
                    `Lỗi khi gọi Gemini Embedding API (${this.modelName}) ở batch ${batchIndex}/${totalBatches}: ${errMsg}`,
                    error.stack
                );
                throw error;
            }
        }

        throw lastError;
    }

    /**
     * Chuẩn hóa vector L2 (khuyến nghị của Google khi dùng Matryoshka outputDimensionality = 768)
     */
    private normalizeVector(values: number[]): number[] {
        let sumSquares = 0;
        for (const v of values) {
            sumSquares += v * v;
        }
        const norm = Math.sqrt(sumSquares);
        if (norm === 0 || !Number.isFinite(norm)) {
            return values;
        }
        return values.map((v) => v / norm);
    }

    getDimensions(): number {
        return this.dimensions;
    }
}
