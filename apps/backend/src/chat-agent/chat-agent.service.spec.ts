import { Test, TestingModule } from '@nestjs/testing';
import { ChatAgentService } from './chat-agent.service.js';

describe('ChatAgentService', () => {
  let service: ChatAgentService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ChatAgentService],
    }).compile();

    service = module.get<ChatAgentService>(ChatAgentService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
