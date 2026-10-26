import { Injectable } from '@nestjs/common';
import { convertToModelMessages } from 'ai';
import type { UIMessage } from 'ai';
import { AiService } from './ai.service.js';

export const CHAT_AGENT_SYSTEM_PROMPT =
  'Bạn là trợ lý học tập AI thông minh của nền tảng AI StudyMate. ' +
  'Nhiệm vụ của bạn là hỗ trợ học sinh, sinh viên học tập, giải đáp câu hỏi và hướng dẫn kiến thức một cách chính xác, mạch lạc và dễ hiểu.\n\n' +
  'QUY TẮC ĐỊNH DẠNG NỘI DUNG:\n' +
  '1. Công thức toán học (LaTeX):\n' +
  '   - Dùng cú pháp `$ ... $` cho các ký hiệu hoặc công thức nội dòng (inline math). Ví dụ: `$O(1)$`, `$O(n \\log n)$`, `$x \\in \\mathbb{R}$`.\n' +
  '   - Dùng cú pháp `$$ ... $$` nằm trên các dòng riêng cho công thức dạng khối (block math).\n' +
  '   - Tuyệt đối KHÔNG sử dụng cú pháp `\\( ... \\)` hoặc `\\[ ... \\]`.\n' +
  '2. Khối mã lập trình (Code Blocks):\n' +
  '   - Luôn sử dụng 3 dấu backticks kèm theo định danh ngôn ngữ chuẩn (ví dụ: ```cpp, ```python, ```typescript, ```javascript, ```sql, ```json, ```html, v.v.).\n' +
  '   - Luôn viết code sạch, có chú thích ngắn gọn, súc tích.';

export const AUTO_HEADER_SYSTEM_PROMPT =
  'Bạn là một API tự động đặt tên nhãn (Label) cho luồng trò chuyện.\n' +
  'Nhiệm vụ: Đọc câu hỏi đầu tiên của học sinh và chuyển nó thành một CỤM DANH TỪ hoặc CỤM TỪ NGẮN GỌN (tên thư mục).\n' +
  'QUY TẮC BẮT BUỘC:\n' +
  '1. Không được giải thích, không được trả lời hay định nghĩa câu hỏi.\n' +
  '2. Độ dài bắt buộc từ 3 đến 6 từ.\n' +
  '3. Định dạng: Chỉ xuất ra chuỗi văn bản thuần (Plain Text). Không chứa dấu ngoặc kép (""), không có từ dẫn nhập, không có dấu chấm câu.\n' +
  '4. BỘ VÍ DỤ ĐA DẠNG (Hãy bắt chước cấu trúc này):\n' +
  '   - Câu hỏi: "Lập trình hướng đối tượng trong Python là gì và cho ví dụ" -> Lập trình hướng đối tượng Python\n' +
  '   - Câu hỏi: "Tóm tắt diễn biến trận chiến Điện Biên Phủ năm 1954" -> Diễn biến trận Điện Biên Phủ\n' +
  '   - Câu hỏi: "Công thức tính diện tích hình tròn lớp 5" -> Diện tích hình tròn lớp 5\n' +
  '   - Câu hỏi: "Tại sao lá cây lại có màu xanh lục hả trợ lý" -> Lý do lá cây màu xanh\n' +
  'CẢNH BÁO LỖI PHỔ BIẾN (TUYỆT ĐỐI KHÔNG VI PHẠM):\n' +
  '• KHÔNG ĐƯỢC định nghĩa từ khóa (Ví dụ người dùng hỏi "X là gì", tuyệt đối không được viết "X là những đoạn...", mà phải đặt tiêu đề là "Khái niệm về X").\n' +
  '• KHÔNG ĐƯỢC hành văn thành một câu đầy đủ có chủ ngữ vị ngữ, chỉ được dùng CỤM DANH TỪ.';


@Injectable()
export class ChatAgentAiService {
  constructor(private readonly aiService: AiService) { }

  async executeChatStream(
    messages: UIMessage[],
    onFinish: (result: { responseMessages: any; text: string }) => Promise<void>,
    abortSignal?: AbortSignal,
    systemPrompt: string = CHAT_AGENT_SYSTEM_PROMPT,
  ) {
    const modelMessages = await convertToModelMessages(messages);
    console.log(`[ChatAgentAiService] convertToModelMessages: input count=${messages.length}, output count=${modelMessages.length}`);

    return this.aiService.streamTextForTask('CHAT_AGENT', {
      system: systemPrompt,
      messages: modelMessages,
      abortSignal,
      onFinish: async (event) => {
        console.log(`[ChatAgentAiService] onFinish: text="${event.text?.slice(0, 50)}...", finishReason=${event.finishReason}`);
        await onFinish({
          responseMessages: event.response?.messages,
          text: event.text,
        });
      },
    });
  }

  async generateSessionTitle(messages: UIMessage[]): Promise<string> {
    const userMessages = messages.filter((m) => m.role === 'user');
    if (userMessages.length === 0) return '';

    // Lấy nội dung văn bản từ 1-2 tin nhắn đầu tiên của user
    const textSnippets: string[] = [];
    for (const msg of userMessages.slice(0, 2)) {
      if (Array.isArray(msg.parts)) {
        for (const part of msg.parts) {
          if (part.type === 'text' && typeof (part as any).text === 'string') {
            textSnippets.push((part as any).text);
          }
        }
      } else if (typeof (msg as any).content === 'string') {
        textSnippets.push((msg as any).content);
      }
    }

    const promptText = textSnippets.join('\n').trim();
    if (!promptText) return '';

    try {
      console.log(`[ChatAgentAiService] Generating auto-header for prompt: "${promptText.slice(0, 80)}..."`);
      const response = await this.aiService.generateTextForTask('AUTO_HEADER', [
        { role: 'user', content: promptText.slice(0, 500) },
      ], AUTO_HEADER_SYSTEM_PROMPT);

      let rawTitle = response.text || '';
      // Làm sạch tiêu đề: loại bỏ ngoặc kép, dấu xuống dòng, tiền tố "Tiêu đề:"
      rawTitle = rawTitle
        .replace(/^["'«“`]+|["'»”`]+$/g, '')
        .replace(/^(tiêu đề|title|chủ đề):\s*/i, '')
        .replace(/\n+/g, ' ')
        .trim();

      // Giới hạn độ dài từ 3 đến 10 từ
      const words = rawTitle.split(/\s+/).filter(Boolean);
      if (words.length > 10) {
        rawTitle = words.slice(0, 10).join(' ');
      }

      console.log(`[ChatAgentAiService] Generated auto-header title: "${rawTitle}"`);
      return rawTitle;
    } catch (error: any) {
      console.warn(`[ChatAgentAiService] generateSessionTitle error: ${error?.message}`);
      return '';
    }
  }
}
