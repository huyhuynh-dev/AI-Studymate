import { Module } from '@nestjs/common';
import { UsersRepoService } from './users-repo/users-repo.service.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { SubjectsRepoService } from './subjects-repo/subjects-repo.service.js';
import { ConversationsRepoService } from './conversations-repo/conversations-repo.service.js';
import { DocumentsRepoService } from './documents-repo/documents-repo.service.js';

@Module({
  imports: [PrismaModule],
  providers: [
    UsersRepoService,
    SubjectsRepoService,
    ConversationsRepoService,
    DocumentsRepoService,
  ],
  exports: [
    UsersRepoService,
    SubjectsRepoService,
    ConversationsRepoService,
    DocumentsRepoService,
  ],
})
export class RepoModule { }
