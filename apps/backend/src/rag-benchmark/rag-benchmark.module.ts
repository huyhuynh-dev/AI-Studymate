import { Module } from '@nestjs/common';
import { DocumentsModule } from '../documents/documents.module.js';
import { RagBenchmarkController } from './rag-benchmark.controller.js';
import { RagBenchmarkService } from './rag-benchmark.service.js';

@Module({
  imports: [DocumentsModule],
  controllers: [RagBenchmarkController],
  providers: [RagBenchmarkService],
  exports: [RagBenchmarkService],
})
export class RagBenchmarkModule {}
