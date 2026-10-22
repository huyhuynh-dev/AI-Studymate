import { Module } from '@nestjs/common';
import { AiService } from './ai.service.js';
import { EmbeddingService } from './embedding.service.js';
import { VisionService } from './vision.service.js';
import { GeminiSummaryService } from './gemini-summary.service.js';
import { BlocknoteService } from './blocknote.service.js';

@Module({
  providers: [
    AiService,
    EmbeddingService,
    VisionService,
    GeminiSummaryService,
    BlocknoteService,
  ],
  exports: [
    AiService,
    EmbeddingService,
    VisionService,
    GeminiSummaryService,
    BlocknoteService,
  ],
})
export class AiModule { }
