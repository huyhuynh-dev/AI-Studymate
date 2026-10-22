import { Module } from '@nestjs/common';
import { AiService } from './ai.service.js';
import { EmbeddingService } from './embedding.service.js';
import { GeminiVisionService } from './gemini-vision.service.js';
import { GeminiSummaryService } from './gemini-summary.service.js';
import { BlocknoteAiService } from './blocknote-ai.service.js';

@Module({
  providers: [
    AiService,
    EmbeddingService,
    GeminiVisionService,
    GeminiSummaryService,
    BlocknoteAiService,
  ],
  exports: [AiService, EmbeddingService, GeminiSummaryService],
})
export class AiModule { }
