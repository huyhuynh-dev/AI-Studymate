import { Module } from '@nestjs/common';
import { AiService } from './ai.service.js';
import { EmbeddingService } from './embedding.service.js';
import { VisionService } from './vision.service.js';
import { GeminiSummaryService } from './gemini-summary.service.js';
import { BlocknoteAiService } from './blocknote-ai.service.js';

@Module({
  providers: [
    AiService,
    EmbeddingService,
    VisionService,
    GeminiSummaryService,
    BlocknoteAiService,
  ],
  exports: [AiService, EmbeddingService, VisionService, GeminiSummaryService],
})
export class AiModule { }
