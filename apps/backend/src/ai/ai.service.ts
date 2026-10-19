import { Injectable } from '@nestjs/common';
import {
  GeminiEmbeddingService,
  EmbeddingResult,
} from './gemini-embedding.service.js';
import { GeminiVisionService } from './gemini-vision.service.js';

@Injectable()
export class AiService {
  constructor(
    private readonly geminiVisionService: GeminiVisionService,
    private readonly geminiEmbeddingService: GeminiEmbeddingService,
  ) {}

  extractTextFromImage(imageBuffer: Buffer, mimeType: string): Promise<string> {
    return this.geminiVisionService.extractTextFromImage(imageBuffer, mimeType);
  }

  embedSingle(text: string): Promise<number[]> {
    return this.geminiEmbeddingService.embedSingle(text);
  }

  embedBatch(texts: string[]): Promise<EmbeddingResult[]> {
    return this.geminiEmbeddingService.embedBatch(texts);
  }
}
