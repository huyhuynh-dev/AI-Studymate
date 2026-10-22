import { Injectable, Logger } from '@nestjs/common';
import { AiService } from './ai.service.js';

export interface EmbeddingResult {
  index: number;
  values: number[];
}

export const EMBEDDING_DIMENSIONS = 768;

@Injectable()
export class EmbeddingService {
  private readonly logger = new Logger(EmbeddingService.name);
  private readonly dimensions = EMBEDDING_DIMENSIONS;

  constructor(private readonly aiService: AiService) {}

  async embedSingle(text: string): Promise<number[]> {
    const results = await this.embedBatch([text]);
    if (!results.length) {
      throw new Error('Không nhận được kết quả embedding từ model');
    }
    return results[0].values;
  }

  async embedBatch(texts: string[]): Promise<EmbeddingResult[]> {
    if (!texts || texts.length === 0) {
      return [];
    }

    let embeddings: number[][];
    try {
      ({ embeddings } = await this.aiService.embedMany(texts));
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      const stack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Lỗi khi gọi Embedding API: ${message}`, stack);
      throw error;
    }

    if (!embeddings || embeddings.length !== texts.length) {
      throw new Error(
        `Embedding API trả về ${embeddings?.length ?? 0} vectors cho ${texts.length} đoạn văn bản`,
      );
    }

    return embeddings.map((values, index) => {
      if (
        values.length !== this.dimensions ||
        values.some((value) => !Number.isFinite(value))
      ) {
        throw new Error(
          `Chiều vector tại vị trí ${index} (${values.length}) không khớp cấu hình (${this.dimensions}) hoặc chứa giá trị không hợp lệ`,
        );
      }

      return {
        index,
        values: this.normalizeVector(values),
      };
    });
  }

  getDimensions(): number {
    return this.dimensions;
  }

  private normalizeVector(values: number[]): number[] {
    let sumSquares = 0;
    for (const value of values) {
      sumSquares += value * value;
    }

    const norm = Math.sqrt(sumSquares);
    if (norm === 0 || !Number.isFinite(norm)) {
      return values;
    }

    return values.map((value) => value / norm);
  }
}
