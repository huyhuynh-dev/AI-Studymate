import { Test, TestingModule } from '@nestjs/testing';
import { AiService } from './ai.service.js';
// [TẠM THỜI] Comment GeminiEmbeddingService để dùng NomicEmbeddingService
// import { GeminiEmbeddingService } from './gemini-embedding.service.js';
import { NomicEmbeddingService } from './nomic-embedding.service.js';
import { GeminiVisionService } from './gemini-vision.service.js';
import { GeminiSummaryService } from './gemini-summary.service.js';

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
        // [TẠM THỜI] Comment GeminiEmbeddingService
        // {
        //   provide: GeminiEmbeddingService,
        //   useValue: {},
        // },
        {
          provide: NomicEmbeddingService,
          useValue: {},
        },
        {
          provide: GeminiSummaryService,
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
