import { Test, TestingModule } from '@nestjs/testing';
import { AiService } from './ai.service.js';
import { VisionService } from './vision.service.js';

describe('VisionService', () => {
  let service: VisionService;
  let aiService: { generateText: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    aiService = {
      generateText: vi.fn(),
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

  it('extracts and trims OCR text from an image', async () => {
    aiService.generateText.mockResolvedValue({ text: '  Nội dung OCR  ' });

    await expect(
      service.extractTextFromImage(Buffer.from('image'), 'image/png'),
    ).resolves.toBe('Nội dung OCR');

    expect(aiService.generateText).toHaveBeenCalledWith([
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
    ]);
  });
});
