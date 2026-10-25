import { Module } from '@nestjs/common';
import { ChatAgentService } from './chat-agent.service.js';
import { ChatAgentController } from './chat-agent.controller.js';
import { RepoModule } from '../repo/repo.module.js';

@Module({
  imports: [RepoModule],
  providers: [ChatAgentService],
  controllers: [ChatAgentController]
})
export class ChatAgentModule {}
