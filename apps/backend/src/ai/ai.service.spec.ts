import { Test, TestingModule } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AiService } from './ai.service.js';
import { AiModelFactory } from './ai-model.factory.js';
import { PromptRegistryService } from './prompts/prompt-registry.service.js';
import { ToolRegistryService } from './tools/tool-registry.service.js';
import { resolveFeatureSchema } from './schemas/index.js';

describe('AiService, AiModelFactory, SchemaRegistry & ToolRegistryService', () => {
  let service: AiService;
  let mockFactory: {
    getModel: ReturnType<typeof vi.fn>;
    getEmbeddingModel: ReturnType<typeof vi.fn>;
    getCustomModel: ReturnType<typeof vi.fn>;
    getModelForTask: ReturnType<typeof vi.fn>;
  };
  let promptRegistry: PromptRegistryService;
  let toolRegistry: ToolRegistryService;

  beforeEach(async () => {
    mockFactory = {
      getModel: vi.fn((profile) => ({ id: `model-${profile}` }) as any),
      getEmbeddingModel: vi.fn(() => ({ id: 'model-embedding' }) as any),
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
      expect(rendered.system).toContain('CỤM DANH TỪ');
      expect(rendered.prompt).toBe('Giải thích định luật II Newton');
    });

    it('renders SUMMARIZE_GENERATE prompt with mode and length instructions', () => {
      const rendered = promptRegistry.render('SUMMARIZE_GENERATE', {
        contextText: 'Nội dung bài học',
        mode: 'key_takeaways',
        length: 'short',
        scope: 'document',
      });
      expect(rendered.system).toContain('DÀN Ý CỐT LÕI');
      expect(rendered.system).toContain('ĐỘ DÀI: NGẮN GỌN');
      expect(rendered.prompt).toContain('Nội dung bài học');
    });

    it('renders QUIZ_GENERATE prompt with question types', () => {
      const rendered = promptRegistry.render('QUIZ_GENERATE', {
        context: 'Lịch sử thế giới',
        count: 5,
        types: ['single_choice'],
        difficulty: 'applied',
      });
      expect(rendered.system).toContain('Soạn tối đa 5 câu hỏi');
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
      expect(rendered.system).toContain('chuyên chấm điểm câu hỏi tự luận');
      expect(rendered.prompt).toContain('Trình bày định luật Ohm');
      expect(rendered.prompt).toContain('Đúng công thức');
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
      expect(prepared.system).toContain('CỤM DANH TỪ');
      expect(prepared.prompt).toBe('Tính toán ma trận');
    });

    it('prepares structured object context with schema', () => {
      const preparedObj = service.prepareObject('ESSAY_GRADE', {
        questionPlain: 'Câu hỏi',
        points: 5,
        criteria: ['Ý 1'],
        plainAnswer: 'Đáp án',
      });

      expect(preparedObj.model).toEqual({ id: 'model-STANDARD' });
      expect(preparedObj.schema).toBeDefined();
      expect(preparedObj.schemaName).toBe('EssayGrading');
      expect(preparedObj.system).toContain('chuyên chấm điểm câu hỏi tự luận');
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
});
