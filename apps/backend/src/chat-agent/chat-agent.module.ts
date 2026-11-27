import { Module } from '@nestjs/common';
import { ChatAgentService } from './chat-agent.service.js';
import { ChatAgentController } from './chat-agent.controller.js';
import { WorkspaceContextHydratorService } from './workspace-context-hydrator.service.js';
import { WorkspaceL2ReadService } from './workspace-l2-read.service.js';
import { AgentActionAuditService } from './agent-action-audit.service.js';
import { WorkspaceMutationService } from './workspace-mutation.service.js';
import { AgentJobsQueueService } from './jobs/agent-jobs-queue.service.js';
import { AgentJobsProcessor } from './jobs/agent-jobs.processor.js';
import { AgentJobsController } from './jobs/agent-jobs.controller.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { RepoModule } from '../repo/repo.module.js';
import { AiModule } from '../ai/ai.module.js';
import { DocumentsModule } from '../documents/documents.module.js';
import { SummariesModule } from '../summaries/summaries.module.js';
import { SearchModule } from '../search/search.module.js';
import { DeckFlashcardModule } from '../deck-flashcard/deck-flashcard.module.js';
import { QuizModule } from '../quiz/quiz.module.js';
import { UsersModule } from '../users/users.module.js';

@Module({
  imports: [
    PrismaModule,
    RepoModule,
    AiModule,
    DocumentsModule,
    SummariesModule,
    SearchModule,
    DeckFlashcardModule,
    QuizModule,
    UsersModule,
  ],
  providers: [
    ChatAgentService,
    WorkspaceContextHydratorService,
    WorkspaceL2ReadService,
    AgentActionAuditService,
    WorkspaceMutationService,
    AgentJobsQueueService,
    AgentJobsProcessor,
  ],
  controllers: [ChatAgentController, AgentJobsController],
  exports: [AgentActionAuditService, AgentJobsQueueService],
})
export class ChatAgentModule {}
