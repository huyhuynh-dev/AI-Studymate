import { Module } from '@nestjs/common';
import { AiService } from './ai.service.js';
import { GeminiEmbeddingService } from './gemini-embedding.service.js';
import { NomicEmbeddingService } from './nomic-embedding.service.js';
import { GeminiVisionService } from './gemini-vision.service.js';
import { GeminiSummaryService } from './gemini-summary.service.js';

@Module({
  providers: [
    AiService,
    GeminiEmbeddingService,
    NomicEmbeddingService,
    GeminiVisionService,
    GeminiSummaryService,
  ],
  exports: [AiService, GeminiSummaryService, NomicEmbeddingService],
})
export class AiModule {}
