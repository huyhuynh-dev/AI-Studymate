import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AiService } from './ai.service.js';
import { AiModelFactory } from './ai-model.factory.js';
import { PromptRegistryService } from './prompts/prompt-registry.service.js';
import { ToolRegistryService } from './tools/tool-registry.service.js';
import { convertToModelMessages } from 'ai';
import { ChatAgentAiService } from './chat-agent-ai.service.js';
import { resolveFeatureSchema } from './schemas/index.js';

describe('AiService, AiModelFactory, SchemaRegistry & ToolRegistryService', () => {
  let service: AiService;
  let mockRerankingModel: {
    specificationVersion: 'v3';
    provider: string;
    modelId: string;
    doRerank: ReturnType<typeof vi.fn>;
  };
  let mockFactory: {
    getModel: ReturnType<typeof vi.fn>;
    getEmbeddingModel: ReturnType<typeof vi.fn>;
    getRerankingModel: ReturnType<typeof vi.fn>;
    getCustomModel: ReturnType<typeof vi.fn>;
    getModelForTask: ReturnType<typeof vi.fn>;
  };
  let promptRegistry: PromptRegistryService;
  let toolRegistry: ToolRegistryService;

  beforeEach(async () => {
    mockRerankingModel = {
      specificationVersion: 'v3',
      provider: 'cohere.reranking',
      modelId: 'bge-reranker-v2-m3',
      doRerank: vi.fn().mockResolvedValue({
        ranking: [
          { index: 1, relevanceScore: -1.8969 },
          { index: 0, relevanceScore: -11.0202 },
        ],
        warnings: [],
      }),
    };

    mockFactory = {
      getModel: vi.fn((profile) => ({ id: `model-${profile}` }) as any),
      getEmbeddingModel: vi.fn(() => ({ id: 'model-embedding' }) as any),
      getRerankingModel: vi.fn(() => mockRerankingModel as any),
      getCustomModel: vi.fn((name) => ({ id: `custom-${name}` }) as any),
      getModelForTask: vi.fn((task) => ({ id: `task-${task}` }) as any),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiService,
        PromptRegistryService,
        ToolRegistryService,
        {
          provide: AiModelFactory,
          useValue: mockFactory,
        },
      ],
    }).compile();

    service = module.get<AiService>(AiService);
    promptRegistry = module.get<PromptRegistryService>(PromptRegistryService);
    toolRegistry = module.get<ToolRegistryService>(ToolRegistryService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
    expect(promptRegistry).toBeDefined();
    expect(toolRegistry).toBeDefined();
  });

  describe('PromptRegistryService', () => {
    it('renders AUTO_HEADER prompt correctly', () => {
      const rendered = promptRegistry.render('AUTO_HEADER', {
        firstMessageSnippet: 'Giải thích định luật II Newton',
      });
      expect(rendered.system).toContain('NOUN PHRASE');
      expect(rendered.prompt).toBe('Giải thích định luật II Newton');
    });

    it('renders SUMMARIZE_GENERATE prompt with mode and length instructions', () => {
      const rendered = promptRegistry.render('SUMMARIZE_GENERATE', {
        contextText: 'Nội dung bài học',
        mode: 'key_takeaways',
        length: 'short',
        scope: 'document',
      });
      expect(rendered.system).toContain('mode="key_takeaways"');
      expect(rendered.system).toContain('<length target="short">');
      expect(rendered.prompt).toContain('Nội dung bài học');
    });

    it('renders QUIZ_GENERATE prompt with question types', () => {
      const rendered = promptRegistry.render('QUIZ_GENERATE', {
        context: 'Lịch sử thế giới',
        count: 5,
        types: ['single_choice'],
        difficulty: 'applied',
      });
      expect(rendered.system).toContain('Generate up to 5 questions');
      expect(rendered.system).toContain('single_choice:');
      expect(rendered.prompt).toContain('Lịch sử thế giới');
    });

    it('renders ESSAY_GRADE prompt with criteria and answer', () => {
      const rendered = promptRegistry.render('ESSAY_GRADE', {
        questionPlain: 'Trình bày định luật Ohm',
        points: 2,
        samplePlain: 'I = U / R',
        criteria: ['Đúng công thức', 'Nêu rõ đơn vị'],
        plainAnswer: 'I = U / R',
      });
      expect(rendered.system).toContain('academic grading assistant');
      expect(rendered.prompt).toContain('Trình bày định luật Ohm');
      expect(rendered.prompt).toContain('Đúng công thức');
    });

    it('renders QUERY_DECOMPOSE prompt with query and initial keywords', () => {
      const rendered = promptRegistry.render('QUERY_DECOMPOSE', {
        semanticQuery: 'So sánh thuật toán Round Robin và Banker',
        keywords: ['Round Robin', 'Banker'],
      });
      expect(rendered.system).toContain('Retrieval Query Planner');
      expect(rendered.prompt).toContain('<user_query>');
      expect(rendered.prompt).toContain('So sánh thuật toán Round Robin và Banker');
      expect(rendered.prompt).toContain('Round Robin, Banker');
    });
  });

  describe('SchemaRegistry (resolveFeatureSchema)', () => {
    it('resolves static schemas correctly', () => {
      const summaryConfig = resolveFeatureSchema('SUMMARIZE_GENERATE', {
        contextText: 'abc',
        mode: 'study_guide',
        length: 'standard',
        scope: 'document',
      });
      expect(summaryConfig.schemaName).toBe('SummaryGeneration');
      expect(summaryConfig.schema).toBeDefined();

      const essayConfig = resolveFeatureSchema('ESSAY_GRADE', {
        questionPlain: 'q',
        points: 1,
        criteria: [],
        plainAnswer: 'a',
      });
      expect(essayConfig.schemaName).toBe('EssayGrading');
      expect(essayConfig.schema).toBeDefined();

      const followUpConfig = resolveFeatureSchema('FOLLOW_UP_SUGGESTIONS', {
        lastAssistantResponse: 'resp',
      });
      expect(followUpConfig.schemaName).toBe('FollowUpSuggestions');
      expect(followUpConfig.schema).toBeDefined();

      const decomposeConfig = resolveFeatureSchema('QUERY_DECOMPOSE', {
        semanticQuery: 'test',
        keywords: [],
      });
      expect(decomposeConfig.schemaName).toBe('QueryDecomposition');
      expect(decomposeConfig.schema).toBeDefined();
    });

    it('resolves dynamic schema factory based on payload', () => {
      const quizConfig = resolveFeatureSchema('QUIZ_GENERATE', {
        context: 'doc',
        count: 3,
        types: ['single_choice', 'true_false'],
        difficulty: 'basic',
      });
      expect(quizConfig.schemaName).toBe('QuizGeneration');
      expect(quizConfig.schema).toBeDefined();

      const flashcardNewConfig = resolveFeatureSchema('FLASHCARD_GENERATE', {
        req: {
          conversationId: '00000000-0000-0000-0000-000000000000',
          target: { kind: 'new' },
          documentIds: 'all',
          count: 5,
          types: ['basic'],
          instructions: '',
        },
        docs: [],
        existingFronts: [],
      });
      expect(flashcardNewConfig.schemaName).toBe('FlashcardNewDeckGeneration');

      const flashcardMoreConfig = resolveFeatureSchema('FLASHCARD_GENERATE', {
        req: {
          conversationId: '00000000-0000-0000-0000-000000000000',
          target: {
            kind: 'deck',
            deckId: '00000000-0000-0000-0000-000000000000',
          },
          documentIds: 'all',
          count: 5,
          types: ['basic'],
          instructions: '',
        },
        docs: [],
        existingFronts: [],
      });
      expect(flashcardMoreConfig.schemaName).toBe('FlashcardMoreCardsGeneration');
    });
  });

  describe('AiService.prepare & prepareObject', () => {
    it('prepares context combining model profile, temperature, and rendered prompt', () => {
      const prepared = service.prepare('AUTO_HEADER', {
        firstMessageSnippet: 'Tính toán ma trận',
      });

      expect(mockFactory.getModel).toHaveBeenCalledWith('FAST');
      expect(prepared.model).toEqual({ id: 'model-FAST' });
      expect(prepared.temperature).toBe(0.1);
      expect(prepared.system).toContain('NOUN PHRASE');
      expect(prepared.prompt).toBe('Tính toán ma trận');
    });

    it('prepares structured object context with schema', () => {
      const preparedObj = service.prepareObject('ESSAY_GRADE', {
        questionPlain: 'Câu hỏi',
        points: 5,
        criteria: ['Ý 1'],
        plainAnswer: 'Đáp án',
      });

      expect(preparedObj.model).toEqual({ id: 'model-REASONING' });
      expect(preparedObj.schema).toBeDefined();
      expect(preparedObj.schemaName).toBe('EssayGrading');
      expect(preparedObj.system).toContain('academic grading assistant');
    });

    it('supports custom model override', () => {
      const prepared = service.prepare(
        'SUMMARIZE_GENERATE',
        {
          contextText: 'Tài liệu A',
          mode: 'study_guide',
          length: 'standard',
          scope: 'document',
        },
        'cx/gpt-custom-model',
      );

      expect(mockFactory.getCustomModel).toHaveBeenCalledWith('cx/gpt-custom-model');
      expect(prepared.model).toEqual({ id: 'custom-cx/gpt-custom-model' });
    });

    it('calls Vercel AI SDK rerank() via AiService.rerankDocuments', async () => {
      const result = await service.rerankDocuments({
        query: 'Cách tối ưu hóa truy vấn SQL?',
        documents: [
          'Hôm nay trời nắng đẹp.',
          'Sử dụng Index và tránh SELECT * giúp tăng tốc độ truy vấn.',
        ],
        topN: 2,
      });

      expect(mockFactory.getRerankingModel).toHaveBeenCalledTimes(1);
      expect(mockRerankingModel.doRerank).toHaveBeenCalledWith(
        expect.objectContaining({
          query: 'Cách tối ưu hóa truy vấn SQL?',
          topN: 2,
        }),
      );
      expect(result.ranking).toEqual([
        {
          originalIndex: 1,
          score: -1.8969,
          document: 'Sử dụng Index và tránh SELECT * giúp tăng tốc độ truy vấn.',
        },
        {
          originalIndex: 0,
          score: -11.0202,
          document: 'Hôm nay trời nắng đẹp.',
        },
      ]);
    });
  });

  describe('AiModelFactory Rerank Integration', () => {
    const originalFetch = globalThis.fetch;

    afterEach(() => {
      globalThis.fetch = originalFetch;
    });

    it('creates bge-reranker-v2-m3 model pointing to LLAMA_SERVER_URL_RERANK and adapts llama-server JSON without meta', async () => {
      const fetchMock = vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            model: 'bge-reranker-v2-m3',
            object: 'list',
            usage: { prompt_tokens: 78, total_tokens: 78 },
            results: [
              { index: 1, relevance_score: -1.8969 },
              { index: 0, relevance_score: -11.0202 },
            ],
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          },
        ),
      );
      globalThis.fetch = fetchMock as typeof fetch;

      const configMock = {
        get: vi.fn((key: string) => {
          if (key === 'GEMINI_API_KEY') return 'test-gemini-key';
          if (key === 'LLAMA_SERVER_URL_RERANK') return 'http://127.0.0.1:8081';
          return undefined;
        }),
      } as unknown as ConfigService;

      const factory = new AiModelFactory(configMock);
      const rerankModel = factory.getRerankingModel();
      if (typeof rerankModel !== 'object' || rerankModel === null) {
        throw new Error('Expected object RerankingModel');
      }
      expect(rerankModel.modelId).toBe('bge-reranker-v2-m3');
      expect(() => factory.getModel('RERANK')).toThrow();

      const res = await rerankModel.doRerank({
        query: 'Tối ưu SQL?',
        documents: { type: 'text', values: ['Trời nắng', 'Dùng Index'] },
        topN: 2,
      });

      expect(fetchMock).toHaveBeenCalledWith(
        'http://127.0.0.1:8081/v1/rerank',
        expect.objectContaining({ method: 'POST' }),
      );
      expect(res.ranking).toEqual([
        { index: 1, relevanceScore: -1.8969 },
        { index: 0, relevanceScore: -11.0202 },
      ]);
    });
  });

  describe('ToolRegistryService', () => {
    it('creates validation tools reusing tool schemas', () => {
      const tools = toolRegistry.getChatValidationTools();
      expect(tools.askUserQuestion).toBeDefined();
      expect(tools.searchDocumentChunks).toBeDefined();
      expect(tools.getDocumentsFullContent).toBeDefined();
      expect(tools.getConversationDocumentsMetadata).toBeDefined();
      expect(tools.createDocumentSummary).toBeDefined();
    });

    it('creates session toolset and tracks executions', async () => {
      const mockSearchCallback = vi.fn().mockResolvedValue([
        {
          id: 'chunk-1',
          documentId: 'doc-1',
          fileName: 'bai1.pdf',
          chunkIndex: 0,
          pageNumbers: [1],
          content: 'Nội dung chunk 1',
          rrfScore: 0.95,
        },
      ]);

      const { tools, tracker } = toolRegistry.createChatSessionToolset({
        onSearchDocumentChunks: mockSearchCallback,
      });

      expect(tools.askUserQuestion).toBeDefined();
      expect(tools.searchDocumentChunks).toBeDefined();

      const searchResult = await tools.searchDocumentChunks.execute(
        { semanticQuery: 'tìm kiếm', keywords: ['từ khóa'] },
        { toolCallId: 'call-1' } as any,
      );

      expect(searchResult.totalChunks).toBe(1);
      expect(tracker.getCollectedChunkIds().has('chunk-1')).toBe(true);

      const lightweight = tracker.getLightweightOutput('call-1');
      expect(lightweight).toBeDefined();
      expect(lightweight?.totalChunks).toBe(1);

      const parts = toolRegistry.extractAssistantUIParts(
        [
          {
            role: 'assistant',
            content: [
              {
                type: 'tool-call',
                toolName: 'searchDocumentChunks',
                toolCallId: 'call-1',
                input: { semanticQuery: 'tìm kiếm' },
              },
            ],
          },
        ],
        tracker,
      );

      expect(parts).toHaveLength(1);
      expect(parts[0].type).toBe('tool-searchDocumentChunks');
      expect(parts[0].output).toEqual(lightweight);
    });
  });

  describe('ChatAgentAiService.sanitizePendingToolCalls', () => {
    it('reconciles unanswered askUserQuestion tool calls when followed by a newer user message', async () => {
      const chatAgentAi = new ChatAgentAiService(service, toolRegistry);
      const { tools } = toolRegistry.createChatSessionToolset();

      const uiMessages: any[] = [
        {
          id: 'u1',
          role: 'user',
          parts: [{ type: 'text', text: 'Hãy tóm tắt tài liệu' }],
        },
        {
          id: 'a1',
          role: 'assistant',
          parts: [
            {
              type: 'tool-askUserQuestion',
              toolCallId: 'call_pending_1',
              state: 'input-available',
              input: {
                questions: [
                  {
                    id: 'target',
                    question: 'Chọn tài liệu?',
                    options: ['Doc A', 'Doc B'],
                  },
                ],
              },
            },
          ],
        },
        {
          id: 'u2',
          role: 'user',
          parts: [{ type: 'text', text: 'Bỏ qua widget, giải thích giúp mình' }],
        },
      ];

      const sanitized = chatAgentAi.sanitizePendingToolCalls(uiMessages);
      const pendingPart = (sanitized[1].parts as any[])[0];
      expect(pendingPart.state).toBe('output-available');
      expect(pendingPart.output?.skipped).toBe(true);

      const modelMessages = await convertToModelMessages(sanitized, { tools });
      expect(modelMessages.some((m) => m.role === 'tool')).toBe(true);
    });
  });
});
