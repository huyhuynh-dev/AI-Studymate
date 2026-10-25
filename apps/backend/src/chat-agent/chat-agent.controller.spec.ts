import { Test, TestingModule } from '@nestjs/testing';
import { ChatAgentController } from './chat-agent.controller.js';

describe('ChatAgentController', () => {
  let controller: ChatAgentController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ChatAgentController],
    }).compile();

    controller = module.get<ChatAgentController>(ChatAgentController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
