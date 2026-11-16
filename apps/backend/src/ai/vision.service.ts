import { Injectable, Logger } from '@nestjs/common';
import { AiService } from './ai.service.js';
import { VISION_OCR_PROMPT } from './prompts/templates/vision-ocr.prompt.js';
import type { VisionIngestionOutput } from './schemas/vision-ingestion.schema.js';

export { VISION_OCR_PROMPT };

@Injectable()
export class VisionService {
  private readonly logger = new Logger(VisionService.name);

  constructor(private readonly aiService: AiService) {}

  /**
   * Thực hiện Single-Pass Multimodal Analysis trên hình ảnh:
   * 1. Trích xuất toàn bộ chữ, bảng biểu (Markdown), công thức (LaTeX) và code.
   * 2. Mô tả chi tiết hình ảnh, biểu đồ, sơ đồ bằng Tiếng Việt.
   * 3. Phân đoạn thành các semantic chunks chuẩn Zod Schema cho Database RAG.
   */
  async analyzeAndChunkImage(
    imageBuffer: Buffer,
    mimeType: string,
    fileName?: string,
  ): Promise<VisionIngestionOutput> {
    const prepared = this.aiService.prepare('VISION_OCR', { fileName });

    try {
      const { object } = await this.aiService.generateObjectForFeature(
        'VISION_OCR',
        { fileName },
        {
          messages: [
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
          ],
        },
      );

      return object;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      const stack = error instanceof Error ? error.stack : undefined;
      this.logger.error(
        `Lỗi khi gọi Vision Ingestion LLM: ${message}`,
        stack,
      );
      throw new Error(`Vision LLM phân tích hình ảnh thất bại: ${message}`);
    }
  }

  /**
   * Ghép kết quả trích xuất văn bản và mô tả thị giác từ Vision LLM
   * thành một tài liệu Enriched Markdown thống nhất để lưu vào cột documents.raw_text.
   */
  composeEnrichedMarkdown(output: VisionIngestionOutput): string {
    const sections: string[] = [];

    const title = output.title_or_topic.trim();
    if (title) {
      sections.push(`# ${title}`);
    }

    const extracted = output.extracted_markdown.trim();
    if (extracted) {
      sections.push(`## Nội dung văn bản trích xuất\n\n${extracted}`);
    }

    const visualDesc = output.visual_description.trim();
    if (visualDesc) {
      sections.push(
        `## Mô tả chi tiết hình ảnh / biểu đồ\n\n${visualDesc}`,
      );
    }

    return sections.join('\n\n').trim();
  }

  /**
   * Giữ tương thích ngược cho các lời gọi chỉ cần lấy chuỗi Markdown từ ảnh.
   */
  async extractTextFromImage(
    imageBuffer: Buffer,
    mimeType: string,
    fileName?: string,
  ): Promise<string> {
    const output = await this.analyzeAndChunkImage(
      imageBuffer,
      mimeType,
      fileName,
    );
    return this.composeEnrichedMarkdown(output);
  }
}
