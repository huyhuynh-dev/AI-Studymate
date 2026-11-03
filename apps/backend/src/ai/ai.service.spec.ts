import { Test, TestingModule } from '@nestjs/testing';
import { AiService } from './ai.service.js';
import { AiModelFactory } from './ai-model.factory.js';

describe('AiService', () => {
  let service: AiService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiService,
        {
          provide: AiModelFactory,
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
