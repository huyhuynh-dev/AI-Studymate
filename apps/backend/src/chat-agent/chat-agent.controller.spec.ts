import { Test, TestingModule } from '@nestjs/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ChatAgentController } from './chat-agent.controller.js';
import { ChatAgentService } from './chat-agent.service.js';

describe('ChatAgentController', () => {
  let controller: ChatAgentController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ChatAgentController],
      providers: [
        {
          provide: ChatAgentService,
          useValue: {
            handleChatStream: vi.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<ChatAgentController>(ChatAgentController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
