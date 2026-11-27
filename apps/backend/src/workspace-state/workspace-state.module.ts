import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { WorkspaceStateController } from './workspace-state.controller.js';
import { PrismaWorkspaceStateRepository } from './workspace-state.repository.js';
import { WORKSPACE_STATE_REPOSITORY } from './workspace-state.repository.port.js';
import { WorkspaceStateService } from './workspace-state.service.js';

@Module({
  imports: [PrismaModule],
  controllers: [WorkspaceStateController],
  providers: [
    WorkspaceStateService,
    {
      provide: WORKSPACE_STATE_REPOSITORY,
      useClass: PrismaWorkspaceStateRepository,
    },
  ],
  exports: [WorkspaceStateService],
})
export class WorkspaceStateModule {}
