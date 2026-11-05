import { Module } from '@nestjs/common';
import { UsersRepoService } from './users-repo/users-repo.service.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { SubjectsRepoService } from './subjects-repo/subjects-repo.service.js';
import { ConversationsRepoService } from './conversations-repo/conversations-repo.service.js';
import { DocumentsRepoService } from './documents-repo/documents-repo.service.js';
import { DocumentChunksRepoService } from './document-chunks-repo/document-chunks-repo.service.js';
import { SummariesRepoService } from './summaries-repo/summaries-repo.service.js';
import { ChatAgentRepoService } from './chat-agent-repo/chat-agent-repo.service.js';

@Module({
  imports: [PrismaModule],
  providers: [
    UsersRepoService,
    SubjectsRepoService,
    ConversationsRepoService,
    DocumentsRepoService,
    DocumentChunksRepoService,
    SummariesRepoService,
    ChatAgentRepoService,
  ],
  exports: [
    UsersRepoService,
    SubjectsRepoService,
    ConversationsRepoService,
    DocumentsRepoService,
    DocumentChunksRepoService,
    SummariesRepoService,
    ChatAgentRepoService,
  ],
})
export class RepoModule { }
