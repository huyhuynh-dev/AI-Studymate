import { Test, TestingModule } from '@nestjs/testing';
import { vi } from 'vitest';
import { ConversationsRepoService } from '../repo/conversations-repo/conversations-repo.service.js';
import { ConversationsService } from './conversations.service.js';

describe('ConversationsService', () => {
  let service: ConversationsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConversationsService,
        { provide: ConversationsRepoService, useValue: { createConversation: vi.fn() } },
      ],
    }).compile();

    service = module.get<ConversationsService>(ConversationsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
