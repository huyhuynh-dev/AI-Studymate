import { Module } from '@nestjs/common';
import { DocumentsService } from './documents.service.js';
import { DocumentsController } from './documents.controller.js';
import { DocumentsQueueService } from './documents-queue.service.js';
import { DocumentsProcessorService } from './documents-processor.service.js';
import { StorageModule } from '../storage/storage.module.js';
import { RepoModule } from '../repo/repo.module.js';

@Module({
  imports: [StorageModule, RepoModule],
  providers: [
    DocumentsService,
    DocumentsQueueService,
    DocumentsProcessorService,
  ],
  controllers: [DocumentsController],
  exports: [DocumentsService, DocumentsQueueService],
})
export class DocumentsModule { }
