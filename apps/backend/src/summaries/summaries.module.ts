import { Module } from '@nestjs/common';
import { SummariesController } from './summaries.controller.js';
import { SummariesService } from './summaries.service.js';
import { PdfExportService } from './pdf-export.service.js';
import { RepoModule } from '../repo/repo.module.js';
import { AiModule } from '../ai/ai.module.js';
import { StorageModule } from '../storage/storage.module.js';

@Module({
    imports: [
        RepoModule,
        AiModule,
        StorageModule,
    ],
    controllers: [SummariesController],
    providers: [SummariesService, PdfExportService],
    exports: [SummariesService],
})
export class SummariesModule { }
