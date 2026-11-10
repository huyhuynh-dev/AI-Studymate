import { Module } from '@nestjs/common';
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

@Module({
  providers: [
    AiModelFactory,
    PromptRegistryService,
    AiService,
    EmbeddingService,
    VisionService,
    SummaryService,
    BlocknoteService,
    ChatAgentAiService,
    QuizAiService,
    FlashcardAiService,
  ],
  exports: [
    AiModelFactory,
    PromptRegistryService,
    AiService,
    EmbeddingService,
    VisionService,
    SummaryService,
    BlocknoteService,
    ChatAgentAiService,
    QuizAiService,
    FlashcardAiService,
  ],
})
export class AiModule {}
