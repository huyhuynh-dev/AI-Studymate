import { Injectable, Logger } from '@nestjs/common';
import { generateText } from 'ai';
import { AiService } from './ai.service.js';

@Injectable()
export class VisionService {
  private readonly logger = new Logger(VisionService.name);

  constructor(private readonly aiService: AiService) {}

  async extractTextFromImage(
    imageBuffer: Buffer,
    mimeType: string,
  ): Promise<string> {
    const prompt =
      'Bạn là chuyên gia OCR văn bản chuyên nghiệp. Hãy trích xuất toàn bộ văn bản có trong hình ảnh này.\n' +
      'Yêu cầu:\n' +
      '1. Giữ nguyên cấu trúc, dấu câu, định dạng và các đoạn xuống dòng của tài liệu.\n' +
      '2. Hỗ trợ đầy đủ tiếng Việt và tiếng Anh, bao gồm cả chữ viết tay hoặc chữ in.\n' +
      '3. Tuyệt đối không thêm lời giải thích hay nhận xét, chỉ trả về chính xác nội dung văn bản được nhận dạng. Nếu ảnh không có chữ, trả về chuỗi rỗng.';

    try {
      const { text } = await this.aiService.generateText([
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
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
