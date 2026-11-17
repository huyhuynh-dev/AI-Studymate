import { ConfigService } from '@nestjs/config';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AiModelFactory } from './ai-model.factory.js';

function createConfigMock(overrides: Record<string, string | undefined> = {}): ConfigService {
  const values: Record<string, string | undefined> = {
    GEMINI_API_KEY: 'test-gemini-key',
    PROVIDER_API_KEY: 'test-provider-key',
    PROVIDER_BASE_URL: 'http://localhost:20128/v1',
    LLAMA_SERVER_URL_EMBEDDING: 'http://127.0.0.1:8082',
    ...overrides,
  };
  return {
    get: vi.fn((key: string) => values[key]),
  } as unknown as ConfigService;
}

describe('AiModelFactory', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('throws clear error if GEMINI_API_KEY is missing', () => {
    expect(() =>
      new AiModelFactory(createConfigMock({ GEMINI_API_KEY: undefined })),
    ).toThrow('Missing Google Generative AI API Key');
  });

  it('throws when calling getModel("RERANK") instead of getRerankingModel()', () => {
    const factory = new AiModelFactory(createConfigMock());
    expect(() => factory.getModel('RERANK')).toThrow(
      'RERANK profile uses a RerankingModel; call getRerankingModel() instead.',
    );
    expect(factory.getModel('FAST')).toBeDefined();
    expect(factory.getModel('STANDARD')).toBeDefined();
    expect(factory.getModel('REASONING')).toBeDefined();
    expect(factory.getModel('VISION')).toBeDefined();
    expect(factory.getEmbeddingModel()).toBeDefined();
  });

  it('normalizes LLAMA_SERVER_URL_RERANK with trailing slashes and existing /v1 suffix without duplicating /v1', async () => {
    const fetchMock = vi.fn().mockImplementation(async () =>
      new Response(
        JSON.stringify({
          model: 'bge-reranker-v2-m3',
          results: [{ index: 0, relevance_score: -0.42 }],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );
    globalThis.fetch = fetchMock as typeof fetch;

    // 1. Default fallback when env var is missing
    const defaultFactory = new AiModelFactory(
      createConfigMock({ LLAMA_SERVER_URL_RERANK: undefined }),
    );
    const defaultModel = defaultFactory.getRerankingModel();
    if (typeof defaultModel !== 'object' || defaultModel === null) {
      throw new Error('Expected object RerankingModel');
    }
    await defaultModel.doRerank({
      query: 'SQL index',
      documents: { type: 'text', values: ['Index speeds up queries'] },
    });
    expect(fetchMock).toHaveBeenLastCalledWith(
      'http://127.0.0.1:8081/v1/rerank',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          authorization: 'Bearer local-no-key',
        }),
      }),
    );

    // 2. Trailing slashes stripped before appending /v1
    const slashFactory = new AiModelFactory(
      createConfigMock({
        LLAMA_SERVER_URL_RERANK: 'http://127.0.0.1:9090///',
        COHERE_API_KEY: 'custom-local-key',
      }),
    );
    const slashModel = slashFactory.getRerankingModel();
    if (typeof slashModel !== 'object' || slashModel === null) {
      throw new Error('Expected object RerankingModel');
    }
    await slashModel.doRerank({
      query: 'B+ Tree',
      documents: { type: 'text', values: ['Balanced tree'] },
    });
    expect(fetchMock).toHaveBeenLastCalledWith(
      'http://127.0.0.1:9090/v1/rerank',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          authorization: 'Bearer custom-local-key',
        }),
      }),
    );

    // 3. Existing /v1/ does not turn into /v1/v1/rerank
    const v1Factory = new AiModelFactory(
      createConfigMock({
        LLAMA_SERVER_URL_RERANK: 'http://127.0.0.1:8081/v1/',
      }),
    );
    const v1Model = v1Factory.getRerankingModel();
    if (typeof v1Model !== 'object' || v1Model === null) {
      throw new Error('Expected object RerankingModel');
    }
    const res = await v1Model.doRerank({
      query: 'Hash table',
      documents: { type: 'text', values: ['O(1) lookup'] },
    });
    expect(fetchMock).toHaveBeenLastCalledWith(
      'http://127.0.0.1:8081/v1/rerank',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(res.ranking).toEqual([{ index: 0, relevanceScore: -0.42 }]);
  });
});
