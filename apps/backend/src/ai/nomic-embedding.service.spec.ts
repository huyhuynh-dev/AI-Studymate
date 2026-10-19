import ollama from 'ollama';

import {
  NOMIC_EMBEDDING_DIMENSIONS,
  NomicEmbeddingService,
} from './nomic-embedding.service.js';

describe('NomicEmbeddingService', () => {
  let service: NomicEmbeddingService;

  beforeEach(() => {
    service = new NomicEmbeddingService();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('embeds a batch with the Ollama model and preserves 768 dimensions', async () => {
    const embeddings = [
      Array.from({ length: NOMIC_EMBEDDING_DIMENSIONS }, () => 1),
      Array.from({ length: NOMIC_EMBEDDING_DIMENSIONS }, () => 2),
    ];
    const embed = vi.spyOn(ollama, 'embed').mockResolvedValue({ embeddings });

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
    const embed = vi.spyOn(ollama, 'embed');

    await expect(service.embedBatch([])).resolves.toEqual([]);
    expect(embed).not.toHaveBeenCalled();
  });

  it('rejects vectors with an unexpected dimension', async () => {
    vi.spyOn(ollama, 'embed').mockResolvedValue({
      embeddings: [Array.from({ length: 3 }, () => 1)],
    });

    await expect(service.embedSingle('text')).rejects.toThrow(
      'không khớp cấu hình (768)',
    );
  });
});
