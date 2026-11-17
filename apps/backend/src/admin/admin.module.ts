import { Module } from '@nestjs/common';
import { AdminGuard } from '../auth/guards/admin.guard.js';
import { DocumentsModule } from '../documents/documents.module.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { RagBenchmarkModule } from '../rag-benchmark/rag-benchmark.module.js';
import { RedisModule } from '../redis/redis.module.js';
import { UsersModule } from '../users/users.module.js';
import { AdminController } from './admin.controller.js';
import { AdminRepoService } from './admin-repo.service.js';
import { AdminService } from './admin.service.js';

@Module({
  imports: [
    PrismaModule,
    RedisModule,
    UsersModule,
    DocumentsModule,
    RagBenchmarkModule,
  ],
  controllers: [AdminController],
  providers: [AdminRepoService, AdminService, AdminGuard],
  exports: [AdminService],
})
export class AdminModule {}
