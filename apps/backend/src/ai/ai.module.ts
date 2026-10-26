import { Module } from '@nestjs/common';
import { AiService } from './ai.service.js';
import { EmbeddingService } from './embedding.service.js';
import { VisionService } from './vision.service.js';
import { SummaryService } from './summary.service.js';
import { BlocknoteService } from './blocknote.service.js';
import { ChatAgentAiService } from './chat-agent-ai.service.js';

@Module({
  providers: [
    AiService,
    EmbeddingService,
    VisionService,
    SummaryService,
    BlocknoteService,
    ChatAgentAiService,
  ],
  exports: [
    AiService,
    EmbeddingService,
    VisionService,
    SummaryService,
    BlocknoteService,
    ChatAgentAiService,
  ],
})
export class AiModule { }
