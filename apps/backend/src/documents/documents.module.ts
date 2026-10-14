import { Module } from '@nestjs/common';
import { DocumentsService } from './documents.service.js';
import { DocumentsController } from './documents.controller.js';
import { DocumentsQueueService } from './services/documents-queue.service.js';
import { DocumentsProcessorService } from './services/documents-processor.service.js';
import { DocumentsEmbedProcessorService } from './services/documents-embed-processor.service.js';
import { GeminiVisionService } from './services/gemini-vision.service.js';
import { GeminiEmbeddingService } from './services/gemini-embedding.service.js';
import { DoclingService } from './services/docling.service.js';
import { StorageModule } from '../storage/storage.module.js';
import { RepoModule } from '../repo/repo.module.js';

@Module({
  imports: [StorageModule, RepoModule],
  providers: [
    DocumentsService,
    DocumentsQueueService,
    DocumentsProcessorService,
    DocumentsEmbedProcessorService,
    GeminiVisionService,
    GeminiEmbeddingService,
    DoclingService,
  ],
  controllers: [DocumentsController],
  exports: [
    DocumentsService,
    DocumentsQueueService,
    GeminiVisionService,
    GeminiEmbeddingService,
    DoclingService,
  ],
})
export class DocumentsModule { }
