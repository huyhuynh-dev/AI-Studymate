import { Test, TestingModule } from '@nestjs/testing';
import { AiService } from './ai.service.js';
import {
  EMBEDDING_DIMENSIONS,
  EmbeddingService,
} from './embedding.service.js';

describe('EmbeddingService', () => {
  let service: EmbeddingService;
  let aiService: { embedMany: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    aiService = {
      embedMany: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmbeddingService,
        {
          provide: AiService,
          useValue: aiService,
        },
      ],
    }).compile();

    service = module.get<EmbeddingService>(EmbeddingService);
  });

  it('embeds a batch and preserves 768 dimensions', async () => {
    const embeddings = [
      Array.from({ length: EMBEDDING_DIMENSIONS }, () => 1),
      Array.from({ length: EMBEDDING_DIMENSIONS }, () => 2),
    ];
    aiService.embedMany.mockResolvedValue({ embeddings });

    const result = await service.embedBatch(['first', 'second']);

    expect(aiService.embedMany).toHaveBeenCalledWith(['first', 'second']);
    expect(result).toHaveLength(2);
    expect(result[0].index).toBe(0);
    expect(result[0].values).toHaveLength(EMBEDDING_DIMENSIONS);
    expect(result[0].values[0]).toBeCloseTo(1 / Math.sqrt(768));
  });

  it('returns an empty result without calling the AI service for an empty batch', async () => {
    await expect(service.embedBatch([])).resolves.toEqual([]);
    expect(aiService.embedMany).not.toHaveBeenCalled();
  });

  it('rejects vectors with an unexpected dimension', async () => {
    aiService.embedMany.mockResolvedValue({
      embeddings: [Array.from({ length: 3 }, () => 1)],
    });

    await expect(service.embedSingle('text')).rejects.toThrow(
      'không khớp cấu hình (768)',
    );
  });
});
