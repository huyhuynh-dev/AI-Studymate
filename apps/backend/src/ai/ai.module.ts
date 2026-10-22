import { Module } from '@nestjs/common';
import { AiService } from './ai.service.js';
// [TẠM THỜI] Comment GeminiEmbeddingService để dùng NomicEmbeddingService (Ollama local)
// import { GeminiEmbeddingService } from './gemini-embedding.service.js';
import { NomicEmbeddingService } from './nomic-embedding.service.js';
import { GeminiVisionService } from './gemini-vision.service.js';
import { GeminiSummaryService } from './gemini-summary.service.js';
import { BlocknoteAiService } from './blocknote-ai.service.js';

@Module({
  providers: [
    AiService,
    // [TẠM THỜI] Comment GeminiEmbeddingService, chuyển sang NomicEmbeddingService
    // GeminiEmbeddingService,
    NomicEmbeddingService,
    GeminiVisionService,
    GeminiSummaryService,
    BlocknoteAiService,
  ],
  exports: [AiService, GeminiSummaryService, NomicEmbeddingService],
})
export class AiModule { }
