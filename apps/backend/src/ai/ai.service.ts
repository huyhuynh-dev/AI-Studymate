import { Injectable } from '@nestjs/common';
import {
  // [TẠM THỜI] Comment GeminiEmbeddingService để dùng NomicEmbeddingService (Ollama local) tránh giới hạn API
  // GeminiEmbeddingService,
  EmbeddingResult,
} from './gemini-embedding.service.js';
import { NomicEmbeddingService } from './nomic-embedding.service.js';
import { GeminiVisionService } from './gemini-vision.service.js';
import {
  GeminiSummaryService,
  GenerateSummaryOptions,
  SummaryResult,
} from './gemini-summary.service.js';
import type { UIMessage } from 'ai';
import {
  BlocknoteAiService,
  BlocknoteToolDefinitions,
} from './blocknote-ai.service.js';

@Injectable()
export class AiService {
  constructor(
    private readonly geminiVisionService: GeminiVisionService,
    // [TẠM THỜI] Chuyển từ GeminiEmbeddingService sang NomicEmbeddingService
    // private readonly geminiEmbeddingService: GeminiEmbeddingService,
    private readonly nomicEmbeddingService: NomicEmbeddingService,
    private readonly geminiSummaryService: GeminiSummaryService,
    private readonly blocknoteAiService: BlocknoteAiService,
  ) { }

  extractTextFromImage(imageBuffer: Buffer, mimeType: string): Promise<string> {
    return this.geminiVisionService.extractTextFromImage(imageBuffer, mimeType);
  }

  embedSingle(text: string): Promise<number[]> {
    // [TẠM THỜI] Comment GeminiEmbeddingService, chuyển sang NomicEmbeddingService
    // return this.geminiEmbeddingService.embedSingle(text);
    return this.nomicEmbeddingService.embedSingle(text);
  }

  embedBatch(texts: string[]): Promise<EmbeddingResult[]> {
    // [TẠM THỜI] Comment GeminiEmbeddingService, chuyển sang NomicEmbeddingService
    // return this.geminiEmbeddingService.embedBatch(texts);
    return this.nomicEmbeddingService.embedBatch(texts);
  }

  generateSummary(options: GenerateSummaryOptions): Promise<SummaryResult> {
    return this.geminiSummaryService.generateSummary(options);
  }

  refineSummary(currentBlocks: any[], instruction: string): Promise<SummaryResult> {
    return this.geminiSummaryService.refineSummary(currentBlocks, instruction);
  }

  executeBlocknoteEditorAiActions(
    messages: UIMessage[],
    toolDefinitions: BlocknoteToolDefinitions,
  ) {
    return this.blocknoteAiService.executeBlocknoteEditorAiActions(messages, toolDefinitions);
  }
}
