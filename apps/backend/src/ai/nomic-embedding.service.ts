import { Injectable, Logger } from '@nestjs/common';
import ollama from 'ollama';

import { EmbeddingResult } from './gemini-embedding.service.js';

export const NOMIC_EMBEDDING_DIMENSIONS = 768;
const NOMIC_EMBEDDING_MODEL = 'nomic-embed-text-v2-moe';

@Injectable()
export class NomicEmbeddingService {
  private readonly logger = new Logger(NomicEmbeddingService.name);
  private readonly modelName = NOMIC_EMBEDDING_MODEL;
  private readonly dimensions = NOMIC_EMBEDDING_DIMENSIONS;

  constructor() {
    this.logger.log(
      `NomicEmbeddingService đã khởi tạo [model: ${this.modelName}, dims: ${this.dimensions}, host: http://localhost:11434]`,
    );
  }

  async embedSingle(text: string): Promise<number[]> {
    const results = await this.embedBatch([text]);
    if (!results.length) {
      throw new Error('Không nhận được kết quả embedding từ Ollama');
    }
    return results[0].values;
  }

  async embedBatch(texts: string[]): Promise<EmbeddingResult[]> {
    if (!texts || texts.length === 0) {
      return [];
    }

    let response;
    try {
      response = await ollama.embed({
        model: this.modelName,
        input: texts,
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      const stack = error instanceof Error ? error.stack : undefined;
      this.logger.error(
        `Lỗi khi gọi Ollama Embedding API (${this.modelName}): ${message}`,
        stack,
      );
      throw error;
    }

    if (!response.embeddings || response.embeddings.length !== texts.length) {
      throw new Error(
        `Ollama Embedding trả về ${response.embeddings?.length ?? 0} vectors cho ${texts.length} đoạn văn bản`,
      );
    }

    return response.embeddings.map((values, index) => {
      if (
        values.length !== this.dimensions ||
        values.some((value) => !Number.isFinite(value))
      ) {
        throw new Error(
          `Chiều vector Ollama tại vị trí ${index} (${values.length}) không khớp cấu hình (${this.dimensions}) hoặc chứa giá trị không hợp lệ`,
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
