import { Module } from '@nestjs/common';
import { ChatAgentService } from './chat-agent.service.js';
import { ChatAgentController } from './chat-agent.controller.js';
import { RepoModule } from '../repo/repo.module.js';
import { AiModule } from '../ai/ai.module.js';
import { DocumentsModule } from '../documents/documents.module.js';

@Module({
  imports: [RepoModule, AiModule, DocumentsModule],
  providers: [ChatAgentService],
  controllers: [ChatAgentController],
})
export class ChatAgentModule {}
