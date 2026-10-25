import { Test, TestingModule } from '@nestjs/testing';
import { ChatAgentRepoService } from './chat-agent-repo.service.js';

describe('ChatAgentRepoService', () => {
  let service: ChatAgentRepoService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ChatAgentRepoService],
    }).compile();

    service = module.get<ChatAgentRepoService>(ChatAgentRepoService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
