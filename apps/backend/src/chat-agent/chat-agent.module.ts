import { Module } from '@nestjs/common';
import { ChatAgentService } from './chat-agent.service.js';
import { ChatAgentController } from './chat-agent.controller.js';
import { WorkspaceContextHydratorService } from './workspace-context-hydrator.service.js';
import { RepoModule } from '../repo/repo.module.js';
import { AiModule } from '../ai/ai.module.js';
import { DocumentsModule } from '../documents/documents.module.js';
import { SummariesModule } from '../summaries/summaries.module.js';
import { SearchModule } from '../search/search.module.js';
import { DeckFlashcardModule } from '../deck-flashcard/deck-flashcard.module.js';
import { QuizModule } from '../quiz/quiz.module.js';

@Module({
  imports: [
    RepoModule,
    AiModule,
    DocumentsModule,
    SummariesModule,
    SearchModule,
    DeckFlashcardModule,
    QuizModule,
  ],
  providers: [ChatAgentService, WorkspaceContextHydratorService],
  controllers: [ChatAgentController],
})
export class ChatAgentModule {}
