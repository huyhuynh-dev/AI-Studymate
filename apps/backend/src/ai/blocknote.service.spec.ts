import { Test, TestingModule } from '@nestjs/testing';
import { AiService } from './ai.service.js';
import { BlocknoteService } from './blocknote.service.js';

describe('BlocknoteService', () => {
  let service: BlocknoteService;
  let aiService: { streamText: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    aiService = {
      streamText: vi.fn().mockReturnValue('stream'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BlocknoteService,
        {
          provide: AiService,
          useValue: aiService,
        },
      ],
    }).compile();

    service = module.get<BlocknoteService>(BlocknoteService);
  });

  it('prepares document messages and delegates the required tool stream', async () => {
    const tools = {};
    const messages = [
      {
        id: 'message-1',
        role: 'user',
        parts: [{ type: 'text', text: 'Make this a heading' }],
      },
    ] as never;

    const result = await service.executeAiActions(messages, tools);

    expect(result).toBe('stream');
    expect(aiService.streamText).toHaveBeenCalledWith(
      expect.objectContaining({
        system: expect.any(String),
        messages: expect.any(Array),
        tools: expect.any(Object),
        toolChoice: 'required',
      }),
    );
  });
});
