import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { AiService } from './ai.service.js';
import { EmbeddingService } from './embedding.service.js';
import { VisionService } from './vision.service.js';
import { SummaryService } from './summary.service.js';
import { BlocknoteService } from './blocknote.service.js';
import { ChatAgentAiService } from './chat-agent-ai.service.js';
import { AiModelFactory } from './ai-model.factory.js';
import { QuizAiService } from './quiz-ai.service.js';
import { FlashcardAiService } from './flashcard-ai.service.js';
import { PromptRegistryService } from './prompts/prompt-registry.service.js';
import { ToolRegistryService } from './tools/tool-registry.service.js';
import { AiTelemetryService } from './telemetry/ai-telemetry.service.js';
import { ChatCompactionService } from './chat-compaction.service.js';

@Module({
  imports: [PrismaModule],
  providers: [
    AiModelFactory,
    PromptRegistryService,
    ToolRegistryService,
    AiTelemetryService,
    AiService,
    EmbeddingService,
    VisionService,
    SummaryService,
    BlocknoteService,
    ChatCompactionService,
    ChatAgentAiService,
    QuizAiService,
    FlashcardAiService,
  ],
  exports: [
    AiModelFactory,
    PromptRegistryService,
    ToolRegistryService,
    AiTelemetryService,
    AiService,
    EmbeddingService,
    VisionService,
    SummaryService,
    BlocknoteService,
    ChatCompactionService,
    ChatAgentAiService,
    QuizAiService,
    FlashcardAiService,
  ],
})
export class AiModule {}
