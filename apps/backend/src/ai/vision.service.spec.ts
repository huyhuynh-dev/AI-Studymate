import { Test, TestingModule } from '@nestjs/testing';
import { AiService } from './ai.service.js';
import { VisionService } from './vision.service.js';
import type { VisionIngestionOutput } from './schemas/vision-ingestion.schema.js';

describe('VisionService', () => {
  let service: VisionService;
  let aiService: {
    prepare: ReturnType<typeof vi.fn>;
    generateObjectForFeature: ReturnType<typeof vi.fn>;
  };

  const mockVisionOutput: VisionIngestionOutput = {
    image_category: 'mixed',
    title_or_topic: 'Đề kiểm tra Giải tích Chương 1',
    extracted_markdown: '## Câu 1\nTính giới hạn $$\\lim_{x \\to 0} \\frac{\\sin x}{x}$$',
    visual_description: 'Đồ thị hàm số bậc 3 cắt trục tung tại (0, 2).',
    contains_table: false,
    contains_formula_or_code: true,
    chunks: [
      {
        content:
          '# Đề kiểm tra Giải tích Chương 1 > ## Câu 1\nTính giới hạn $$\\lim_{x \\to 0} \\frac{\\sin x}{x}$$\nĐồ thị hàm số bậc 3 cắt trục tung tại (0, 2).',
        raw_content:
          'Tính giới hạn $$\\lim_{x \\to 0} \\frac{\\sin x}{x}$$\nĐồ thị hàm số bậc 3 cắt trục tung tại (0, 2).',
        headings: ['Đề kiểm tra Giải tích Chương 1', 'Câu 1'],
        chunk_type: 'mixed',
        has_table: false,
        has_image: true,
      },
    ],
  };

  beforeEach(async () => {
    aiService = {
      prepare: vi.fn().mockReturnValue({ prompt: 'mocked-vision-prompt' }),
      generateObjectForFeature: vi
        .fn()
        .mockResolvedValue({ object: mockVisionOutput }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VisionService,
        {
          provide: AiService,
          useValue: aiService,
        },
      ],
    }).compile();

    service = module.get<VisionService>(VisionService);
  });

  it('analyzes and chunks an image in a single pass via generateObjectForFeature', async () => {
    const result = await service.analyzeAndChunkImage(
      Buffer.from('image-bytes'),
      'image/png',
      'exam.png',
    );

    expect(result).toEqual(mockVisionOutput);
    expect(aiService.prepare).toHaveBeenCalledWith('VISION_OCR', {
      fileName: 'exam.png',
    });
    expect(aiService.generateObjectForFeature).toHaveBeenCalledWith(
      'VISION_OCR',
      { fileName: 'exam.png' },
      expect.objectContaining({
        messages: [
          expect.objectContaining({
            role: 'user',
            content: expect.arrayContaining([
              expect.objectContaining({ type: 'text' }),
              expect.objectContaining({
                type: 'image',
                mediaType: 'image/png',
              }),
            ]),
          }),
        ],
      }),
    );
  });

  it('composes enriched markdown from vision output', async () => {
    const text = await service.extractTextFromImage(
      Buffer.from('image-bytes'),
      'image/png',
      'exam.png',
    );

    expect(text).toContain('# Đề kiểm tra Giải tích Chương 1');
    expect(text).toContain('## Nội dung văn bản trích xuất');
    expect(text).toContain('## Mô tả chi tiết hình ảnh / biểu đồ');
  });
});
