import { Module } from '@nestjs/common';
import { DocumentsService } from './documents.service.js';
import { DocumentsController } from './documents.controller.js';
import { DocumentsQueueService } from './services/documents-queue.service.js';
import { DocumentIngestionProcessor } from './services/document-ingestion.processor.js';
import { DoclingService } from './services/docling.service.js';
import { RetrievalService } from './services/retrieval.service.js';
import { GoogleDocsImportService } from './services/google-docs-import.service.js';
import { SuperDocRuntimeService } from './services/superdoc-runtime.service.js';
import { SuperDocCollaborationService } from './collaboration/superdoc-collaboration.service.js';
import { StorageModule } from '../storage/storage.module.js';
import { RepoModule } from '../repo/repo.module.js';
import { AiModule } from '../ai/ai.module.js';
import { PrismaModule } from '../prisma/prisma.module.js';

@Module({
  imports: [StorageModule, RepoModule, AiModule, PrismaModule],
  providers: [
    DocumentsService,
    DocumentsQueueService,
    DocumentIngestionProcessor,
    DoclingService,
    RetrievalService,
    GoogleDocsImportService,
    SuperDocRuntimeService,
    SuperDocCollaborationService,
  ],
  controllers: [DocumentsController],
  exports: [
    DocumentsService,
    DocumentsQueueService,
    DoclingService,
    RetrievalService,
    SuperDocRuntimeService,
    SuperDocCollaborationService,
  ],
})
export class DocumentsModule {}
