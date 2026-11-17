import { Test, TestingModule } from '@nestjs/testing';
import { vi } from 'vitest';
import { DocumentsService } from '../documents/documents.service.js';
import { ConversationsController } from './conversations.controller.js';
import { ConversationsService } from './conversations.service.js';

describe('ConversationsController', () => {
  let controller: ConversationsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ConversationsController],
      providers: [
        { provide: ConversationsService, useValue: { getConversationById: vi.fn() } },
        { provide: DocumentsService, useValue: { getDocuments: vi.fn() } },
      ],
    }).compile();

    controller = module.get<ConversationsController>(ConversationsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
