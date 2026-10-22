import { Test, TestingModule } from '@nestjs/testing';
import { AiService } from './ai.service.js';
import { GeminiSummaryService } from './gemini-summary.service.js';
import { BlocknoteAiService } from './blocknote-ai.service.js';

describe('AiService', () => {
  let service: AiService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiService,
        {
          provide: GeminiSummaryService,
          useValue: {},
        },
        {
          provide: BlocknoteAiService,
          useValue: {},
        },
      ],
    }).compile();

    service = module.get<AiService>(AiService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
