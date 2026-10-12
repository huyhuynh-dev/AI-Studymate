import { Module } from '@nestjs/common';
import { ConversationsController } from './conversations.controller.js';
import { ConversationsService } from './conversations.service.js';
import { RepoModule } from '../repo/repo.module.js';
import { DocumentsModule } from '../documents/documents.module.js';

@Module({
  imports: [RepoModule, DocumentsModule],
  controllers: [ConversationsController],
  providers: [ConversationsService],
  exports: [ConversationsService],
})
export class ConversationsModule { }
