import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI } from '@google/generative-ai';

@Injectable()
export class GeminiVisionService {
    private readonly logger = new Logger(GeminiVisionService.name);
    private genAI: GoogleGenerativeAI | null = null;
    private readonly modelName = 'gemini-3.5-flash-lite';

    constructor(private readonly configService: ConfigService) {
        const apiKey = this.configService.get<string>('GEMINI_API_KEY');
        if (apiKey) {
            this.genAI = new GoogleGenerativeAI(apiKey);
            this.logger.log(`GeminiVisionService đã khởi tạo với model [${this.modelName}]`);
        } else {
            this.logger.warn('Chưa cấu hình GEMINI_API_KEY trong file môi trường (.env)');
        }
    }

    /**
     * Trích xuất văn bản từ hình ảnh sử dụng Gemini Vision API
     * @param imageBuffer Dữ liệu binary của ảnh
     * @param mimeType Định dạng MIME của ảnh (e.g. image/jpeg, image/png, image/webp)
     */
    async extractTextFromImage(imageBuffer: Buffer, mimeType: string): Promise<string> {
        if (!this.genAI) {
            const apiKey = this.configService.get<string>('GEMINI_API_KEY');
            if (!apiKey) {
                throw new Error('GEMINI_API_KEY chưa được cấu hình trong biến môi trường');
            }
            this.genAI = new GoogleGenerativeAI(apiKey);
        }

        try {
            const model = this.genAI.getGenerativeModel({ model: this.modelName });

            const base64Data = imageBuffer.toString('base64');
            const imagePart = {
                inlineData: {
                    data: base64Data,
                    mimeType: mimeType,
                },
            };

            const prompt =
                'Bạn là chuyên gia OCR văn bản chuyên nghiệp. Hãy trích xuất toàn bộ văn bản có trong hình ảnh này.\n' +
                'Yêu cầu:\n' +
                '1. Giữ nguyên cấu trúc, dấu câu, định dạng và các đoạn xuống dòng của tài liệu.\n' +
                '2. Hỗ trợ đầy đủ tiếng Việt và tiếng Anh, bao gồm cả chữ viết tay hoặc chữ in.\n' +
                '3. Tuyệt đối không thêm lời giải thích hay nhận xét, chỉ trả về chính xác nội dung văn bản được nhận dạng. Nếu ảnh không có chữ, trả về chuỗi rỗng.';

            const result = await model.generateContent([prompt, imagePart]);
            const response = await result.response;
            const text = response.text();

            return text ? text.trim() : '';
        } catch (error: any) {
            this.logger.error(`Lỗi khi gọi Gemini Vision API (${this.modelName}): ${error.message}`, error.stack);
            throw new Error(`Gemini Vision OCR thất bại: ${error.message}`);
        }
    }
}
