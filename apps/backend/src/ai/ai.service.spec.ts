import { Test, TestingModule } from '@nestjs/testing';
import { AiService } from './ai.service.js';
import { GeminiEmbeddingService } from './gemini-embedding.service.js';
import { GeminiVisionService } from './gemini-vision.service.js';

describe('AiService', () => {
  let service: AiService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiService,
        {
          provide: GeminiVisionService,
          useValue: {},
        },
        {
          provide: GeminiEmbeddingService,
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
