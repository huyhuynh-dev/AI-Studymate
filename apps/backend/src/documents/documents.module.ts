import { Module } from '@nestjs/common';
import { DocumentsService } from './documents.service.js';
import { DocumentsController } from './documents.controller.js';
import { DocumentsQueueService } from './services/documents-queue.service.js';
import { DocumentsProcessorService } from './services/documents-processor.service.js';
import { DocumentsEmbedProcessorService } from './services/documents-embed-processor.service.js';
import { DoclingService } from './services/docling.service.js';
import { RetrievalService } from './services/retrieval.service.js';
import { StorageModule } from '../storage/storage.module.js';
import { RepoModule } from '../repo/repo.module.js';
import { AiModule } from '../ai/ai.module.js';
import { PrismaModule } from '../prisma/prisma.module.js';

@Module({
  imports: [StorageModule, RepoModule, AiModule, PrismaModule],
  providers: [
    DocumentsService,
    DocumentsQueueService,
    DocumentsProcessorService,
    DocumentsEmbedProcessorService,
    DoclingService,
    RetrievalService,
  ],
  controllers: [DocumentsController],
  exports: [
    DocumentsService,
    DocumentsQueueService,
    DoclingService,
    RetrievalService,
  ],
})
export class DocumentsModule {}
