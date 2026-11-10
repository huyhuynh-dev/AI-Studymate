import { Test, TestingModule } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AiService } from './ai.service.js';
import { AiModelFactory } from './ai-model.factory.js';
import { PromptRegistryService } from './prompts/prompt-registry.service.js';

describe('AiService, AiModelFactory & PromptRegistryService', () => {
  let service: AiService;
  let mockFactory: {
    getModel: ReturnType<typeof vi.fn>;
    getEmbeddingModel: ReturnType<typeof vi.fn>;
    getCustomModel: ReturnType<typeof vi.fn>;
    getModelForTask: ReturnType<typeof vi.fn>;
  };
  let promptRegistry: PromptRegistryService;

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
        {
          provide: AiModelFactory,
          useValue: mockFactory,
        },
      ],
    }).compile();

    service = module.get<AiService>(AiService);
    promptRegistry = module.get<PromptRegistryService>(PromptRegistryService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
    expect(promptRegistry).toBeDefined();
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

  describe('AiService.prepare', () => {
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
});
