import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenAI } from '@google/genai';

export interface EmbeddingResult {
    index: number;
    values: number[];
}

export const EMBEDDING_DIMENSIONS = 768;

@Injectable()
export class GeminiEmbeddingService {
    private readonly logger = new Logger(GeminiEmbeddingService.name);
    private genAI: GoogleGenAI | null = null;
    private readonly primaryModel: string;
    private readonly fallbackModel = 'text-embedding-004';
    private readonly dimensions = EMBEDDING_DIMENSIONS;

    constructor(private readonly configService: ConfigService) {
        this.primaryModel =
            this.configService.get<string>('GEMINI_EMBEDDING_MODEL') || 'gemini-embedding-001';

        const apiKey = this.configService.get<string>('GEMINI_API_KEY');
        if (apiKey) {
            this.genAI = new GoogleGenAI({ apiKey });
            this.logger.log(
                `GeminiEmbeddingService đã khởi tạo [model: ${this.primaryModel}, dims: ${this.dimensions}]`
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
     * Sinh embedding vectors cho một batch nhiều đoạn văn bản (tối ưu quota & latency)
     * Trả về mảng EmbeddingResult giữ đúng thứ tự đầu vào
     */
    async embedBatch(texts: string[]): Promise<EmbeddingResult[]> {
        if (!texts || texts.length === 0) {
            return [];
        }

        const client = this.ensureClient();

        try {
            return await this.callEmbedContent(client, this.primaryModel, texts);
        } catch (primaryError: any) {
            const isModelNotFound =
                primaryError?.status === 404 ||
                /not found|not supported/i.test(primaryError?.message || '');

            if (isModelNotFound && this.primaryModel !== this.fallbackModel) {
                this.logger.warn(
                    `Model [${this.primaryModel}] không khả dụng (${primaryError.message}), chuyển sang fallback [${this.fallbackModel}]`
                );
                return await this.callEmbedContent(client, this.fallbackModel, texts);
            }

            this.logger.error(
                `Lỗi khi gọi Gemini Embedding API (${this.primaryModel}): ${primaryError.message}`,
                primaryError.stack
            );
            throw new Error(`Gemini Embedding thất bại: ${primaryError.message}`);
        }
    }

    private async callEmbedContent(
        client: GoogleGenAI,
        model: string,
        texts: string[]
    ): Promise<EmbeddingResult[]> {
        const response = await client.models.embedContent({
            model,
            contents: texts,
            config: {
                outputDimensionality: this.dimensions,
            },
        });

        if (!response.embeddings || response.embeddings.length !== texts.length) {
            throw new Error(
                `Gemini Embedding trả về ${response.embeddings?.length ?? 0} vectors cho ${texts.length} đoạn văn bản`
            );
        }

        return response.embeddings.map((emb, index) => {
            const rawValues = emb.values;
            if (!rawValues || rawValues.length === 0) {
                throw new Error(`Vector embedding tại vị trí ${index} bị rỗng`);
            }

            // Đảm bảo kích thước vector đúng 768 chiều và chuẩn hóa L2 nếu bị cắt giảm chiều (MRL)
            const sliced =
                rawValues.length > this.dimensions
                    ? rawValues.slice(0, this.dimensions)
                    : rawValues;

            if (sliced.length !== this.dimensions) {
                throw new Error(
                    `Chiều vector trả về (${sliced.length}) không khớp cấu hình (${this.dimensions})`
                );
            }

            return {
                index,
                values: this.normalizeVector(sliced),
            };
        });
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
