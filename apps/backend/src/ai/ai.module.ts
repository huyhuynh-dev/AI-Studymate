import { Module } from '@nestjs/common';
import { AiService } from './ai.service.js';
import { EmbeddingService } from './embedding.service.js';
import { VisionService } from './vision.service.js';
import { SummaryService } from './summary.service.js';
import { BlocknoteService } from './blocknote.service.js';
import { ChatAgentAiService } from './chat-agent-ai.service.js';
import { AiModelFactory } from './ai-model.factory.js';
import { QuizAiService } from './quiz-ai.service.js';

@Module({
  providers: [
    AiService,
    EmbeddingService,
    VisionService,
    SummaryService,
    BlocknoteService,
    ChatAgentAiService,
    AiModelFactory,
    QuizAiService,
  ],
  exports: [
    AiService,
    EmbeddingService,
    VisionService,
    SummaryService,
    BlocknoteService,
    ChatAgentAiService,
    AiModelFactory,
    QuizAiService,
  ],
})
export class AiModule { }
