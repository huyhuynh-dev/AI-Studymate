import { ConfigService } from '@nestjs/config';
import { Ollama } from 'ollama';

import {
  NOMIC_EMBEDDING_DIMENSIONS,
  NomicEmbeddingService,
} from './nomic-embedding.service.js';

describe('NomicEmbeddingService', () => {
  let service: NomicEmbeddingService;

  beforeEach(() => {
    const configService = {
      get: vi.fn().mockReturnValue('http://127.0.0.1:11434'),
    } as unknown as ConfigService;

    service = new NomicEmbeddingService(configService);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('embeds a batch with the Ollama model and preserves 768 dimensions', async () => {
    const embeddings = [
      Array.from({ length: NOMIC_EMBEDDING_DIMENSIONS }, () => 1),
      Array.from({ length: NOMIC_EMBEDDING_DIMENSIONS }, () => 2),
    ];
    const embed = vi
      .spyOn(Ollama.prototype, 'embed')
      .mockResolvedValue({ embeddings });

    const result = await service.embedBatch(['first', 'second']);

    expect(embed).toHaveBeenCalledWith({
      model: 'nomic-embed-text-v2-moe',
      input: ['first', 'second'],
    });
    expect(result).toHaveLength(2);
    expect(result[0].index).toBe(0);
    expect(result[0].values).toHaveLength(NOMIC_EMBEDDING_DIMENSIONS);
    expect(result[0].values[0]).toBeCloseTo(1 / Math.sqrt(768));
  });

  it('returns an empty result without calling Ollama for an empty batch', async () => {
    const embed = vi.spyOn(Ollama.prototype, 'embed');

    await expect(service.embedBatch([])).resolves.toEqual([]);
    expect(embed).not.toHaveBeenCalled();
  });

  it('rejects vectors with an unexpected dimension', async () => {
    vi.spyOn(Ollama.prototype, 'embed').mockResolvedValue({
      embeddings: [Array.from({ length: 3 }, () => 1)],
    });

    await expect(service.embedSingle('text')).rejects.toThrow(
      'không khớp cấu hình (768)',
    );
  });
});
