import { Injectable, Logger } from '@nestjs/common';
import { AiService } from './ai.service.js';
import { VISION_OCR_PROMPT } from './prompts/templates/vision-ocr.prompt.js';

export { VISION_OCR_PROMPT };

@Injectable()
export class VisionService {
  private readonly logger = new Logger(VisionService.name);

  constructor(private readonly aiService: AiService) {}

  async extractTextFromImage(
    imageBuffer: Buffer,
    mimeType: string,
  ): Promise<string> {
    const prepared = this.aiService.prepare('VISION_OCR', {});

    try {
      const { text } = await this.aiService.generateText([
        {
          role: 'user',
          content: [
            { type: 'text', text: prepared.prompt },
            {
              type: 'image',
              image: imageBuffer,
              mediaType: mimeType,
            },
          ],
        },
      ]);

      return text.trim();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      const stack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Lỗi khi gọi Vision OCR API: ${message}`, stack);
      throw new Error(`Gemini Vision OCR thất bại: ${message}`);
    }
  }
}
