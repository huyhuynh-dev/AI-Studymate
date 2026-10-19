import { Injectable } from '@nestjs/common';
import {
  GeminiEmbeddingService,
  EmbeddingResult,
} from './gemini-embedding.service.js';
import { GeminiVisionService } from './gemini-vision.service.js';
import {
  GeminiSummaryService,
  GenerateSummaryOptions,
  SummaryResult,
} from './gemini-summary.service.js';

@Injectable()
export class AiService {
  constructor(
    private readonly geminiVisionService: GeminiVisionService,
    private readonly geminiEmbeddingService: GeminiEmbeddingService,
    private readonly geminiSummaryService: GeminiSummaryService,
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

  generateSummary(options: GenerateSummaryOptions): Promise<SummaryResult> {
    return this.geminiSummaryService.generateSummary(options);
  }

  refineSummary(currentBlocks: any[], instruction: string): Promise<SummaryResult> {
    return this.geminiSummaryService.refineSummary(currentBlocks, instruction);
  }
}
